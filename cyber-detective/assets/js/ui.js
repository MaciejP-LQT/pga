/* =========================================================
   ui.js - HUD, legenda, banner, odliczanie, paski wzmocnien

   Ekrany menu i koniec gry obsluguje Screens/Flow (jak w Snake).
   Legenda budowana jest na ekranie "howto" (flow.js wola
   UI.buildLegend()) - wariant kompaktowy: rzad ikon z wartoscia
   pod spodem, identycznie jak w Snake.
   Sekcja partnera (logo KFC) zostala usunieta - Snake jej nie ma.
   ========================================================= */
window.UI = (function () {
    const el = {
        score: document.getElementById('score'),
        level: document.getElementById('level'),
        lives: document.getElementById('lives'),
        powerBox: document.getElementById('power-bars'),
        boostBar: document.getElementById('boost-bar'),
        boostFill: document.getElementById('boost-fill'),
        slowBar: document.getElementById('slow-bar'),
        slowFill: document.getElementById('slow-fill'),
        hint: document.getElementById('touch-hint'),
        thumb: document.getElementById('thumb-zone'),
        banner: document.getElementById('banner'),
        countdown: document.getElementById('countdown'),
        countValue: document.getElementById('countdown-value'),
        legend: document.getElementById('legend'),
        logoMain: document.getElementById('logo-main'),
        logoMainSlot: document.getElementById('logo-main-slot'),
        logoCorner: document.getElementById('logo-corner-slot'),
        logoCornerImg: document.getElementById('logo-corner')
    };

    /* ---------- legenda (ekran "howto") ---------- */
    function legendItem(cls, icon, value) {
        return '<li' + (cls ? ' class="' + cls + '"' : '') + '>' +
               icon + '<b>' + value + '</b></li>';
    }

    function imgTag(file) {
        return '<img src="assets/images/' + file + '" alt="">';
    }

    function buildLegend() {
        if (!el.legend) return;
        const rows = [];

        rows.push(legendItem('', '<span class="token-dot"></span>',
                             '+' + CONFIG.TOKEN_POINTS));

        CONFIG.ITEMS.forEach(function (i) {
            rows.push(legendItem('', imgTag(i.key + '.png'), '+' + i.points));
        });

        if (CONFIG.BOOST_ENABLED) {
            rows.push(legendItem('is-boost', imgTag('boost.png'),
                                 T('howto.chaseLabel')));
        }

        if (CONFIG.SLOW_ENABLED) {
            const pct = Math.round((1 - 1 / CONFIG.SLOW_FACTOR) * 100);
            rows.push(legendItem('is-slow', imgTag('slow.png'), '\u2212' + pct + '%'));
        }

        el.legend.innerHTML = rows.join('');

        /* brakujacy plik ikony - cicho ukrywamy zamiast "zepsutej" ramki */
        el.legend.querySelectorAll('img').forEach(function (img) {
            img.addEventListener('error', function () {
                console.warn('[UI] Brak ikony legendy:', img.src);
                img.style.visibility = 'hidden';
            }, { once: true });
        });
    }

    /* ---------- logo ---------- */
    function setMode(node, img, mode, fileRev, fileCol) {
        if (node) {
            node.classList.toggle('mode-plate', mode === 'plate');
            node.classList.toggle('mode-reverse', mode !== 'plate');
        }
        if (img) img.src = (mode === 'plate') ? fileCol : fileRev;
    }

    function applyLogoSlots() {
        const root = document.documentElement;
        root.style.setProperty('--logo-pad', CONFIG.LOGO_PLATE_PADDING + 'px');
        root.style.setProperty('--logo-pad-sm', CONFIG.LOGO_PLATE_PADDING_SMALL + 'px');

        setMode(el.logoMainSlot, el.logoMain, CONFIG.LOGO_MAIN_MODE,
                CONFIG.LOGO_MAIN_FILE, CONFIG.LOGO_MAIN_FILE_COLOR);
        setMode(el.logoCorner, el.logoCornerImg, CONFIG.LOGO_MAIN_MODE,
                CONFIG.LOGO_MAIN_FILE, CONFIG.LOGO_MAIN_FILE_COLOR);

        [el.logoMainSlot, el.logoCorner].forEach(function (n) {
            if (n) n.classList.toggle('hidden', !CONFIG.SHOW_LOGO_MAIN);
        });
        if (el.logoCorner) el.logoCorner.style.opacity = CONFIG.LOGO_CORNER_OPACITY;
    }

    /* ---------- strefa kciuka / podpowiedz ---------- */
    function setThumbZone(on) {
        if (!el.thumb) return;
        const touch = matchMedia('(pointer: coarse)').matches;
        el.thumb.classList.toggle('hidden', !(on && touch && CONFIG.SHOW_THUMB_ZONE));
    }

    let hintTimer = null;
    function showHint() {
        if (!el.hint) return;
        if (!matchMedia('(pointer: coarse)').matches) return;
        el.hint.classList.remove('hidden', 'fade');
        clearTimeout(hintTimer);
        hintTimer = setTimeout(function () { el.hint.classList.add('fade'); },
                               CONFIG.HINT_VISIBLE_MS || 2600);
    }
    function hideHint() {
        if (!el.hint) return;
        clearTimeout(hintTimer);
        el.hint.classList.add('hidden');
    }

    /* ---------- banner na srodku planszy ---------- */
    let bannerTimer = null;
    function banner(text, cls, ms) {
        if (!el.banner) return;
        el.banner.textContent = text;
        el.banner.className = 'banner ' + (cls || '');
        clearTimeout(bannerTimer);
        if (ms) bannerTimer = setTimeout(function () { el.banner.classList.add('hidden'); }, ms);
    }
    function hideBanner() {
        if (!el.banner) return;
        clearTimeout(bannerTimer);
        el.banner.classList.add('hidden');
    }

    /* ---------- odliczanie ---------- */
    function showCountdown(label) {
        el.countdown.classList.remove('hidden');
        el.countValue.textContent = label;
        el.countValue.classList.toggle('go', /^[a-z]/i.test(label));
        el.countValue.classList.remove('tick');
        void el.countValue.offsetWidth;
        el.countValue.classList.add('tick');
    }
    function hideCountdown() {
        el.countdown.classList.add('hidden');
        el.countValue.classList.remove('tick', 'go');
    }

    /* ---------- HUD ---------- */
    function setScore(s) {
        el.score.textContent = s;
        el.score.classList.remove('bump');
        void el.score.offsetWidth;
        el.score.classList.add('bump');
    }
    function setLevel(l) { el.level.textContent = l; }
    function setLives(n) {
        el.lives.innerHTML = n > 0
            ? Array.from({ length: n }, function () { return '<i class="life"></i>'; }).join('')
            : '<span class="no-life">\u2014</span>';
    }
    function setPowerups(p) {
        const b = p ? p.boostLeft / CONFIG.BOOST_DURATION_MS : 0;
        const s = p ? p.slowLeft / CONFIG.SLOW_DURATION_MS : 0;
        el.boostBar.classList.toggle('hidden', b <= 0);
        if (b > 0) el.boostFill.style.transform = 'scaleX(' + Math.max(0, b) + ')';
        el.slowBar.classList.toggle('hidden', s <= 0);
        if (s > 0) el.slowFill.style.transform = 'scaleX(' + Math.max(0, s) + ')';
        el.powerBox.classList.toggle('hidden', b <= 0 && s <= 0);
    }

    return {
        applyLogoSlots, buildLegend,
        setScore, setLevel, setLives, setPowerups,
        showCountdown, hideCountdown,
        showHint, hideHint, setThumbZone,
        banner, hideBanner
    };
})();
