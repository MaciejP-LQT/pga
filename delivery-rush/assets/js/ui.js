/* =========================================================
   ui.js — TYLKO elementy widoczne PODCZAS ROZGRYWKI
   Po wprowadzeniu routera ekranów (screens.js + flow.js)
   ten moduł nie zajmuje się już ekranami. Odpowiada za:
     - HUD (wynik, rekord, poziom)
     - odliczanie 3-2-1
     - combo i paski wzmocnień
     - podpowiedź o sterowaniu
     - strefę kciuka
     - legendę punktów (używaną na ekranie HOWTO)
     - ekspozycję Visa x2 (pop-up, pasek, świecący wynik)
   Ekrany, nawigacja i teksty → flow.js
   =========================================================
   ZMIANA W TEJ WERSJI
   setCombo() przyjmuje teraz opcjonalne turnsLeft/turnLimit
   i renderuje kropki obok mnożnika — wizualny odpowiednik
   limitu skrętów (COMBO_TURN_LIMIT z config.js). Bez tego
   gracz nie widział, ile skrętów zostało mu do wygaśnięcia
   combo — sam limit działał "w ciemno".
   Wywołanie bez tych argumentów (setCombo(m)) nadal działa
   jak wcześniej — kropki po prostu się nie pokazują.
   =========================================================
   VISA x2
   Złoto + "x2" są zarezerwowane dla karty Visa (boost).
   Combo ma własny, pomarańczowy styl i zawsze dopisek "COMBO".
     showVisaPop()  duży napis z logo na środku planszy po zebraniu
     setPowerups()  ustawia body.is-visa-boost (świecący wynik)
     applyVisaBar() logo + "x2" na pasku boosta
   ========================================================= */
window.UI = (function () {
    const $ = id => document.getElementById(id);
    const el = {
        score:      $('score'),
        best:       $('best'),
        bestItem:   $('hud-best'),
        level:      $('level'),
        combo:      $('combo'),
        powerBox:   $('power-bars'),
        boostBar:   $('boost-bar'),
        boostFill:  $('boost-fill'),
        slowBar:    $('slow-bar'),
        slowFill:   $('slow-fill'),
        hint:       $('touch-hint'),
        thumb:      $('thumb-zone'),
        countdown:  $('countdown'),
        countValue: $('countdown-value'),
        legend:     $('legend'),
        pause:      $('screen-pause'),
        stage:      $('stage'),
        logoCorner: $('logo-corner-slot'),
        logoCornerImg: $('logo-corner')
    };
    /* Jedno miejsce wykrywania dotyku. */
    function isTouch() {
        return matchMedia('(pointer: coarse)').matches;
    }
    /* =====================================================
       HUD
       ===================================================== */
    function setScore(s) {
        if (!el.score) return;
        el.score.textContent = s;
        el.score.classList.remove('bump');
        void el.score.offsetWidth;
        el.score.classList.add('bump');
    }
    function setBest(b) {
        if (el.best) el.best.textContent = b;
    }
    function setLevel(l) {
        if (el.level) el.level.textContent = l;
    }
    /**
     * Buduje znaczniki kropek: wypełniona = zostały skręty,
     * pusta = zużyty limit. Liczba kropek = COMBO_TURN_LIMIT.
     */
    function comboDotsHtml(turnsLeft, turnLimit) {
        if (turnLimit == null || turnLimit <= 0) return '';
        let html = '<span class="combo-dots">';
        for (let i = 0; i < turnLimit; i++) {
            html += '<i class="combo-dot' + (i < turnsLeft ? ' is-on' : '') + '"></i>';
        }
        html += '</span>';
        return html;
    }
    /**
     * @param {number} m          mnożnik combo (0 = brak/wygaszone)
     * @param {number} [turnsLeft] ile skrętów zostało do wygaśnięcia
     * @param {number} [turnLimit] CONFIG.COMBO_TURN_LIMIT — liczba kropek
     */
    function setCombo(m, turnsLeft, turnLimit) {
        if (!el.combo) return;
        if (m >= CONFIG.COMBO_MIN) {
            const dots = comboDotsHtml(turnsLeft, turnLimit);
            el.combo.innerHTML = T('game.combo', { mult: m }) + dots;
            el.combo.classList.remove('hidden', 'pulse');
            void el.combo.offsetWidth;
            el.combo.classList.add('pulse');
        } else {
            el.combo.classList.add('hidden');
            el.combo.classList.remove('pulse');
        }
    }
    function setPowerups(power) {
        if (!el.powerBox) return;
        const b = power ? Powerups.progress(power.boost) : 0;
        const s = power ? Powerups.progress(power.slow)  : 0;
        el.boostBar.classList.toggle('hidden', b <= 0);
        if (b > 0) el.boostFill.style.transform = 'scaleX(' + b + ')';
        el.slowBar.classList.toggle('hidden', s <= 0);
        if (s > 0) el.slowFill.style.transform = 'scaleX(' + s + ')';
        el.powerBox.classList.toggle('hidden', b <= 0 && s <= 0);
        /* świecący wynik w HUD przez cały czas trwania Visa x2 */
        const visa = b > 0;
        if (document.body.classList.contains('is-visa-boost') !== visa)
            document.body.classList.toggle('is-visa-boost', visa);
    }
    /* =====================================================
       VISA x2
       ===================================================== */
    let visaPop = null;
    /* Style Visa wstrzykiwane z JS — działają nawet bez zmian w style.css
       i bez przebudowy style.min.css (wcześniej brak CSS = logo w naturalnym,
       ogromnym rozmiarze). */
    function injectVisaStyles() {
        if (document.getElementById('visa-x2-styles')) return;
        const st = document.createElement('style');
        st.id = 'visa-x2-styles';
        st.textContent =
            '#visa-pop{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 50%,rgba(26,31,113,.62) 0%,rgba(7,10,38,0) 62%)}' +
            '#visa-pop.show{animation:visaPop 1.2s cubic-bezier(.2,.9,.25,1) forwards}' +
            '#visa-pop .visa-pop-logo{display:block;width:36%;max-width:230px;height:auto;filter:drop-shadow(0 0 18px rgba(247,182,0,.55)) drop-shadow(0 4px 10px rgba(0,0,0,.7))}' +
            '#visa-pop .visa-pop-text{font-family:"PixelPL","PressStart2P",monospace;font-size:clamp(14px,5cqw,34px);line-height:1.2;color:#FFC22E;white-space:nowrap;text-shadow:.08em .08em 0 #2b1600,0 0 24px rgba(247,182,0,.6)}' +
            '@keyframes visaPop{0%{opacity:0;transform:scale(.4)}18%{opacity:1;transform:scale(1.12)}30%{opacity:1;transform:scale(1)}75%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.94) translateY(-6%)}}' +
            '#boost-bar .power-label{display:inline-flex;align-items:center;gap:.4em}' +
            '#boost-bar .power-logo{display:block;height:1.05em;width:auto;max-width:3em}' +
            'body.is-visa-boost #score{color:#FFC22E;text-shadow:0 0 12px rgba(247,182,0,.65)}' +
            'body.is-visa-boost #hud .hud-item:has(#score){border-color:rgba(247,182,0,.8);box-shadow:0 0 18px rgba(247,182,0,.35)}' +
            '@media (prefers-reduced-motion:reduce){#visa-pop.show{animation-duration:.01s;animation-delay:1s}}';
        document.head.appendChild(st);
    }
    /** Logo + "x2" na pasku boosta (zamiast samego tekstu z HTML). */
    function applyVisaBar() {
        if (!el.boostBar) return;
        const label = el.boostBar.querySelector('.power-label');
        if (!label) return;
        label.innerHTML =
            '<img class="power-logo" src="' + CONFIG.LOGO_MAIN_FILE + '" alt="Visa">' +
            '<span>' + T('game.visaBar', { mult: CONFIG.BOOST_MULTIPLIER }) + '</span>';
    }
    /** Duży napis "logo Visa + x2 PUNKTY" na środku planszy. */
    function showVisaPop() {
        if (!el.stage) return;
        if (!visaPop) {
            visaPop = document.createElement('div');
            visaPop.id = 'visa-pop';
            visaPop.setAttribute('aria-hidden', 'true');
            visaPop.innerHTML =
                '<img class="visa-pop-logo" src="' + CONFIG.LOGO_MAIN_FILE + '" alt="">' +
                '<span class="visa-pop-text"></span>';
            el.stage.appendChild(visaPop);
        }
        visaPop.querySelector('.visa-pop-text').textContent =
            T('game.visaPop', { mult: CONFIG.BOOST_MULTIPLIER });
        visaPop.classList.remove('show');
        void visaPop.offsetWidth;
        visaPop.classList.add('show');
    }
    function hideVisaPop() {
        if (visaPop) visaPop.classList.remove('show');
    }
    /* =====================================================
       ODLICZANIE
       ===================================================== */
    function showCountdown(label) {
        if (!el.countdown) return;
        el.countdown.classList.remove('hidden');
        el.countValue.textContent = label;
        /* "START!" ma inny rozmiar niż cyfry */
        el.countValue.classList.toggle('go', /[a-zA-Z]/.test(label));
        el.countValue.classList.remove('tick');
        void el.countValue.offsetWidth;
        el.countValue.classList.add('tick');
    }
    function hideCountdown() {
        if (!el.countdown) return;
        el.countdown.classList.add('hidden');
        el.countValue.classList.remove('tick', 'go');
    }
    /* =====================================================
       PODPOWIEDŹ O STEROWANIU
       ===================================================== */
    let hintTimer = null;
    /** Treść dopasowana do urządzenia. Gamepad ma priorytet. */
    function hintText() {
        if (window.Input && Input.hasGamepad && Input.hasGamepad())
            return T('game.hintPad');
        return isTouch() ? T('game.hintTouch') : T('game.hintMouse');
    }
    /**
     * @param {boolean} dim  true  = wyszarzona, NIE znika sama (odliczanie)
     *                       false = pełna jasność + odliczanie do zniknięcia
     */
    function showHint(dim) {
        if (!el.hint) return;
        if (!isTouch() && CONFIG.SHOW_HINT_ON_DESKTOP === false) return;
        clearTimeout(hintTimer);
        el.hint.textContent = hintText();
        el.hint.classList.remove('hidden', 'fade');
        el.hint.classList.toggle('is-dim', !!dim);
        if (dim) return;      /* czeka na start gry */
        hintTimer = setTimeout(
            () => el.hint.classList.add('fade'),
            CONFIG.HINT_VISIBLE_MS || 2600
        );
    }
    function hideHint() {
        if (!el.hint) return;
        clearTimeout(hintTimer);
        el.hint.classList.add('hidden');
        el.hint.classList.remove('is-dim', 'fade');
    }
    /* =====================================================
       STREFA KCIUKA
       ===================================================== */
    function setThumbZone(on) {
        if (!el.thumb) return;
        /* z gamepadem ręce są na kontrolerze — strefa zbędna */
        const hasPad = window.Input && Input.hasGamepad && Input.hasGamepad();
        const allow = CONFIG.SHOW_THUMB_ZONE && !hasPad &&
                      (isTouch() || CONFIG.THUMB_ZONE_ON_DESKTOP === true);
        el.thumb.classList.toggle('hidden', !(on && allow));
    }
    /* =====================================================
       LEGENDA PUNKTÓW  (ekran HOWTO)
       ===================================================== */
    function slowPercent() {
        return Math.round((1 - 1 / CONFIG.SLOW_FACTOR) * 100);
    }
    function buildLegend() {
        if (!el.legend) return;
        const compact = CONFIG.LEGEND_MODE === 'compact';
        el.legend.classList.toggle('compact', compact);
        const rows = [];
        CONFIG.ITEMS.forEach(i => rows.push({
            key: i.key,
            label: i.label,
            value: '+' + i.points,
            cls: ''
        }));
        if (CONFIG.BOOST_ENABLED) rows.push({
            key: 'boost',
            label: T('game.visaLegend'),
            value: 'x' + CONFIG.BOOST_MULTIPLIER,
            cls: 'is-boost'
        });
        if (CONFIG.SLOW_ENABLED) rows.push({
            key: 'slow',
            label: CONFIG.SLOW_LABEL,
            value: '−' + slowPercent() + '%',
            cls: 'is-slow'
        });
        if (CONFIG.PENALTY_ENABLED) rows.push({
            key: 'penalty',
            label: CONFIG.PENALTY_LABEL,
            value: String(CONFIG.PENALTY_POINTS),
            cls: '',
            neg: true
        });
        /* compact = ikona + wartość (wąsko, na pasku)
           full    = ikona + nazwa + wartość (czytelniej na kiosku) */
        el.legend.innerHTML = rows.map(r => {
            const img = '<img src="assets/images/' + r.key + '.png" alt="" title="' +
                        r.label + '">';
            const val = '<b' + (r.neg ? ' class="neg"' : '') + '>' + r.value + '</b>';
            return compact
                ? '<li class="' + r.cls + '">' + img + val + '</li>'
                : '<li class="' + r.cls + '">' + img +
                  '<span>' + r.label + '</span>' + val + '</li>';
        }).join('');
    }
    /* =====================================================
       LOGO W ROGU PLANSZY
       ===================================================== */
    function applyCornerLogo() {
        if (!el.logoCorner) return;
        const plate = CONFIG.LOGO_MAIN_MODE === 'plate';
        el.logoCorner.classList.toggle('mode-plate', plate);
        el.logoCorner.classList.toggle('mode-reverse', !plate);
        el.logoCorner.classList.toggle('hidden', !CONFIG.SHOW_LOGO_MAIN);
        /* Przezroczystość ma sens TYLKO w trybie "reverse" (logo bez
           tła, subtelny znak wodny). W trybie "plate" płytka musi
           zostać nieprzezroczysta — inaczej miesza się z ciemnym tłem
           planszy i traci cały kontrast, przez co wygląda jak plama.
           Wcześniej inline style.opacity nadpisywał .mode-plate{.82}
           z CSS NIEZALEŻNIE od specyficzności klas (styl inline
           zawsze wygrywa) — stąd niewidoczne logo mimo poprawnego CSS. */
        if (plate) {
            el.logoCorner.style.removeProperty('opacity');   /* CSS .82 wraca do gry */
        } else {
            el.logoCorner.style.opacity = CONFIG.LOGO_CORNER_OPACITY;
        }
        if (el.logoCornerImg) {
            el.logoCornerImg.src = plate
                ? CONFIG.LOGO_MAIN_FILE_COLOR
                : CONFIG.LOGO_MAIN_FILE;
        }
        const root = document.documentElement;
        root.style.setProperty('--logo-pad', CONFIG.LOGO_PLATE_PADDING + 'px');
        root.style.setProperty('--logo-pad-sm', CONFIG.LOGO_PLATE_PADDING_SMALL + 'px');
    }
    /* =====================================================
       PAUZA  (nakładka poza routerem)
       ===================================================== */
    function showPause(on) {
        if (el.pause) el.pause.classList.toggle('hidden', !on);
        document.body.classList.toggle('modal-open', !!on);
    }
    /* =====================================================
       INIT
       ===================================================== */
    function init() {
        injectVisaStyles();
        applyCornerLogo();
        applyVisaBar();
        buildLegend();
        /* rekord w HUD ma sens tylko przy lokalnym zapisie */
        if (el.bestItem)
            el.bestItem.classList.toggle('hidden', !CONFIG.SHOW_BEST);
        document.body.classList.toggle('is-touch', isTouch());
    }
    return {
        init, isTouch,
        setScore, setBest, setLevel, setCombo, setPowerups,
        showVisaPop, hideVisaPop,
        showCountdown, hideCountdown,
        showHint, hideHint,
        setThumbZone,
        buildLegend,
        showPause
    };
})();
