/* =========================================================
   flow.js - logika przeplywu ekranow (identyczny jak w Snake)
   ========================================================= */
window.Flow = (function () {

    let lastScore = 0;
    let rankingCount = 0;
    let rankingFetchedAt = 0;
    let nickUsed = '';
    let scoreSaved = false;
    let savedRank = null;
    let rankSubmitting = false;
    let confirmTarget = 'home';
    let pendingRetry = null;
    let errorBack = null;
    let lastEnd = null;

    const $ = function (id) { return document.getElementById(id); };

    function applyTexts(root) {
        (root || document).querySelectorAll('[data-t]').forEach(function (el) {
            const val = T(el.dataset.t);
            if (typeof val === 'string') el.textContent = val;
        });
    }

    /* ================= RANKING ================= */

    function validItems(items) {
        if (!Array.isArray(items)) return [];
        return items.filter(function (it) {
            if (!it) return false;
            if (typeof it.displayNick !== 'string') return false;
            if (!it.displayNick.trim()) return false;
            if (it.result === null || it.result === undefined) return false;
            if (it.result === '') return false;
            return Number.isFinite(Number(it.result));
        });
    }

    function hasRanking() {
        if (!CONFIG.API_ENABLED || !window.Api) return false;
        if (!CONFIG.HIDE_RANKING_IF_EMPTY) return true;
        return rankingCount > 0;
    }

    function updateRankingButtons() {
        const show = hasRanking();
        ['btn-ranking', 'btn-end-ranking'].forEach(function (id) {
            const btn = $(id);
            if (!btn) return;
            const hiddenNow = btn.classList.contains('hidden');
            if (hiddenNow === show) btn.classList.toggle('hidden', !show);
        });
    }

    async function refreshRankingCount(force) {
        if (!CONFIG.API_ENABLED || !window.Api) {
            rankingCount = 0;
            updateRankingButtons();
            return 0;
        }
        if (!force && Date.now() - rankingFetchedAt < (CONFIG.RANKING_TTL_MS || 3000)) {
            updateRankingButtons();
            return rankingCount;
        }
        try {
            const r = await Api.loadRanking(CONFIG.TOP_SIZE);
            if (!r.ok) return rankingCount;
            rankingCount = validItems(r.items).length;
            rankingFetchedAt = Date.now();
            updateRankingButtons();
            return rankingCount;
        } catch (e) {
            return rankingCount;
        }
    }

    /* ================= 1. LOADER ================= */

    Screens.on('loader', {
        enter: function () {
            const fill = $('loader-fill');
            if (fill) fill.style.width = '0%';
        }
    });

    function setLoaderProgress(pct, msgKey) {
        const fill = $('loader-fill');
        if (fill) fill.style.width = Math.round(pct) + '%';
        const msg = $('loader-msg');
        if (msg && msgKey) msg.textContent = T(msgKey);
    }

    async function boot() {
        const started = Date.now();
        Screens.go('loader', null, { replace: true });
        try {
            setLoaderProgress(15, 'loader.assets');
            if (window.Assets && Assets.loadAll) await Assets.loadAll();
            setLoaderProgress(60, 'loader.api');
            await refreshRankingCount();
            setLoaderProgress(100);
            const wait = Math.max(0, (CONFIG.LOADER_MIN_MS || 0) - (Date.now() - started));
            setTimeout(function () { Screens.go('home', null, { replace: true }); }, wait);
        } catch (e) {
            console.error('[Flow] boot', e);
            showError('error.apiDown', { retry: true });
        }
    }

    /* ================= 2. HOME ================= */

    Screens.on('home', {
        enter: function () {
            Screens.resetHistory();
            const back = document.querySelector('#screen-home .btn-back');
            if (back) back.classList.toggle('hidden', !CONFIG.SHOW_BACK_BUTTON);
            setHomeError('');
            updateRankingButtons();
            refreshRankingCount();
        }
    });

    function setHomeError(msg) {
        const el = $('home-error');
        if (!el) return;
        el.textContent = msg || '';
        el.style.display = msg ? 'block' : 'none';
    }

    /* ================= 3. HOW TO PLAY ================= */

    Screens.on('howto', {
        enter: function () {
            const list = $('howto-rules');
            if (list) {
                const rules = T('howto.rules');
                list.innerHTML = Array.isArray(rules)
                    ? rules.map(function (r) { return '<li>' + r + '</li>'; }).join('')
                    : '';
            }
            if (window.UI && UI.buildLegend) UI.buildLegend();

            Screens.watchIdle(CONFIG.IDLE_TIMEOUT_SEC, function () { Screens.back('home'); },
                { elId: 'howto-timer', textKey: 'common.idleTimer' });
        }
    });

    /* ================= 4. RANKING ================= */

    Screens.on('ranking', {
        enter: async function () {
            await renderRanking($('ranking-list'), CONFIG.TOP_SIZE);
            Screens.watchIdle(CONFIG.IDLE_TIMEOUT_SEC, function () { Screens.back('home'); },
                { elId: 'ranking-timer', textKey: 'common.idleTimer' });
        }
    });

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    async function renderRanking(box, top, mine) {
        if (!box) return;
        if (!mine || !box.children.length) box.innerHTML = '<li class="top-empty">' + T('common.loading') + '</li>';

        if (!CONFIG.API_ENABLED || !window.Api) {
            box.innerHTML = '<li class="top-empty">' + T('ranking.unavailable') + '</li>';
            return;
        }

        const r = await Api.loadRanking(top);
        if (!r.ok) {
            box.innerHTML = '<li class="top-empty">' + T('ranking.offline') + '</li>';
            return;
        }

        const items = validItems(r.items);
        rankingCount = items.length;
        rankingFetchedAt = Date.now();
        updateRankingButtons();

        if (!items.length) {
            box.innerHTML = '<li class="top-empty">' + T('ranking.empty') + '</li>';
            return;
        }

        const ownIndex = mine && nickUsed ? items.findIndex(function (it) {
            return it.displayNick === nickUsed && Number(it.result) === Number(mine.score) &&
                (!mine.position || Number(it.position) === Number(mine.position));
        }) : -1;
        let html = items.map(function (it, index) {
            const me = index === ownIndex ? ' class="me" aria-current="true"' : '';
            return '<li' + me + '><span class="rank">' + esc(it.position) + '.</span>' +
                '<span class="nick">' + esc(it.displayNick) + '</span>' +
                '<span class="pts">' + esc(it.result) + '</span></li>';
        }).join('');
        if (mine && ownIndex < 0) {
            html += '<li class="me is-outside" aria-current="true"><span class="rank">' +
                esc(mine.position || '\u2013') + '.</span><span class="nick">' +
                esc(nickUsed || T('ranking.yourResult')) + '</span><span class="pts">' +
                esc(mine.score) + '</span></li>';
        }
        box.innerHTML = html;
        if (mine) requestAnimationFrame(function () { scrollToSavedRank(box); });
    }

    /* ================= 5. CONFIRM ================= */

    Screens.on('confirm', {
        enter: function (data) {
            confirmTarget = (data && data.target) || 'home';
        }
    });

    function confirmExit(target) {
        Screens.go('confirm', { target: target || 'home' });
    }

    /* ================= 6. GAMEEND ================= */

    Screens.on('gameend', {
        enter: function (data) {
            const score = data.score !== undefined ? data.score : lastScore;
            lastScore = score;
            lastEnd = data.end !== undefined ? data.end : lastEnd;

            const won = score > 0;

            $('end-title').textContent = won ? T('gameend.win.title') : T('gameend.lose.title');

            const sc = $('end-score');
            sc.textContent = won ? T('gameend.win.score', { score: score }) : '';
            sc.classList.toggle('hidden', !won);

            $('end-message').textContent =
                !won       ? T('gameend.lose.message')
              : scoreSaved ? T('gameend.win.savedInfo')
              :              T('gameend.win.subtitle');

            const isSuspicious = !!(lastEnd && lastEnd.suspicious);

            const canPrize = CONFIG.API_ENABLED && lastEnd && lastEnd.eligible && !isSuspicious;
            $('btn-prize').classList.toggle('hidden', !canPrize);

            // const canRank = won && CONFIG.API_ENABLED &&
            //                 score >= CONFIG.NICK_MIN_SCORE &&
            //                 !scoreSaved && !isSuspicious;
            const canRank = won && CONFIG.API_ENABLED &&
                            lastEnd && lastEnd.rankingActive &&
                            score >= CONFIG.NICK_MIN_SCORE &&
                            !scoreSaved && !isSuspicious;
            $('btn-addrank').classList.toggle('hidden', !canRank);

            updateRankingButtons();
            refreshRankingCount(true);

            const timerEl = $('end-timer');
            const sec = won ? (CONFIG.WIN_REDIRECT_SEC || 0) : (CONFIG.LOSE_REDIRECT_SEC || 0);

            if (sec > 0) {
                let left = sec;
                timerEl.classList.remove('hidden');
                timerEl.textContent = T('gameend.timer', { sec: left });
                Screens.interval(function () {
                    left--;
                    if (left <= 0) { Screens.go('home'); return; }
                    timerEl.textContent = T('gameend.timer', { sec: left });
                }, 1000);
            } else {
                timerEl.classList.add('hidden');
            }
        }
    });

    /* ================= 7. ADDTORANKING ================= */

    Screens.on('addrank', {
        enter: function (data) {
            const score = data.score !== undefined ? data.score : lastScore;
            updateRankSavedView();
            if (scoreSaved) {
                renderRanking($('addrank-list'), CONFIG.TOP_SIZE, savedRank);
                startAddRankIdle();
                return;
            }
            $('addrank-score').textContent = T('addrank.score', { score: score });

            const input = $('nick-input');
            input.value = '';
            input.disabled = false;
            input.placeholder = T('addrank.placeholder');
            input.maxLength = CONFIG.NICK_MAX_LENGTH;

            $('btn-nick-add').disabled = false;
            setRankStatus('', null);
            $('addrank-box').classList.remove('is-done', 'hidden');

            renderRanking($('addrank-list'), CONFIG.TOP_SIZE);
            Screens.timeout(function () { if (!scoreSaved && Screens.current() === 'addrank') input.focus(); }, 150);

            startAddRankIdle();
        }
    });

    let rankMotion = Promise.resolve();
    function reducedRankMotion() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    function scrollToSavedRank(box) {
        rankMotion.then(function () {
            if (!box.isConnected || Screens.current() !== 'addrank') return;
            const row = box.querySelector('li.me');
            if (!row) return;
            const a = box.getBoundingClientRect(), r = row.getBoundingClientRect();
            const top = Math.max(0, box.scrollTop + r.top - a.top - box.clientTop - (box.clientHeight - r.height) / 2);
            box.scrollTo({ top: top, behavior: reducedRankMotion() ? 'instant' : 'smooth' });
            row.classList.add('rank-reveal');
        });
    }
    async function animateRankSavedView() {
        const screen = $('screen-addrank');
        if (Screens.current() !== 'addrank' || reducedRankMotion()) {
            updateRankSavedView();
            return;
        }
        const nodes = [screen.querySelector('.addrank-info'), $('addrank-box')].filter(Boolean);
        screen.classList.add('rank-saving-motion');
        const animations = nodes.filter(function (node) { return node.animate; }).map(function (node) {
            const st = getComputedStyle(node);
            return node.animate([
                { height: node.getBoundingClientRect().height + 'px', opacity: st.opacity,
                  marginTop: st.marginTop, marginBottom: st.marginBottom, paddingTop: st.paddingTop,
                  paddingBottom: st.paddingBottom, borderTopWidth: st.borderTopWidth, borderBottomWidth: st.borderBottomWidth },
                { height: '0px', opacity: 0, marginTop: '0px', marginBottom: '0px', paddingTop: '0px',
                  paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px' }
            ], { duration: 300, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards' });
        });
        await Promise.all(animations.map(function (a) { return a.finished.catch(function () {}); }));
        updateRankSavedView();
        animations.forEach(function (a) { a.cancel(); });
        screen.classList.remove('rank-saving-motion');
        const summary = $('addrank-summary');
        if (summary && summary.animate && Screens.current() === 'addrank') {
            summary.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
        }
    }
    function updateRankSavedView() {
        const screen = $('screen-addrank');
        screen.classList.toggle('rank-saved', scoreSaved);
        const title = screen.querySelector('[data-t="addrank.title"]');
        if (title) title.textContent = T(scoreSaved ? 'addrank.savedTitle' : 'addrank.title');
        let summary = $('addrank-summary');
        if (!summary) {
            summary = document.createElement('p');
            summary.id = 'addrank-summary';
            summary.className = 'rank-status is-ok';
            summary.setAttribute('role', 'status');
            $('addrank-box').insertAdjacentElement('afterend', summary);
        }
        summary.style.display = scoreSaved ? 'block' : 'none';
        summary.textContent = scoreSaved ? (savedRank && savedRank.position
            ? T('addrank.savedAt', { position: savedRank.position }) : T('addrank.savedPlain')) : '';
    }
    function startAddRankIdle() {
        Screens.watchIdle(CONFIG.IDLE_TIMEOUT_SEC, function () { Screens.back('gameend'); },
            { elId: 'addrank-timer', textKey: 'common.idleTimer' });
    }

    function setRankStatus(msg, kind) {
        const el = $('addrank-status');
        if (!el) return;
        el.textContent = msg || '';
        el.style.display = msg ? 'block' : 'none';
        el.classList.toggle('is-ok', kind === 'ok');
        el.classList.toggle('is-wait', kind === 'wait');
        el.classList.toggle('is-err', kind === 'err');
    }

    function unlockNickForm(input) {
        input.disabled = false;
        $('btn-nick-add').disabled = false;
        $('addrank-box').classList.remove('is-done');
    }

    async function submitNick() {
        if (rankSubmitting || scoreSaved) return;
        const input = $('nick-input');
        const nick = input.value.trim();

        if (!nick) {
            setRankStatus(T('addrank.errEmpty'), 'err');
            input.focus();
            return;
        }
        if (nick.length < CONFIG.NICK_MIN_LENGTH) {
            setRankStatus(T('addrank.errTooShort', { min: CONFIG.NICK_MIN_LENGTH }), 'err');
            input.focus();
            return;
        }

        rankSubmitting = true;
        input.disabled = true;
        $('btn-nick-add').disabled = true;
        $('addrank-box').classList.add('is-done');
        setRankStatus(T('addrank.saving'), 'wait');

        /* pauza idle timera na czas moderacji/zapisu */
        Screens.stopIdle();
        const timerEl = $('addrank-timer');
        if (timerEl) timerEl.classList.add('hidden');

        try {
            const r = await Api.addToRanking(nick);

            if (r.code === 'NICK_NOT_ALLOWED') {
                unlockNickForm(input);
                setRankStatus(T('addrank.errNickNotAllowed'), 'err');
                input.focus(); input.select();
                return;
            }
            if (r.code === 'NICK_INVALID_FORMAT') {
                unlockNickForm(input);
                setRankStatus(T('addrank.errNickFormat'), 'err');
                input.focus();
                return;
            }
            if (r.code === 'NICK_MODERATION_UNAVAILABLE') {
                unlockNickForm(input);
                setRankStatus(T('addrank.errModerationUnavailable'), 'err');
                return;
            }
            if (r.code === 'SESSION_NOT_ELIGIBLE') {
                $('addrank-box').classList.add('hidden');
                setRankStatus(T('addrank.errNotEligible'), 'err');
                return;
            }

            if (r.ok || r.code === 'ALREADY_SAVED') {
                nickUsed = nick;
                scoreSaved = true;
                savedRank = { score: lastScore, position: r.position || null };
                input.blur();
                rankMotion = animateRankSavedView();
                await rankMotion;
                await renderRanking($('addrank-list'), CONFIG.TOP_SIZE, savedRank);
            } else {
                unlockNickForm(input);
                setRankStatus(T('addrank.errRetry'), 'err');
            }
        } catch (e) {
            if (!scoreSaved) {
                unlockNickForm(input);
                setRankStatus(T('addrank.errRetry'), 'err');
            }

        } finally {
            rankSubmitting = false;
            if (Screens.current() === 'addrank') {
                if (timerEl) timerEl.classList.remove('hidden');
                startAddRankIdle();
            }
        }
    }

    /* ================= 8. PRIZE ================= */

    async function claimAndShowPrize() {
        const btn = $('btn-prize');
        const label = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = T('prize.loading'); }

        let r;
        try {
            r = await Api.claimPrize();
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = label; }
        }

        if (r.ok) { Screens.go('prize', { prize: r.prize }); return; }
        showPrizeError(prizeErrorText(r), r.code === 'NETWORK');
    }

    function prizeErrorText(r) {
        switch (r.code) {
            case 'NO_FREE_CODE':         return T('prize.errNoCodes');
            case 'CODES_DISABLED':       return T('prize.errDisabled');
            case 'CLAIM_WINDOW_EXPIRED': return T('prize.errExpired');
            case 'SESSION_NOT_ELIGIBLE': return T('prize.errNotEligible');
            case 'NETWORK':              return T('prize.errNetwork');
            default:                     return T('prize.errGeneric');
        }
    }

    function showPrizeError(message, canRetry) {
        pendingRetry = canRetry ? claimAndShowPrize : null;
        Screens.go('error', { message: message, retry: canRetry, back: 'gameend' });
    }

    Screens.on('prize', {
        enter: function (data) {
            const prize = (data && data.prize) || Api.getPrize();
            if (!prize) { Screens.back('gameend'); return; }

            $('prize-code').textContent = prize.code;
            $('prize-code').style.setProperty('--voucher-code-size', Math.min(16, 150 / Math.max(1, Array.from(String(prize.code)).length)) + 'cqw');
            $('prize-code').classList.remove('is-empty');
            $('prize-type').textContent = prize.typeName || '';
            $('prize-hint').textContent = T('prize.screenHint');

            $('btn-copy').classList.toggle('hidden', !CONFIG.PRIZE_ALLOW_COPY);
            $('btn-download').classList.toggle('hidden', !CONFIG.PRIZE_ALLOW_DOWNLOAD);
            $('copy-label').textContent = T('prize.copy');

            prepareVoucher(prize.code, prize.typeName);
            startPrizeIdle();
        }
    });
    function startPrizeIdle() {
        Screens.watchIdle(CONFIG.IDLE_TIMEOUT_SEC, function () { Screens.back('gameend'); },
            { elId: 'prize-timer', textKey: 'common.idleTimer' });
    }

    function copyCode() {
        const code = $('prize-code').textContent;
        if (!code || code === '\u2014') return;

        const done = function () {
            $('copy-label').textContent = T('prize.copied');
            Screens.timeout(function () { $('copy-label').textContent = T('prize.copy'); }, 2000);
        };

        function fallbackCopy() {
            const ta = document.createElement('textarea');
            ta.value = code;
            ta.style.cssText = 'position:fixed;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); done(); } catch (e) {}
            ta.remove();
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(done).catch(fallbackCopy);
        } else fallbackCopy();
    }

    function wrapText(ctx, text, cx, y, maxW, lh) {
        const words = String(text).split(' ');
        let line = '';
        for (const w of words) {
            const test = line ? line + ' ' + w : w;
            if (ctx.measureText(test).width > maxW && line) {
                ctx.fillText(line, cx, y);
                y += lh;
                line = w;
            } else line = test;
        }
        if (line) ctx.fillText(line, cx, y);
    }

    /* ================= VOUCHER (obraz z kodem do pobrania) =================
       Pionowy 1080x1350: scena gry na dole, bilet z logotypami Visa | KFC,
       tytul gry, kod, instrukcja, stopka (prize.footer - opcjonalna).
       Obraz generuje sie od razu po wejsciu na ekran nagrody, wiec klik
       "Pobierz" nie czeka (wazne dla iPhone / navigator.share).
       ===================================================================== */
    const VOUCHER = {
        W: 1080, H: 1350,
        BG: 'assets/images/home-bg.jpg',             /* tlo gry */
        LOGO_VISA: 'assets/images/logo-visa.png',
        LOGO_PARTNER: 'assets/images/logo-kfc.png',  /* null = samo Visa */
        FONT_PIXEL: '"PressStart2P", monospace'
    };
    let voucherFile = null;
    let voucherToken = 0;

    function loadImg(src) {
        return new Promise(function (res) {
            if (!src) return res(null);
            const i = new Image();
            i.onload = function () { res(i); };
            i.onerror = function () { res(null); };   /* brak pliku = pomijamy warstwe */
            i.src = src;
        });
    }
    /* logo wpasowane w prostokat; radius > 0 = zaokraglone rogi (logo z tlem, np. KFC) */
    function fitLogo(x, img, cx, cy, maxW, maxH, radius) {
        if (!img) return;
        const s = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
        const w = img.naturalWidth * s, h = img.naturalHeight * s;
        const l = cx - w / 2, t = cy - h / 2;
        if (radius) {
            x.save();
            x.beginPath(); x.roundRect(l, t, w, h, radius); x.clip();
            x.drawImage(img, l, t, w, h);
            x.restore();
        } else {
            x.drawImage(img, l, t, w, h);
        }
    }
    /* bilet: prostokat z zaokragleniem i polkolistymi wycieciami po bokach */
    function ticketPath(x, l, t, w, h, r, notchY, notchR) {
        x.beginPath();
        x.moveTo(l + r, t);
        x.lineTo(l + w - r, t); x.arcTo(l + w, t, l + w, t + r, r);
        x.lineTo(l + w, notchY - notchR);
        x.arc(l + w, notchY, notchR, -Math.PI / 2, Math.PI / 2, true);
        x.lineTo(l + w, t + h - r); x.arcTo(l + w, t + h, l + w - r, t + h, r);
        x.lineTo(l + r, t + h); x.arcTo(l, t + h, l, t + h - r, r);
        x.lineTo(l, notchY + notchR);
        x.arc(l, notchY, notchR, Math.PI / 2, -Math.PI / 2, true);
        x.lineTo(l, t + r); x.arcTo(l, t, l + r, t, r);
        x.closePath();
    }
    async function drawVoucher(code, rewardName) {
        const W = VOUCHER.W, H = VOUCHER.H;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const x = c.getContext('2d');
        const imgs = await Promise.all([
            loadImg(VOUCHER.BG), loadImg(VOUCHER.LOGO_VISA), loadImg(VOUCHER.LOGO_PARTNER)
        ]);
        const bg = imgs[0], visa = imgs[1], partner = imgs[2];
        try { await document.fonts.load('40px ' + VOUCHER.FONT_PIXEL); } catch (e) {}

        /* 1. tlo: cala scena gry na dole (szerokosc 100%), niebo dociagniete do gory */
        x.fillStyle = '#0a0d33'; x.fillRect(0, 0, W, H);
        if (bg) {
            const sh = Math.round(bg.naturalHeight * W / bg.naturalWidth);
            const sceneTop = H - sh;
            x.drawImage(bg, 0, 0, bg.naturalWidth, 2, 0, 0, W, sceneTop + 2);
            const sky = x.createLinearGradient(0, 0, 0, sceneTop);
            sky.addColorStop(0, 'rgba(7,10,38,.55)');
            sky.addColorStop(1, 'rgba(7,10,38,0)');
            x.fillStyle = sky; x.fillRect(0, 0, W, sceneTop + 2);
            x.imageSmoothingEnabled = false;
            x.drawImage(bg, 0, sceneTop, W, sh);
            x.imageSmoothingEnabled = true;
        }
        const foot = x.createLinearGradient(0, H - 170, 0, H);
        foot.addColorStop(0, 'rgba(7,10,38,0)');
        foot.addColorStop(1, 'rgba(7,10,38,.85)');
        x.fillStyle = foot; x.fillRect(0, H - 170, W, 170);

        /* 2. bilet */
        const L = 90, TOP = 56, BW = W - 180, BH = 804, notchY = TOP + 230;
        ticketPath(x, L, TOP, BW, BH, 36, notchY, 34);
        const card = x.createLinearGradient(0, TOP, 0, TOP + BH);
        card.addColorStop(0, 'rgba(22,28,82,.94)');
        card.addColorStop(1, 'rgba(10,13,51,.97)');
        x.fillStyle = card;
        x.shadowColor = 'rgba(247,182,0,.45)'; x.shadowBlur = 44;
        x.fill();
        x.shadowBlur = 0;
        x.lineWidth = 4; x.strokeStyle = '#F7B600'; x.stroke();

        /* 3. logotypy: Visa | KFC */
        const logoY = TOP + 115;
        if (partner) {
            fitLogo(x, visa, W / 2 - 190, logoY, 270, 90);
            x.fillStyle = 'rgba(152,160,208,.5)'; x.fillRect(W / 2 - 1, logoY - 55, 2, 110);
            fitLogo(x, partner, W / 2 + 190, logoY, 230, 126, 14);
        } else {
            fitLogo(x, visa, W / 2, logoY, 340, 110);
        }
        /* linia perforacji miedzy wycieciami */
        x.setLineDash([14, 12]); x.lineWidth = 3;
        x.strokeStyle = 'rgba(247,182,0,.55)';
        x.beginPath(); x.moveTo(L + 50, notchY); x.lineTo(L + BW - 50, notchY); x.stroke();
        x.setLineDash([]);

        /* 4. tytul gry (pixel) */
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillStyle = '#FFC22E';
        x.font = '44px ' + VOUCHER.FONT_PIXEL;
        const title = String(T('home.title')).replace(/\s+/g, ' ').trim().toUpperCase();
        while (x.measureText(title).width > BW - 100) {
            x.font = x.font.replace(/(\d+)px/, function (m, n) { return (n - 2) + 'px'; });
        }
        x.shadowColor = '#3a1d00'; x.shadowOffsetX = 4; x.shadowOffsetY = 4;
        x.fillText(title, W / 2, notchY + 95);
        x.shadowColor = 'transparent'; x.shadowOffsetX = 0; x.shadowOffsetY = 0;
        if (rewardName) {
            x.fillStyle = '#d5dcff';
            let rewardSize = 30;
            x.font = rewardSize + 'px Inter, system-ui, sans-serif';
            while (x.measureText(String(rewardName)).width > 760 && rewardSize > 12) {
                x.font = (--rewardSize) + 'px Inter, system-ui, sans-serif';
            }
            x.fillText(String(rewardName), W / 2, notchY + 162, 760);
        }
        x.fillStyle = '#98a0d0';
        x.font = '600 30px Inter, system-ui, sans-serif';
        x.fillText(T('prize.title'), W / 2, notchY + 224);
        /* 5. kod w ramce */
        const boxW = BW - 140, boxH = 150, boxY = notchY + 264;
        x.fillStyle = 'rgba(7,10,38,.9)';
        x.beginPath(); x.roundRect(W / 2 - boxW / 2, boxY, boxW, boxH, 22); x.fill();
        x.setLineDash([18, 12]); x.lineWidth = 4; x.strokeStyle = '#F7B600'; x.stroke(); x.setLineDash([]);
        x.fillStyle = '#FFC22E';
        x.font = '800 92px Consolas, "Courier New", monospace';
        while (x.measureText(code).width > boxW - 70) {
            x.font = x.font.replace(/(\d+)px/, function (m, n) { return (n - 2) + 'px'; });
        }
        x.fillText(code, W / 2, boxY + boxH / 2 + 4);

        /* 6. instrukcja */
        x.fillStyle = '#d5dcff';
        x.font = '400 34px Inter, system-ui, sans-serif';
        x.textBaseline = 'alphabetic';
        wrapText(x, T('prize.voucherHint'), W / 2, boxY + boxH + 80, boxW, 46);

        /* 7. stopka pod biletem - tylko gdy jest prize.footer w texts.js */
        const footer = T('prize.footer');
        if (typeof footer === 'string' && footer && footer.indexOf('prize.') !== 0 && footer.charAt(0) !== '[') {
            x.fillStyle = 'rgba(232,236,255,.85)';
            x.font = '400 26px Inter, system-ui, sans-serif';
            x.fillText(footer, W / 2, H - 44);
        }
        return c;
    }
    function prepareVoucher(code, rewardName) {
        voucherFile = null;
        const token = ++voucherToken;               /* starszy render nie nadpisze nowszego */
        drawVoucher(code, rewardName).then(function (c) {
            c.toBlob(function (blob) {
                if (!blob || token !== voucherToken) return;
                voucherFile = new File([blob], 'nagroda-' + code + '.png', { type: 'image/png' });
            }, 'image/png');
        }).catch(function (e) { console.error('[Flow] voucher', e); });
    }
    /** Android: menu udostepniania. Pozostale (iPhone, desktop): zwykle pobieranie. */
    function downloadPrize() {
        if (!voucherFile) return;          /* jeszcze sie generuje (ulamek sekundy) */
        const isAndroid = /Android/i.test(navigator.userAgent);
        if (isAndroid && navigator.canShare && navigator.canShare({ files: [voucherFile] })) {
            Screens.stopIdle();
            navigator.share({ files: [voucherFile] })
                .catch(function () {})     /* anulowanie = AbortError, ignorujemy */
                .finally(startPrizeIdle);
            return;
        }
        /* iPhone / desktop: zwykle pobieranie (link musi byc w DOM) */
        const url = URL.createObjectURL(voucherFile);
        const a = document.createElement('a');
        a.href = url;
        a.download = voucherFile.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }

    /* ================= 9. ERROR ================= */

    Screens.on('error', {
        enter: function (data) {
            $('error-msg').textContent = data.message || T('error.generic');
            $('btn-error-retry').classList.toggle('hidden', !data.retry);

            const quit = $('btn-error-quit');
            if (quit) quit.textContent = data.back === 'gameend' ? T('common.back') : T('error.quit');
            errorBack = data.back || null;

            if (errorBack === 'gameend') {
                Screens.watchIdle(CONFIG.IDLE_TIMEOUT_SEC,
                    function () { errorBack = null; Screens.back('gameend'); },
                    { elId: 'error-timer', textKey: 'common.idleTimer' });
            }
        }
    });

    function showError(textKey, opts) {
        opts = opts || {};
        Screens.go('error', { message: T(textKey), retry: !!opts.retry });
    }

    function errorTextFor(code, network) {
        if (code === 'NO_FREE_CODE') return T('error.noFreeCode');
        if (network)                 return T('error.network');
        return T('error.generic');
    }

    /* ================= NAWIGACJA POWROTU ================= */

    function goBack(target) {
        switch (target) {
            case 'exit':
                if (CONFIG.BACK_URL) location.href = CONFIG.BACK_URL;
                else history.back();
                break;
            case 'confirm':
                if (window.Game && Game.pause) Game.pause();
                confirmExit('home');
                break;
            case 'gameend':
                Screens.back('gameend');
                break;
            case 'auto':
                Screens.back('home');
                break;
            case 'home':
            default:
                Screens.go('home');
        }
    }

    /* ================= PRZYCISKI ================= */

    function bind() {
        const click = function (id, fn) {
            const el = $(id);
            if (el) el.addEventListener('click', fn);
        };

        document.querySelectorAll('.btn-back').forEach(function (btn) {
            btn.addEventListener('click', function () { goBack(btn.dataset.back); });
        });

        click('btn-play',    function () { startGame(); });
        click('btn-howto',   function () { Screens.go('howto'); });
        click('btn-ranking', function () { Screens.go('ranking'); });

        click('btn-howto-play', function () { startGame(); });
        click('btn-rank-play',  function () { startGame(); });

        click('btn-prize',       function () { claimAndShowPrize(); });
        click('btn-addrank',     function () { Screens.go('addrank', { score: lastScore }); });
        click('btn-again',       function () { startGame(); });
        click('btn-end-ranking', function () { Screens.go('ranking'); });

        click('btn-nick-add', submitNick);
        const nick = $('nick-input');
        if (nick) nick.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') submitNick();
        });

        click('btn-copy',     copyCode);
        click('btn-download', downloadPrize);

        click('btn-confirm-yes', function () {
            if (window.Game && Game.stop) Game.stop();
            Screens.go(confirmTarget, null, { replace: true });
        });
        click('btn-confirm-no', function () {
            Screens.back('game');
            if (window.Game && Game.resume) Game.resume();
        });

        click('btn-error-retry', function () {
            const fn = pendingRetry;
            pendingRetry = null;
            if (fn) fn(); else boot();
        });
        click('btn-error-quit', function () {
            if (errorBack === 'gameend') { errorBack = null; Screens.back('gameend'); }
            else goBack('exit');
        });
    }

    /* ================= START GRY ================= */

    async function startGame() {
        setHomeError('');

        const btns = ['btn-play', 'btn-howto-play', 'btn-rank-play', 'btn-again'];
        btns.forEach(function (id) { const b = $(id); if (b) b.disabled = true; });

        const r = await Api.startSession();

        btns.forEach(function (id) { const b = $(id); if (b) b.disabled = false; });

        if (!r.ok) {
            const msg = errorTextFor(r.code, r.network);
            if (r.code === 'NO_FREE_CODE') {
                if (Screens.current() === 'home') setHomeError(msg);
                else Screens.go('home');
                return;
            }
            showError(r.network ? 'error.network' : 'error.generic', { retry: true });
            return;
        }

        /* nowa rozgrywka = nowa sesja, mozna znow zapisac wynik */
        scoreSaved = false;
        savedRank = null;
        nickUsed = '';

        Screens.go('game', null, { replace: true });
        if (window.Game && Game.start) Game.start();
    }

    function onGameOver(score, end) {
        lastScore = score;
        lastEnd = end;
        Screens.go('gameend', { score: score, end: end }, { replace: true });
    }

    function init() {
        applyTexts();
        bind();
        boot();
    }

    return {
        init: init, boot: boot, startGame: startGame, onGameOver: onGameOver,
        goBack: goBack, confirmExit: confirmExit,
        showError: showError, errorTextFor: errorTextFor,
        renderRanking: renderRanking, applyTexts: applyTexts, hasRanking: hasRanking,
        getScore: function () { return lastScore; },
        getEnd: function () { return lastEnd; },
        isScoreSaved: function () { return scoreSaved; }
    };
})();
