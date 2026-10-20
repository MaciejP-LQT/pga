/* =========================================================
   game.js — pętla gry (rAF + stały krok logiczny + interpolacja)
   Ten moduł zajmuje się TYLKO rozgrywką.
   Ekrany, nawigacja i sesja API → flow.js
   Interfejs:
     Game.start()   uruchamia rozgrywkę (woła flow.js po udanym
                    Api.startSession())
     Game.stop()    przerywa (np. przy wyjściu do menu)
   Po zakończeniu gry woła:
     Flow.onGameOver(score, endResult)
   =========================================================
   KLUCZOWE MECHANIZMY
   1. Przyspieszenie liczone od ZJEDZONYCH ELEMENTÓW (itemsEaten),
      nie od punktów — patrz checkSpeedup().
   2. Combo wygasa po N skrętach bez jedzenia (turnsSinceEat),
      nie po czasie — patrz registerRealTurn() / breakCombo().
   3. Próg swipe'a (JOY_STEP_PX / JOY_DEAD_ZONE) maleje wraz ze
      wzrostem prędkości gry — patrz updateInputSensitivity().
   4. Powrót z efektu spowolnienia jest płynny (ramp) i startuje
      dopiero przy najbliższym skręcie gracza — patrz
      updateStepFactor() / registerRealTurn().
   5. ZEGAR GRY (gameNow) — podczas pauzy obraz zamarza CAŁKOWICIE.
      Wszystko, co zależy od czasu (pulsowanie, miganie, expiresAt,
      rampa spowolnienia), używa gameNow() = performance.now() minus
      suma pauz. Surowe `now` zostaje tylko do liczenia dt.
   6. PLAYSTARTEDAT TYLKO PRZY PIERWSZYM WEJŚCIU W PLAY — odliczanie
      po wznowieniu (COUNTDOWN_ON_RESUME) nie resetuje punktu
      odniesienia dla czasu rozgrywki wysyłanego do API.
   7. LOG ZDARZEŃ (scoreLog) — każde zjedzenie/kara zapisuje się
      jako {t, v} (czas od startu gry w ms, wartość punktowa).
      Log leci do Api.endGame() jako trzeci argument i pozwala
      serwerowi zweryfikować, czy zgłoszony wynik faktycznie
      wynika z rozgrywki — patrz 01_limit_i_walidacja_wyniku.sql.
      Limit 4000 to higiena pamięci przeglądarki; realny limit
      liczby zdarzeń pilnuje serwer (MaxEventCount).
   8. WYDAJNOŚĆ RYSOWANIA — poświata boost/slow (shadowBlur) jest
      nakładana TYLKO na głowę. Blur na każdym segmencie kosztował
      tym więcej, im dłuższy wąż — patrz drawCourier().
   9. VISA x2 — złoto i samo "x2" są zarezerwowane dla karty Visa.
      Zebranie karty → UI.showVisaPop(); każde jedzenie w trakcie
      boosta → dopisek "VISA x2" — patrz eatItem() / grabPowerup().
      Combo NIE ma napisu na planszy — pokazuje je plakietka u góry
      (COMBO x2 + kropki). Dwa napisy jeden nad drugim wychodziły
      poza planszę przy krawędzi, szczególnie na mobile.
      Pilnowanie krawędzi dla wszystkich napisów → effects.js.
   ========================================================= */
window.Game = (function () {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const STATE = { IDLE:'idle', COUNT:'count', PLAY:'play', PAUSE:'pause', OVER:'over' };
    let state = STATE.IDLE;
    let snake=null, blink=null, power=null, items=[];
    let score=0, stepMs=CONFIG.START_STEP_MS, acc=0, lastTime=0;
    let tile=20, boardSize=400;
    let countIndex=-1, countTimer=0, afterCount=null;
    let combo=0, turnsSinceEat=0;
    let playStartedAt=0;
    let rafId=null;
    let overAnimationUntil=0;
    let lastPowerUiAt=-Infinity;
    let initialized=false;
    /* Diagnostyka: pomiar istniejacej petli, bez osobnego rAF/timera. */
    const perfDebug = (function () {
        let panel = null, previous = null, since = null;
        let frames = 0, intervals = 0, sum = 0, max = 0, logic = 0, render = 0;
        function reset() {
            previous = null; since = null;
            frames = intervals = sum = max = logic = render = 0;
        }
        function hide() { if (panel) panel.hidden = true; reset(); }
        function begin(now) {
            if (CONFIG.DEBUG_PERFORMANCE !== true) { hide(); return null; }
            if (!panel) {
                panel = document.createElement('pre');
                panel.id = 'delivery-performance';
                panel.setAttribute('aria-hidden', 'true');
                panel.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:1000;margin:0;padding:8px 10px;background:rgba(5,8,25,.94);color:#baf7cb;font:11px/1.45 monospace;pointer-events:none;white-space:pre;border-radius:6px;';
                document.body.appendChild(panel);
            }
            panel.hidden = false;
            if (since === null) { since = now; panel.textContent = 'FPS: pomiar...'; }
            if (previous !== null) {
                const delta = Math.max(0, now - previous);
                intervals++; sum += delta; max = Math.max(max, delta);
            }
            previous = now;
            return performance.now();
        }
        function end(now, start, drawStart) {
            if (start === null) return;
            const finish = performance.now();
            frames++; logic += drawStart - start; render += finish - drawStart;
            const refresh = Math.max(100, Number(CONFIG.DEBUG_PERFORMANCE_REFRESH_MS) || 500);
            if (now - since < refresh || !intervals) return;
            const fps = sum > 0 ? intervals * 1000 / sum : 0;
            panel.textContent = 'FPS: ' + fps.toFixed(1) +
                '\nKlatka avg/max: ' + (sum / intervals).toFixed(1) + ' / ' + max.toFixed(1) + ' ms' +
                '\nLogika avg: ' + (logic / frames).toFixed(2) + ' ms' +
                '\nRysowanie CPU avg: ' + (render / frames).toFixed(2) + ' ms' +
                '\nSegmenty: ' + (snake ? snake.cells.length : 0) +
                '\nCanvas: ' + canvas.width + 'x' + canvas.height + ' | ' + state;
            since = now; frames = intervals = sum = max = logic = render = 0;
        }
        return { begin, end, reset, hide };
    })();
    function haltLoop() {
        perfDebug.hide();
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = null;
    }
    function ensureLoop() {
        if (rafId === null && (state === STATE.PLAY || state === STATE.COUNT)) {
            lastTime = performance.now();
            rafId = requestAnimationFrame(frame);
        }
    }
    let itemsEaten=0, nextSpeedupAtItems=CONFIG.SPEEDUP_EVERY_ITEMS;
    let joyStepBase=CONFIG.JOY_STEP_PX, joyDeadBase=CONFIG.JOY_DEAD_ZONE;
    let currentFactor=1, rawFactorPrev=1;
    let pendingSlowRestore=false, slowPendingSince=0;
    let ramping=false, rampStartFactor=1, rampStartTime=0;
    /* zegar gry — stoi podczas pauzy */
    let pauseOffset=0, pausedAt=0, pausedWallMs=0;
    /* log zdarzeń do walidacji wyniku po stronie serwera */
    let scoreLog = [];
    let playStartedGameNow = 0;
    /** Czas gry: performance.now() minus suma wszystkich pauz. */
    function gameNow() { return performance.now() - pauseOffset; }
    /* =====================================================
       ROZMIAR PLANSZY
       ===================================================== */
    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const size = canvas.clientWidth;
        if (!size) return;
        const pixels = Math.round(size*dpr);
        if (canvas.width === pixels && canvas.height === pixels && boardSize === size) {
            tile = size / CONFIG.TILE_COUNT;
            return;
        }
        canvas.width  = pixels;
        canvas.height = Math.round(size*dpr);
        ctx.setTransform(dpr,0,0,dpr,0,0);
        ctx.imageSmoothingEnabled = true;
        boardSize = size;
        tile = size / CONFIG.TILE_COUNT;
    }
    function pickTileCount() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const touch = matchMedia('(pointer: coarse)').matches;
        const landscape = w > h;
        let klasa;
        if (landscape && w >= 820)  klasa = 'konsola/desktop (poziom)';
        else if (touch && w >= 700) klasa = 'KIOSK (duzy ekran dotykowy)';
        else if (touch)             klasa = 'telefon';
        else                        klasa = 'desktop';
        document.body.classList.toggle('is-landscape', landscape);
        document.body.classList.toggle('is-big-screen', w >= 700);
        if (!CONFIG.AUTO_TILE_COUNT) {
            console.info('[DeliveryRush] ' + klasa + ' | viewport ' + w + 'x' + h +
                ' | siatka STALA ' + CONFIG.TILE_COUNT + 'x' + CONFIG.TILE_COUNT);
            return;
        }
        const before = CONFIG.TILE_COUNT;
        if (w <= 400)      CONFIG.TILE_COUNT = CONFIG.TILE_COUNT_SMALL;
        else if (w <= 700) CONFIG.TILE_COUNT = CONFIG.TILE_COUNT_MOBILE;
        if (CONFIG.TILE_COUNT !== before)
            console.warn('[DeliveryRush] UWAGA: siatka zmieniona ' + before + ' -> ' +
                CONFIG.TILE_COUNT + '. Wyniki NIE sa porownywalne.');
    }
    /* =====================================================
       CZUŁOŚĆ WEJŚCIA — maleje wraz ze wzrostem prędkości
       ===================================================== */
    function updateInputSensitivity() {
        const span = CONFIG.START_STEP_MS - CONFIG.MIN_STEP_MS;
        const progress = span > 0
            ? Math.min(1, Math.max(0, (CONFIG.START_STEP_MS - stepMs) / span))
            : 0;
        const stepMin = CONFIG.JOY_STEP_PX_MIN != null ? CONFIG.JOY_STEP_PX_MIN : joyStepBase * 0.5;
        const deadMin = CONFIG.JOY_DEAD_ZONE_MIN != null ? CONFIG.JOY_DEAD_ZONE_MIN : joyDeadBase * 0.5;
        CONFIG.JOY_STEP_PX   = Math.round(joyStepBase - (joyStepBase - stepMin) * progress);
        CONFIG.JOY_DEAD_ZONE = Math.round(joyDeadBase - (joyDeadBase - deadMin) * progress);
    }
    /* =====================================================
       SYGNAŁ "PRAWDZIWY SKRĘT"
       ===================================================== */
    function registerRealTurn(now) {
        if (pendingSlowRestore) beginRampDown(now);
        turnsSinceEat++;
        if (CONFIG.COMBO_ENABLED && turnsSinceEat > CONFIG.COMBO_TURN_LIMIT) {
            breakCombo();
        } else {
            updateComboUI();
        }
    }
    /* =====================================================
       START / RESET
       ===================================================== */
    function resetGame() {
        perfDebug.reset();
        lastPowerUiAt = -Infinity;
        snake = Courier.create();
        blink = Blink.create();
        power = Powerups.create();
        score = 0;
        stepMs = CONFIG.START_STEP_MS;
        itemsEaten = 0;
        nextSpeedupAtItems = CONFIG.SPEEDUP_EVERY_ITEMS;
        acc=0; items=[]; combo=0; turnsSinceEat=0;
        currentFactor=1; rawFactorPrev=1;
        pendingSlowRestore=false; slowPendingSince=0;
        ramping=false; rampStartFactor=1; rampStartTime=0;
        pauseOffset=0; pausedAt=0; pausedWallMs=0;
        playStartedAt=0;
        playStartedGameNow=0;
        scoreLog = [];
        CONFIG.JOY_STEP_PX = joyStepBase;
        CONFIG.JOY_DEAD_ZONE = joyDeadBase;
        Effects.clear();
        if (Input.reset) Input.reset();
        const it = ItemFactory.spawnItem(snake.cells);
        if (it) items.push(it);
        UI.setScore(0);
        UI.setLevel(1);
        UI.setCombo(0);
        UI.setPowerups(power);
        UI.hideVisaPop();
    }
    /** Wywoływane przez flow.js po udanym Api.startSession(). */
    function start() {
        resetGame();
        if (UI.measureHud) UI.measureHud();
        beginCountdown(() => {
            if (!snake.started) {
                Courier.setDirection(snake, Input.getHeld() || CONFIG.AUTO_START_DIR);
                snake.started = true;
            }
        });
        if (rafId === null) {
            lastTime = performance.now();
            rafId = requestAnimationFrame(frame);
        }
    }
    /** Przerwanie rozgrywki bez ekranu końcowego (wyjście do menu). */
    function stop() {
        haltLoop();
        cancelCountdown();
        state = STATE.IDLE;
        pausedAt = 0;
        Input.show(false);
        Effects.clear();
        UI.hideHint();
        UI.setThumbZone(false);
        UI.setPowerups(null);
        UI.hideVisaPop();
        UI.showPause(false);
    }
    /* =====================================================
       ODLICZANIE
       ===================================================== */
    function beginCountdown(onFinish) {
        afterCount = onFinish;
        countIndex = 0;
        countTimer = CONFIG.COUNTDOWN_STEP_MS;
        acc = 0;
        state = STATE.COUNT;
        const labels = T('game.countdown');
        UI.showCountdown(labels[0]);
        UI.showHint(true);
        UI.setThumbZone(true);
        Input.show(true);
        resize();
        requestAnimationFrame(resize);
        lastTime = performance.now();
    }
    function updateCountdown(dt) {
        countTimer -= dt;
        if (countTimer > 0) return;
        const labels = T('game.countdown');
        countIndex++;
        if (countIndex < labels.length) {
            countTimer += CONFIG.COUNTDOWN_STEP_MS;
            UI.showCountdown(labels[countIndex]);
            return;
        }
        UI.hideCountdown();
        UI.showHint(false);
        countIndex = -1;
        acc = 0;
        state = STATE.PLAY;
        if (!playStartedAt) {
            playStartedAt = Date.now();
            playStartedGameNow = gameNow();
        }
        const cb = afterCount;
        afterCount = null;
        if (cb) cb();
    }
    function cancelCountdown(keep) {
        countIndex = -1;
        if (!keep) afterCount = null;
        UI.hideCountdown();
    }
    /* =====================================================
       PAUZA
       ===================================================== */
    function pauseGame() {
        if (state !== STATE.PLAY && state !== STATE.COUNT) return;
        if (state === STATE.COUNT) cancelCountdown(true);
        if (!pausedAt) pausedAt = performance.now();
        state = STATE.PAUSE;
        haltLoop();
        Input.show(false);
        UI.hideHint();
        UI.setThumbZone(false);
    }
    function resumeGame() {
        if (state !== STATE.PAUSE) return;
        if (pausedAt) {
            const paused = performance.now() - pausedAt;
            pauseOffset += paused;
            pausedWallMs += paused;
            pausedAt = 0;
        }
        if (CONFIG.COUNTDOWN_ON_RESUME) {
            beginCountdown(afterCount);
        } else {
            state = STATE.PLAY;
            UI.setThumbZone(true);
            Input.show(true);
            lastTime = performance.now();
        }
        ensureLoop();
    }
    /* =====================================================
       KONIEC GRY
       ===================================================== */
    function gameOver() {
        cancelCountdown();
        state = STATE.OVER;
        overAnimationUntil = performance.now() + 480;
        if (pausedAt) {
            const paused = performance.now() - pausedAt;
            pauseOffset += paused;
            pausedWallMs += paused;
            pausedAt = 0;
        }
        const head = snake.cells[0];
        Effects.burst(head.x, head.y, '#ff5252', 22, CONFIG.PARTICLE_SPEED*1.7);
        Effects.shake(CONFIG.SHAKE_DEATH_MS, CONFIG.SHAKE_DEATH_POWER);
        Effects.flash(CONFIG.FLASH_DEATH);
        Input.show(false);
        UI.hideHint();
        UI.setThumbZone(false);
        UI.setCombo(0);
        UI.setPowerups(null);
        UI.hideVisaPop();
        const finalScore = score;
        const durationMs = playStartedAt
            ? Math.max(0, (Date.now() - playStartedAt) - pausedWallMs)
            : null;
        const endPromise = Api.endGame(finalScore, durationMs, scoreLog);
        const delay = new Promise(res => setTimeout(res, 480));
        Promise.all([endPromise, delay]).then(([res]) => {
            if (state !== STATE.OVER) return;
            haltLoop();
            Flow.onGameOver(finalScore, res || { ok: false, eligible: false });
        });
    }
    /* =====================================================
       PUNKTACJA I PRĘDKOŚĆ
       ===================================================== */
    function effStep() { return stepMs * currentFactor; }
    function vibrate(duration) {
        if (!CONFIG.HAPTIC_FEEDBACK) return;
        try {
            if (typeof navigator.vibrate === 'function') navigator.vibrate(duration);
        } catch {
            // Opcjonalna wibracja nie może przerwać gry, jeśli przeglądarka ją blokuje.
        }
    }
    function addScore(points) {
        score = Math.max(0, score + points);
        UI.setScore(score);
    }
    function checkSpeedup() {
        let changed = false;
        while (itemsEaten >= nextSpeedupAtItems && stepMs > CONFIG.MIN_STEP_MS) {
            stepMs = Math.max(CONFIG.MIN_STEP_MS, stepMs - CONFIG.SPEEDUP_MS);
            nextSpeedupAtItems += CONFIG.SPEEDUP_EVERY_ITEMS;
            changed = true;
        }
        UI.setLevel(1 + Math.floor((CONFIG.START_STEP_MS - stepMs)/CONFIG.SPEEDUP_MS));
        if (changed) updateInputSensitivity();
    }
    function occupied() {
        return snake.cells.concat(items, Powerups.cells(power));
    }
    function respawnItem() {
        items = items.filter(i => i.kind !== 'item');
        const it = ItemFactory.spawnItem(occupied());
        if (it) items.push(it);
        const hasPen = items.some(i => i.kind === 'penalty');
        if (CONFIG.PENALTY_ENABLED && !hasPen &&
            score >= CONFIG.PENALTY_AFTER_SCORE &&
            Math.random() < CONFIG.PENALTY_CHANCE) {
            const p = ItemFactory.spawnPenalty(occupied());
            if (p) items.push(p);
        }
    }
    function comboTurnsLeft() {
        return Math.max(0, CONFIG.COMBO_TURN_LIMIT - turnsSinceEat);
    }
    function updateComboUI() {
        UI.setCombo(combo, comboTurnsLeft(), CONFIG.COMBO_TURN_LIMIT);
    }
    function bumpCombo() {
        if (!CONFIG.COMBO_ENABLED) return 1;
        combo = Math.min(CONFIG.COMBO_MAX, combo+1);
        turnsSinceEat = 0;
        updateComboUI();
        return combo;
    }
    function breakCombo() {
        combo = 0; turnsSinceEat = 0;
        updateComboUI();
    }
    /** Zapis zdarzenia do logu walidacyjnego - patrz komentarz #7. */
    function logScoreEvent(value) {
        if (scoreLog.length < 4000) {
            scoreLog.push({ t: Math.round(gameNow() - playStartedGameNow), v: value });
        }
    }
    /** Pozycja dopisku: nad elementem, a przy górnej krawędzi pod nim
        (żeby nie nachodził na "+punkty", które effects.js dociska w dół). */
    function tagY(y) { return y >= 2 ? y - 1 : y + 1; }
    function eatItem(item) {
        vibrate(CONFIG.HAPTIC_ITEM_MS);
        const cMult = bumpCombo();
        const bMult = Powerups.scoreMultiplier(power);
        const gained = item.points * cMult * bMult;
        const hasCombo = cMult >= CONFIG.COMBO_MIN;
        const hasVisa  = bMult > 1;
        Courier.grow(snake, item.grow);
        addScore(gained);
        logScoreEvent(gained);
        itemsEaten++;
        checkSpeedup();
        Blink.trigger(blink, false);
        Effects.burst(item.x, item.y, item.color);
        /* punkty: złote TYLKO przy Visie */
        Effects.floatText(item.x, item.y, '+'+gained,
                          hasVisa ? CONFIG.BOOST_COLOR : '#b9f6ca',
                          hasCombo || hasVisa);
        Effects.shake(CONFIG.SHAKE_EAT_MS, CONFIG.SHAKE_EAT_POWER);
        /* jedyny dopisek na planszy = Visa; combo widać na plakietce u góry */
        if (hasVisa) {
            Effects.floatText(item.x, tagY(item.y),
                T('game.visaTag', { mult: CONFIG.BOOST_MULTIPLIER }),
                CONFIG.BOOST_COLOR, false);
        }
        respawnItem();
    }
    function hitPenalty(item) {
        vibrate(CONFIG.HAPTIC_PENALTY_MS);
        Courier.shrink(snake, item.shrink);
        addScore(item.points);
        logScoreEvent(item.points);
        Blink.trigger(blink, true);
        breakCombo();
        Effects.burst(item.x, item.y, '#8d6e63', 18, CONFIG.PARTICLE_SPEED*1.4);
        Effects.floatText(item.x, item.y, String(item.points), '#ff8a80', true);
        Effects.shake(CONFIG.SHAKE_PENALTY_MS, CONFIG.SHAKE_PENALTY_POWER);
        Effects.flash(CONFIG.FLASH_PENALTY);
        items = items.filter(i => i !== item);
    }
    function grabPowerup(hit, x, y) {
        vibrate(CONFIG.HAPTIC_ITEM_MS);
        const isBoost = hit.def.id === 'boost';
        const color = hit.def.color();
        Effects.burst(x, y, color, isBoost ? 26 : 16, CONFIG.PARTICLE_SPEED*1.5);
        /* Visa: duży napis z logo na środku planszy zamiast małego "x2" */
        if (isBoost) UI.showVisaPop();
        else Effects.floatText(x, y, 'SLOW', color, true);
        Effects.shake(isBoost?CONFIG.SHAKE_BOOST_MS:CONFIG.SHAKE_SLOW_MS,
                      isBoost?CONFIG.SHAKE_BOOST_POWER:CONFIG.SHAKE_SLOW_POWER);
        Effects.flash(isBoost?CONFIG.FLASH_BOOST:CONFIG.FLASH_SLOW);
        Blink.trigger(blink, true);
        if (!isBoost) acc = 0;
    }
    function logicStep(now) {
        if (!snake.started) return;
        if (!snake.queue.length) Courier.setDirection(snake, Input.getHeld());
        const head = Courier.step(snake);
        if (Courier.hitsWall(head) || Courier.hitsSelf(snake)) { gameOver(); return; }
        const grabbed = Powerups.collectAt(power, head.x, head.y);
        if (grabbed) grabPowerup(grabbed, head.x, head.y);
        const hit = items.find(i => i.x===head.x && i.y===head.y);
        if (hit) {
            if (hit.kind === 'item') eatItem(hit);
            else hitPenalty(hit);
        }
        items = items.filter(i => i.kind !== 'penalty' || i.expiresAt > now);

        /* Pełna plansza: przy zjedzeniu mogło nie być wolnego pola.
           Ogon zwalnia miejsce, więc próbujemy w każdym kroku. */
        if (!items.some(i => i.kind === 'item')) {
            const it = ItemFactory.spawnItem(occupied());
            if (it) items.push(it);
        }
    }
    /* =====================================================
       POWRÓT ZE SPOWOLNIENIA (płynna rampa)
       ===================================================== */
    function beginRampDown(now) {
        pendingSlowRestore = false;
        ramping = true;
        rampStartFactor = currentFactor;
        rampStartTime = now;
    }
    function updateStepFactor(now) {
        const rawFactor = Powerups.stepFactor(power);
        if (rawFactorPrev > 1 && rawFactor === 1 && !pendingSlowRestore && !ramping) {
            pendingSlowRestore = true;
            slowPendingSince = now;
            currentFactor = rawFactorPrev;
        }
        if (pendingSlowRestore) {
            const maxWait = CONFIG.SLOW_RESTORE_MAX_WAIT_MS || 1200;
            if (now - slowPendingSince >= maxWait) beginRampDown(now);
        }
        if (ramping) {
            const rampMs = CONFIG.SLOW_RAMP_MS || 0;
            if (rampMs <= 0) {
                currentFactor = rawFactor;
                ramping = false;
            } else {
                const t = Math.min(1, (now - rampStartTime) / rampMs);
                currentFactor = rampStartFactor + (1 - rampStartFactor) * t;
                if (t >= 1) ramping = false;
            }
        } else if (!pendingSlowRestore) {
            currentFactor = rawFactor;
        }
        if (rawFactor > 1 && (ramping || pendingSlowRestore)) {
            ramping = false;
            pendingSlowRestore = false;
            currentFactor = rawFactor;
        }
        rawFactorPrev = rawFactor;
    }
    /* =====================================================
       RENDEROWANIE
       ===================================================== */
    function lerp(a,b,t){ return a+(b-a)*t; }
    function drawGrid() {
        /* Delivery Rush: półprzezroczysta plansza — miasto prześwituje przez siatkę */
        ctx.clearRect(0,0,boardSize,boardSize);
        ctx.fillStyle = 'rgba(12,15,52,.66)';
        ctx.fillRect(0,0,boardSize,boardSize);
        if (power.slow.active)       ctx.strokeStyle = 'rgba(144,202,249,.30)';
        else if (power.boost.active) ctx.strokeStyle = 'rgba(247,182,0,.26)';
        else                         ctx.strokeStyle = 'rgba(150,160,255,.20)';
        ctx.lineWidth = 1;
        for (let i=1;i<CONFIG.TILE_COUNT;i++){
            const p = Math.round(i*tile)+.5;
            ctx.beginPath(); ctx.moveTo(p,0); ctx.lineTo(p,boardSize); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0,p); ctx.lineTo(boardSize,p); ctx.stroke();
        }
    }
    function drawSprite(key,px,py,size,angle) {
        const img = Assets.get(key);
        if (!img || !img.complete || !img.naturalWidth) {
            ctx.fillStyle = key==='body' ? '#1A1F71' : '#F7B600';
            ctx.fillRect(px,py,size,size);
            return;
        }
        if (!angle) { ctx.drawImage(img,px,py,size,size); return; }
        ctx.save();
        ctx.translate(px+size/2, py+size/2);
        ctx.rotate(angle);
        ctx.drawImage(img,-size/2,-size/2,size,size);
        ctx.restore();
    }
    function angleOf(d){
        if(d.x===1)return 0;
        if(d.x===-1)return Math.PI;
        if(d.y===1)return Math.PI/2;
        return -Math.PI/2;
    }
    const CORNERS = {
        '1,0|0,1':0,'0,-1|-1,0':0,
        '0,1|-1,0':Math.PI/2,'1,0|0,-1':Math.PI/2,
        '-1,0|0,-1':Math.PI,'0,1|1,0':Math.PI,
        '0,-1|1,0':-Math.PI/2,'-1,0|0,1':-Math.PI/2
    };
    function drawPowerupMarkers(now) {
        Powerups.markers(power).forEach(({marker:mk, def}) => {
            const left = mk.expiresAt - now;
            if (left < 1600 && Math.floor(left/140)%2===0) return;
            const pulseMs = def.pulse();
            const phase = ((now-mk.born)%pulseMs)/pulseMs;
            const wave = Math.sin(phase*Math.PI*2);
            const size = tile*0.96*(1+wave*0.10);
            const off = (tile-size)/2;
            ctx.save();
            ctx.globalAlpha = 0.28+0.22*wave;
            ctx.fillStyle = def.color();
            ctx.beginPath();
            ctx.arc(mk.x*tile+tile/2, mk.y*tile+tile/2, tile*0.78, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
            drawSprite(phase>0.5?def.spriteHot:def.sprite,
                       mk.x*tile+off, mk.y*tile+off, size, 0);
        });
    }
    function drawItems(now) {
        items.forEach(item => {
            const pulse = 1+Math.sin((now-item.born)/220)*0.06;
            const size = tile*0.92*pulse;
            const off = (tile-size)/2;
            if (item.kind==='penalty') {
                const left = item.expiresAt-now;
                if (left<1800 && Math.floor(left/150)%2===0) return;
            }
            drawSprite(item.sprite, item.x*tile+off, item.y*tile+off, size, 0);
        });
    }
    function drawCourier(t) {
        const cells=snake.cells, prev=snake.prev;
        const move = snake.started && state===STATE.PLAY ? t : 1;
        const slow = power.slow.active;
        const hot  = power.boost.active;
        const glow = slow||hot;
        for (let i=cells.length-1;i>=0;i--) {
            const cur=cells[i], old=prev[i]||cur;
            const x=lerp(old.x,cur.x,move)*tile;
            const y=lerp(old.y,cur.y,move)*tile;
            if (i===0) {
                const key = slow?'headSlow' : hot?'headBoost'
                          : (blink?Blink.spriteKey(blink):'head');
                /* FIX wydajności: shadowBlur tylko na głowie (1 rozmycie
                   na klatkę zamiast jednego na każdy segment). Kolor
                   ciała i tak sygnalizuje boost/slow (bodyBoost/bodySlow). */
                if (glow) {
                    ctx.save();
                    ctx.shadowColor = slow ? CONFIG.SLOW_COLOR : CONFIG.BOOST_COLOR;
                    ctx.shadowBlur = tile*(slow?0.7:0.55);
                }
                drawSprite(key,x,y,tile,angleOf(snake.dir));
                if (glow) ctx.restore();
            } else if (i===cells.length-1 && cells.length>2) {
                const b=cells[i-1];
                drawSprite('tail',x,y,tile,angleOf({x:b.x-cur.x,y:b.y-cur.y}));
            } else {
                const nx=cells[i-1], pv=cells[i+1];
                let drawn=false;
                if (nx&&pv) {
                    const inD={x:cur.x-pv.x,y:cur.y-pv.y};
                    const outD={x:nx.x-cur.x,y:nx.y-cur.y};
                    if ((inD.x!==outD.x||inD.y!==outD.y)&&(inD.x||inD.y)&&(outD.x||outD.y)) {
                        const a=CORNERS[inD.x+','+inD.y+'|'+outD.x+','+outD.y];
                        if (a!==undefined) { drawSprite('corner',x,y,tile,a); drawn=true; }
                    }
                }
                if (!drawn) drawSprite(slow?'bodySlow':hot?'bodyBoost':'body',x,y,tile,0);
            }
        }
    }
    /* =====================================================
       PĘTLA
       ===================================================== */
    function frame(now) {
        rafId = null;
        if (state === STATE.IDLE || state === STATE.PAUSE ||
            (state === STATE.OVER && now >= overAnimationUntil)) return;
        const perfStart = perfDebug.begin(now);
        let dt = now-lastTime;
        lastTime = now;
        if (dt>250) dt=250;
        const gnow = gameNow();
        if (state===STATE.COUNT) updateCountdown(dt);
        if (state===STATE.PLAY) {
            acc += dt;
            Powerups.update(power, dt, gnow, score, ()=>ItemFactory.freeCell(occupied()));
            updateStepFactor(gnow);
            if (now - lastPowerUiAt >= 50) {
                UI.setPowerups(power);
                lastPowerUiAt = now;
            }
            let step = effStep();
            while (acc>=step) {
                acc-=step;
                logicStep(gnow);
                if (state!==STATE.PLAY) { acc=0; break; }
                step = effStep();
            }
        }
        if (blink && (state===STATE.PLAY||state===STATE.COUNT)) Blink.update(blink,dt);
        if (state!==STATE.PAUSE) Effects.update(dt);
        const perfDrawStart = perfStart === null ? null : performance.now();
        ctx.clearRect(0,0,boardSize,boardSize);
        const sh = state===STATE.PAUSE ? {x:0,y:0} : Effects.shakeOffset();
        ctx.save();
        ctx.translate(sh.x, sh.y);
        drawGrid();
        if (snake) {
            drawPowerupMarkers(gnow);
            drawItems(gnow);
            drawCourier(state===STATE.PLAY ? Math.min(1, acc/effStep()) : 1);
            Effects.draw(ctx, tile);
        }
        Effects.drawFlash(ctx, boardSize);
        ctx.restore();
        perfDebug.end(now, perfStart, perfDrawStart);
        if (state === STATE.PLAY || state === STATE.COUNT ||
            (state === STATE.OVER && now < overAnimationUntil)) {
            rafId = requestAnimationFrame(frame);
        }
    }
    /* =====================================================
       ZDARZENIA
       ===================================================== */
    function bindEvents() {
        const exitBtn = document.getElementById('btn-game-exit');
        if (exitBtn) exitBtn.addEventListener('click', () => {
            if (state !== STATE.PLAY && state !== STATE.COUNT) return;
            pauseGame();
            Flow.confirmExit('home');
        });
        window.addEventListener('keydown', e => {
            const tag = (e.target && e.target.tagName || '').toUpperCase();
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (e.key === 'Escape' || e.key === 'p') {
                if (state === STATE.PLAY || state === STATE.COUNT) {
                    pauseGame();
                    Flow.confirmExit('home');
                }
            }
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && state === STATE.PLAY) pauseGame();
            else if (!document.hidden && state === STATE.PAUSE &&
                     Screens.current() === 'game') resumeGame();
        });
        window.addEventListener('resize', () => { pickTileCount(); resize(); });
        window.addEventListener('orientationchange',
            () => setTimeout(() => { pickTileCount(); resize(); }, 200));
        if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
        window.addEventListener('gamepadconnected', () =>
            document.body.classList.add('has-gamepad'));
        window.addEventListener('gamepaddisconnected', () => {
            if (!Input.hasGamepad || !Input.hasGamepad())
                document.body.classList.remove('has-gamepad');
        });
        if (Input.hasGamepad && Input.hasGamepad())
            document.body.classList.add('has-gamepad');
    }
    /* =====================================================
       INIT
       ===================================================== */
    function init() {
        if (initialized) return;
        initialized = true;
        pickTileCount();
        UI.init();
        power = Powerups.create();
        resize();
        joyStepBase = CONFIG.JOY_STEP_PX;
        joyDeadBase = CONFIG.JOY_DEAD_ZONE;
        Input.init(dir => {
            if (!snake) return;
            if (state!==STATE.PLAY && state!==STATE.COUNT) return;
            const was = snake.started;
            const turned = Courier.setDirection(snake, dir);
            if (state===STATE.COUNT) snake.started = was;
            UI.hideHint();
            if (turned && state===STATE.PLAY) registerRealTurn(gameNow());
        });
        Input.show(false);
        bindEvents();
    }
    return {
        init, start, stop,
        pause: pauseGame,
        resume: resumeGame,
        isPlaying: () => state === STATE.PLAY,
        getComboTurnsLeft: () => Math.max(0, CONFIG.COMBO_TURN_LIMIT - turnsSinceEat),
        isSlowPending: () => pendingSlowRestore
    };
})();
/* =========================================================
   BOOTSTRAP — uruchomienie aplikacji
   ========================================================= */
(function () {
    function boot() {
        window.Game.init();
        window.Flow.init();
    }
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
