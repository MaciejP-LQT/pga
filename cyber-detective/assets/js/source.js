/* =========================================================
   source.js - etykieta zrodla (statystyka). Identyczny jak w Snake.
   Kolejnosc: ?src= w URL -> sessionStorage -> CONFIG.API_SOURCE_DEFAULT
   Ladowac PRZED api.js.
   ========================================================= */
window.Source = (function () {

    const KEY = 'gameapi.src';
    const ALLOWED = ['kiosk', 'web', 'mobile'];   // = KnownSources w ClientInfo.cs

    function fromQuery() {
        try {
            const p = new URLSearchParams(location.search);
            return p.get('src') || p.get('source');
        } catch (e) { return null; }
    }

    function normalize(v) {
        if (!v) return null;
        const s = String(v).trim().toLowerCase();
        return ALLOWED.indexOf(s) >= 0 ? s : null;
    }

    function remembered() {
        try { return normalize(sessionStorage.getItem(KEY)); } catch (e) { return null; }
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
        if (current === null) current = resolve();
        return current;
    }

    return {
        get: get,
        isKiosk: function () { return get() === 'kiosk'; },
        allowed: function () { return ALLOWED.slice(); }
    };
})();
