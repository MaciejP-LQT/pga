/* =========================================================
   config-check.js — wykrywa BRAKUJĄCE klucze w CONFIG

   Owija CONFIG w Proxy i loguje każdy odczyt nieistniejącego
   klucza. Dodaj do index.html ZARAZ PO config.js.
   ========================================================= */
(function () {

    if (!window.CONFIG) {
        console.error('[ConfigCheck] brak window.CONFIG — sprawdź kolejność skryptów');
        return;
    }

    const OPTIONAL = new Set([
        'BACK_URL', 'LOADER_MIN_MS', 'TOP_PREVIEW_SIZE',
        'toJSON', 'then', 'constructor', 'length', 'name'
    ]);

    const missing = new Set();
    const raw = window.CONFIG;

    window.CONFIG = new Proxy(raw, {
        get(target, prop) {
            if (typeof prop === 'symbol') return target[prop];

            if (!(prop in target) && !OPTIONAL.has(prop)) {
                if (!missing.has(prop)) {
                    missing.add(prop);
                    console.warn(
                        '%c[ConfigCheck] BRAK klucza: CONFIG.' + prop,
                        'color:#ff9e3d;font-weight:bold'
                    );
                }
            }
            return target[prop];
        }
    });

    function report() {
        if (!missing.size) {
            console.info('%c[ConfigCheck] ✓ wszystkie klucze obecne',
                         'color:#3ecf8e');
            return;
        }

        console.group('%c[ConfigCheck] BRAKUJE ' + missing.size + ' kluczy',
                      'color:#ff6b6b;font-weight:bold');
        [...missing].sort().forEach(k => console.log('CONFIG.' + k));
        console.log('%cDopisz je do config.js', 'color:#98a0d0');
        console.groupEnd();
    }

    setTimeout(report, 2500);

    window.ConfigCheck = { report, missing: () => [...missing], raw: () => raw };

})();
