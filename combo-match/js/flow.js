/* =========================================================
   flow.js — logika przepływu ekranów Memory

   Spina Screens (router), UI i Api (dane).
   Cała nawigacja jest tutaj — game.js zajmuje się tylko rozgrywką.
   ========================================================= */
window.Flow = (function () {

    let lastScore = 0;
    let rankingCount = 0;
    let rankingFetchedAt = 0;
    let nickUsed = '';
    let scoreSaved = false;
    let confirmTarget = 'home';
    let pendingRetry = null;
    let errorBack = null;
    let lastEnd = null;

    const $ = id => document.getElementById(id);

    /* =====================================================
       Podstawianie tekstów przez atrybut data-t
       ===================================================== */

    function applyTexts(root) {
        (root || document).querySelectorAll('[data-t]').forEach(el => {
            const val = T(el.dataset.t);
            if (typeof val === 'string') {
                if (val.includes('<')) {
                    el.innerHTML = val;
                } else {
                    el.textContent = val;
                }
            }
        });
    }

    /* =====================================================
       RANKING — wspólna logika
       ===================================================== */

    function validItems(items) {
        if (!Array.isArray(items)) return [];
        return items.filter(it => {
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
        ['btn-ranking', 'btn-end-ranking'].forEach(id => {
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

    /* =====================================================
       1. LOADER
       ===================================================== */

    Screens.on('loader', {
        enter() {
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

            /* Preload card images */
            const images = [
                ...(CONFIG.CARD_IMAGES_K || []),
                ...(CONFIG.CARD_IMAGES_V || []),
            ];
            const loadPromises = images.map(img => {
                return new Promise(resolve => {
                    const i = new Image();
                    i.onload = resolve;
                    i.onerror = resolve;
                    i.src = img.src;
                });
            });
            await Promise.all(loadPromises);

            setLoaderProgress(60, 'loader.api');

            if (window.Api && Api.init) Api.init();
            await refreshRankingCount();

            setLoaderProgress(100);

            const wait = Math.max(0, (CONFIG.LOADER_MIN_MS || 0) - (Date.now() - started));
            setTimeout(() => Screens.go('home', null, { replace: true }), wait);

        } catch (e) {
            console.error('[Flow] boot', e);
            showError('error.apiDown', { retry: true });
        }
    }

    /* =====================================================
       2. HOME
       ===================================================== */

    Screens.on('home', {
        enter() {
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

    /* =====================================================
       3. HOW TO PLAY
       ===================================================== */

    Screens.on('howto', {
        enter() {
            const list = $('howto-rules');
            if (list) {
                const rules = T('howto.rules');
                list.innerHTML = Array.isArray(rules)
                    ? rules.map(r => '<li>' + r + '</li>').join('')
                    : '';
            }

            Screens.watchIdle(CONFIG.IDLE_TIMEOUT_SEC, () => Screens.back('home'),
                { elId: 'howto-timer', textKey: 'common.idleTimer' });
        }
    });

    /* =====================================================
       4. RANKING
       ===================================================== */

    Screens.on('ranking', {
        async enter() {
            await renderRanking($('ranking-list'), CONFIG.TOP_SIZE);

            Screens.watchIdle(CONFIG.IDLE_TIMEOUT_SEC, () => Screens.back('home'),
                { elId: 'ranking-timer', textKey: 'common.idleTimer' });
        }
    });

    function esc(s) {
        return String(s ?? '').replace(/[&<>"]/g,
            c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
    }

    async function renderRanking(box, top, mine) {
        if (!box) return;

        box.innerHTML = '<li class="top-empty">' + T('common.loading') + '</li>';

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

        let html = items.map(it => {
            const me = nickUsed && it.displayNick === nickUsed ? ' class="me"' : '';
            return '<li' + me + '>' +
                   '<span class="rank">' + it.position + '.</span>' +
                   '<span class="nick">' + esc(it.displayNick) + '</span>' +
                   '<span class="pts">' + it.result + '</span></li>';
        }).join('');

        const inTop = nickUsed && items.some(it => it.displayNick === nickUsed);

        if (mine && !inTop) {
            const label = nickUsed ? esc(nickUsed) : T('ranking.yourResult');
            html += '<li class="me is-outside">' +
                    '<span class="rank">' + (mine.position || '–') + '.</span>' +
                    '<span class="nick">' + label + '</span>' +
                    '<span class="pts">' + mine.score + '</span></li>';
        }

        box.innerHTML = html;
    }

    /* =====================================================
       5. CONFIRM
       ===================================================== */

    Screens.on('confirm', {
        enter(data) {
            confirmTarget = (data && data.target) || 'home';
        }
    });

    function confirmExit(target) {
        Screens.go('confirm', { target: target || 'home' });
    }

    /* =====================================================
       6. GAMEEND
       ===================================================== */

    function canClaimPrize() {
        return CONFIG.API_ENABLED && lastScore >= CONFIG.PRIZE_MIN_SCORE &&
               !!(lastEnd && lastEnd.eligible && !lastEnd.suspicious);
    }

    Screens.on('gameend', {
        enter(data) {
            const score = data.score !== undefined ? data.score : lastScore;
            lastScore = score;
            lastEnd = data.end !== undefined ? data.end : lastEnd;

            const hasScore = score > 0;
            const won = hasScore && score >= CONFIG.PRIZE_MIN_SCORE;

            $('end-title').textContent = won ? T('gameend.win.title')
                                             : T('gameend.lose.title');

            const sc = $('end-score');
            sc.textContent = hasScore ? T('gameend.win.score', { score }) : '';
            sc.classList.toggle('hidden', !hasScore);

            $('end-message').textContent =
                !won       ? T('gameend.lose.message')
              : scoreSaved ? T('gameend.win.savedInfo')
              :              T('gameend.win.subtitle');

            const isSuspicious = !!(lastEnd && lastEnd.suspicious);

            $('btn-prize').classList.toggle('hidden', !canClaimPrize());

            const canRank = hasScore && CONFIG.API_ENABLED &&
                            score >= CONFIG.NICK_MIN_SCORE &&
                            !scoreSaved && !isSuspicious;

            $('btn-addrank').classList.toggle('hidden', !canRank);

            updateRankingButtons();
            refreshRankingCount(true);

            const timerEl = $('end-timer');

            const sec = hasScore
                ? (CONFIG.WIN_REDIRECT_SEC || 0)
                : (CONFIG.LOSE_REDIRECT_SEC || 0);

            if (sec > 0) {
                let left = sec;

                timerEl.classList.remove('hidden');
                timerEl.textContent = T('gameend.timer', { sec: left });

                Screens.interval(() => {
                    left--;
                    if (left <= 0) { Screens.go('home'); return; }
                    timerEl.textContent = T('gameend.timer', { sec: left });
                }, 1000);
            } else {
                timerEl.classList.add('hidden');
            }
        }
    });

    /* =====================================================
       7. ADDTORANKING
       ===================================================== */

    Screens.on('addrank', {
        enter(data) {
            const score = data.score !== undefined ? data.score : lastScore;

            $('addrank-score').textContent = T('addrank.score', { score });

            const input = $('nick-input');
            input.value = '';
            input.disabled = false;
            input.placeholder = T('addrank.placeholder');
            input.maxLength = CONFIG.NICK_MAX_LENGTH;

            $('btn-nick-add').disabled = false;
            setRankStatus('', null);
            $('addrank-box').classList.remove('is-done');

            renderRanking($('addrank-list'), CONFIG.TOP_SIZE);

            setTimeout(() => input.focus(), 150);

            Screens.watchIdle(CONFIG.IDLE_TIMEOUT_SEC, () => Screens.back('gameend'),
                { elId: 'addrank-timer', textKey: 'common.idleTimer' });
        }
    });

    function setRankStatus(msg, kind) {
        const el = $('addrank-status');
        if (!el) return;
        el.textContent = msg || '';
        el.style.display = msg ? 'block' : 'none';
        el.classList.toggle('is-ok', kind === 'ok');
        el.classList.toggle('is-wait', kind === 'wait');
        el.classList.toggle('is-err', kind === 'err');
    }

    async function submitNick() {
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

        input.disabled = true;
        $('btn-nick-add').disabled = true;
        $('addrank-box').classList.add('is-done');
        setRankStatus(T('addrank.saving'), 'wait');

        const r = await Api.addToRanking(nick);

        if (r.code === 'NICK_NOT_ALLOWED') {
            input.disabled = false;
            $('btn-nick-add').disabled = false;
            $('addrank-box').classList.remove('is-done');
            setRankStatus(T('addrank.errNickNotAllowed'), 'err');
            input.focus();
            input.select();
            return;
        }

        if (r.code === 'NICK_INVALID_FORMAT') {
            input.disabled = false;
            $('btn-nick-add').disabled = false;
            $('addrank-box').classList.remove('is-done');
            setRankStatus(T('addrank.errNickFormat'), 'err');
            input.focus();
            return;
        }

        if (r.code === 'NICK_MODERATION_UNAVAILABLE') {
            input.disabled = false;
            $('btn-nick-add').disabled = false;
            $('addrank-box').classList.remove('is-done');
            setRankStatus(T('addrank.errModerationUnavailable'), 'err');
            return;
        }

        if (r.code === 'SESSION_NOT_ELIGIBLE') {
            $('addrank-box').classList.add('hidden');
            setRankStatus(T('addrank.errNotEligible'), 'err');
            return;
        }

        nickUsed = nick;

        if (r.ok) {
            scoreSaved = true;
            setRankStatus(r.position
                ? T('addrank.savedAt', { position: r.position })
                : T('addrank.savedPlain'), 'ok');

        } else if (r.code === 'ALREADY_SAVED') {
            scoreSaved = true;
            setRankStatus(T('addrank.alreadySaved'), 'ok');

        } else {
            input.disabled = false;
            $('btn-nick-add').disabled = false;
            $('addrank-box').classList.remove('is-done');
            setRankStatus(T('addrank.errRetry'), 'err');
        }

        await renderRanking($('addrank-list'), CONFIG.TOP_SIZE,
                            { score: lastScore, position: r.position });
    }

    /* =====================================================
       8. PRIZE
       ===================================================== */

    async function claimAndShowPrize() {
        if (!canClaimPrize()) return;

        const btn = $('btn-prize');
        const label = btn ? btn.textContent : '';

        if (btn) { btn.disabled = true; btn.textContent = T('prize.loading'); }

        const r = await Api.claimPrize();

        if (btn) { btn.disabled = false; btn.textContent = label; }

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
        Screens.go('error', { message, retry: canRetry, back: 'gameend' });
    }

    /* Pionowy bilet 1080 × 1350, zgodny z układem nagrody w CyberDetective. */
    const VOUCHER = {
        W: 1080, H: 1350,
        BG: 'assets/bg-neon.jpg',
        LOGO_VISA: 'assets/logo-visa.png',
        LOGO_PARTNER: 'assets/logo-kfc.png',
        FONT_PIXEL: '"PressStart2P", monospace'
    };
    let voucherFile = null;
    let voucherToken = 0;

    function loadVoucherImage(src) {
        return new Promise(resolve => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => resolve(null);
            image.src = src;
        });
    }

    function fitVoucherLogo(ctx, image, cx, cy, maxW, maxH, radius) {
        if (!image) return;
        const scale = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight);
        const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
        ctx.save();
        if (radius) {
            ctx.beginPath();
            ctx.roundRect(cx - w / 2, cy - h / 2, w, h, radius);
            ctx.clip();
        }
        ctx.drawImage(image, cx - w / 2, cy - h / 2, w, h);
        ctx.restore();
    }

    function voucherTicketPath(ctx, l, t, w, h, r, notchY, notchR) {
        ctx.beginPath();
        ctx.moveTo(l + r, t);
        ctx.lineTo(l + w - r, t);
        ctx.arcTo(l + w, t, l + w, t + r, r);
        ctx.lineTo(l + w, notchY - notchR);
        ctx.arc(l + w, notchY, notchR, -Math.PI / 2, Math.PI / 2, true);
        ctx.lineTo(l + w, t + h - r);
        ctx.arcTo(l + w, t + h, l + w - r, t + h, r);
        ctx.lineTo(l + r, t + h);
        ctx.arcTo(l, t + h, l, t + h - r, r);
        ctx.lineTo(l, notchY + notchR);
        ctx.arc(l, notchY, notchR, Math.PI / 2, -Math.PI / 2, true);
        ctx.lineTo(l, t + r);
        ctx.arcTo(l, t, l + r, t, r);
        ctx.closePath();
    }

    async function drawVoucher(code) {
        const W = VOUCHER.W, H = VOUCHER.H;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const x = c.getContext('2d');
        const [bg, visa, partner] = await Promise.all([
            loadVoucherImage(VOUCHER.BG),
            loadVoucherImage(VOUCHER.LOGO_VISA),
            loadVoucherImage(VOUCHER.LOGO_PARTNER)
        ]);
        try {
            await Promise.all([
                document.fonts.load('44px ' + VOUCHER.FONT_PIXEL),
                document.fonts.load('400 34px Inter'),
                document.fonts.load('600 34px Inter')
            ]);
        } catch (e) {}

        x.fillStyle = '#0a0d33';
        x.fillRect(0, 0, W, H);
        if (bg) {
            const scale = Math.max(W / bg.naturalWidth, H / bg.naturalHeight);
            const w = bg.naturalWidth * scale, h = bg.naturalHeight * scale;
            x.drawImage(bg, (W - w) / 2, (H - h) / 2, w, h);
        }
        const shade = x.createLinearGradient(0, 0, 0, H);
        shade.addColorStop(0, 'rgba(7,10,38,.55)');
        shade.addColorStop(.75, 'rgba(7,10,38,0)');
        shade.addColorStop(1, 'rgba(7,10,38,.85)');
        x.fillStyle = shade;
        x.fillRect(0, 0, W, H);

        const L = 90, TOP = 56, BW = W - 180, BH = 740, notchY = TOP + 230;
        voucherTicketPath(x, L, TOP, BW, BH, 36, notchY, 34);
        const card = x.createLinearGradient(0, TOP, 0, TOP + BH);
        card.addColorStop(0, 'rgba(22,28,82,.94)');
        card.addColorStop(1, 'rgba(10,13,51,.97)');
        x.fillStyle = card;
        x.shadowColor = 'rgba(247,182,0,.45)';
        x.shadowBlur = 44;
        x.fill();
        x.shadowBlur = 0;
        x.lineWidth = 4;
        x.strokeStyle = '#F7B600';
        x.stroke();

        const logoY = TOP + 115;
        if (partner) {
            fitVoucherLogo(x, visa, W / 2 - 190, logoY, 270, 90);
            x.fillStyle = 'rgba(152,160,208,.5)';
            x.fillRect(W / 2 - 1, logoY - 55, 2, 110);
            fitVoucherLogo(x, partner, W / 2 + 190, logoY, 230, 126, 14);
        } else {
            fitVoucherLogo(x, visa, W / 2, logoY, 340, 110);
        }
        x.setLineDash([14, 12]);
        x.lineWidth = 2;
        x.strokeStyle = 'rgba(247,182,0,.55)';
        x.beginPath();
        x.moveTo(L + 50, notchY);
        x.lineTo(L + BW - 50, notchY);
        x.stroke();
        x.setLineDash([]);

        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillStyle = '#FFC22E';
        x.font = '44px ' + VOUCHER.FONT_PIXEL;
        const title = T('prize.gameTitle');
        while (x.measureText(title).width > BW - 100) {
            x.font = x.font.replace(/(\d+)px/, (m, n) => (n - 2) + 'px');
        }
        x.shadowColor = '#3a1d00';
        x.shadowOffsetX = 4;
        x.shadowOffsetY = 4;
        x.fillText(title, W / 2, notchY + 95);
        x.shadowColor = 'transparent';
        x.shadowOffsetX = 0;
        x.shadowOffsetY = 0;
        x.fillStyle = '#98a0d0';
        x.font = '600 34px Inter, system-ui, sans-serif';
        x.fillText(T('prize.title'), W / 2, notchY + 165);

        const boxW = BW - 140, boxH = 150, boxY = notchY + 210;
        x.fillStyle = 'rgba(7,10,38,.9)';
        x.beginPath();
        x.roundRect(W / 2 - boxW / 2, boxY, boxW, boxH, 22);
        x.fill();
        x.setLineDash([18, 12]);
        x.lineWidth = 4;
        x.strokeStyle = '#F7B600';
        x.stroke();
        x.setLineDash([]);
        x.fillStyle = '#FFC22E';
        x.font = '800 92px Consolas, "Courier New", monospace';
        while (x.measureText(code).width > boxW - 70) {
            x.font = x.font.replace(/(\d+)px/, (m, n) => (n - 2) + 'px');
        }
        x.fillText(code, W / 2, boxY + boxH / 2 + 4);

        x.fillStyle = '#d5dcff';
        x.font = '400 34px Inter, system-ui, sans-serif';
        x.textBaseline = 'alphabetic';
        wrapText(x, T('prize.hint'), W / 2, boxY + boxH + 80, boxW, 46);
        return c;
    }

    function prepareVoucher(code) {
        voucherFile = null;
        const token = ++voucherToken;
        drawVoucher(code).then(canvas => {
            canvas.toBlob(blob => {
                // Starszy render nie może nadpisać kodu z kolejnej gry.
                if (!blob || token !== voucherToken) return;
                voucherFile = new File([blob], 'nagroda-' + code + '.png', { type: 'image/png' });
            }, 'image/png');
        }).catch(error => console.error('[Flow] voucher', error));
    }

    Screens.on('prize', {
        enter(data) {
            const prize = (data && data.prize) || Api.getPrize();
            if (!prize) { Screens.back('gameend'); return; }

            const allowDownload = CONFIG.PRIZE_ALLOW_DOWNLOAD &&
                new URLSearchParams(location.search).get('hideDownload') !== '1';

            $('prize-code').textContent = prize.code;
            $('prize-code').classList.remove('is-empty');
            $('prize-type').textContent = prize.typeName || '';
            $('prize-hint').textContent = T(allowDownload ? 'prize.hint' : 'prize.hintCopyOnly');
            const validToText = prize.validToText || '';
            $('prize-validity').textContent = validToText ? T('prize.validOn', { date: validToText }) : '';
            $('prize-validity').classList.toggle('hidden', !validToText);

            $('btn-copy').classList.toggle('hidden', !CONFIG.PRIZE_ALLOW_COPY);
            $('btn-download').classList.toggle('hidden', !allowDownload);
            $('copy-label').textContent = T('prize.copy');

            prepareVoucher(prize.code);

            Screens.watchIdle(CONFIG.IDLE_TIMEOUT_SEC, () => Screens.back('gameend'),
                { elId: 'prize-timer', textKey: 'common.idleTimer' });
        }
    });

    function copyCode() {
        const code = $('prize-code').textContent;
        if (!code || code === '—') return;

        const done = () => {
            $('copy-label').textContent = T('prize.copied');
            Screens.timeout(() => { $('copy-label').textContent = T('prize.copy'); }, 2000);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(done).catch(fallbackCopy);
        } else fallbackCopy();

        function fallbackCopy() {
            const ta = document.createElement('textarea');
            ta.value = code;
            ta.style.cssText = 'position:fixed;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); done(); } catch (e) {}
            ta.remove();
        }
    }

    /** Android: menu udostępniania. Pozostałe (iPhone, desktop): zwykłe pobieranie. */
    function downloadPrize() {
        if (!voucherFile) return;          /* jeszcze się generuje (ułamek sekundy) */

        const isAndroid = /Android/i.test(navigator.userAgent);

        if (isAndroid && navigator.canShare && navigator.canShare({ files: [voucherFile] })) {
            Screens.stopIdle();
            navigator.share({ files: [voucherFile] })
                .catch(() => {})            /* anulowanie = AbortError, ignorujemy */
                .finally(() => {
                    Screens.watchIdle(CONFIG.IDLE_TIMEOUT_SEC, () => Screens.back('gameend'),
                        { elId: 'prize-timer', textKey: 'common.idleTimer' });
                });
            return;
        }

        /* iPhone / desktop: zwykłe pobieranie (link musi być w DOM) */
        const url = URL.createObjectURL(voucherFile);
        const a = document.createElement('a');
        a.href = url;
        a.download = voucherFile.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
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

    /* =====================================================
       9. ERROR
       ===================================================== */

    Screens.on('error', {
        enter(data) {
            $('error-msg').textContent = data.message || T('error.generic');
            $('btn-error-retry').classList.toggle('hidden', !data.retry);

            const quit = $('btn-error-quit');
            if (quit) quit.textContent = data.back === 'gameend'
                ? T('common.back') : T('error.quit');
            errorBack = data.back || null;

            if (errorBack === 'gameend') {
                Screens.watchIdle(CONFIG.IDLE_TIMEOUT_SEC,
                    () => { errorBack = null; Screens.back('gameend'); },
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

    /* =====================================================
       NAWIGACJA POWROTU
       ===================================================== */

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

    /* =====================================================
       PODPIĘCIE PRZYCISKÓW
       ===================================================== */

    function bind() {
        const click = (id, fn) => {
            const el = $(id);
            if (el) el.addEventListener('click', fn);
        };

        /* wszystkie strzałki powrotu */
        document.querySelectorAll('.btn-back').forEach(btn => {
            btn.addEventListener('click', () => goBack(btn.dataset.back));
        });

        /* HOME */
        click('btn-play',    () => startGame());
        click('btn-howto',   () => Screens.go('howto'));
        click('btn-ranking', () => Screens.go('ranking'));

        /* HOWTO / RANKING */
        click('btn-howto-play', () => startGame());
        click('btn-rank-play',  () => startGame());

        /* GAMEEND */
        click('btn-prize', () => claimAndShowPrize());
        click('btn-addrank', () => Screens.go('addrank', { score: lastScore }));
        click('btn-again', () => startGame());
        click('btn-end-ranking', () => Screens.go('ranking'));

        /* ADDTORANKING */
        click('btn-nick-add', submitNick);

        const nick = $('nick-input');
        if (nick) nick.addEventListener('keydown', e => {
            if (e.key === 'Enter') submitNick();
        });

        /* PRIZE */
        click('btn-copy',     copyCode);
        click('btn-download', downloadPrize);

        /* CONFIRM */
        click('btn-confirm-yes', () => {
            if (window.Game && Game.stop) Game.stop();
            Screens.go(confirmTarget, null, { replace: true });
        });

        click('btn-confirm-no', () => {
            Screens.back('game');
            if (window.Game && Game.resume) Game.resume();
        });

        /* ERROR */
        click('btn-error-retry', () => {
            const fn = pendingRetry;
            pendingRetry = null;
            if (fn) fn(); else boot();
        });
        click('btn-error-quit', () => {
            if (errorBack === 'gameend') { errorBack = null; Screens.back('gameend'); }
            else goBack('exit');
        });
    }

    /* =====================================================
       START GRY
       ===================================================== */

    async function startGame() {
        setHomeError('');

        const btns = ['btn-play', 'btn-howto-play', 'btn-rank-play', 'btn-again'];
        btns.forEach(id => { const b = $(id); if (b) b.disabled = true; });

        const r = await Api.startSession();

        btns.forEach(id => { const b = $(id); if (b) b.disabled = false; });

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

        scoreSaved = false;
        nickUsed = '';

        Screens.go('game', null, { replace: true });
        if (window.Game && Game.start) Game.start();
    }

    /** Wywoływane przez game.js po zakończeniu rozgrywki. */
    async function onGameOver(score, data) {
        lastScore = score;
        data = data || {};

        /* Wyślij wynik do API */
        let end = { eligible: false, suspicious: false };

        if (CONFIG.API_ENABLED && window.Api) {
            const r = await Api.endGame(score, data.duration || 0, []);
            if (r.ok) {
                end = {
                    eligible: r.eligible,
                    suspicious: r.suspicious,
                    prizeName: r.prizeName,
                    result: r.result
                };
            }
        }

        lastEnd = end;
        Screens.go('gameend', { score, end }, { replace: true });
    }

    /* =====================================================
       INIT
       ===================================================== */

    function init() {
        applyTexts();
        bind();
        if (window.Game && Game.init) Game.init();
        boot();
    }

    return {
        init, boot, startGame, onGameOver, goBack, confirmExit,
        showError, errorTextFor,
        renderRanking, applyTexts, hasRanking,
        getScore: () => lastScore,
        getEnd: () => lastEnd,
        isScoreSaved: () => scoreSaved
    };
})();
