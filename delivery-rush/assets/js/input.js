/* =========================================================
   input.js - sterowanie

   Joystick PLYWAJACY: pojawia sie tam, gdzie gracz dotknie,
   znika po puszczeniu. Cala warstwa dotyku (poza HUD-em)
   jest polem sterowania.

   Cztery tryby rownolegle:
     1. joystick plywajacy (dotyk / mysz)
     2. swipe              (szybkie muzniecie < 300 ms)
     3. klawiatura         (strzalki / WASD)
     4. GAMEPAD            (D-pad + analogi)   <-- NOWE v24

   ---------------------------------------------------------
   DLACZEGO GAMEPAD API (v24)

   MSI Claw ma fizyczny D-pad i dwa analogi. W przegladarce
   NIE generuja one zdarzen keydown - to osobne API, ktore
   trzeba ODPYTYWAC w petli (gamepady nie wysylaja zdarzen).

   Bez tego gracz bierze konsole do rak, naciska D-pad
   i nic sie nie dzieje - musi dotykac ekranu.

   ---------------------------------------------------------
   POPRAWKA PRECYZJI (v21, zachowana)

   Kierunek liczony z PRZYROSTU ruchu (stepOrigin resetowany
   po kazdym skrecie), a nie wzgledem punktu dotkniecia.
   Wizualny srodek joysticka (joyCenter) podaza za palcem.
   ========================================================= */
window.Input = (function () {

    let onDirection = () => {};
    let held = null;

    let touchId = null;
    let joyCenter  = { x: 0, y: 0 };
    let stepOrigin = { x: 0, y: 0 };
    let firstTurn = true;
    let moved = false;
    let startTime = 0;

    const layer = document.getElementById('touch-layer');
    const joy   = document.getElementById('joy-float');
    const base  = document.getElementById('joy-float-base');
    const knob  = document.getElementById('joy-float-knob');

    const DIR = {
        up:    { x: 0, y: -1 },
        down:  { x: 0, y:  1 },
        left:  { x: -1, y: 0 },
        right: { x:  1, y: 0 }
    };

    /* ---------- pomocnicze ---------- */

    function isOpposite(a, b) {
        return a && b && a.x === -b.x && a.y === -b.y;
    }

    function emit(dir) {
        if (!dir) return;
        if (held && held.x === dir.x && held.y === dir.y) return;
        if (isOpposite(held, dir)) return;

        held = dir;

        if (CONFIG.HAPTIC_FEEDBACK && navigator.vibrate) {
            try { navigator.vibrate(CONFIG.HAPTIC_MS || 8); } catch (err) {}
        }

        onDirection(dir);
    }

    /** Zamienia przyrost ruchu na kierunek. Zwraca null przy ruchu ukosnym. */
    function vectorToDirection(dx, dy) {
        const ax = Math.abs(dx), ay = Math.abs(dy);
        const bias = CONFIG.JOY_AXIS_BIAS || 1.3;

        if (ax > ay * bias) return dx > 0 ? DIR.right : DIR.left;
        if (ay > ax * bias) return dy > 0 ? DIR.down : DIR.up;

        return null;
    }

    /* ---------- warstwa wizualna joysticka ---------- */

    function showJoy(x, y) {
        if (!joy) return;
        joy.style.left = x + 'px';
        joy.style.top  = y + 'px';
        joy.classList.remove('hidden');
        joy.classList.add('appearing');
        knob.style.transform = 'translate(-50%, -50%)';
        base.classList.remove('active');
    }

    function moveJoy(dx, dy) {
        if (!knob) return;
        const max = CONFIG.JOY_MAX_RADIUS;
        const dist = Math.hypot(dx, dy);
        const k = dist > max ? max / dist : 1;
        knob.style.transform =
            `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
    }

    function hideJoy() {
        if (!joy) return;
        joy.classList.add('hidden');
        joy.classList.remove('appearing');
        base.classList.remove('active');
    }

    /* ---------- obsluga wskaznika (dotyk / mysz) ---------- */

    function down(e) {
        if (touchId !== null) return;
        touchId = e.pointerId;

        joyCenter.x  = stepOrigin.x = e.clientX;
        joyCenter.y  = stepOrigin.y = e.clientY;

        firstTurn = true;
        moved = false;
        startTime = performance.now();

        showJoy(e.clientX, e.clientY);

        if (layer.setPointerCapture) {
            try { layer.setPointerCapture(e.pointerId); } catch (err) {}
        }
        e.preventDefault();
    }

    function move(e) {
        if (e.pointerId !== touchId) return;
        e.preventDefault();

        /* wizual: baza podaza za palcem */
        let vx = e.clientX - joyCenter.x;
        let vy = e.clientY - joyCenter.y;

        const max  = CONFIG.JOY_MAX_RADIUS;
        const dist = Math.hypot(vx, vy);

        if (dist > max) {
            const k = (dist - max) / dist;
            joyCenter.x += vx * k;
            joyCenter.y += vy * k;

            joy.style.left = joyCenter.x + 'px';
            joy.style.top  = joyCenter.y + 'px';

            vx = e.clientX - joyCenter.x;
            vy = e.clientY - joyCenter.y;
        }

        moveJoy(vx, vy);

        /* logika: kierunek z przyrostu od ostatniego skretu */
        const dx = e.clientX - stepOrigin.x;
        const dy = e.clientY - stepOrigin.y;

        const threshold = firstTurn
            ? CONFIG.JOY_DEAD_ZONE
            : (CONFIG.JOY_STEP_PX || CONFIG.JOY_DEAD_ZONE);

        if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) {
            base.classList.remove('active');
            return;
        }

        const dir = vectorToDirection(dx, dy);
        if (!dir) return;

        moved = true;
        base.classList.add('active');

        if (isOpposite(held, dir)) {
            stepOrigin.x = e.clientX;
            stepOrigin.y = e.clientY;
            return;
        }

        emit(dir);

        stepOrigin.x = e.clientX;
        stepOrigin.y = e.clientY;
        firstTurn = false;
    }

    function up(e) {
        /* krotkie muzniecie bez przekroczenia dead zone = swipe */
        if (!moved && e && performance.now() - startTime < 300) {
            const dx = e.clientX - stepOrigin.x;
            const dy = e.clientY - stepOrigin.y;

            if (Math.hypot(dx, dy) > 12) {
                const dir = vectorToDirection(dx, dy);
                if (dir) emit(dir);
            }
        }

        touchId = null;
        held = null;
        firstTurn = true;
        moved = false;
        hideJoy();
    }

    /* ---------- klawiatura ---------- */

    const KEYS = {
        arrowup:{x:0,y:-1}, arrowdown:{x:0,y:1},
        arrowleft:{x:-1,y:0}, arrowright:{x:1,y:0},
        w:{x:0,y:-1}, s:{x:0,y:1}, a:{x:-1,y:0}, d:{x:1,y:0}
    };
    const keyHeld = new Set();

    /** Czy focus jest w polu, gdzie gracz pisze tekst. */
    function isTyping(e) {
        const t = e.target;
        if (!t) return false;

        const tag = (t.tagName || '').toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;

        return t.isContentEditable === true;
    }

    function onKeyDown(e) {
        /* Bez tego gracz nie wpisze nicku z literami W/A/S/D
           ani nie poprawi tekstu strzałkami — preventDefault()
           blokowałby wprowadzanie znaków. */
        if (isTyping(e)) return;

        const k = e.key.toLowerCase(), dir = KEYS[k];
        if (!dir) return;

        e.preventDefault();
        keyHeld.add(k);
        emit(dir);
    }

    function onKeyUp(e) {
        if (isTyping(e)) return;                  /* <-- DODAJ */

        const k = e.key.toLowerCase();
        if (!KEYS[k]) return;
        keyHeld.delete(k);
        if (!keyHeld.size && touchId === null) held = null;
    }

    /* =====================================================
       GAMEPAD  (MSI Claw: D-pad, analogi, ABXY)

       Gamepady NIE wysylaja zdarzen - trzeba je odpytywac.
       Robimy to w osobnej petli rAF, niezaleznej od gry.

       Standardowe mapowanie (w3c "standard gamepad"):
         buttons[12] = D-pad gora
         buttons[13] = D-pad dol
         buttons[14] = D-pad lewo
         buttons[15] = D-pad prawo
         axes[0]     = lewy analog X  (-1 lewo, +1 prawo)
         axes[1]     = lewy analog Y  (-1 gora, +1 dol)
         axes[2..3]  = prawy analog
       ===================================================== */

    let padLoop = null;
    let padConnected = false;
    let lastPadDir = null;
    let padActive = false;          // czy gracz dotknal gamepada w tej sesji

    function readGamepad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];

        for (let i = 0; i < pads.length; i++) {
            const gp = pads[i];
            if (!gp || !gp.connected) continue;

            let dir = null;

            /* --- D-pad (priorytet: dyskretny, wiec najdokladniejszy) --- */
            const b = gp.buttons;
            if (b) {
                if (b[12] && b[12].pressed) dir = DIR.up;
                else if (b[13] && b[13].pressed) dir = DIR.down;
                else if (b[14] && b[14].pressed) dir = DIR.left;
                else if (b[15] && b[15].pressed) dir = DIR.right;
            }

            /* --- analogi, gdy D-pad nieaktywny --- */
            if (!dir && gp.axes && gp.axes.length >= 2) {
                const dz = CONFIG.PAD_DEAD_ZONE || 0.5;

                /* lewy analog; jesli jest prawy, tez go czytamy */
                const pairs = gp.axes.length >= 4
                    ? [[gp.axes[0], gp.axes[1]], [gp.axes[2], gp.axes[3]]]
                    : [[gp.axes[0], gp.axes[1]]];

                for (const [ax, ay] of pairs) {
                    if (Math.max(Math.abs(ax), Math.abs(ay)) < dz) continue;

                    /* ta sama zasada co przy dotyku: bez zgadywania
                       przy ruchu ukosnym */
                    const bias = CONFIG.JOY_AXIS_BIAS || 1.3;
                    if (Math.abs(ax) > Math.abs(ay) * bias)
                        dir = ax > 0 ? DIR.right : DIR.left;
                    else if (Math.abs(ay) > Math.abs(ax) * bias)
                        dir = ay > 0 ? DIR.down : DIR.up;

                    if (dir) break;
                }
            }

            if (dir) {
                if (!padActive) {
                    padActive = true;
                    /* pierwszy ruch gamepadem - chowamy podpowiedz dotykowa */
                    if (window.UI && UI.hideHint) UI.hideHint();
                }

                /* emitujemy tylko przy ZMIANIE, zeby trzymanie D-pada
                   nie zalewalo gry powtorzeniami */
                if (!lastPadDir || lastPadDir.x !== dir.x || lastPadDir.y !== dir.y) {
                    lastPadDir = dir;
                    emit(dir);
                }
            } else {
                lastPadDir = null;
            }

            return;     // obslugujemy pierwszy podlaczony pad
        }
    }

    function padTick() {
        if (padConnected) readGamepad();
        padLoop = requestAnimationFrame(padTick);
    }

    function startPadLoop() {
        if (padLoop !== null) return;
        padLoop = requestAnimationFrame(padTick);
    }

    function bindGamepad() {
        if (!navigator.getGamepads) return;      // brak wsparcia

        window.addEventListener('gamepadconnected', e => {
            padConnected = true;
            console.info('[Input] gamepad podlaczony:',
                e.gamepad && e.gamepad.id, '| mapowanie:',
                e.gamepad && e.gamepad.mapping || '(niestandardowe)');
            startPadLoop();
        });

        window.addEventListener('gamepaddisconnected', () => {
            const pads = navigator.getGamepads ? navigator.getGamepads() : [];
            padConnected = Array.prototype.some.call(pads, p => p && p.connected);
            if (!padConnected) lastPadDir = null;
            console.info('[Input] gamepad odlaczony');
        });

        /* Chrome nie wysyla gamepadconnected, dopoki gracz nie ruszy
           kontrolerem - ale gdy strona zostala przeladowana z juz
           podlaczonym padem, moze byc widoczny od razu. */
        const pads = navigator.getGamepads();
        for (let i = 0; i < pads.length; i++) {
            if (pads[i] && pads[i].connected) { padConnected = true; break; }
        }
        startPadLoop();
    }

    /** Czy w tej sesji wykryto aktywny gamepad. */
    function hasGamepad() { return padConnected; }

    /* ---------- API ---------- */

    function init(cb) {
        onDirection = cb;

        if (layer) {
            if (window.PointerEvent) {
                layer.addEventListener('pointerdown',   down, { passive: false });
                layer.addEventListener('pointermove',   move, { passive: false });
                layer.addEventListener('pointerup',     up);
                layer.addEventListener('pointercancel', up);
                layer.addEventListener('lostpointercapture', up);
            } else {
                const wrap = h => e => {
                    const t = e.touches[0] || e.changedTouches[0];
                    h({ pointerId: 1, clientX: t.clientX, clientY: t.clientY,
                        preventDefault: () => e.preventDefault() });
                };
                layer.addEventListener('touchstart', wrap(down), { passive: false });
                layer.addEventListener('touchmove',  wrap(move), { passive: false });
                layer.addEventListener('touchend',   wrap(up));
                layer.addEventListener('touchcancel',wrap(up));
            }

            layer.addEventListener('contextmenu', e => e.preventDefault());
        }

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', () => { keyHeld.clear(); up(); });

        if (CONFIG.GAMEPAD_ENABLED !== false) bindGamepad();
    }

    function show(v) {
        if (layer) layer.classList.toggle('hidden', !v);
        if (!v) up();
    }

    function reset() {
        held = null;
        touchId = null;
        firstTurn = true;
        moved = false;
        lastPadDir = null;
        hideJoy();
    }

    return { init, show, reset, hasGamepad, getHeld: () => held };
})();
