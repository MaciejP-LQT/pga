/* =========================================================
   screens.js — router ekranów

   Jedno miejsce odpowiedzialne za to, KTÓRY ekran jest widoczny.

   UŻYCIE:
     Screens.go('home')              przejdź
     Screens.go('prize', {code:...}) przejdź z danymi
     Screens.back()                  wróć do poprzedniego
     Screens.current()               nazwa bieżącego

     Screens.on('home', {
         enter(data){ ... },
         leave(){ ... }
     });
   ========================================================= */
window.Screens = (function () {

    const MAP = {
        loader:   'screen-loader',
        home:     'screen-home',
        howto:    'screen-howto',
        ranking:  'screen-ranking',
        game:     null,
        gameend:  'screen-gameend',
        addrank:  'screen-addrank',
        prize:    'screen-prize',
        confirm:  'screen-confirm',
        error:    'screen-error'
    };

    const hooks = {};
    let currentId = null;
    let history = [];
    let timers = [];

    let idleInterval = null;
    let idleLeft = 0;
    let idleReset = null;
    const IDLE_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];

    function stopIdle() {
        if (idleReset) {
            IDLE_EVENTS.forEach(ev => document.removeEventListener(ev, idleReset));
            idleReset = null;
        }
        clearInterval(idleInterval);
        idleInterval = null;
        idleLeft = 0;
    }

    function el(id) {
        const domId = MAP[id];
        return domId ? document.getElementById(domId) : null;
    }

    let homeResizeObserver = null;
    let homeFitFrame = null;

    function fitHomePanel() {
        const screen = el('home');
        const panel = screen && screen.querySelector('.panel');
        if (!panel || screen.classList.contains('hidden')) return;

        if (!window.matchMedia('(min-width: 701px)').matches) {
            panel.style.removeProperty('zoom');
            return;
        }

        const screenStyle = getComputedStyle(screen);
        const panelStyle = getComputedStyle(panel);
        const availableHeight = screen.clientHeight
            - parseFloat(screenStyle.paddingTop) - parseFloat(screenStyle.paddingBottom);
        // offsetHeight pozostaje nieskalowane; zoom nie zmienia pomiaru przy kolejnych wywołaniach.
        const naturalHeight = panel.offsetHeight + parseFloat(panelStyle.marginTop);
        const scale = Math.min(1, Math.max(0.01, (availableHeight - 1) / naturalHeight));
        const zoom = String(Math.floor(scale * 1000000) / 1000000);
        if (panel.style.zoom !== zoom) panel.style.zoom = zoom;
    }

    function watchHomePanel() {
        if (!homeResizeObserver) {
            homeResizeObserver = new ResizeObserver(() => {
                cancelAnimationFrame(homeFitFrame);
                homeFitFrame = requestAnimationFrame(fitHomePanel);
            });
            homeResizeObserver.observe(el('home'));
            homeResizeObserver.observe(el('home').querySelector('.panel'));
        }
        fitHomePanel();
    }

    function hideAll() {
        Object.keys(MAP).forEach(id => {
            const node = el(id);
            if (node) node.classList.add('hidden');
        });
    }

    function clearTimers() {
        timers.forEach(t => { clearTimeout(t); clearInterval(t); });
        timers = [];
    }

    /**
     * Widoczny, odliczający timer bezczynności dla BIEŻĄCEGO ekranu.
     */
    function watchIdle(seconds, fn, opts) {
        stopIdle();
        if (!seconds || seconds <= 0) return;

        opts = opts || {};
        const el = opts.elId ? document.getElementById(opts.elId) : null;
        const textKey = opts.textKey;

        idleLeft = seconds;

        function render() {
            if (!el || !textKey) return;
            el.classList.remove('hidden');
            el.textContent = T(textKey, { sec: idleLeft });
        }

        render();
        idleInterval = setInterval(() => {
            idleLeft--;
            if (idleLeft <= 0) { stopIdle(); fn(); return; }
            render();
        }, 1000);

        idleReset = () => { idleLeft = seconds; render(); };
        IDLE_EVENTS.forEach(ev =>
            document.addEventListener(ev, idleReset, { passive: true }));
    }

    function on(id, handlers) {
        if (!(id in MAP))
            console.warn('[Screens] rejestrujesz hook dla nieznanego ekranu:', id);
        hooks[id] = Object.assign(hooks[id] || {}, handlers);
    }

    function go(id, data, opts) {
        stopIdle();

        if (!(id in MAP)) {
            console.error('[Screens] nieznany ekran:', id,
                          '\nZnane:', Object.keys(MAP).join(', '));
            return;
        }

        if (MAP[id] && !document.getElementById(MAP[id])) {
            console.error('[Screens] brak elementu #' + MAP[id] + ' w index.html');
            return;
        }

        stopIdle();

        opts = opts || {};

        if (currentId) {
            clearTimers();
            const h = hooks[currentId];
            if (h && h.leave) {
                try { h.leave(); } catch (e) { console.error('[Screens] leave', currentId, e); }
            }
            if (!opts.replace && currentId !== id) history.push(currentId);
        }

        hideAll();
        currentId = id;

        const node = el(id);
        if (node) node.classList.remove('hidden');

        document.body.classList.toggle('modal-open', id !== 'game');
        document.body.dataset.screen = id;

        const h = hooks[id];
        if (h && h.enter) {
            try { h.enter(data || {}); }
            catch (e) { console.error('[Screens] enter', id, e); }
        }

        if (id === 'home') watchHomePanel();

        console.info('[Screens] →', id);
    }

    function back(fallback) {
        const prev = history.pop();
        if (prev) go(prev, null, { replace: true });
        else go(fallback || 'home', null, { replace: true });
    }

    function current() { return currentId; }

    function resetHistory() { history = []; }

    function timeout(fn, ms) {
        const t = setTimeout(fn, ms);
        timers.push(t);
        return t;
    }

    function interval(fn, ms) {
        const t = setInterval(fn, ms);
        timers.push(t);
        return t;
    }

    function check() {
        const missing = [];
        Object.entries(MAP).forEach(([id, domId]) => {
            if (domId && !document.getElementById(domId)) missing.push(id);
        });
        if (missing.length)
            console.warn('[Screens] brak w HTML:', missing.join(', '));
        else
            console.info('[Screens] ✓ wszystkie ekrany obecne');
        return missing;
    }

    return { on, go, back, current, resetHistory, timeout, interval, check, MAP, watchIdle, stopIdle };
})();
