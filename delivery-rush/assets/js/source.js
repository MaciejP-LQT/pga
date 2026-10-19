/* =========================================================
   source.js - ustalenie etykiety zrodla (statystyka)

   Kolejnosc:
     1. ?src=kiosk w URL        - jeden build, rozne stoiska
     2. zapamietana w sessionStorage (dla dalszej nawigacji)
     3. CONFIG.API_SOURCE_DEFAULT

   To TYLKO etykieta do raportow. Serwer jej nie ufa i nie wplywa ona
   ani na pule kodow, ani na zasady wydawania.

   Ladowac PRZED api.js.
   ========================================================= */
window.Source = (function () {

    const KEY = 'snake.src';

    /* Musi sie zgadzac z whitelista KnownSources w ClientInfo.cs po
       stronie API. */
    const ALLOWED = ['kiosk', 'web', 'mobile'];

    function fromQuery() {
        try {
            const p = new URLSearchParams(location.search);
            return p.get('src') || p.get('source');
        } catch (e) {
            return null;
        }
    }

    function normalize(v) {
        if (!v) return null;
        const s = String(v).trim().toLowerCase();
        return ALLOWED.indexOf(s) >= 0 ? s : null;
    }

    function remembered() {
        try { return normalize(sessionStorage.getItem(KEY)); }
        catch (e) { return null; }
    }

    function remember(v) {
        try { sessionStorage.setItem(KEY, v); } catch (e) {}
    }

    function resolve() {
        const q = normalize(fromQuery());
        if (q) { remember(q); return q; }

        const r = remembered();
        if (r) return r;

        return normalize(CONFIG.API_SOURCE_DEFAULT) || 'web';
    }

    let current = null;

    function get() {
        if (current === null) {
            current = resolve();
            const raw = fromQuery();
            if (raw && !normalize(raw))
                console.warn('[Source] nieznane zrodlo "' + raw + '" - uzywam "' + current + '"');
            else
                console.info('[Source]', current);
        }
        return current;
    }

    return {
        get,
        isKiosk: () => get() === 'kiosk',
        allowed: () => ALLOWED.slice()
    };
})();
