const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function setup(game, { pointerEvents = true } = {}) {
    let now = 0;
    const listeners = {};
    const windowListeners = {};
    const elements = new Map();
    const directions = [];
    const document = {
        getElementById(id) {
            if (!elements.has(id)) {
                const classes = new Set(['hidden']);
                elements.set(id, {
                    style: {},
                    classList: {
                        add: name => classes.add(name),
                        remove: name => classes.delete(name),
                        contains: name => classes.has(name),
                        toggle(name, force) {
                            const add = force === undefined ? !classes.has(name) : force;
                            if (add) classes.add(name);
                            else classes.delete(name);
                        }
                    },
                    addEventListener: (type, handler) => { listeners[type] = handler; },
                    setPointerCapture() {}
                });
            }
            return elements.get(id);
        }
    };
    const window = {
        addEventListener: (type, handler) => { windowListeners[type] = handler; }
    };
    if (pointerEvents) window.PointerEvent = function () {};
    const source = fs.readFileSync(path.join(__dirname, '..', game, 'assets', 'js', 'input.js'), 'utf8');
    vm.runInNewContext(source, {
        window,
        document,
        navigator: {},
        performance: { now: () => now },
        CONFIG: {
            JOY_DEAD_ZONE: 14,
            JOY_STEP_PX: 18,
            JOY_MAX_RADIUS: 46,
            JOY_AXIS_BIAS: 1.3,
            GAMEPAD_ENABLED: false
        }
    });
    window.Input.init(dir => directions.push({ x: dir.x, y: dir.y }));
    return {
        input: window.Input,
        directions,
        joy: elements.get('joy-float'),
        setTime(value) { now = value; },
        fire(type, properties = {}) {
            assert.equal(typeof listeners[type], 'function', `Missing ${type} listener`);
            listeners[type]({ type, pointerId: 1, clientX: 120, clientY: 400, preventDefault() {}, ...properties });
        },
        fireWindow(type, properties = {}) {
            windowListeners[type]({ type, preventDefault() {}, ...properties });
        }
    };
}

for (const game of ['delivery-rush', 'cyber-detective']) {
    for (const x of [-1, 1]) {
        test(`${game}: horizontal swipe ${x} ignores capture loss and duplicate pointerup`, () => {
            const env = setup(game);
            env.fire('pointerdown');
            env.fire('pointermove', { clientX: 120 + x * 40 });
            env.setTime(100);
            env.fire('pointerup', { clientX: 120 + x * 40 });
            assert.deepEqual(env.directions, [{ x, y: 0 }]);
            env.fire('lostpointercapture', { clientX: 0, clientY: 0 });
            env.fire('pointerup', { clientX: 0, clientY: 0 });
            assert.deepEqual(env.directions, [{ x, y: 0 }]);
            assert.equal(env.input.getHeld(), null);
            assert.equal(env.joy.classList.contains('hidden'), true);
        });
    }

    test(`${game}: short swipes still work in all four directions`, () => {
        for (const dir of [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }]) {
            for (const withMove of [false, true]) {
                const env = setup(game);
                const end = { clientX: 120 + dir.x * 13, clientY: 400 + dir.y * 13 };
                env.fire('pointerdown');
                if (withMove) env.fire('pointermove', end);
                assert.deepEqual(env.directions, []);
                env.setTime(100);
                env.fire('pointerup', end);
                env.fire('lostpointercapture', { clientX: 0, clientY: 0 });
                assert.deepEqual(env.directions, [dir]);
            }
        }
    });

    for (const type of ['pointercancel', 'lostpointercapture']) {
        test(`${game}: ${type} only clears the active gesture`, () => {
            for (const withMove of [false, true]) {
                const env = setup(game);
                env.fire('pointerdown');
                if (withMove) env.fire('pointermove', { clientX: 160 });
                env.setTime(100);
                env.fire(type, { clientX: 0, clientY: 0 });
                assert.deepEqual(env.directions, withMove ? [{ x: 1, y: 0 }] : []);
                assert.equal(env.input.getHeld(), null);
                assert.equal(env.joy.classList.contains('hidden'), true);
                env.fire('pointerup', { clientX: 0, clientY: 0 });
                env.fire('lostpointercapture', { clientX: 0, clientY: 0 });
                env.fire('pointerdown');
                env.fire('pointermove', { clientX: 80 });
                assert.deepEqual(env.directions, withMove ? [{ x: 1, y: 0 }, { x: -1, y: 0 }] : [{ x: -1, y: 0 }]);
            }
        });
    }

    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        test(`${game}: ${type} from another pointer does not end the gesture`, () => {
            const env = setup(game);
            env.fire('pointerdown');
            env.fire('pointerdown', { pointerId: 2, clientX: 300 });
            env.setTime(100);
            env.fire(type, { pointerId: 2, clientX: 0, clientY: 0 });
            assert.deepEqual(env.directions, []);
            assert.equal(env.joy.classList.contains('hidden'), false);
            env.fire('pointermove', { clientX: 160 });
            assert.deepEqual(env.directions, [{ x: 1, y: 0 }]);
            env.fire('pointerup', { clientX: 160 });
            assert.equal(env.input.getHeld(), null);
        });
    }

    test(`${game}: hiding or blurring the game discards the gesture`, () => {
        for (const action of ['hide', 'blur', ...(game === 'delivery-rush' ? ['reset'] : [])]) {
            const env = setup(game);
            env.fire('pointerdown');
            env.setTime(100);
            if (action === 'hide') env.input.show(false);
            else if (action === 'blur') env.fireWindow('blur');
            else env.input.reset();
            env.fire('pointerup', { clientX: 0, clientY: 0 });
            env.fire('lostpointercapture', { clientX: 0, clientY: 0 });
            assert.deepEqual(env.directions, []);
            assert.equal(env.input.getHeld(), null);
            assert.equal(env.joy.classList.contains('hidden'), true);
        }
    });

    test(`${game}: taps and slow releases do not become swipes`, () => {
        for (const [dx, duration] of [[0, 100], [12, 100], [40, 300]]) {
            const env = setup(game);
            env.fire('pointerdown');
            env.setTime(duration);
            env.fire('pointerup', { clientX: 120 + dx });
            env.fire('lostpointercapture', { clientX: 0, clientY: 0 });
            assert.deepEqual(env.directions, []);
        }
    });

    test(`${game}: holding the joystick still allows direction changes`, () => {
        const env = setup(game);
        env.fire('pointerdown');
        env.fire('pointermove', { clientX: 160 });
        env.fire('pointermove', { clientX: 160, clientY: 340 });
        env.setTime(100);
        env.fire('pointerup', { clientX: 160, clientY: 340 });
        env.fire('lostpointercapture', { clientX: 0, clientY: 0 });
        assert.deepEqual(env.directions, [{ x: 1, y: 0 }, { x: 0, y: -1 }]);
    });

    test(`${game}: keyboard directions and blur cleanup are preserved`, () => {
        const env = setup(game);
        env.fireWindow('keydown', { key: 'd' });
        assert.equal(env.input.getHeld().x, 1);
        env.fireWindow('keyup', { key: 'd' });
        assert.equal(env.input.getHeld(), null);
        env.fireWindow('keydown', { key: 'w' });
        assert.equal(env.input.getHeld().y, -1);
        env.fireWindow('blur');
        assert.equal(env.input.getHeld(), null);
        assert.deepEqual(env.directions, [{ x: 1, y: 0 }, { x: 0, y: -1 }]);
    });
}

test('delivery-rush: touch-event fallback preserves swipes and joystick input', () => {
    const env = setup('delivery-rush', { pointerEvents: false });
    const start = { clientX: 120, clientY: 400 };
    const right = { clientX: 160, clientY: 400 };
    env.fire('touchstart', { touches: [start] });
    env.fire('touchmove', { touches: [right] });
    env.fire('touchend', { touches: [], changedTouches: [right] });
    env.fire('touchstart', { touches: [start] });
    env.setTime(100);
    env.fire('touchend', { touches: [], changedTouches: [{ clientX: 107, clientY: 400 }] });
    assert.deepEqual(env.directions, [{ x: 1, y: 0 }, { x: -1, y: 0 }]);
    assert.equal(env.input.getHeld(), null);
});

test('delivery-rush: touchcancel never generates a swipe, even without touch coordinates', () => {
    for (const changedTouches of [[], [{ clientX: 0, clientY: 0 }]]) {
        const env = setup('delivery-rush', { pointerEvents: false });
        env.fire('touchstart', { touches: [{ clientX: 120, clientY: 400 }] });
        env.setTime(100);
        env.fire('touchcancel', { touches: [], changedTouches });
        assert.deepEqual(env.directions, []);
        assert.equal(env.input.getHeld(), null);
        assert.equal(env.joy.classList.contains('hidden'), true);
        env.fire('touchstart', { touches: [{ clientX: 120, clientY: 400 }] });
        env.fire('touchmove', { touches: [{ clientX: 160, clientY: 400 }] });
        assert.deepEqual(env.directions, [{ x: 1, y: 0 }]);
    }
});
