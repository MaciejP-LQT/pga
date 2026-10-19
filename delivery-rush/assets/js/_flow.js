/* =========================================================
   flow.js — logika przepływu ekranów

   Spina Screens (router), UI (render) i Api (dane).
   Cała nawigacja jest tutaj — game.js zajmuje się tylko rozgrywką.

   RANKING — jedno źródło prawdy:
     validItems()          odfiltrowuje puste wiersze z API
     hasRanking()          czy jest co pokazać
     updateRankingButtons() aktualizuje WSZYSTKIE przyciski naraz
   ========================================================= */
window.Flow = (function () {

    let lastScore = 0;
    let rankingCount = 0;
    let rankingFetchedAt = 0;        // DODAJ
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
            if (typeof val === 'string') el.textContent = val;
        });
    }

    /* =====================================================
       RANKING — wspólna logika dla wszystkich ekranów
       ===================================================== */

    /**
     * Odfiltrowuje wiersze bez treści.
     * API może zwrócić pozycję z pustym nickiem albo bez wyniku —
     * items.length byłoby > 0, ale lista bezużyteczna.
     */
    function validItems(items) {
        if (!Array.isArray(items)) return [];

        return items.filter(it => {
            if (!it) return false;

            /* nick musi być niepustym tekstem */
            if (typeof it.displayNick !== 'string') return false;
            if (!it.displayNick.trim()) return false;

            /* wynik: UWAGA — Number(null) i Number('') dają 0,
               więc sam isFinite() przepuściłby puste wartości */
            if (it.result === null || it.result === undefined) return false;
            if (it.result === '') return false;

            return Number.isFinite(Number(it.result));
        });
    }

    /** Jedyne miejsce odpowiadające: czy jest co pokazać. */
    function hasRanking() {
        if (!CONFIG.API_ENABLED || !window.Api) return false;
        if (!CONFIG.HIDE_RANKING_IF_EMPTY) return true;
        return rankingCount > 0;
    }

    /** Aktualizuje wszystkie przyciski rankingu naraz. */
    function updateRankingButtons() {
        const show = hasRanking();

        ['btn-ranking', 'btn-end-ranking'].forEach(id => {
            const btn = $(id);
            if (!btn) return;

            /* zmieniamy klasę tylko przy realnej zmianie stanu —
               inaczej animacja odpalałaby się przy każdym wejściu */
            const hiddenNow = btn.classList.contains('hidden');
            if (hiddenNow === show) btn.classList.toggle('hidden', !show);
        });
    }

    /**
     * Pobiera ranking z API i aktualizuje licznik.
     * @returns {Promise<number>} liczba prawidłowych pozycji
     */
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

            if (window.Assets && Assets.loadAll) await Assets.loadAll();
            setLoaderProgress(60, 'loader.api');

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

            /* stan z pamięci natychmiast (bez migotania),
               prawdziwy odczytujemy w tle */
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
            if (window.UI && UI.buildLegend) UI.buildLegend();

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
            /* Pokazujemy nick, ktory gracz WLASNIE wpisal - bezpieczniej
               i bardziej "moje" niz generyczny podpis. Fallback na
               T('ranking.yourResult') tylko gdyby nickUsed z jakiegos
               powodu byl jeszcze pusty (np. ten ekran pokazuje sie
               przed pierwszym udanym zapisem). */
            const label = nickUsed ? esc(nickUsed) : T('ranking.yourResult');

            html += '<li class="me is-outside">' +
                    '<span class="rank">' + (mine.position || '–') + '.</span>' +
                    '<span class="nick">' + label + '</span>' +
                    '<span class="pts">' + mine.score + '</span></li>';
        }

        box.innerHTML = html;
    }

    /* =====================================================
       5. CONFIRM — potwierdzenie wyjścia z gry
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

    Screens.on('gameend', {
        enter(data) {
            const score = data.score !== undefined ? data.score : lastScore;
            lastScore = score;
            lastEnd = data.end !== undefined ? data.end : lastEnd;

            const won = score > 0;

            $('end-title').textContent = won ? T('gameend.win.title')
                                             : T('gameend.lose.title');

            const sc = $('end-score');
            sc.textContent = won ? T('gameend.win.score', { score }) : '';
            sc.classList.toggle('hidden', !won);

            /* po zapisie zmieniamy podtytuł — zachęta do zapisu
               byłaby myląca, skoro przycisk zniknął */
            $('end-message').textContent =
                !won       ? T('gameend.lose.message')
              : scoreSaved ? T('gameend.win.savedInfo')
              :              T('gameend.win.subtitle');

               /* "suspicious" blokuje OBIE rzeczy (nagrodę i ranking) -
               to inny sygnał niż "eligible", który mówi tylko o progu
               nagrody. Sesja z uczciwym, ale niskim wynikiem ma
               eligible=false (bo nie łapie się na żaden próg nagrody),
               ale suspicious=false - taka sesja NADAL powinna móc
               zapisać wynik w rankingu. Stąd dwa niezależne warunki. */
            const isSuspicious = !!(lastEnd && lastEnd.suspicious);

            const canPrize = CONFIG.API_ENABLED && lastEnd && lastEnd.eligible && !isSuspicious;
            $('btn-prize').classList.toggle('hidden', !canPrize);

            const canRank = won && CONFIG.API_ENABLED &&
                            lastEnd && lastEnd.rankingActive &&
                            score >= CONFIG.NICK_MIN_SCORE &&
                            !scoreSaved && !isSuspicious;

            $('btn-addrank').classList.toggle('hidden', !canRank);

            /* ten sam warunek co na HOME — bez duplikowania logiki */
            updateRankingButtons();
            refreshRankingCount(true);

            const timerEl = $('end-timer');

            const sec = won
                ? (CONFIG.WIN_REDIRECT_SEC || 0)
                : (CONFIG.LOSE_REDIRECT_SEC || 0);

            if (sec > 0) {
                let left = sec;

                timerEl.classList.remove('hidden');
                timerEl.textContent = T('gameend.timer', { sec: left });

                Screens.interval(() => {
                    left--;

                    if (left <= 0) {
                        Screens.go('home');
                        return;
                    }

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

            startAddRankIdle();   // <-- ZMIANA
        }
    });

    /** Wydzielone, żeby submitNick() mogło uruchomić timer ponownie
        po zakończeniu zapytania, z pełnym, świeżym czasem. */
    function startAddRankIdle() {
        Screens.watchIdle(CONFIG.IDLE_TIMEOUT_SEC, () => Screens.back('gameend'),
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

        /* Moderacja GPT trwa czasem kilka-kilkanaście sekund, a w tym czasie
        gracz nic nie klika ani nie dotyka ekranu - idle timer tykałby
        dalej i mógłby przekierować w trakcie oczekiwania na odpowiedź,
        zanim gracz zobaczy potwierdzenie zapisu. Pauzujemy licznik na
        czas zapytania i uruchamiamy go od nowa dopiero po odpowiedzi. */
        Screens.stopIdle();
        $('addrank-timer').classList.add('hidden');

        try {
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
        } finally {
            /* Niezależnie od wyniku - pełne, świeże okno czasu na przeczytanie
            komunikatu, zanim nastąpi auto-powrót. */
            $('addrank-timer').classList.remove('hidden');
            startAddRankIdle();
        }
    }

    /* =====================================================
       8. PRIZE
       Kod pobieramy PRZED wejściem na ekran nagrody. Dzięki temu
       ekran z kodem pokazuje się wyłącznie wtedy, gdy kod istnieje -
       a nieudana próba trafia na ekran błędu z konkretnym powodem,
       zamiast pustego pola "—" pod nagłówkiem "Twoja nagroda".
       ===================================================== */
    async function claimAndShowPrize() {
        const btn = $('btn-prize');
        const label = btn ? btn.textContent : '';

        if (btn) { btn.disabled = true; btn.textContent = T('prize.loading'); }

        const r = await Api.claimPrize();

        if (btn) { btn.disabled = false; btn.textContent = label; }

        if (r.ok) { Screens.go('prize', { prize: r.prize }); return; }

        /* Ponowienie ma sens tylko przy problemie z siecią - przy pustej
           puli czy wygasłym oknie gracz ma iść do obsługi, nie klikać. */
        showPrizeError(prizeErrorText(r), r.code === 'NETWORK');
    }

    /** Każda odmowa ma swój komunikat - "błąd sieci" przy pustej puli
        wysłałby gracza do obsługi z niewłaściwym pytaniem. */
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

    Screens.on('prize', {
        enter(data) {
            const prize = (data && data.prize) || Api.getPrize();
            if (!prize) { Screens.back('gameend'); return; }

            $('prize-code').textContent = prize.code;
            $('prize-code').classList.remove('is-empty');
            $('prize-type').textContent = prize.typeName || '';
            $('prize-hint').textContent = T('prize.hint');

            $('btn-copy').classList.toggle('hidden', !CONFIG.PRIZE_ALLOW_COPY);
            $('btn-download').classList.toggle('hidden', !CONFIG.PRIZE_ALLOW_DOWNLOAD);
            $('copy-label').textContent = T('prize.copy');

            prepareVoucher(prize.code);
            startPrizeIdle();

            // Screens.watchIdle(CONFIG.IDLE_TIMEOUT_SEC, () => Screens.back('gameend'),
            //     { elId: 'prize-timer', textKey: 'common.idleTimer' });
        }
    });

    function startPrizeIdle() {
        Screens.watchIdle(CONFIG.IDLE_TIMEOUT_SEC, () => Screens.back('gameend'),
            { elId: 'prize-timer', textKey: 'common.idleTimer' });
    }

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

        /* =====================================================
       VOUCHER — plik przygotowany ZANIM gracz kliknie.
       Safari (iPhone) blokuje udostępnianie/pobieranie, jeśli
       między kliknięciem a akcją jest czekanie (toBlob jest
       asynchroniczne), oraz ignoruje a.download przy data: URL.
       ===================================================== */
    let voucherFile = null;

    function drawVoucher(code) {
        const W = 1000, H = 600;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const x = c.getContext('2d');
        const g = x.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#161c52');
        g.addColorStop(1, '#0a0d33');
        x.fillStyle = g;
        x.fillRect(0, 0, W, H);
        x.strokeStyle = '#F7B600';
        x.lineWidth = 6;
        x.setLineDash([18, 12]);
        x.strokeRect(50, 50, W - 100, H - 100);
        x.setLineDash([]);
        x.textAlign = 'center';
        x.fillStyle = '#98a0d0';
        x.font = '600 30px system-ui, sans-serif';
        x.fillText(T('prize.title'), W / 2, 160);
        x.fillStyle = '#F7B600';
        x.font = '800 78px Consolas, monospace';
        /* 16 znaków + myślniki — zmniejsz, jeśli nie mieści się w ramce */
        while (x.measureText(code).width > W - 160) {
            x.font = x.font.replace(/(\d+)px/, (m, n) => (n - 2) + 'px');
        }
        x.fillText(code, W / 2, 300);
        x.fillStyle = '#b9c4d8';
        x.font = '400 26px system-ui, sans-serif';
        wrapText(x, T('prize.hint'), W / 2, 400, W - 200, 36);
        return c;
    }

    function prepareVoucher(code) {
        voucherFile = null;
        drawVoucher(code).toBlob(blob => {
            if (!blob) return;
            voucherFile = new File([blob], 'nagroda-' + code + '.png', { type: 'image/png' });
        }, 'image/png');
    }

       /** Android: menu udostępniania. Pozostałe (iPhone, desktop): zwykłe pobieranie. */
    function downloadPrize() {
        if (!voucherFile) return;          /* jeszcze się generuje (ułamek sekundy) */

        const isAndroid = /Android/i.test(navigator.userAgent);

        if (isAndroid && navigator.canShare && navigator.canShare({ files: [voucherFile] })) {
            Screens.stopIdle();
            navigator.share({ files: [voucherFile] })
                .catch(() => {})            /* anulowanie = AbortError, ignorujemy */
                .finally(startPrizeIdle);
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

            /* 'auto' = wróć skąd przyszliśmy (historia routera) */
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

        /* wszystkie strzałki powrotu — jeden handler */
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

            /* brak kodów to nie awaria — zostajemy na ekranie */
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
    function onGameOver(score, end) {
        lastScore = score;
        lastEnd = end;
        Screens.go('gameend', { score, end }, { replace: true });
    }

    /* =====================================================
       INIT
       ===================================================== */

    function init() {
        applyTexts();
        bind();
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
