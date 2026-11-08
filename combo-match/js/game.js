/* =========================================================
   game.js — logika rozgrywki Memory

   Odpowiada WYŁĄCZNIE za mechanikę gry: karty, timer, etapy,
   punktacja. Ekrany, API i nawigacja → flow.js.

   API:
     Game.start()      rozpocznij nową grę od odliczania 3, 2, 1 (każdy etap)
     Game.stop()       zatrzymaj grę natychmiast
     Game.pause()      zatrzymaj odliczanie/timer; false, jeśli gra już się skończyła
     Game.resume()     wznów timer
     Game.getScore()   aktualny wynik
     Game.getStage()   aktualny numer etapu
     Game.getDuration()  czas trwania gry w ms
   ========================================================= */
window.Game = (function () {

    /* =====================================================
       STAN GRY
       ===================================================== */
    // Układ kart pozostaje w JS, nigdy w atrybutach zakrytych elementów DOM.
    let cardDataByElement = new WeakMap();
    let flippedCards = [];
    let matchedPairs = 0;
    let totalPairs = 0;
    let score = 0;
    let multiplier = 1;
    let isLocked = false;
    let gameOver = false;
    let currentStage = 1;
    let gameStartedAt = 0;

    // Timer (countdown)
    let timerInterval = null;
    let remainingSeconds = 0;
    let timerStarted = false;
    let timerDeadline = 0;
    let countdownInterval = null;
    let countdownDeadline = 0;
    let paused = false;
    let pausedAt = 0;
    const stageTimeouts = new Set();

    /* =====================================================
       DOM
       ===================================================== */
    const $ = id => document.getElementById(id);

    function getEls() {
        return {
            board:       $('game-board'),
            score:       $('stat-score'),
            bonus:       $('stat-bonus'),
            hudBonus:    $('hud-bonus'),
            pairs:       $('stat-pairs'),
            time:        $('stat-time'),
            stageBadge:  $('stage-badge'),
            stageOverlay:$('stage-overlay'),
            stageTitle:  $('stage-overlay-title'),
            stageInfo:   $('stage-overlay-info'),
            stageScore:  $('stage-overlay-score'),
            stageTime:   $('stage-overlay-time'),
            btnNextStage:$('btn-next-stage'),
            btnStageRestart: $('btn-stage-restart'),
            btnStageFinish: $('btn-stage-finish')
        };
    }

    /* =====================================================
       DOPASOWANIE PLANSZY DO DOSTĘPNEJ SZEROKOŚCI I WYSOKOŚCI
       ===================================================== */
    let layoutObserver = null;
    let layoutFrame = null;

    function fitBoard() {
        const app = $('app');
        const block = $('play-block');
        const stage = $('stage');
        const board = $('game-board');
        if (!app || !block || !stage || !board) return;

        const appStyle = getComputedStyle(app);
        const boardStyle = getComputedStyle(board);
        const size = parseFloat(boardStyle.getPropertyValue('--card-size'));
        const rows = Number(boardStyle.getPropertyValue('--grid-rows'));
        const cols = Number(boardStyle.getPropertyValue('--grid-cols'));
        const gap = parseFloat(boardStyle.rowGap);
        const availableHeight = app.clientHeight
            - parseFloat(appStyle.paddingTop) - parseFloat(appStyle.paddingBottom);
        // Rezerwujemy rzeczywistą wysokość obu HUD-ów, odstępów i obramowania planszy.
        const overhead = block.getBoundingClientRect().height - board.getBoundingClientRect().height;
        const height = Math.min(size, (availableHeight - overhead - (rows - 1) * gap - 1) / rows);

        const stageStyle = getComputedStyle(stage);
        const availableWidth = stage.clientWidth
            - parseFloat(stageStyle.paddingLeft) - parseFloat(stageStyle.paddingRight);
        const width = Math.min(size, (availableWidth - (cols - 1) * gap) / cols);

        if (height >= size && width >= size) {
            board.style.removeProperty('--card-width');
            board.style.removeProperty('--card-height');
            return;
        }
        board.style.setProperty('--card-width', Math.max(1, Math.floor(width * 100) / 100) + 'px');
        board.style.setProperty('--card-height', Math.max(1, Math.floor(Math.min(width, height) * 100) / 100) + 'px');
    }

    function watchBoardLayout() {
        if (!layoutObserver) {
            layoutObserver = new ResizeObserver(() => {
                cancelAnimationFrame(layoutFrame);
                layoutFrame = requestAnimationFrame(fitBoard);
            });
            ['app', 'play-block', 'stage', 'game-board'].forEach(id => layoutObserver.observe($(id)));
        }
        fitBoard();
    }

    /* =====================================================
       NARZĘDZIA
       ===================================================== */

    function shuffle(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function formatTime(seconds) {
        const s = Math.max(0, seconds);
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return m + ':' + sec.toString().padStart(2, '0');
    }

    function vibrate(duration) {
        try {
            if (typeof navigator.vibrate === 'function') navigator.vibrate(duration);
        } catch {
            // Opcjonalna wibracja nie może przerwać gry, jeśli przeglądarka ją blokuje.
        }
    }

    function spawnParticles(x, y, color) {
        const count = 12;
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            const angle = (Math.PI * 2 * i) / count;
            const distance = 40 + Math.random() * 60;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance;
            particle.style.cssText =
                'left:' + x + 'px;top:' + y + 'px;background:' + color +
                ';box-shadow:0 0 6px ' + color +
                ';--tx:' + tx + 'px;--ty:' + ty + 'px';
            document.body.appendChild(particle);
            particle.addEventListener('animationend', () => particle.remove());
        }
    }

    function bumpStat(el) {
        if (!el) return;
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
    }

    /* =====================================================
       ETAPY
       ===================================================== */

    function getStageConfig(stageNum) {
        const stages = CONFIG.STAGES;
        if (stageNum <= stages.length) return stages[stageNum - 1];
        return stages[stages.length - 1];
    }

    function updateStageBadge() {
        const el = getEls().stageBadge;
        if (el) el.textContent = currentStage;
    }

    /* =====================================================
       BONUS UI
       ===================================================== */

    function updateBonusUI() {
        const els = getEls();
        if (els.bonus) els.bonus.textContent = 'x' + multiplier;
        if (els.hudBonus) {
            els.hudBonus.classList.remove('bonus-x1', 'bonus-x2', 'bonus-x3');
            if (multiplier >= 3) els.hudBonus.classList.add('bonus-x3');
            else if (multiplier === 2) els.hudBonus.classList.add('bonus-x2');
            else els.hudBonus.classList.add('bonus-x1');
        }
        bumpStat(els.bonus);
    }

    /* =====================================================
       TIMER (countdown)
       ===================================================== */

    function updateTimer() {
        if (!timerStarted || paused || gameOver) return;
        const seconds = Math.max(0, Math.ceil((timerDeadline - performance.now()) / 1000));
        const changed = seconds !== remainingSeconds;
        remainingSeconds = seconds;
        const els = getEls();
        if (els.time) els.time.textContent = formatTime(seconds);

        const timeItem = els.time ? els.time.closest('.hud-item') : null;
        if (timeItem) timeItem.classList.toggle('time-danger', seconds <= 10);
        if (changed && seconds > 0 && seconds <= 5) vibrate(80);
        if (seconds === 0) finishGame();
    }

    function startTimer(startedAt = performance.now()) {
        if (timerStarted) return;
        timerStarted = true;
        timerDeadline = startedAt + remainingSeconds * 1000;
        timerInterval = setInterval(updateTimer, 100);
        updateTimer();
    }

    function stopTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
        timerStarted = false;
    }

    function stopCountdown() {
        clearInterval(countdownInterval);
        countdownInterval = null;
        countdownDeadline = 0;
        const overlay = $('countdown-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    function updateCountdown() {
        if (countdownInterval === null || paused || gameOver) return;
        const seconds = Math.ceil((countdownDeadline - performance.now()) / 1000);
        if (seconds <= 0) {
            // Opóźniony callback nie przesuwa początku czasu rozgrywki.
            const startedAt = countdownDeadline;
            stopCountdown();
            isLocked = false;
            startTimer(startedAt);
            return;
        }
        const value = $('countdown-value');
        if (value && value.textContent !== String(seconds)) value.textContent = seconds;
    }

    function startCountdown() {
        stopCountdown();
        isLocked = true;
        countdownDeadline = performance.now() + 3000;
        const overlay = $('countdown-overlay');
        if (overlay) overlay.classList.remove('hidden');
        countdownInterval = setInterval(updateCountdown, 100);
        updateCountdown();
    }

    function scheduleStage(callback, delay) {
        const id = setTimeout(() => {
            stageTimeouts.delete(id);
            callback();
        }, delay);
        stageTimeouts.add(id);
    }

    function clearStageTimeouts() {
        stageTimeouts.forEach(id => clearTimeout(id));
        stageTimeouts.clear();
    }

    function resetTimer(seconds) {
        stopTimer();
        timerStarted = false;
        remainingSeconds = seconds;
        const els = getEls();
        if (els.time) els.time.textContent = formatTime(remainingSeconds);
        const timeItem = els.time ? els.time.closest('.hud-item') : null;
        if (timeItem) timeItem.classList.remove('time-danger');
    }

    /* =====================================================
       KARTY
       ===================================================== */

    function createCardElement(cardData) {
        const card = document.createElement('div');
        card.className = 'card';
        cardDataByElement.set(card, { id: cardData.id, src: cardData.src });

        card.innerHTML =
            '<div class="card-inner">' +
                '<div class="card-face card-back"></div>' +
                '<div class="card-face card-front"></div>' +
            '</div>';

        card.addEventListener('click', () => onCardClick(card));
        return card;
    }

    function createPlaceholder() {
        const el = document.createElement('div');
        el.className = 'card-placeholder';
        return el;
    }

    /* =====================================================
       LOGIKA GRY
       ===================================================== */

    function onCardClick(card) {
        if (gameOver || paused) return;
        if (isLocked || !timerStarted || !cardDataByElement.has(card)) return;
        if (card.classList.contains('flipped')) return;
        if (card.classList.contains('matched')) return;

        updateTimer();
        if (gameOver) return;

        const image = document.createElement('img');
        image.src = cardDataByElement.get(card).src;
        image.alt = '';
        image.draggable = false;
        card.querySelector('.card-front').replaceChildren(image);
        card.classList.add('flipped');
        flippedCards.push(card);

        if (flippedCards.length === 2) {
            checkForMatch();
        }
    }

    function checkForMatch() {
        const [card1, card2] = flippedCards;
        const isMatch = cardDataByElement.get(card1).id === cardDataByElement.get(card2).id;

        if (isMatch) handleMatch(card1, card2);
        else handleMismatch(card1, card2);
    }

    function handleMatch(card1, card2) {
        const earned = CONFIG.POINTS_BASE * multiplier;
        score += earned;
        matchedPairs++;

        multiplier = CONFIG.MAX_MULTIPLIER;

        const els = getEls();
        if (els.score) { els.score.textContent = score; bumpStat(els.score); }
        if (els.pairs) { els.pairs.textContent = matchedPairs + ' / ' + totalPairs; bumpStat(els.pairs); }
        updateBonusUI();

        card1.classList.add('matched');
        card2.classList.add('matched');

        vibrate(50);

        const rect1 = card1.getBoundingClientRect();
        const rect2 = card2.getBoundingClientRect();
        spawnParticles(rect1.left + rect1.width / 2, rect1.top + rect1.height / 2, '#F7B600');
        spawnParticles(rect2.left + rect2.width / 2, rect2.top + rect2.height / 2, '#F7B600');

        flippedCards = [];

        if (matchedPairs === totalPairs) {
            isLocked = true;
            stopTimer();
            scheduleStage(showStageComplete, 600);
        }
    }

    function handleMismatch(card1, card2) {
        isLocked = true;

        multiplier = Math.max(1, multiplier - 1);
        updateBonusUI();

        scheduleStage(() => {
            card1.classList.add('no-match');
            card2.classList.add('no-match');
        }, 400);

        scheduleStage(() => {
            [card1, card2].forEach(card => {
                card.classList.remove('flipped', 'no-match');
                card.querySelector('.card-front').replaceChildren();
            });
            flippedCards = [];
            isLocked = false;
        }, 1000);
    }

    /* =====================================================
       ZAKOŃCZENIE GRY (koniec czasu lub odbiór nagród między etapami)
       ===================================================== */

    function finishGame() {
        if (gameOver) return;
        stopTimer();
        stopCountdown();
        clearStageTimeouts();
        gameOver = true;
        isLocked = true;
        hideStageOverlay();

        const duration = Date.now() - gameStartedAt;

        if (window.Flow && Flow.onGameOver) {
            Flow.onGameOver(score, {
                stage: currentStage,
                duration: duration
            });
        }
    }

    /* =====================================================
       ZAKOŃCZENIE ETAPU (overlay wewnątrz gry)
       ===================================================== */

    function showStageComplete() {
        if (gameOver) return;
        stopTimer();
        isLocked = true;

        const config = getStageConfig(currentStage);
        const timeUsed = config.timeLimit - remainingSeconds;

        const els = getEls();
        if (els.stageOverlay) els.stageOverlay.classList.remove('hidden');
        if (els.stageTitle) els.stageTitle.textContent = T('game.stageComplete', { n: currentStage });
        if (els.stageInfo) els.stageInfo.textContent = T('game.nextStage', { n: currentStage + 1 });
        if (els.stageScore) els.stageScore.textContent = score;
        if (els.stageTime) els.stageTime.textContent = formatTime(timeUsed);
        if (els.btnStageFinish) {
            els.btnStageFinish.textContent = T(score >= CONFIG.PRIZE_MIN_SCORE
                ? 'game.finishBtn' : 'game.finishOnlyBtn');
        }

        // Celebration particles
        for (let i = 0; i < 5; i++) {
            scheduleStage(() => {
                const x = Math.random() * window.innerWidth;
                const y = Math.random() * window.innerHeight;
                const colors = ['#F7B600', '#FFE28A', '#3F47B8', '#98a0d0', '#eef1ff'];
                spawnParticles(x, y, colors[i % colors.length]);
            }, i * 200);
        }
    }

    function hideStageOverlay() {
        const els = getEls();
        if (els.stageOverlay) els.stageOverlay.classList.add('hidden');
    }

    function nextStage() {
        currentStage++;
        hideStageOverlay();
        initStage();
    }

    /* =====================================================
       INICJALIZACJA ETAPU
       ===================================================== */

    function initStage() {
        stopCountdown();
        clearStageTimeouts();
        cardDataByElement = new WeakMap();
        const config = getStageConfig(currentStage);
        totalPairs = config.pairs;
        const totalSlots = config.cols * config.rows;
        const totalCards = config.pairs * 2;
        const hasPlaceholder = totalSlots > totalCards;

        const els = getEls();
        const boardEl = els.board;
        if (!boardEl) return;

        boardEl.style.setProperty('--grid-cols', config.cols);
        boardEl.style.setProperty('--grid-rows', config.rows);

        updateStageBadge();

        // Reset state for this stage (score persists!)
        flippedCards = [];
        matchedPairs = 0;
        multiplier = 1;
        isLocked = true;
        gameOver = false;
        paused = false;
        pausedAt = 0;

        // Reset UI (keep score)
        if (els.score) els.score.textContent = score;
        if (els.pairs) els.pairs.textContent = '0 / ' + totalPairs;
        updateBonusUI();
        resetTimer(config.timeLimit);
        hideStageOverlay();

        // Pick images — zawsze połowa z puli „k", połowa z puli „v"
        let selectedImages;
        {
            const poolK = shuffle(CONFIG.CARD_IMAGES_K || []);
            const poolV = shuffle(CONFIG.CARD_IMAGES_V || []);
            const halfV = Math.floor(config.pairs / 2);
            const halfK = config.pairs - halfV;
            selectedImages = shuffle([
                ...poolK.slice(0, halfK),
                ...poolV.slice(0, halfV),
            ]);
        }
        const cardPairs = [...selectedImages, ...selectedImages];
        const cards = shuffle(cardPairs);

        // Clear and populate board
        boardEl.innerHTML = '';

        const slots = [];
        if (hasPlaceholder) {
            const centerIndex = Math.floor(totalSlots / 2);
            let cardIdx = 0;
            for (let i = 0; i < totalSlots; i++) {
                if (i === centerIndex) {
                    slots.push({ type: 'placeholder' });
                } else {
                    slots.push({ type: 'card', data: cards[cardIdx] });
                    cardIdx++;
                }
            }
        } else {
            cards.forEach(cardData => {
                slots.push({ type: 'card', data: cardData });
            });
        }

        slots.forEach((slot, i) => {
            let el;
            if (slot.type === 'placeholder') {
                el = createPlaceholder();
            } else {
                el = createCardElement(slot.data);
            }
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            boardEl.appendChild(el);

            scheduleStage(() => {
                el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, 50 + i * 40);
        });

        watchBoardLayout();
        startCountdown();
    }

    /* =====================================================
       API PUBLICZNE
       ===================================================== */

    function start() {
        currentStage = 1;
        score = 0;
        gameStartedAt = Date.now();
        initStage();
    }

    function stop() {
        stopTimer();
        stopCountdown();
        clearStageTimeouts();
        gameOver = true;
        isLocked = true;
    }

    function pause() {
        if (gameOver) return false;
        if (paused) return true;
        updateCountdown();
        updateTimer();
        if (gameOver) return false;
        pausedAt = performance.now();
        paused = true;
        return true;
    }

    function resume() {
        if (!paused || gameOver) return;
        const pauseDuration = performance.now() - pausedAt;
        if (timerStarted) timerDeadline += pauseDuration;
        if (countdownInterval !== null) countdownDeadline += pauseDuration;
        paused = false;
        updateCountdown();
        updateTimer();
    }

    /* =====================================================
       INIT — podpięcie przycisków w obrębie gry
       ===================================================== */

    function init() {
        const els = getEls();
        if (els.btnNextStage) {
            els.btnNextStage.addEventListener('click', nextStage);
        }
        if (els.btnStageRestart) {
            els.btnStageRestart.addEventListener('click', () => {
                hideStageOverlay();
                if (window.Flow && Flow.startGame) Flow.startGame();
            });
        }
        if (els.btnStageFinish) {
            els.btnStageFinish.addEventListener('click', finishGame);
        }
    }

    return {
        init,
        start,
        stop,
        pause,
        resume,
        getScore:    () => score,
        getStage:    () => currentStage,
        getDuration: () => Date.now() - gameStartedAt
    };
})();
