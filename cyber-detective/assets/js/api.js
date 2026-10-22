/* =========================================================
   api.js - integracja z GameApi (identyczny jak w Snake,
   klucze localStorage "gameapi.*" - nie koliduja ze Snake)
   ========================================================= */
window.Api = (function () {

    const LS_QUEUE   = 'gameapi.outbox';
    const LS_SESSION = 'gameapi.session';

    let session  = null;
    let queue    = [];
    let flushing = false;
    let flushTimer = null;

    const TERMINAL = new Set([
        'SESSION_ALREADY_ENDED', 'SESSION_NOT_FOUND', 'SESSION_GAME_MISMATCH',
        'GAME_NOT_FOUND', 'UNKNOWN_EVENT_NAME', 'EVENT_DETAILS_NOT_JSON',
        'RESULT_REQUIRED', 'NICK_REQUIRED', 'RANKING_ENTRY_ALREADY_EXISTS',
        'SESSION_HAS_NO_RESULT', 'INVALID_SESSION_TOKEN',
        'SESSION_NOT_ELIGIBLE', 'CLAIM_WINDOW_EXPIRED', 'CODES_DISABLED',
        'NICK_NOT_ALLOWED', 'NICK_INVALID_FORMAT'
    ]);

    const DENY = new Set([
        'SESSION_NOT_ELIGIBLE', 'CLAIM_WINDOW_EXPIRED', 'CODES_DISABLED', 'NO_FREE_CODE'
    ]);

    function load(key, fb) {
        try { const v = JSON.parse(localStorage.getItem(key)); return v === null ? fb : v; }
        catch (e) { return fb; }
    }
    function save(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
    }
    function persistQueue() { save(LS_QUEUE, queue); }

    function base() { return (CONFIG.API_BASE_URL || '').replace(/\/+$/, ''); }
    function isOnline() { return !navigator || navigator.onLine !== false; }

    async function http(method, path, body, token) {
        const headers = {};
        if (body) headers['Content-Type'] = 'application/json';
        if (token) headers['X-Game-Token'] = token;

        const src = window.Source ? Source.get() : CONFIG.API_SOURCE_DEFAULT;
        if (src) headers['X-Source'] = src;

        const ctrl = new AbortController();
        const t = setTimeout(function () { ctrl.abort(); }, CONFIG.API_TIMEOUT_MS);

        try {
            const r = await fetch(base() + path, {
                method: method,
                headers: headers,
                body: body ? JSON.stringify(body) : undefined,
                signal: ctrl.signal
            });
            const text = await r.text();
            let data = null;
            try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
            return { ok: r.ok, status: r.status, data: data, code: (data && data.code) || null };
        } catch (e) {
            return { ok: false, status: 0, data: null, code: null, network: true };
        } finally {
            clearTimeout(t);
        }
    }

    function event(name, details, token, uid) {
        return http('POST', '/api/event', {
            gameId: CONFIG.API_GAME_ID,
            sessionUid: uid || null,
            eventName: name,
            eventDetails: details || null
        }, token);
    }

    async function startSession() {
        if (!CONFIG.API_ENABLED) { session = null; return { ok: true, demo: true }; }

        const start = await event('GameStart', { client: CONFIG.API_CLIENT_TAG }, null, null);
        if (!start.ok) {
            console.warn('[Api] GameStart:', start.code || start.status);
            return { ok: false, code: start.code || 'NETWORK', network: start.network };
        }

        const d = start.data.data || {};
        session = {
            uid: start.data.uid, token: d.token, startedAt: Date.now(),
            ended: false, eligible: false, suspicious: false, prizeName: null,
            prize: null, claiming: false, ranked: false, ranking: false
        };
        save(LS_SESSION, session);
        return { ok: true };
    }

    function enqueue(name, details) {
        if (!CONFIG.API_ENABLED || !session) return;
        queue.push({
            id: name + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
            uid: session.uid, token: session.token, name: name, details: details, attempts: 0
        });
        persistQueue();
        flush();
    }

    async function flush() {
        if (flushing || !queue.length) return;
        if (!isOnline()) return;
        flushing = true;
        clearTimeout(flushTimer);
        try {
            while (queue.length) {
                const item = queue[0];
                const r = await event(item.name, item.details, item.token, item.uid);
                if (r.ok) { queue.shift(); persistQueue(); continue; }
                if (r.code && TERMINAL.has(r.code)) { queue.shift(); persistQueue(); continue; }
                item.attempts++;
                persistQueue();
                if (item.attempts >= CONFIG.API_MAX_ATTEMPTS) { queue.shift(); persistQueue(); continue; }
                const delay = Math.min(20000, 800 * Math.pow(2, item.attempts - 1));
                flushTimer = setTimeout(flush, delay);
                break;
            }
        } finally {
            flushing = false;
        }
    }

    async function endGame(score, durationMs, events) {
        if (!session || session.ended) return { ok: false, eligible: false, code: 'NO_SESSION' };

        session.ended = true;
        save(LS_SESSION, session);

        const details = {
            result: score,
            durationMs: durationMs || (Date.now() - session.startedAt),
            events: Array.isArray(events) ? events : []
        };

        const r = await event('GameEnd', details, session.token, session.uid);

        if (!r.ok) {
            if (!r.code || !TERMINAL.has(r.code)) enqueue('GameEnd', details);
            return { ok: false, eligible: false, code: r.code || 'NETWORK', network: r.network };
        }

        const d = (r.data && r.data.data) || {};
        session.eligible   = !!d.codeEligible;
        session.suspicious = !!d.suspicious;
        session.rankingActive = !!d.rankingActive;
        session.prizeName  = d.prizeName || null;
        save(LS_SESSION, session);

        return {
            ok: true, eligible: session.eligible, suspicious: session.suspicious,
            rankingActive: session.rankingActive,prizeName: session.prizeName, result: d.result
        };
    }

    async function claimPrize() {
        if (!CONFIG.API_ENABLED) return { ok: false, code: 'DEMO' };
        if (!session)            return { ok: false, code: 'NO_SESSION' };
        if (session.prize)       return { ok: true, prize: session.prize, cached: true };
        if (session.claiming)    return { ok: false, code: 'IN_PROGRESS' };
        session.claiming = true;

        try {
            const r = await event('GameCodeIssue', null, session.token, session.uid);
            if (!r.ok) {
                return {
                    ok: false, code: r.code || 'NETWORK', network: r.network,
                    deny: !!(r.code && DENY.has(r.code))
                };
            }
            const d = (r.data && r.data.data) || {};
            if (!d.code) return { ok: false, code: 'NO_CODE_IN_RESPONSE' };

            session.prize = {
                code: d.code,
                codeId: d.codeId,
                typeId: d.typeId,
                typeName: d.typeName || null,
                validToText: typeof d.validToText === 'string' ? d.validToText.trim() : ''
            };
            save(LS_SESSION, session);
            return { ok: true, prize: session.prize, alreadyIssued: !!d.alreadyIssued };
        } finally {
            session.claiming = false;
        }
    }

    function addToRanking(nick) {
        if (!session)        return Promise.resolve({ ok: false, code: 'NO_SESSION' });
        if (session.ranked)  return Promise.resolve({ ok: false, code: 'ALREADY_SAVED' });
        if (session.ranking) return Promise.resolve({ ok: false, code: 'IN_PROGRESS' });
        if (!nick || !nick.trim()) return Promise.resolve({ ok: false, code: 'NICK_REQUIRED' });

        const clean = nick.trim().slice(0, CONFIG.NICK_MAX_LENGTH);
        session.ranking = true;

        return event('GameRankingAdd', { nick: clean, displayNick: clean }, session.token, session.uid)
            .then(function (r) {
                session.ranking = false;
                if (r.ok || r.code === 'RANKING_ENTRY_ALREADY_EXISTS') {
                    session.ranked = true;
                    save(LS_SESSION, session);
                    return { ok: true, position: r.data && r.data.data && r.data.data.position };
                }
                save(LS_SESSION, session);
                return { ok: false, code: r.code || 'NETWORK', network: r.network };
            });
    }

    async function loadRanking(top) {
        if (!CONFIG.API_ENABLED) return { ok: false, items: [] };
        const r = await http('GET',
            '/api/ranking-list?gameId=' + CONFIG.API_GAME_ID + '&top=' + (top || CONFIG.TOP_SIZE),
            null, null);
        if (!r.ok || !r.data) return { ok: false, items: [] };
        return { ok: true, items: r.data.items || [] };
    }

    function init() {
        queue = load(LS_QUEUE, []);
        const prev = load(LS_SESSION, null);
        if (prev && queue.length) session = prev;
        window.addEventListener('online', flush);
        document.addEventListener('visibilitychange', function () { if (!document.hidden) flush(); });
        flush();
    }

    init();

    return {
        init: init, startSession: startSession, endGame: endGame, claimPrize: claimPrize,
        addToRanking: addToRanking, loadRanking: loadRanking, flush: flush,
        getSession: function () { return session; },
        getPrize:   function () { return session && session.prize; },
        isEligible: function () { return !!(session && session.eligible); },
        pending:    function () { return queue.length; },
        isDemo:     function () { return !CONFIG.API_ENABLED; }
    };
})();
