(() => {
    'use strict';

    // Do gier przekazujemy wyłącznie hideDownload; bez parametru adresy pozostają bez zmian.
    const hideDownload = new URLSearchParams(window.location.search).get('hideDownload');
    const gameQuery = hideDownload === null ? '' : `?${new URLSearchParams({ hideDownload })}`;

    // Adresy są względne wobec Hub/index.html. Uzupełnij null dopiero po ustaleniu adresu gry.
    // Grafiki przypisujemy według GameID; pliki 2 i 4 w dostarczonych materiałach są identyczne.
    const GAMES = [
        { id: 1, name: 'Delivery Rush', image: 'assets/gameId-1-img.png', url: `delivery-rush/${gameQuery}` },
        { id: 2, name: 'Cyber Detective', image: 'assets/gameId-2-img.png', url: `cyber-detective/${gameQuery}` },
        { id: 3, name: 'Combo Match', image: 'assets/gameId-3-img.png', url: `combo-match/${gameQuery}` },
        { id: 4, name: 'Gaming Challenge', image: 'assets/gameId-4-img.png', url: `gaming-challenge/${gameQuery}` },
    ];

    const track = document.getElementById('game-track');
    const viewport = document.getElementById('game-viewport');
    const thumbnails = document.getElementById('thumbnails');
    const title = document.getElementById('game-title');
    const counter = document.getElementById('game-counter');
    const hint = document.getElementById('launch-hint');
    const previous = document.getElementById('previous');
    const next = document.getElementById('next');
    const cardsView = document.getElementById('cards-view');
    const carouselView = document.getElementById('carousel-view');
    const gameGrid = document.getElementById('game-grid');
    const viewButtons = document.querySelectorAll('[data-view]');
    let currentView = 'cards';
    let selected = 0;
    let gesture = null;
    let suppressClick = false;

    function createLaunch(game, showBadge = true) {
        const launch = document.createElement(game.url ? 'a' : 'button');
        launch.className = 'game-art';
        if (game.url) {
            launch.href = game.url;
            launch.setAttribute('aria-label', `Zagraj w ${game.name}`);
            if (showBadge) {
                const badge = document.createElement('span');
                badge.className = 'play-badge';
                badge.textContent = 'Zagraj ↗';
                badge.setAttribute('aria-hidden', 'true');
                launch.append(badge);
            }
        } else {
            launch.type = 'button';
            launch.setAttribute('aria-disabled', 'true');
            launch.setAttribute('aria-label', `${game.name} — gra chwilowo niedostępna`);
            if (showBadge) launch.setAttribute('aria-describedby', 'launch-hint');
        }

        const image = document.createElement('img');
        image.src = game.image;
        image.alt = game.name;
        image.width = 800;
        image.height = 800;
        image.draggable = false;
        launch.prepend(image);
        return launch;
    }

    GAMES.forEach((game) => {
        const card = document.createElement('li');
        card.className = 'game-card';
        const launch = createLaunch(game, false);
        const caption = document.createElement('span');
        caption.className = 'card-caption';
        const name = document.createElement('strong');
        name.className = 'card-name';
        name.textContent = game.name;
        const status = document.createElement('span');
        status.className = 'card-status';
        status.textContent = game.url ? 'Zagraj ↗' : 'Gra chwilowo niedostępna';
        caption.append(name, status);
        launch.append(caption);
        card.append(launch);
        gameGrid.append(card);
    });

    const slides = GAMES.map((game, index) => {
        const slide = document.createElement('div');
        slide.className = 'slide';
        slide.id = `game-${game.id}`;
        slide.setAttribute('role', 'group');
        slide.setAttribute('aria-roledescription', 'slajd');
        slide.setAttribute('aria-label', `${index + 1} z ${GAMES.length}: ${game.name}`);
        const launch = createLaunch(game);
        const image = launch.querySelector('img');
        slide.append(launch);
        track.append(slide);

        const thumbnail = document.createElement('button');
        thumbnail.className = 'thumbnail';
        thumbnail.type = 'button';
        thumbnail.setAttribute('aria-label', `Wybierz ${game.name}`);
        thumbnail.setAttribute('aria-controls', slide.id);
        thumbnail.title = game.name;
        const preview = image.cloneNode();
        preview.alt = '';
        thumbnail.append(preview);
        thumbnail.addEventListener('click', () => select(index));
        thumbnails.append(thumbnail);
        return { slide, launch, thumbnail };
    });

    // Skrajne kopie pozwalają przejść przez koniec pętli bez przewijania całego paska.
    for (const [source, prepend] of [[slides[GAMES.length - 1].slide, true], [slides[0].slide, false]]) {
        const clone = source.cloneNode(true);
        clone.removeAttribute('id');
        clone.inert = true;
        clone.setAttribute('aria-hidden', 'true');
        if (prepend) track.prepend(clone);
        else track.append(clone);
    }

    let position = 1;

    function resetPosition() {
        track.style.transition = 'none';
        position = selected + 1;
        track.style.transform = `translateX(-${position * 100}%)`;
        void track.offsetWidth;
        track.style.transition = '';
    }

    function settleLoop() {
        if (position === 0 || position === GAMES.length + 1) resetPosition();
    }

    track.addEventListener('transitionend', (event) => {
        if (event.target === track && event.propertyName === 'transform') settleLoop();
    });
    resetPosition();

    function select(index) {
        settleLoop();
        const nextIndex = ((index % GAMES.length) + GAMES.length) % GAMES.length;
        const focusedSlide = slides[selected].slide.contains(document.activeElement);
        const difference = nextIndex - selected;
        position = selected === GAMES.length - 1 && nextIndex === 0 ? GAMES.length + 1
            : selected === 0 && nextIndex === GAMES.length - 1 ? 0
            : nextIndex + 1;
        selected = nextIndex;
        const game = GAMES[selected];
        if (difference !== 0) track.style.transform = `translateX(-${position * 100}%)`;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) settleLoop();
        title.textContent = game.name;
        counter.textContent = `${String(selected + 1).padStart(2, '0')} / ${String(GAMES.length).padStart(2, '0')}`;
        hint.textContent = game.url ? 'Kliknij obraz, aby zagrać' : 'Gra chwilowo niedostępna';
        hint.classList.toggle('available', Boolean(game.url));
        slides.forEach(({ slide, thumbnail }, slideIndex) => {
            const active = slideIndex === selected;
            slide.inert = !active;
            slide.setAttribute('aria-hidden', String(!active));
            thumbnail.setAttribute('aria-current', String(active));
        });
        if (focusedSlide) slides[selected].launch.focus({ preventScroll: true });
    }

    viewButtons.forEach((button) => {
        button.addEventListener('click', () => {
            currentView = button.dataset.view;
            if (gesture && viewport.hasPointerCapture(gesture.id)) viewport.releasePointerCapture(gesture.id);
            gesture = null;
            suppressClick = false;
            cardsView.hidden = currentView !== 'cards';
            carouselView.hidden = currentView !== 'carousel';
            viewButtons.forEach((option) => option.setAttribute('aria-pressed', String(option === button)));
            if (currentView === 'carousel') resetPosition();
        });
    });

    previous.addEventListener('click', () => select(selected - 1));
    next.addEventListener('click', () => select(selected + 1));

    document.addEventListener('keydown', (event) => {
        if (currentView !== 'carousel' || event.target.closest('.view-switch')) return;
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"]')) return;
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const thumbnailFocused = thumbnails.contains(document.activeElement);
        select(selected + (event.key === 'ArrowRight' ? 1 : -1));
        if (thumbnailFocused) slides[selected].thumbnail.focus({ preventScroll: true });
    });

    const GAMEPAD_PRESS_THRESHOLD = 0.55;
    const GAMEPAD_RELEASE_THRESHOLD = 0.25;
    const GAMEPAD_REPEAT_DELAY = 400;
    const GAMEPAD_REPEAT_INTERVAL = 200;
    let gamepadDirection = 0;
    let gamepadRepeatAt = 0;

    function readGamepadDirection(gamepad) {
        if (gamepad.mapping === 'standard') {
            const left = gamepad.buttons[14]?.pressed;
            const right = gamepad.buttons[15]?.pressed;
            if (left || right) return left === right ? 0 : left ? -1 : 1;
        }
        // W standardowym układzie osie 0 i 2 to poziome osie obu drążków.
        for (const axis of [0, 2]) {
            const value = gamepad.axes[axis] || 0;
            const direction = Math.sign(value);
            const threshold = direction === gamepadDirection
                ? GAMEPAD_RELEASE_THRESHOLD : GAMEPAD_PRESS_THRESHOLD;
            if (Math.abs(value) >= threshold) return direction;
        }
        return 0;
    }

    function pollGamepads(now) {
        let direction = 0;
        if (currentView === 'carousel' && !document.hidden && document.hasFocus()) {
            let gamepads;
            try {
                gamepads = navigator.getGamepads();
            } catch {
                // Przeglądarka może blokować Gamepad API, np. w osadzonym iframe.
                return;
            }
            for (const gamepad of gamepads) {
                if (!gamepad || !gamepad.connected) continue;
                direction = readGamepadDirection(gamepad);
                if (direction) break;
            }
        }
        if (direction && (direction !== gamepadDirection || now >= gamepadRepeatAt)) {
            const thumbnailFocused = thumbnails.contains(document.activeElement);
            select(selected + direction);
            if (thumbnailFocused) slides[selected].thumbnail.focus({ preventScroll: true });
            gamepadRepeatAt = now + (direction !== gamepadDirection
                ? GAMEPAD_REPEAT_DELAY : GAMEPAD_REPEAT_INTERVAL);
        }
        gamepadDirection = direction;
        window.requestAnimationFrame(pollGamepads);
    }

    if (typeof navigator.getGamepads === 'function') window.requestAnimationFrame(pollGamepads);

    viewport.addEventListener('dragstart', (event) => event.preventDefault());

    viewport.addEventListener('pointerdown', (event) => {
        if (!event.isPrimary || event.button !== 0) return;
        suppressClick = false;
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false };
    });

    viewport.addEventListener('pointermove', (event) => {
        if (!gesture || gesture.id !== event.pointerId) return;
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        if (!gesture.horizontal && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
            gesture = null;
            return;
        }
        if (!gesture.horizontal && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
            gesture.horizontal = true;
            suppressClick = true;
            viewport.setPointerCapture(event.pointerId);
        }
    });

    viewport.addEventListener('pointerup', (event) => {
        if (!gesture || gesture.id !== event.pointerId) return;
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)) {
            suppressClick = true;
            select(selected + (dx < 0 ? 1 : -1));
        }
        gesture = null;
    });
    viewport.addEventListener('pointercancel', () => { gesture = null; });
    viewport.addEventListener('lostpointercapture', (event) => {
        // Dotyk przechwytuje obraz; przeniesienie przechwycenia na viewport nie kończy gestu.
        if (event.target === viewport && gesture && gesture.id === event.pointerId) gesture = null;
    });
    viewport.addEventListener('click', (event) => {
        if (!suppressClick || event.detail === 0) return;
        event.preventDefault();
        event.stopPropagation();
    }, true);

    select(0);
})();
