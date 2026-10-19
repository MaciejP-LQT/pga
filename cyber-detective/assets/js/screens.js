/* =========================================================
   screens.js — router ekranów

   Jedno miejsce odpowiedzialne za to, KTÓRY ekran jest widoczny.
   Bez tego logika przełączania rozłazi się po całej grze.

   UŻYCIE:
     Screens.go('home')              przejdź
     Screens.go('prize', {code:...}) przejdź z danymi
     Screens.back()                  wróć do poprzedniego
     Screens.current()               nazwa bieżącego

     Screens.on('home', {
         enter(data){ ... },   // wywoływane przy wejściu
         leave(){ ... }        // przy wyjściu
     });

   HISTORIA: każde go() odkłada poprzedni ekran na stos.
   back() zdejmuje. Dzięki temu btnBack działa z dowolnego miejsca.
   ========================================================= */
window.Screens = (function () {

    /* id ekranu → id elementu w DOM.
       Dodanie nowego ekranu = wpis tutaj + <div> w index.html. */
    const MAP = {
        loader:   'screen-loader',
        home:     'screen-home',
        howto:    'screen-howto',
        ranking:  'screen-ranking',
        game:     null,                 // gra to brak nakładki
        gameend:  'screen-gameend',
        addrank:  'screen-addrank',
        prize:    'screen-prize',
        confirm:  'screen-confirm',     // potwierdzenie wyjścia z gry
        error:    'screen-error'
    };

    const hooks = {};        // id → { enter, leave }
    let currentId = null;
    let history = [];
    let timers = [];         // timery ekranu, czyszczone przy wyjściu

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
    /* ---------- pomocnicze ---------- */

    function el(id) {
        const domId = MAP[id];
        return domId ? document.getElementById(domId) : null;
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

    /* ---------- API ---------- */

    /**
     * Timer bezczynności dla BIEŻĄCEGO ekranu.
     * Resetuje się przy każdym dotyku/kliknięciu/klawiszu/scrollu,
     * a po `ms` bez żadnej akcji woła `fn`.
     *
     * Czyszczony automatycznie przy KAŻDYM przejściu ekranu (go/back) —
     * nie trzeba go ręcznie zatrzymywać w leave().
     */
    function watchIdle(ms, fn) {
        stopIdle();
        idleReset = () => {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(fn, ms);
        };
        IDLE_EVENTS.forEach(ev =>
            document.addEventListener(ev, idleReset, { passive: true }));
        idleReset();
    }


    /**
     * Widoczny, odliczajacy timer bezczynnosci dla BIEZACEGO ekranu.
     *
     * Co sekunde aktualizuje element #elId tekstem z klucza textKey
     * (placeholder {sec}), a po wyzerowaniu woła fn(). KAZDA akcja
     * gracza (dotyk / klik / klawisz / scroll) resetuje odliczanie
     * do wartosci poczatkowej - nie przerywa go na stale.
     *
     * Czyszczony automatycznie przy KAZDYM przejsciu ekranu (go()),
     * wiec nie trzeba go recznie zatrzymywac w leave().
     *
     * @param {number} seconds   dlugosc odliczania w sekundach
     * @param {function} fn      wywolywane po wyzerowaniu
     * @param {{elId:string, textKey:string}} [opts]  gdzie i czym pokazac odliczanie
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

    /**
     * Rejestruje hooki ekranu.
     * @param {string} id
     * @param {{enter?:function, leave?:function}} handlers
     */
    function on(id, handlers) {
        if (!(id in MAP))
            console.warn('[Screens] rejestrujesz hook dla nieznanego ekranu:', id);

        hooks[id] = Object.assign(hooks[id] || {}, handlers);
    }

    /**
     * Przejście na ekran.
     * @param {string} id
     * @param {object} [data]     przekazane do enter()
     * @param {object} [opts]     { replace:true } = nie odkładaj na stos
     */
    function go(id, data, opts) {
        stopIdle();

        if (!(id in MAP)) {
            console.error('[Screens] nieznany ekran:', id,
                          '\nZnane:', Object.keys(MAP).join(', '));
            return;
        }

        /* Ekran jest w mapie, ale brakuje go w HTML — łatwo przeoczyć
           przy dodawaniu nowego widoku. */
        if (MAP[id] && !document.getElementById(MAP[id])) {
            console.error('[Screens] brak elementu #' + MAP[id] + ' w index.html');
            return;
        }

        stopIdle();

        opts = opts || {};

        /* wyjście z poprzedniego */
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

        /* body dostaje klasę = CSS wie, który ekran jest aktywny */
        document.body.classList.toggle('modal-open', id !== 'game');
        document.body.dataset.screen = id;

        const h = hooks[id];
        if (h && h.enter) {
            try { h.enter(data || {}); }
            catch (e) { console.error('[Screens] enter', id, e); }
        }

        console.info('[Screens] →', id);
    }

    /** Powrót do poprzedniego ekranu. Gdy stos pusty — na fallback. */
    function back(fallback) {
        const prev = history.pop();
        if (prev) go(prev, null, { replace: true });
        else go(fallback || 'home', null, { replace: true });
    }

    function current() { return currentId; }

    function resetHistory() { history = []; }

    /**
     * setTimeout powiązany z ekranem — czyszczony automatycznie
     * przy wyjściu. Bez tego timer z GAMEEND odpaliłby się
     * po przejściu gdzie indziej.
     */
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

    /** Diagnostyka: które ekrany są w mapie, a których brakuje w HTML. */
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
