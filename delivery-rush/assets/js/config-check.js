/* =========================================================
   config-check.js — wykrywa BRAKUJĄCE klucze w CONFIG

   Owija CONFIG w Proxy i loguje każdy odczyt nieistniejącego
   klucza. Bez tego brak klucza daje undefined i psuje grę
   po cichu, czasem daleko od przyczyny.

   Dodaj do index.html ZARAZ PO config.js:
     <script src="js/config.js"></script>
     <script src="js/config-check.js"></script>

   Ręcznie: ConfigCheck.report()
   ========================================================= */
(function () {

    if (!window.CONFIG) {
        console.error('[ConfigCheck] brak window.CONFIG — sprawdź kolejność skryptów');
        return;
    }

    /* Klucze, które CELOWO mogą nie istnieć — mają wartości
       domyślne w kodzie, więc ich brak nie jest błędem. */
    const OPTIONAL = new Set([
        'TILE_COUNT_MOBILE', 'TILE_COUNT_SMALL',
        'BACK_URL', 'HINT_TEXT_PAD', 'HINT_TEXT', 'HINT_TEXT_MOUSE',
        'THUMB_ZONE_ON_DESKTOP', 'SHOW_HINT_ON_DESKTOP',
        'PRIZE_DOWNLOAD_FORMAT', 'LOADER_MIN_MS',
        'UNIFY_PLATFORMS', 'TOP_PREVIEW_SIZE',
        /* wewnętrzne */
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

    /* raport po starcie, gdy wszystkie moduły już czytały config */
    setTimeout(report, 2500);

    window.ConfigCheck = { report, missing: () => [...missing], raw: () => raw };

})();
