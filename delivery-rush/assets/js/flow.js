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
    let savedRank = null;
    let rankSubmitting = false;
    let confirmTarget = 'home';
    let pendingRetry = null;
    let errorBack = null;
    let lastEnd = null;  
    
    const $ = id => document.getElementById(id);
    const PRIZE_COPY = {
        screenHint: 'Skopiuj kod i wykorzystaj go w GameON. Możesz też pobrać voucher.',
        voucherHint: 'Wykorzystaj ten kod w GameON.'
    };

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
        if (mine) requestAnimationFrame(function () {
            if (!box.isConnected || Screens.current() !== 'addrank') return;
            const row = box.querySelector('li.me');
            if (!row) return;
            const listRect = box.getBoundingClientRect();
            const rowRect = row.getBoundingClientRect();
            box.scrollTop += rowRect.top - listRect.top - (box.clientHeight - rowRect.height) / 2;
        });
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

            $('btn-prize').classList.toggle('hidden', !canClaimPrize());

            const canRank = hasScore && CONFIG.API_ENABLED &&
                            lastEnd && lastEnd.rankingActive &&
                            score >= CONFIG.NICK_MIN_SCORE &&
                            !scoreSaved && !isSuspicious;

            $('btn-addrank').classList.toggle('hidden', !canRank);

            /* ten sam warunek co na HOME — bez duplikowania logiki */
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
                updateRankSavedView();
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

    /* =====================================================
       8. PRIZE
       Kod pobieramy PRZED wejściem na ekran nagrody. Dzięki temu
       ekran z kodem pokazuje się wyłącznie wtedy, gdy kod istnieje -
       a nieudana próba trafia na ekran błędu z konkretnym powodem,
       zamiast pustego pola "—" pod nagłówkiem "Twoja nagroda".
       ===================================================== */
    async function claimAndShowPrize() {
        if (!canClaimPrize()) return;

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
            const codeLength = Array.from(String(prize.code)).length;
            $('prize-code').style.setProperty('--voucher-code-size', Math.min(10.22, 120 / Math.max(1, codeLength)) + 'cqw');
            $('prize-code').classList.remove('is-empty');
            $('prize-type').textContent = prize.typeName || '';
            $('prize-hint').textContent = PRIZE_COPY.screenHint;

            $('btn-copy').classList.toggle('hidden', !CONFIG.PRIZE_ALLOW_COPY);
            $('btn-download').classList.toggle('hidden', !CONFIG.PRIZE_ALLOW_DOWNLOAD);
            $('copy-label').textContent = T('prize.copy');

            prepareVoucher(prize.code, prize.typeName);
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
    // Voucher: wspolny projekt biletu, grafiki z katalogu tej gry.
    const VOUCHER = {
        W: 1080, H: 1350,
        BG: 'assets/images/home-bg.jpg',
        VISA: 'assets/images/logo-visa.png',
        KFC: 'assets/images/logo-kfc.png'
    };
    let voucherFile = null;
    let voucherRenderId = 0;
    function voucherImage(src) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
        });
    }
    function voucherLogo(ctx, img, cx, cy, maxW, maxH) {
        if (!img) return;
        const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
        const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
        ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    }
    function voucherFit(ctx, text, size, family, width) {
        do {
            ctx.font = size + 'px ' + family;
            if (ctx.measureText(text).width <= width || size <= 12) break;
            size -= 2;
        } while (true);
    }
    async function drawVoucher(code, rewardName) {
        code = String(code);
        const W = VOUCHER.W, H = VOUCHER.H;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const x = c.getContext('2d');
        const [bg, visa, kfc] = await Promise.all([
            voucherImage(VOUCHER.BG), voucherImage(VOUCHER.VISA), voucherImage(VOUCHER.KFC)
        ]);
        if (document.fonts) {
            try { await document.fonts.load('40px "PressStart2P"'); } catch (e) {}
        }
        x.fillStyle = '#0a0d33'; x.fillRect(0, 0, W, H);
        if (bg) {
            const h = Math.min(H, Math.round(bg.naturalHeight * W / bg.naturalWidth));
            const top = H - h;
            if (top > 0) {
                x.drawImage(bg, 0, 0, bg.naturalWidth, 2, 0, 0, W, top + 2);
                const sky = x.createLinearGradient(0, 0, 0, top);
                sky.addColorStop(0, 'rgba(7,10,38,.55)');
                sky.addColorStop(1, 'rgba(7,10,38,0)');
                x.fillStyle = sky; x.fillRect(0, 0, W, top + 2);
            }
            x.drawImage(bg, 0, top, W, h);
        }
        // Bilet z polkolistymi wycieciami.
        const L = 90, R = 990, TOP = 56, BOTTOM = 860, NY = 286, NR = 34;
        x.beginPath(); x.moveTo(L + 36, TOP);
        x.lineTo(R - 36, TOP); x.arcTo(R, TOP, R, TOP + 36, 36);
        x.lineTo(R, NY - NR); x.arc(R, NY, NR, -Math.PI / 2, Math.PI / 2, true);
        x.lineTo(R, BOTTOM - 36); x.arcTo(R, BOTTOM, R - 36, BOTTOM, 36);
        x.lineTo(L + 36, BOTTOM); x.arcTo(L, BOTTOM, L, BOTTOM - 36, 36);
        x.lineTo(L, NY + NR); x.arc(L, NY, NR, Math.PI / 2, -Math.PI / 2, true);
        x.lineTo(L, TOP + 36); x.arcTo(L, TOP, L + 36, TOP, 36); x.closePath();
        const card = x.createLinearGradient(0, TOP, 0, BOTTOM);
        card.addColorStop(0, 'rgba(22,28,82,.94)');
        card.addColorStop(1, 'rgba(10,13,51,.97)');
        x.fillStyle = card; x.shadowColor = 'rgba(247,182,0,.45)'; x.shadowBlur = 44;
        x.fill(); x.shadowBlur = 0; x.lineWidth = 4; x.strokeStyle = '#F7B600'; x.stroke();
        if (visa && kfc) {
            voucherLogo(x, visa, 350, 171, 270, 90);
            voucherLogo(x, kfc, 730, 171, 230, 126);
            x.fillStyle = 'rgba(152,160,208,.5)'; x.fillRect(539, 116, 2, 110);
        } else voucherLogo(x, visa || kfc, 540, 171, 340, 110);
        x.setLineDash([14, 12]); x.lineWidth = 3; x.strokeStyle = 'rgba(247,182,0,.55)';
        x.beginPath(); x.moveTo(140, NY); x.lineTo(940, NY); x.stroke(); x.setLineDash([]);
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillStyle = '#FFC22E';
        const title = String(T('home.title')).toUpperCase();
        voucherFit(x, title, 44, '"PressStart2P", monospace', 800);
        x.fillText(title, 540, 381);
        if (rewardName) {
            x.fillStyle = '#d5dcff';
            voucherFit(x, String(rewardName), 30, 'Inter, system-ui, sans-serif', 760);
            x.fillText(String(rewardName), 540, 448);
        }
        x.fillStyle = '#98a0d0'; x.font = '600 30px Inter, system-ui, sans-serif';
        x.fillText(T('prize.title'), 540, rewardName ? 510 : 480);
        x.beginPath(); x.roundRect(160, 550, 760, 150, 22);
        x.fillStyle = 'rgba(7,10,38,.9)'; x.fill();
        x.setLineDash([18, 12]); x.lineWidth = 4; x.strokeStyle = '#F7B600'; x.stroke(); x.setLineDash([]);
        x.fillStyle = '#FFC22E';
        voucherFit(x, code, 92, 'Consolas, "Courier New", monospace', 690);
        x.fillText(code, 540, 625);
        x.fillStyle = '#d5dcff'; x.font = '400 34px Inter, system-ui, sans-serif';
        x.textBaseline = 'alphabetic';
        wrapText(x, PRIZE_COPY.voucherHint, 540, 786, 760, 46);
        // Bez stopki o regulaminie i bez dodatkowych deklaracji o kodzie.
        return c;
    }
    function prepareVoucher(code, rewardName) {
        voucherFile = null;
        const renderId = ++voucherRenderId;
        drawVoucher(code, rewardName).then(c => {
            c.toBlob(blob => {
                if (!blob || renderId !== voucherRenderId) return;
                voucherFile = new File([blob], 'nagroda-' + code + '.png', { type: 'image/png' });
            }, 'image/png');
        }).catch(e => console.error('[Flow] voucher', e));
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
        savedRank = null;
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
