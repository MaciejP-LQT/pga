/* Keeps the first HOW-TO legend item synchronized with Maze token art. */
(function () {
    'use strict';
    function fixLegend() {
        var first = document.querySelector('#screen-howto #legend li:first-child');
        if (!first) return;
        var img = first.querySelector('img');
        if (!img) {
            img = document.createElement('img');
            img.alt = '';
            first.insertBefore(img, first.firstChild);
        }
        img.src = 'assets/images/magnifying_glass.png';
    }
    document.addEventListener('DOMContentLoaded', fixLegend, { once: true });
    new MutationObserver(fixLegend).observe(document.documentElement, { childList: true, subtree: true });
})();
