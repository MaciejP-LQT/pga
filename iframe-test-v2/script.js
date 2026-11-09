(() => {
    'use strict';

    const frame = document.getElementById('game-frame');
    const gameSelect = document.getElementById('game-select');
    const gameUrl = document.getElementById('game-url');
    const sourceForm = document.getElementById('source-form');
    const settings = document.getElementById('settings');
    const status = document.getElementById('frame-status');
    const openGame = document.getElementById('open-game');
    const navigation = document.querySelectorAll('[data-source]');
    let loadedUrl = new URL(frame.getAttribute('src'), document.baseURI);

    function pagePath(url) {
        return url.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
    }

    function sourceOption(url) {
        return Array.from(gameSelect.options).find(item =>
            item.value !== 'custom' && new URL(item.value, document.baseURI).href === url.href
        );
    }

    function updateMetrics() {
        const rect = frame.getBoundingClientRect();
        document.getElementById('frame-metrics').textContent =
            `Okno: ${window.innerWidth} × ${window.innerHeight} px · iframe: ${Math.round(rect.width)} × ${Math.round(rect.height)} px · DPR: ${window.devicePixelRatio || 1}`;
    }

    function loadSource(value, navigate = true) {
        let url;
        try {
            if (!value.trim()) throw new Error('empty');
            url = new URL(value.trim(), document.baseURI);
            const protocols = window.location.protocol === 'file:' ? ['http:', 'https:', 'file:'] : ['http:', 'https:'];
            if (!protocols.includes(url.protocol)) throw new Error('protocol');
            const current = new URL(document.baseURI);
            if (url.origin === current.origin && pagePath(url) === pagePath(current)) throw new Error('recursive');
        } catch {
            gameUrl.setAttribute('aria-invalid', 'true');
            status.classList.add('is-error');
            status.textContent = 'Podaj adres HTTP(S) lub ścieżkę gry, a nie samego testera. Poprzednia zawartość ramki nie została zmieniona.';
            return false;
        }

        gameUrl.removeAttribute('aria-invalid');
        status.classList.remove('is-error');
        gameUrl.value = url.href;
        const option = sourceOption(url);
        gameSelect.value = option ? option.value : 'custom';
        frame.title = option ? option.textContent : 'Własna strona — test iframe';
        openGame.href = url.href;
        for (const button of navigation) {
            if (new URL(button.dataset.source, document.baseURI).href === url.href) {
                button.setAttribute('aria-current', 'page');
            } else {
                button.removeAttribute('aria-current');
            }
        }
        document.getElementById('origin-info').textContent = url.origin === window.location.origin
            ? 'Wybrane źródło ma ten sam origin co tester. Produkcja używa iframe cross-origin — podaj inny port lub domenę, aby odwzorować tę izolację.'
            : 'Wybrane źródło jest cross-origin. Ograniczenia osadzania, pamięci i uprawnień określają przeglądarka oraz serwer gry.';
        status.textContent = 'Wybrane źródło ustawione. Działanie gry i ewentualne blokady osadzania sprawdź w ramce i konsoli przeglądarki.';
        if (navigate || url.href !== loadedUrl.href) frame.src = url.href;
        loadedUrl = url;
        return true;
    }

    document.getElementById('open-settings').addEventListener('click', () => {
        updateMetrics();
        settings.showModal();
    });

    settings.addEventListener('close', () => {
        const option = sourceOption(loadedUrl);
        gameSelect.value = option ? option.value : 'custom';
    });

    gameSelect.addEventListener('change', () => {
        if (gameSelect.value === 'custom') {
            settings.showModal();
            gameUrl.focus();
            gameUrl.select();
        } else {
            loadSource(gameSelect.value);
        }
    });

    for (const button of navigation) {
        button.addEventListener('click', () => loadSource(button.dataset.source));
    }

    sourceForm.addEventListener('submit', event => {
        event.preventDefault();
        if (sourceForm.reportValidity() && loadSource(gameUrl.value)) settings.close();
    });

    document.getElementById('reload-game').addEventListener('click', () => {
        status.textContent = 'Ponowne wczytywanie wybranego źródła…';
        frame.src = loadedUrl.href;
    });

    frame.addEventListener('load', () => {
        if (gameUrl.getAttribute('aria-invalid') !== 'true') {
            status.textContent = 'Nawigacja iframe zakończona. Nie oznacza to, że gra lub jej API zostały poprawnie uruchomione.';
        }
    });

    window.addEventListener('resize', updateMetrics);
    if ('ResizeObserver' in window) new ResizeObserver(updateMetrics).observe(frame);
    document.getElementById('file-warning').hidden = window.location.protocol !== 'file:';
    const initialSource = new URLSearchParams(window.location.search).get('src');
    gameUrl.value = initialSource || loadedUrl.href;
    loadSource(gameUrl.value, false);
    if (gameUrl.getAttribute('aria-invalid') === 'true') settings.showModal();
    updateMetrics();
})();
