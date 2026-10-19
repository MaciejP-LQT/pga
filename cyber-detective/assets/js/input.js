/* input.js - plywajacy joystick + swipe + klawiatura (BEZ ZMIAN) */
window.Input = (function () {
    let onDirection = () => {}, held = null, lastAxis = null;
    let touchId = null, origin = { x: 0, y: 0 }, moved = false, startTime = 0;
    const layer = document.getElementById('touch-layer');
    const joy = document.getElementById('joy-float');
    const base = document.getElementById('joy-float-base');
    const knob = document.getElementById('joy-float-knob');
    function vectorToDirection(dx, dy) {
        const ax = Math.abs(dx), ay = Math.abs(dy);
        let axis;
        if (lastAxis === 'x') axis = (ay > ax * 1.35) ? 'y' : 'x';
        else if (lastAxis === 'y') axis = (ax > ay * 1.35) ? 'x' : 'y';
        else axis = ax >= ay ? 'x' : 'y';
        lastAxis = axis;
        return axis === 'x' ? { x: dx > 0 ? 1 : -1, y: 0 } : { x: 0, y: dy > 0 ? 1 : -1 };
    }
    function showJoy(x, y) {
        joy.style.left = x + 'px'; joy.style.top = y + 'px';
        joy.classList.remove('hidden'); joy.classList.add('appearing');
        knob.style.transform = 'translate(-50%, -50%)';
        base.classList.remove('active');
    }
    function moveJoy(dx, dy) {
        const max = CONFIG.JOY_MAX_RADIUS, dist = Math.hypot(dx, dy);
        const k = dist > max ? max / dist : 1;
        knob.style.transform = 'translate(calc(-50% + ' + (dx * k) + 'px), calc(-50% + ' + (dy * k) + 'px))';
    }
    function hideJoy() { joy.classList.add('hidden'); joy.classList.remove('appearing'); base.classList.remove('active'); }
    function down(e) {
        if (touchId !== null) return;
        touchId = e.pointerId; origin.x = e.clientX; origin.y = e.clientY;
        moved = false; lastAxis = null; startTime = performance.now();
        showJoy(e.clientX, e.clientY);
        if (layer.setPointerCapture) { try { layer.setPointerCapture(e.pointerId); } catch (err) {} }
        e.preventDefault();
    }
    function move(e) {
        if (e.pointerId !== touchId) return;
        e.preventDefault();
        const dx = e.clientX - origin.x, dy = e.clientY - origin.y;
        moveJoy(dx, dy);
        if (Math.hypot(dx, dy) < CONFIG.JOY_DEAD_ZONE) { held = null; base.classList.remove('active'); return; }
        moved = true; base.classList.add('active');
        const dir = vectorToDirection(dx, dy);
        const changed = !held || held.x !== dir.x || held.y !== dir.y;
        held = dir;
        if (changed) onDirection(dir);
    }
    function up(e) {
        if (!moved && e && performance.now() - startTime < 300) {
            const dx = e.clientX - origin.x, dy = e.clientY - origin.y;
            if (Math.hypot(dx, dy) > 12) { lastAxis = null; onDirection(vectorToDirection(dx, dy)); }
        }
        touchId = null; held = null; lastAxis = null; moved = false; hideJoy();
    }
    const KEYS = { arrowup: { x: 0, y: -1 }, arrowdown: { x: 0, y: 1 }, arrowleft: { x: -1, y: 0 }, arrowright: { x: 1, y: 0 },
                   w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 } };
    const keyHeld = new Set();
    function onKeyDown(e) {
        const tag = (e.target && e.target.tagName || '').toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        const k = e.key.toLowerCase(), dir = KEYS[k];
        if (!dir) return;
        e.preventDefault(); keyHeld.add(k); held = dir; onDirection(dir);
    }
    function onKeyUp(e) {
        const k = e.key.toLowerCase();
        if (!KEYS[k]) return;
        keyHeld.delete(k);
        if (!keyHeld.size && touchId === null) held = null;
    }
    function init(cb) {
        onDirection = cb;
        layer.addEventListener('pointerdown', down, { passive: false });
        layer.addEventListener('pointermove', move, { passive: false });
        layer.addEventListener('pointerup', up);
        layer.addEventListener('pointercancel', up);
        layer.addEventListener('lostpointercapture', up);
        layer.addEventListener('contextmenu', e => e.preventDefault());
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', () => { keyHeld.clear(); up(); });
    }
    function show(v) { layer.classList.toggle('hidden', !v); if (!v) up(); }
    return { init, show, getHeld: () => held };
})();
