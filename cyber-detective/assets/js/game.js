/* =========================================================
   game.js - petla gry labiryntowej (Maze)
   Interfejs identyczny jak w Snake:
     Game.init / start / stop / pause / resume
   Po utracie ostatniego zycia wola Flow.onGameOver(score, endResult).
   - Zegar gry (gameNow) - na pauzie wszystko zamiera.
   - playStartedAt ustawiane RAZ - cala gra to jedna sesja API.
   - scoreLog - kazde addScore(n) zapisuje {t, v} do walidacji.
   - Drony pojawiaja sie w bezpiecznej odleglosci + oslona gracza
     po odrodzeniu (patrz drones.js, HERO_SHIELD_MS).
   ZMIANA (stale plansze na pierwszych poziomach):
   - Poziomy 1..CONFIG.FIXED_LAYOUT_LEVELS maja ZAWSZE ten sam uklad
     labiryntu i to samo rozmieszczenie pol Boost/Slow. Uzywamy
     stalego ziarna (seed) - Maze.make() juz je obsluguje.
   - Kolejne poziomy generuja sie losowo, jak wczesniej.
   - Ziarna mozna podac recznie w CONFIG.FIXED_LEVEL_SEEDS, zeby
     "zamrozic" konkretne uklady, ktore sie spodobaly.
   - Losowe zostaja: ruch dronow i pojawianie sie przedmiotow
     (to jest rozgrywka, nie plansza).
   ZMIANA (wyczyszczenie labiryntu):
   - Po zjedzeniu ostatniej lupy gra zatrzymuje sie na
     CONFIG.LEVEL_CLEAR_DELAY_MS (stan CLEAR): wybuch, "+500",
     migajace sciany, "LABIRYNT CZYSTY!". Dopiero potem nowy poziom.
   ========================================================= */
window.Game = (function () {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const STATE = { IDLE: 'idle', COUNT: 'count', PLAY: 'play',
                    PAUSE: 'pause', DYING: 'dying', OVER: 'over', CLEAR: 'clear' };
    let state = STATE.IDLE;
    let clearLeft = 0;
    let mz = null, hero = null, drones = [], tokens = null, powerCells = [];
    let item = null, itemTimer = 0;
    let score = 0, level = 1, lives = CONFIG.LIVES;
    let tokensLeft = 0, captureChain = 0;
    let heroStep = CONFIG.HERO_STEP_MS, droneStep = CONFIG.DRONE_STEP_MS;
    let heroAcc = 0, lastTime = 0;
    let boostLeft = 0, slowLeft = 0;
    let heroShield = 0;
    let dyingLeft = 0;
    let countIndex = -1, countTimer = 0;
    let tile = 20, boardW = 0, boardH = 0, offX = 0, offY = 0;
    let blinkTimer = 2000, blinkClosed = 0;
    let rafId = null;
    let pauseOffset = 0, pausedAt = 0, pausedWallMs = 0;
    let playStartedAt = 0, playStartedGameNow = 0;
    let scoreLog = [];
    function gameNow() { return performance.now() - pauseOffset; }

    /* ---------------- canvas ---------------- */
    function resize() {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (!w || !h) return;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = true;
        if (!mz) { boardW = w; boardH = h; return; }
        tile = Math.floor(Math.min(w / mz.cols, h / mz.rows));
        boardW = tile * mz.cols;
        boardH = tile * mz.rows;
        offX = Math.round((w - boardW) / 2);
        offY = Math.round((h - boardH) / 2);
    }

    /* ---------------- stale plansze ---------------- */
    /** Ziarno dla poziomu albo null (= poziom losowy). */
    function levelSeed(lvl) {
        const fixed = CONFIG.FIXED_LAYOUT_LEVELS || 0;
        if (lvl > fixed) return null;
        const seeds = CONFIG.FIXED_LEVEL_SEEDS || [];
        const s = seeds[lvl - 1];
        /* 0 nie moze byc ziarnem (Maze.make traktuje je jak "brak") */
        return (s && s > 0) ? s : 1000 + lvl * 7919;
    }
    /** Powtarzalny generator liczb 0..1 dla danego ziarna
        (ten sam algorytm co w maze.js). */
    function seededRandom(seed) {
        let rnd = seed;
        return function () {
            rnd = (rnd * 1664525 + 1013904223) % 4294967296;
            return rnd / 4294967296;
        };
    }

    /* ---------------- budowa poziomu ---------------- */
    function pickMazeSize() {
        if (!CONFIG.AUTO_MAZE_SIZE) return { c: CONFIG.MAZE_COLS, r: CONFIG.MAZE_ROWS };
        return window.innerWidth <= 700
            ? { c: CONFIG.MAZE_COLS_MOBILE, r: CONFIG.MAZE_ROWS_MOBILE }
            : { c: CONFIG.MAZE_COLS, r: CONFIG.MAZE_ROWS };
    }
    function buildLevel(keepScore) {
        if (!keepScore) level = 1;
        const size = pickMazeSize();
        const seed = levelSeed(level);
        /* rng do rozmieszczenia pol Boost/Slow - staly na stalych poziomach */
        const rng = seed ? seededRandom(seed + 17) : Math.random;
        mz = seed ? Maze.make(size.c, size.r, seed) : Maze.make(size.c, size.r);
        const cells = Maze.paths(mz);
        const cx = Math.floor(mz.cols / 2) | 1;
        const cy = Math.floor(mz.rows / 2) | 1;
        const startCell = Maze.canMove(mz, cx, cy)
            ? { x: cx, y: cy }
            : cells[Math.floor(cells.length / 2)];
        hero = {
            x: startCell.x, y: startCell.y,
            px: startCell.x, py: startCell.y,
            dir: { x: 1, y: 0 }, next: null, moving: false
        };
        tokens = new Set();
        cells.forEach(function (c) {
            if (c.x === hero.x && c.y === hero.y) return;
            tokens.add(c.x + ':' + c.y);
        });
        powerCells = [];
        const far = cells.filter(function (c) {
            return Math.abs(c.x - hero.x) + Math.abs(c.y - hero.y) > Math.floor(mz.cols / 3);
        });
        const placed = [];
        function place(kind, n) {
            for (let i = 0; i < n && far.length; i++) {
                let best = null, bestD = -1;
                for (let t = 0; t < 24; t++) {
                    const c = far[Math.floor(rng() * far.length)];
                    const d = placed.length
                        ? Math.min.apply(null, placed.map(function (p) {
                            return Math.abs(p.x - c.x) + Math.abs(p.y - c.y); }))
                        : 999;
                    if (d > bestD) { bestD = d; best = c; }
                }
                if (!best) break;
                powerCells.push({ kind: kind, x: best.x, y: best.y, born: gameNow() });
                placed.push(best);
                tokens.delete(best.x + ':' + best.y);
            }
        }
        if (CONFIG.BOOST_ENABLED) place('boost', CONFIG.BOOST_COUNT);
        if (CONFIG.SLOW_ENABLED)  place('slow',  CONFIG.SLOW_COUNT);
        tokensLeft = tokens.size;
        drones = Drones.create(mz, CONFIG.DRONE_COUNT, hero);
        item = null;
        itemTimer = CONFIG.ITEM_EVERY_MS;
        boostLeft = 0; slowLeft = 0; captureChain = 0;
        heroShield = CONFIG.HERO_SHIELD_MS || 0;
        heroAcc = 0;
        if (!keepScore) {
            score = 0; lives = CONFIG.LIVES;
            scoreLog = [];
            playStartedAt = 0; playStartedGameNow = 0;
            pauseOffset = 0; pausedAt = 0; pausedWallMs = 0;
        }
        heroStep = Math.max(CONFIG.MIN_STEP_MS,
                   CONFIG.HERO_STEP_MS - (level - 1) * CONFIG.SPEEDUP_EVERY_LEVEL);
        droneStep = Math.max(CONFIG.MIN_STEP_MS,
                   CONFIG.DRONE_STEP_MS - (level - 1) * CONFIG.SPEEDUP_EVERY_LEVEL);
        Effects.clear();
        resize();
        UI.setScore(score); UI.setLevel(level); UI.setLives(lives);
        UI.setPowerups(null);
    }

    /* ---------------- odliczanie ---------------- */
    function beginCountdown() {
        countIndex = 0;
        countTimer = CONFIG.COUNTDOWN_STEP_MS;
        state = STATE.COUNT;
        UI.hideBanner();
        UI.showCountdown(T('game.countdown')[0]);
        UI.showHint(true);
        UI.setThumbZone(true);
        Input.show(true);
        resize();
        lastTime = performance.now();
    }
    function updateCountdown(dt) {
        countTimer -= dt;
        if (countTimer > 0) return;
        countIndex++;
        const labels = T('game.countdown');
        if (countIndex < labels.length) {
            countTimer += CONFIG.COUNTDOWN_STEP_MS;
            UI.showCountdown(labels[countIndex]);
            return;
        }
        UI.hideCountdown();
        UI.showHint(false);
        countIndex = -1;
        heroAcc = 0;
        state = STATE.PLAY;
        if (!playStartedAt) {
            playStartedAt = Date.now();
            playStartedGameNow = gameNow();
        }
    }

    /* ---------------- stany ---------------- */
    function start() {
        buildLevel(false);
        beginCountdown();
        if (rafId === null) {
            lastTime = performance.now();
            rafId = requestAnimationFrame(frame);
        }
    }
    /* ostatnia lupa zjedzona: zatrzymaj gre i pokaz moment wyczyszczenia */
    function levelCleared() {
        state = STATE.CLEAR;
        clearLeft = CONFIG.LEVEL_CLEAR_DELAY_MS || 1800;
        hero.px = hero.x; hero.py = hero.y;
        heroAcc = 0;
        boostLeft = 0; slowLeft = 0; captureChain = 0;
        UI.setPowerups(null);
        UI.hideHint();
        const bonus = addScore(CONFIG.LEVEL_CLEAR_BONUS || 500, false);
        Effects.burst(hero.x, hero.y, '#FFC22E', 30, CONFIG.PARTICLE_SPEED * 1.8);
        Effects.flash(CONFIG.FLASH_BOOST);
        UI.hideBanner();
        /* jeden komunikat na srodku planszy przez cala pauze (styl jak Visa x2) */
        if (UI.showClearPop) UI.showClearPop(T('game.mazeClear', { level: level }), '+' + bonus, clearLeft);
        else UI.banner(T('game.mazeClear', { level: level }), 'win', clearLeft);
    }
    function nextLevel() {
        level++;
        if (UI.hideClearPop) UI.hideClearPop();
        buildLevel(true);
        beginCountdown();      /* odliczanie i tak ukrywa banner - bez migniecia "POZIOM X" */
    }
    function pauseGame() {
        if (state !== STATE.PLAY && state !== STATE.COUNT) return;
        if (!pausedAt) pausedAt = performance.now();
        state = STATE.PAUSE;
        Input.show(false);
        UI.hideHint();
        UI.setThumbZone(false);
    }
    function closePause() {
        if (pausedAt) {
            const paused = performance.now() - pausedAt;
            pauseOffset += paused;
            pausedWallMs += paused;
            pausedAt = 0;
        }
    }
    function resumeGame() {
        if (state !== STATE.PAUSE) return;
        closePause();
        if (CONFIG.COUNTDOWN_ON_RESUME) {
            beginCountdown();
        } else {
            state = STATE.PLAY;
            UI.setThumbZone(true);
            Input.show(true);
            lastTime = performance.now();
        }
    }
    function stop() {
        state = STATE.IDLE;
        pausedAt = 0;
        Input.show(false);
        Effects.clear();
        UI.hideHint(); UI.hideBanner(); UI.hideCountdown();
        if (UI.hidePowerPop) UI.hidePowerPop();
        if (UI.hideClearPop) UI.hideClearPop();
        UI.setThumbZone(false);
        UI.setPowerups(null);
    }

    /* ---------------- koniec gry ---------------- */
    function gameOver() {
        state = STATE.OVER;
        closePause();
        Input.show(false);
        UI.hideHint();
        UI.setThumbZone(false);
        UI.setPowerups(null);
        const finalScore = score;
        const durationMs = playStartedAt
            ? Math.max(0, (Date.now() - playStartedAt) - pausedWallMs)
            : null;
        const endPromise = Api.endGame(finalScore, durationMs, scoreLog);
        const delay = new Promise(function (res) { setTimeout(res, 900); });
        Promise.all([endPromise, delay]).then(function (arr) {
            if (state !== STATE.OVER) return;
            UI.hideBanner();
            Flow.onGameOver(finalScore, arr[0] || { ok: false, eligible: false });
        });
    }
    function loseLife() {
        lives--;
        UI.setLives(lives);
        Effects.burst(hero.x, hero.y, '#ff5252', 24, CONFIG.PARTICLE_SPEED * 1.7);
        Effects.shake(CONFIG.SHAKE_DEATH_MS, CONFIG.SHAKE_DEATH_POWER);
        Effects.flash(CONFIG.FLASH_DEATH);
        boostLeft = 0; slowLeft = 0; captureChain = 0;
        UI.setPowerups(null);
        UI.banner(T('game.caught'), 'lose');
        if (lives <= 0) { gameOver(); return; }
        state = STATE.DYING;
        dyingLeft = CONFIG.DEATH_PAUSE_MS;
    }
    function respawnAfterDeath() {
        const cx = Math.floor(mz.cols / 2) | 1;
        const cy = Math.floor(mz.rows / 2) | 1;
        const ok = Maze.canMove(mz, cx, cy);
        hero.x = ok ? cx : hero.x;
        hero.y = ok ? cy : hero.y;
        hero.px = hero.x; hero.py = hero.y;
        hero.dir = { x: 1, y: 0 };
        hero.next = null;
        drones = Drones.create(mz, CONFIG.DRONE_COUNT, hero);
        heroShield = CONFIG.HERO_SHIELD_MS || 0;
        heroAcc = 0;
        UI.hideBanner();
        beginCountdown();
    }

    /* ---------------- logika ---------------- */
    function logScoreEvent(value) {
        if (scoreLog.length < 6000) {
            scoreLog.push({ t: Math.round(gameNow() - playStartedGameNow), v: value });
        }
    }
    function addScore(n, useBoost) {
        const mult = (useBoost !== false && boostLeft > 0) ? (CONFIG.BOOST_MULTIPLIER || 2) : 1;
        const gained = n * mult;
        score += gained;
        logScoreEvent(gained);
        UI.setScore(score);
        return gained;
    }
    function tryTurn() {
        if (!hero.next) return;
        if (Maze.canMove(mz, Maze.wrapX(mz, hero.x + hero.next.x), hero.y + hero.next.y)) {
            hero.dir = hero.next;
            hero.next = null;
        }
    }
    function heroStepLogic() {
        tryTurn();
        const nx = Maze.wrapX(mz, hero.x + hero.dir.x);
        const ny = hero.y + hero.dir.y;
        hero.px = hero.x; hero.py = hero.y;
        if (Maze.canMove(mz, nx, ny)) { hero.x = nx; hero.y = ny; hero.moving = true; }
        else { hero.moving = false; return; }
        const key = hero.x + ':' + hero.y;
        if (tokens.has(key)) {
            tokens.delete(key);
            tokensLeft--;
            addScore(CONFIG.TOKEN_POINTS);
            Effects.shake(CONFIG.SHAKE_EAT_MS, CONFIG.SHAKE_EAT_POWER);
            if (tokensLeft <= 0) { levelCleared(); return; }
        }
        const pIdx = powerCells.findIndex(function (p) { return p.x === hero.x && p.y === hero.y; });
        if (pIdx >= 0) {
            const p = powerCells[pIdx];
            powerCells.splice(pIdx, 1);
            if (p.kind === 'boost') {
                boostLeft = CONFIG.BOOST_DURATION_MS;
                captureChain = 0;
                Drones.makeWeak(drones, CONFIG.BOOST_DURATION_MS);
                Effects.burst(p.x, p.y, CONFIG.BOOST_COLOR, 16, CONFIG.PARTICLE_SPEED * 1.5);
                if (UI.showVisaPop) UI.showVisaPop();
                Effects.shake(CONFIG.SHAKE_BOOST_MS, CONFIG.SHAKE_BOOST_POWER);
                Effects.flash(CONFIG.FLASH_BOOST);
            } else {
                slowLeft = CONFIG.SLOW_DURATION_MS;
                Effects.burst(p.x, p.y, CONFIG.SLOW_COLOR, 16, CONFIG.PARTICLE_SPEED * 1.4);
                if (UI.showSlowPop) UI.showSlowPop();
                Effects.shake(CONFIG.SHAKE_SLOW_MS, CONFIG.SHAKE_SLOW_POWER);
                Effects.flash(CONFIG.FLASH_SLOW);
            }
        }
        if (item && item.x === hero.x && item.y === hero.y) {
            const gained = addScore(item.points);
            Effects.burst(item.x, item.y, item.color, 12);
            /* w trakcie Visa x2: zloty napis "+100 VISA x2" (jak w Delivery Rush) */
            if (boostLeft > 0 && UI.visaTag) {
                Effects.floatText(item.x, item.y, '+' + gained + ' ' + UI.visaTag(), '#FFC22E', true);
            } else {
                Effects.floatText(item.x, item.y, '+' + gained, '#b9f6ca', true);
            }
            Effects.shake(CONFIG.SHAKE_EAT_MS * 1.5, CONFIG.SHAKE_EAT_POWER * 1.6);
            item = null;
            itemTimer = CONFIG.ITEM_EVERY_MS;
        }
    }
    function checkCollisions() {
        for (const d of drones) {
            if (state !== STATE.PLAY) return;
            if (!Drones.hits(d, hero)) continue;
            if (d.weak) {
                const pts = CONFIG.CAPTURE_POINTS[
                    Math.min(captureChain, CONFIG.CAPTURE_POINTS.length - 1)];
                captureChain++;
                addScore(pts, false);
                Drones.capture(d);
                Effects.burst(d.x, d.y, '#90CAF9', 18, CONFIG.PARTICLE_SPEED * 1.6);
                Effects.floatText(d.x, d.y, '+' + pts, '#FFE28A', true);
                Effects.shake(CONFIG.SHAKE_CAPTURE_MS, CONFIG.SHAKE_CAPTURE_POWER);
            } else if (heroShield > 0) {
                continue;
            } else {
                loseLife();
                return;
            }
        }
    }
    function spawnItem() {
        const cells = Maze.paths(mz).filter(function (c) {
            return !(c.x === hero.x && c.y === hero.y) &&
                   !powerCells.some(function (p) { return p.x === c.x && p.y === c.y; });
        });
        if (!cells.length) return;
        const total = CONFIG.ITEMS.reduce(function (s, i) { return s + i.weight; }, 0);
        let r = Math.random() * total, def = CONFIG.ITEMS[0];
        for (const d of CONFIG.ITEMS) { r -= d.weight; if (r <= 0) { def = d; break; } }
        const c = cells[Math.floor(Math.random() * cells.length)];
        item = { x: c.x, y: c.y, sprite: def.key, points: def.points, color: def.color,
                 born: gameNow(), expiresAt: gameNow() + CONFIG.ITEM_LIFETIME_MS };
    }

    /* ---------------- rendering ---------------- */
    function lerp(a, b, t) { return a + (b - a) * t; }
    function smooth(prev, cur, t) {
        let d = cur - prev;
        if (Math.abs(d) > 1) d = d > 0 ? d - mz.cols : d + mz.cols;
        return prev + d * t;
    }
    function drawMaze() {
        ctx.clearRect(0, 0, boardW, boardH);
        const wallKey = tile <= 28 ? 'wallSmall' : 'wall';
        for (let y = 0; y < mz.rows; y++) {
            for (let x = 0; x < mz.cols; x++) {
                if (mz.grid[y][x] !== Maze.WALL) continue;
                const wallSize = tile * 0.86;
                const wallOffset = (tile - wallSize) / 2;
                drawSprite(wallKey, x * tile + wallOffset, y * tile + wallOffset, wallSize, 0);
            }
        }
    }
    function drawTokens() {
        const size = tile * 0.74;
        const offset = (tile - size) / 2;
        tokens.forEach(function (k) {
            const parts = k.split(':');
            const x = Number(parts[0]);
            const y = Number(parts[1]);
            drawSprite('magnifyingGlass', x * tile + offset, y * tile + offset, size, 0);
        });
    }
    function drawSprite(key, px, py, size, angle) {
        const img = Assets.get(key);
        if (!img || !img.complete || !img.naturalWidth) {
            ctx.fillStyle = '#F7B600';
            ctx.fillRect(px, py, size, size);
            return;
        }
        if (!angle) { ctx.drawImage(img, px, py, size, size); return; }
        ctx.save();
        ctx.translate(px + size / 2, py + size / 2);
        ctx.rotate(angle);
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
        ctx.restore();
    }
    function angleOf(d) {
        if (d.x === 1) return 0;
        if (d.x === -1) return Math.PI;
        if (d.y === 1) return Math.PI / 2;
        if (d.y === -1) return -Math.PI / 2;
        return 0;
    }
    function drawPowerCells(now) {
        powerCells.forEach(function (p) {
            const boost = p.kind === 'boost';
            const pulseMs = boost ? CONFIG.BOOST_PULSE_MS : CONFIG.SLOW_PULSE_MS;
            const phase = ((now - p.born) % pulseMs) / pulseMs;
            const wave = Math.sin(phase * Math.PI * 2);
            const size = tile * 0.92 * (1 + wave * 0.10);
            const off = (tile - size) / 2;
            ctx.save();
            ctx.globalAlpha = 0.24 + 0.20 * wave;
            ctx.fillStyle = boost ? CONFIG.BOOST_COLOR : CONFIG.SLOW_COLOR;
            ctx.beginPath();
            ctx.arc(p.x * tile + tile / 2, p.y * tile + tile / 2, tile * 0.72, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            drawSprite(phase > 0.5 ? (boost ? 'boostHot' : 'slowHot') : (boost ? 'boost' : 'slow'),
                       p.x * tile + off, p.y * tile + off, size, 0);
        });
    }
    function drawItem(now) {
        if (!item) return;
        const left = item.expiresAt - now;
        if (left < 1600 && Math.floor(left / 150) % 2 === 0) return;
        const pulse = 1 + Math.sin((now - item.born) / 220) * 0.07;
        const size = tile * 0.88 * pulse;
        const off = (tile - size) / 2;
        drawSprite(item.sprite, item.x * tile + off, item.y * tile + off, size, 0);
    }
    function drawDrones(now) {
        drones.forEach(function (d) {
            if (d.releaseIn > 0) return;
            const key = Drones.spriteKey(d, now);
            if (!key) return;
            const t = state === STATE.PLAY ? Drones.progress(d) : 1;
            const x = smooth(d.px, d.x, t) * tile;
            const y = lerp(d.py, d.y, t) * tile;
            const size = tile * 0.9;
            const off = (tile - size) / 2;
            if (d.weak) {
                ctx.save();
                ctx.shadowColor = CONFIG.SLOW_COLOR;
                ctx.shadowBlur = tile * 0.4;
            }
            drawSprite(key, x + off, y + off, size, 0);
            if (d.weak) ctx.restore();
        });
    }
    function drawHero(t, now) {
        if (heroShield > 0 && Math.floor(now / 120) % 2 === 0) return;
        const x = smooth(hero.px, hero.x, t) * tile;
        const y = lerp(hero.py, hero.y, t) * tile;
        const key = blinkClosed > 0 ? 'heroBlink'
                  : boostLeft > 0 ? 'heroBoost'
                  : slowLeft > 0 ? 'heroSlow' : 'hero';
        const glow = boostLeft > 0 || slowLeft > 0;
        if (glow) {
            ctx.save();
            ctx.shadowColor = boostLeft > 0 ? CONFIG.BOOST_COLOR : CONFIG.SLOW_COLOR;
            ctx.shadowBlur = tile * 0.55;
        }
        drawSprite(key, x, y, tile, 0);
        if (glow) ctx.restore();
    }

    /* ---------------- petla ---------------- */
    function frame(now) {
        rafId = requestAnimationFrame(frame);
        let dt = now - lastTime;
        lastTime = now;
        if (dt > 250) dt = 250;
        const gnow = gameNow();
        if (state === STATE.COUNT) updateCountdown(dt);
        if (state === STATE.DYING) {
            dyingLeft -= dt;
            if (dyingLeft <= 0) respawnAfterDeath();
        }
        if (state === STATE.CLEAR) {
            clearLeft -= dt;
            if (clearLeft <= 0) nextLevel();
        }
        if (state === STATE.PLAY) {
            if (heroShield > 0) heroShield = Math.max(0, heroShield - dt);
            if (boostLeft > 0) {
                boostLeft -= dt;
                if (boostLeft <= 0) { boostLeft = 0; captureChain = 0; }
            }
            if (slowLeft > 0) {
                slowLeft -= dt;
                if (slowLeft <= 0) slowLeft = 0;
            }
            UI.setPowerups({ boostLeft: boostLeft, slowLeft: slowLeft });
            blinkTimer -= dt;
            if (blinkClosed > 0) {
                blinkClosed -= dt;
                if (blinkClosed <= 0) {
                    blinkClosed = 0;
                    blinkTimer = CONFIG.BLINK_MIN_DELAY_MS +
                        Math.random() * (CONFIG.BLINK_MAX_DELAY_MS - CONFIG.BLINK_MIN_DELAY_MS);
                }
            } else if (blinkTimer <= 0) {
                blinkClosed = CONFIG.BLINK_CLOSED_MS;
            }
            if (item && item.expiresAt <= gnow) item = null;
            if (!item) {
                itemTimer -= dt;
                if (itemTimer <= 0) { spawnItem(); itemTimer = CONFIG.ITEM_EVERY_MS; }
            }
            heroAcc += dt;
            while (heroAcc >= heroStep) {
                heroAcc -= heroStep;
                heroStepLogic();
                checkCollisions();
                if (state !== STATE.PLAY) { heroAcc = 0; break; }
            }
            if (state === STATE.PLAY) {
                Drones.step(drones, mz, hero, dt, droneStep, slowLeft > 0);
                checkCollisions();
            }
        }
        if (state !== STATE.PAUSE) Effects.update(dt);
        ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        if (!mz) return;
        /* Static camera: gameplay effects must never move the board. */
        const sh = { x: 0, y: 0 };
        ctx.save();
        ctx.translate(offX + sh.x, offY + sh.y);
        /* wyczyszczony labirynt: sciany migaja (jak w arcade) */
        const wallBlink = state === STATE.CLEAR && Math.floor(clearLeft / 200) % 2 === 0;
        if (wallBlink) ctx.globalAlpha = 0.35;
        drawMaze();
        ctx.globalAlpha = 1;
        drawTokens();
        drawPowerCells(gnow);
        drawItem(gnow);
        const ht = state === STATE.PLAY ? Math.min(1, heroAcc / heroStep) : 1;
        drawDrones(gnow);
        if (state !== STATE.DYING || Math.floor(dyingLeft / 120) % 2 === 0) drawHero(ht, gnow);
        Effects.draw(ctx, tile);
        Effects.drawFlash(ctx, boardW, boardH);
        ctx.restore();
    }

    /* ---------------- zdarzenia ---------------- */
    function bindEvents() {
        window.addEventListener('keydown', function (e) {
            const tag = (e.target && e.target.tagName || '').toUpperCase();
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (e.key === 'Escape' || e.key === 'p') {
                if (state === STATE.PLAY || state === STATE.COUNT) {
                    pauseGame();
                    Flow.confirmExit('home');
                }
            }
        });
        document.addEventListener('visibilitychange', function () {
            if (document.hidden && state === STATE.PLAY) pauseGame();
            else if (!document.hidden && state === STATE.PAUSE &&
                     Screens.current() === 'game') resumeGame();
        });
        window.addEventListener('resize', resize);
        window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
        if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
    }

    /* ---------------- init ---------------- */
    function init() {
        if (window.UI && UI.applyLogoSlots) UI.applyLogoSlots();
        resize();
        Input.init(onDir);
        Input.show(false);
        bindEvents();
        initGamepad();
    }

    /* Wspolny handler kierunku: klawiatura, dotyk i pad. */
    function onDir(dir) {
        if (!hero) return;
        if (state !== STATE.PLAY && state !== STATE.COUNT) return;
        hero.next = dir;
        tryTurn();
        UI.hideHint();
    }

    /* ---------------- PAD / HANDHELD ----------------
       D-pad (przyciski 12-15), lewa galka (osie 0/1),
       D-pad jako osie 6/7 (niestandardowe mapowanie),
       Start (9) = pauza jak Escape.
       Kierunek wysylany raz przy zmianie - jak strzalka. */
    const PAD_DEADZONE = 0.5;
    let padLastDir = '', padStartDown = false, padRaf = 0;

    function getPads() {
        const list = navigator.getGamepads ? navigator.getGamepads() : [];
        const out = [];
        for (let i = 0; i < list.length; i++) if (list[i] && list[i].connected !== false) out.push(list[i]);
        return out;
    }
    function padPressed(p, i) {
        const b = p.buttons && p.buttons[i];
        return !!b && (b.pressed || b.value > 0.5);
    }
    function padDir(p) {
        if (padPressed(p, 12)) return { x: 0, y: -1 };
        if (padPressed(p, 13)) return { x: 0, y: 1 };
        if (padPressed(p, 14)) return { x: -1, y: 0 };
        if (padPressed(p, 15)) return { x: 1, y: 0 };
        const a = p.axes || [];
        if (a.length > 7 && p.mapping !== 'standard') {
            if (a[7] < -PAD_DEADZONE) return { x: 0, y: -1 };
            if (a[7] >  PAD_DEADZONE) return { x: 0, y: 1 };
            if (a[6] < -PAD_DEADZONE) return { x: -1, y: 0 };
            if (a[6] >  PAD_DEADZONE) return { x: 1, y: 0 };
        }
        /* Lewa galka (osie 0/1) ORAZ prawa galka (osie 2/3) - jak w Delivery Rush.
           Wygrywa galka wychylona mocniej. Osie, ktore w spoczynku nie stoja
           przy zerze (np. triggery na niestandardowym mapowaniu = -1),
           sa pomijane, zeby nie wysylaly kierunku same z siebie. */
        const rest = padRest(p);
        let best = null, bestMag = PAD_DEADZONE;
        [[0, 1], [2, 3]].forEach(function (pair) {
            const ix = pair[0], iy = pair[1];
            if (rest[ix] || rest[iy]) return;
            const ax = a[ix] || 0, ay = a[iy] || 0;
            const mag = Math.max(Math.abs(ax), Math.abs(ay));
            if (mag < bestMag) return;
            bestMag = mag;
            best = Math.abs(ax) > Math.abs(ay)
                ? { x: ax > 0 ? 1 : -1, y: 0 }
                : { x: 0, y: ay > 0 ? 1 : -1 };
        });
        return best;
    }

    /* Kalibracja spoczynku: zapamietuje, ktore osie przy pierwszym odczycie
       stoja daleko od zera (triggery). Dla mapowania 'standard' osie 0-3
       to zawsze galki, wiec nic nie wykluczamy. */
    const padRestMap = {};
    function padRest(p) {
        const id = p.index + ':' + p.id;
        if (padRestMap[id]) return padRestMap[id];
        const ex = {};
        if (p.mapping !== 'standard') {
            (p.axes || []).forEach(function (v, i) { if (Math.abs(v) > 0.5) ex[i] = true; });
        }
        padRestMap[id] = ex;
        return ex;
    }
    function pollPad() {
        padRaf = 0;
        const pads = getPads();
        if (!pads.length) { padLastDir = ''; padStartDown = false; return; }
        let dir = null, start = false;
        for (let i = 0; i < pads.length && !dir; i++) dir = padDir(pads[i]);
        for (let i = 0; i < pads.length; i++) if (padPressed(pads[i], 9)) start = true;

        const key = dir ? dir.x + ':' + dir.y : '';
        if (dir && key !== padLastDir) onDir(dir);
        padLastDir = key;

        if (start && !padStartDown && (state === STATE.PLAY || state === STATE.COUNT)) {
            pauseGame();
            Flow.confirmExit('home');
        }
        padStartDown = start;
        padRaf = requestAnimationFrame(pollPad);
    }
    function startPadLoop() { if (!padRaf) padRaf = requestAnimationFrame(pollPad); }
    function initGamepad() {
        Input.hasGamepad = function () { return getPads().length > 0; };
        window.addEventListener('gamepadconnected', function (e) {
            console.info('[Gamepad] podlaczony:', e.gamepad.id, 'mapping:', e.gamepad.mapping || '(brak)',
                         'osie:', e.gamepad.axes.length, 'przyciski:', e.gamepad.buttons.length);
            startPadLoop();
        });
        window.addEventListener('gamepaddisconnected', function () { padLastDir = ''; });
        if (getPads().length) startPadLoop();
    }
    return {
        init: init, start: start, stop: stop,
        pause: pauseGame, resume: resumeGame,
        isPlaying: function () { return state === STATE.PLAY; }
    };
})();

/* ---------------- BOOTSTRAP (jak w Snake) ---------------- */
(function () {
    function boot() {
        window.Game.init();
        window.Flow.init();
    }
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
