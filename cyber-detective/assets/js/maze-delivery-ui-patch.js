/* Aligns Maze gameplay messages with Delivery Rush without changing Maze mechanics. */
(function () {
    'use strict';

    var hintTimer = null;
    var powerPop = null;

    function isTouch() { return matchMedia('(pointer: coarse)').matches; }
    function hintText() {
        if (window.Input && Input.hasGamepad && Input.hasGamepad()) return T('game.hintPad');
        return isTouch() ? T('game.hintTouch') : T('game.hintMouse');
    }
    function showHint(dim) {
        var hint = document.getElementById('touch-hint');
        if (!hint) return;
        if (!isTouch() && CONFIG.SHOW_HINT_ON_DESKTOP === false) return;
        clearTimeout(hintTimer);
        hint.textContent = hintText();
        hint.classList.remove('hidden', 'fade');
        hint.classList.toggle('is-dim', !!dim);
        if (dim) return;
        hintTimer = setTimeout(function () { hint.classList.add('fade'); }, CONFIG.HINT_VISIBLE_MS || 2600);
    }
    function hideHint() {
        var hint = document.getElementById('touch-hint');
        clearTimeout(hintTimer);
        if (!hint) return;
        hint.classList.add('hidden');
        hint.classList.remove('is-dim', 'fade');
    }
    function showPowerPop(kind) {
        var stage = document.getElementById('stage');
        if (!stage) return;
        if (!powerPop) {
            powerPop = document.createElement('div');
            powerPop.id = 'maze-power-pop';
            powerPop.setAttribute('aria-hidden', 'true');
            powerPop.innerHTML = '<img alt=""><span></span>';
            stage.appendChild(powerPop);
        }
        var boost = kind === 'boost';
        powerPop.className = boost ? 'is-boost' : 'is-slow';
        powerPop.querySelector('img').src = boost ? 'assets/images/boost.png' : 'assets/images/slow.png';
        powerPop.querySelector('span').textContent = boost ? T('game.chase') : T('game.slow');
        powerPop.classList.remove('show');
        void powerPop.offsetWidth;
        powerPop.classList.add('show');
    }
    function hidePowerPop() { if (powerPop) powerPop.classList.remove('show'); }

    function install() {
        if (!window.UI) return false;
        UI.showHint = showHint;
        UI.hideHint = hideHint;
        UI.showPowerPop = showPowerPop;
        UI.hidePowerPop = hidePowerPop;
        return true;
    }
    if (!install()) document.addEventListener('DOMContentLoaded', install, { once: true });
})();
