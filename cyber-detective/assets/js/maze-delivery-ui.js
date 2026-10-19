/* =========================================================
   maze-delivery-ui.js - komunikaty w grze i paski jak w Delivery Rush
   - podpowiedz o sterowaniu
   - VISA x2: logo Visa + "x2 PUNKTY" na srodku planszy (animacja DR),
     swiecacy wynik w HUD przez caly czas trwania x2,
     pasek boosta z logo Visa + "x2"
   - SLOW: ten sam komunikat w wersji niebieskiej
   Wyglad -> style-game-maze.css (sekcja "MAZE v6 - VISA x2").
   Nie zmienia mechaniki gry.
   ========================================================= */
(function () {
    'use strict';
    var hintTimer = null;
    var pops = {};

    /* domyslne teksty - uzywane tylko, gdy brak klucza w texts.js */
    var FALLBACK = {
        visaPop: 'x{mult} PUNKTY',
        visaTag: 'VISA x{mult}',
        visaBar: 'x{mult}',
        slowPop: 'SPOWOLNIENIE',
        /* ekran ZASADY GRY */
        visaRule:  'Zbierz kartę <b>Visa</b> — przez chwilę masz <b>x{mult} punkty</b> ' +
                   'i <b>ścigasz drony</b> (złapany dron = bonus). Błękitne pole je spowalnia.',
        visaChase: 'ścigasz drony'
    };
    function tx(key, vars) {
        var g = window.TEXTS && window.TEXTS.game;
        if (g && g[key] != null) return T('game.' + key, vars);
        return String(FALLBACK[key] || key).replace(/\{(\w+)\}/g, function (m, k) {
            return vars && vars[k] !== undefined ? vars[k] : m;
        });
    }
    function mult() { return CONFIG.BOOST_MULTIPLIER || 2; }
    function isTouch() { return matchMedia('(pointer: coarse)').matches; }

    /* ---------------- podpowiedz ---------------- */
    function hintText() {
        if (window.Input && Input.hasGamepad && Input.hasGamepad()) return T('game.hintPad');
        return isTouch() ? T('game.hintTouch') : T('game.hintMouse');
    }
    function showHint(dim) {
        var el = document.getElementById('touch-hint');
        if (!el) return;
        if (!isTouch() && CONFIG.SHOW_HINT_ON_DESKTOP === false) return;
        clearTimeout(hintTimer);
        el.textContent = hintText();
        el.classList.remove('hidden', 'fade');
        el.classList.toggle('is-dim', !!dim);
        if (!dim) hintTimer = setTimeout(function () { el.classList.add('fade'); }, CONFIG.HINT_VISIBLE_MS || 2600);
    }
    function hideHint() {
        var el = document.getElementById('touch-hint');
        clearTimeout(hintTimer);
        if (!el) return;
        el.classList.add('hidden');
        el.classList.remove('is-dim', 'fade');
    }

    /* ---------------- pop-up VISA x2 / SLOW ---------------- */
    function getPop(kind) {
        if (pops[kind]) return pops[kind];
        var stage = document.getElementById('stage');
        if (!stage) return null;
        var el = document.createElement('div');
        el.className = 'mz-pop ' + (kind === 'boost' ? 'is-boost' : 'is-slow');
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<img alt=""><span></span>';
        el.querySelector('img').src = kind === 'boost' ? CONFIG.LOGO_MAIN_FILE : 'assets/images/slow.png';
        stage.appendChild(el);
        pops[kind] = el;
        return el;
    }
    function showPop(kind) {
        var other = pops[kind === 'boost' ? 'slow' : 'boost'];
        if (other) other.classList.remove('show');
        var el = getPop(kind);
        if (!el) return;
        el.querySelector('span').textContent = kind === 'boost'
            ? tx('visaPop', { mult: mult() })
            : tx('slowPop');
        el.classList.remove('show');
        void el.offsetWidth;            /* restart animacji */
        el.classList.add('show');
    }
    /* ---------------- LABIRYNT CZYSTY! ---------------- */
    var clearPop = null;
    function showClearPop(title, sub, ms) {
        var stage = document.getElementById('stage');
        if (!stage) return;
        hidePowerPop();
        if (!clearPop) {
            clearPop = document.createElement('div');
            clearPop.className = 'mz-pop is-clear';
            clearPop.setAttribute('aria-hidden', 'true');
            clearPop.innerHTML = '<span></span><b></b>';
            stage.appendChild(clearPop);
        }
        clearPop.querySelector('span').textContent = title;
        clearPop.querySelector('b').textContent = sub || '';
        clearPop.style.setProperty('--clear-ms', (ms || 1800) + 'ms');
        clearPop.classList.remove('show');
        void clearPop.offsetWidth;
        clearPop.classList.add('show');
    }
    function hideClearPop() { if (clearPop) clearPop.classList.remove('show'); }
    function hidePowerPop() {
        Object.keys(pops).forEach(function (k) { pops[k].classList.remove('show'); });
    }

    /* ---------------- pasek boosta: logo Visa + x2 ---------------- */
    function applyVisaBar() {
        var label = document.querySelector('#boost-bar .power-label');
        if (!label) return;
        label.removeAttribute('data-t');   /* router tekstow nie nadpisze logo */
        label.innerHTML = '<img class="power-logo" src="' + CONFIG.LOGO_MAIN_FILE + '" alt="Visa">' +
            '<span>' + tx('visaBar', { mult: mult() }) + '</span>';
    }

    /* ---------------- ekran ZASADY GRY: Visa = x2 + poscig ---------------- */
    function patchHowto() {
        var rules = document.getElementById('howto-rules');
        if (rules) {
            var lis = rules.querySelectorAll('li');
            for (var i = 0; i < lis.length; i++) {
                var t = lis[i].textContent.toLowerCase();
                if (lis[i].dataset.mzVisa) break;
                if (t.indexOf('ścig') >= 0 || t.indexOf('złote pole') >= 0 || t.indexOf('visa') >= 0) {
                    lis[i].innerHTML = tx('visaRule', { mult: mult() });
                    lis[i].dataset.mzVisa = '1';
                    break;
                }
            }
        }
        var legend = document.getElementById('legend');
        if (legend) {
            /* token = lupa (jak na planszy) - usun stara kropke, zostaw ikone + wartosc */
            var tokenVal = '+' + (CONFIG.TOKEN_POINTS || 1);
            legend.querySelectorAll('li').forEach(function (li) {
                var bv = li.querySelector('b');
                if (!bv || bv.textContent.trim() !== tokenVal) return;
                li.classList.add('mz-token-legend');
                var keptImg = false;
                Array.prototype.slice.call(li.children).forEach(function (ch) {
                    if (ch === bv) return;
                    if (ch.tagName === 'IMG' && !keptImg) { keptImg = true; return; }
                    if (ch.tagName === 'SPAN' && !ch.querySelector('img,i') && ch.textContent.trim()) return;
                    ch.remove();
                });
            });
            var items = legend.querySelectorAll('li');
            for (var j = 0; j < items.length; j++) {
                var li = items[j];
                var b = li.querySelector('b');
                if (!b || li.dataset.mzVisa) continue;
                if (li.classList.contains('is-boost') || /ścig/i.test(b.textContent)) {
                    li.classList.add('is-boost', 'mz-visa-legend');
                    b.innerHTML = 'x' + mult() + '<small>' + tx('visaChase') + '</small>';
                    li.dataset.mzVisa = '1';
                }
            }
        }
    }
    function watchHowto() {
        patchHowto();
        if (!window.MutationObserver) return;
        ['howto-rules', 'legend'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) new MutationObserver(patchHowto).observe(el, { childList: true });
        });
    }

    function install() {
        if (!window.UI || !window.CONFIG) return false;
        UI.showHint = showHint;
        UI.hideHint = hideHint;
        UI.showVisaPop = function () { showPop('boost'); };
        UI.showSlowPop = function () { showPop('slow'); };
        UI.hidePowerPop = hidePowerPop;
        UI.showClearPop = showClearPop;
        UI.hideClearPop = hideClearPop;
        UI.hideVisaPop = hidePowerPop;
        /* dopisek przy punktach w trakcie x2 - uzywa game.js */
        UI.visaTag = function () { return tx('visaTag', { mult: mult() }); };

        var originalSetPowerups = UI.setPowerups;
        UI.setPowerups = function (power) {
            if (originalSetPowerups) originalSetPowerups.call(UI, power);
            var boost = !!(power && power.boostLeft > 0);
            document.body.classList.toggle('is-visa-boost', boost);
            document.body.classList.toggle('is-slow-active', !!(power && power.slowLeft > 0));
            if (boost && !document.querySelector('#boost-bar .power-logo')) applyVisaBar();
            if (!power) hidePowerPop();
        };
        applyVisaBar();
        watchHowto();
        return true;
    }
    if (!install()) document.addEventListener('DOMContentLoaded', install, { once: true });
})();
