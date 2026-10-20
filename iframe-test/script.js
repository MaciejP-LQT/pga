(() => {
    'use strict';

    const sourceForm = document.getElementById('source-form');
    const gameSelect = document.getElementById('game-select');
    const gameUrl = document.getElementById('game-url');
    const sizeForm = document.getElementById('size-form');
    const sizePreset = document.getElementById('size-preset');
    const widthInput = document.getElementById('frame-width');
    const heightInput = document.getElementById('frame-height');
    const shell = document.getElementById('frame-shell');
    const frame = document.getElementById('game-frame');
    const sizeOutput = document.getElementById('frame-size');
    const status = document.getElementById('frame-status');
    const openGame = document.getElementById('open-game');
    let loadedUrl;
    let currentSize;

    function setStatus(message, isError = false) {
        status.textContent = message;
        status.classList.toggle('is-error', isError);
    }

    function pagePath(url) {
        return url.pathname.replace(/index\.html$/, '').replace(/\/$/, '');
    }

    function loadGame() {
        let url;
        try {
            url = new URL(gameUrl.value.trim(), document.baseURI);
            const protocols = window.location.protocol === 'file:' ? ['http:', 'https:', 'file:'] : ['http:', 'https:'];
            if (!protocols.includes(url.protocol)) throw new Error('protocol');
            const currentPage = new URL(document.baseURI);
            if (url.origin === currentPage.origin && pagePath(url) === pagePath(currentPage)) {
                throw new Error('recursive');
            }
        } catch {
            setStatus('Podaj adres HTTP(S) lub ścieżkę do gry, a nie do samego testera.', true);
            return;
        }

        loadedUrl = url.href;
        gameUrl.value = loadedUrl;
        gameSelect.value = Array.from(gameSelect.options).find(option =>
            option.value !== 'custom' && new URL(option.value, document.baseURI).href === loadedUrl
        )?.value || 'custom';
        const name = gameSelect.value === 'custom' ? 'Własna strona' : gameSelect.selectedOptions[0].textContent;
        frame.title = `${name} — podgląd w iframe`;
        openGame.href = loadedUrl;
        setStatus('Otwieranie strony w iframe…');
        frame.src = loadedUrl;
    }

    function updateSize(width, height) {
        widthInput.value = String(width);
        heightInput.value = String(height);
        sizeOutput.textContent = `${width} × ${height} px`;
        const preset = `${width}x${height}`;
        currentSize = preset;
        sizePreset.value = Array.from(sizePreset.options).some(option => option.value === preset) ? preset : 'custom';
    }

    function applySize(width, height) {
        shell.style.width = `${width}px`;
        shell.style.height = `${height}px`;
        updateSize(width, height);
    }

    sourceForm.addEventListener('submit', event => {
        event.preventDefault();
        if (sourceForm.reportValidity()) loadGame();
    });

    gameSelect.addEventListener('change', () => {
        if (gameSelect.value === 'custom') {
            gameUrl.focus();
            gameUrl.select();
            return;
        }
        gameUrl.value = gameSelect.value;
        loadGame();
    });

    gameUrl.addEventListener('input', () => { gameSelect.value = 'custom'; });

    sizePreset.addEventListener('change', () => {
        if (sizePreset.value === 'custom') return;
        const [width, height] = sizePreset.value.split('x').map(Number);
        applySize(width, height);
    });

    sizeForm.addEventListener('submit', event => {
        event.preventDefault();
        if (sizeForm.reportValidity()) applySize(widthInput.valueAsNumber, heightInput.valueAsNumber);
    });

    document.getElementById('swap-size').addEventListener('click', () => {
        if (sizeForm.reportValidity()) applySize(heightInput.valueAsNumber, widthInput.valueAsNumber);
    });

    document.getElementById('reload-game').addEventListener('click', () => {
        if (!loadedUrl) return;
        setStatus('Ponowne otwieranie strony w iframe…');
        frame.src = loadedUrl;
    });

    frame.addEventListener('load', () => {
        if (loadedUrl) setStatus('Nawigacja iframe zakończona. Sprawdź w podglądzie, czy gra działa poprawnie.');
    });

    if ('ResizeObserver' in window) {
        const observer = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            const roundedWidth = Math.round(width);
            const roundedHeight = Math.round(height);
            if (width > 0 && height > 0 && `${roundedWidth}x${roundedHeight}` !== currentSize) {
                updateSize(roundedWidth, roundedHeight);
            }
        });
        observer.observe(shell);
    }

    document.getElementById('file-warning').hidden = window.location.protocol !== 'file:';
    applySize(widthInput.valueAsNumber, heightInput.valueAsNumber);
    gameUrl.value = gameSelect.value;
    loadGame();
})();
