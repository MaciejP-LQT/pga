const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scripts = path.join(__dirname, '..', 'assets', 'js');
const source = fs.readFileSync(path.join(scripts, 'game.js'), 'utf8');
// Expose private state only in the VM to test the actual collection path.
const instrumented = source.replace('        init, start, stop,',
    '        resetGame, logicStep, snapshot: () => ({ snake, items, power, scoreLog }),\n        init, start, stop,');
assert.notEqual(instrumented, source);

function setup({ navigator = {}, haptics = true } = {}) {
    let now = 1000;
    const scores = [];
    let visaPops = 0;
    const window = {};
    const context = vm.createContext({
        window,
        navigator,
        performance: { now: () => now },
        document: {
            readyState: 'loading',
            addEventListener() {},
            getElementById: () => ({ getContext: () => ({}) })
        },
        UI: {
            setScore: score => scores.push(score),
            setLevel() {}, setCombo() {}, setPowerups() {}, hideVisaPop() {},
            showVisaPop() { visaPops++; }
        },
        Effects: { clear() {}, burst() {}, floatText() {}, shake() {}, flash() {} },
        Input: { reset() {}, getHeld: () => null },
        T: () => 'VISA x2'
    });
    for (const [file, name] of [
        ['config.js', 'CONFIG'], ['courier.js', 'Courier'], ['blink.js', 'Blink'],
        ['powerups.js', 'Powerups'], ['food.js', 'ItemFactory']
    ]) {
        vm.runInContext(fs.readFileSync(path.join(scripts, file), 'utf8'), context);
        context[name] = window[name];
    }
    context.CONFIG.HAPTIC_FEEDBACK = haptics;
    vm.runInContext(instrumented, context);
    const game = window.Game;
    game.resetGame();
    game.snapshot().snake.started = true;
    function nextCell() {
        const { snake } = game.snapshot();
        return { x: snake.cells[0].x + snake.dir.x, y: snake.cells[0].y + snake.dir.y };
    }
    return {
        game,
        config: context.CONFIG,
        scores,
        get visaPops() { return visaPops; },
        placeFood(index = 0) {
            const def = context.CONFIG.ITEMS[index];
            game.snapshot().items.splice(0, Infinity, {
                ...nextCell(), kind: 'item', sprite: def.key,
                points: def.points, grow: def.grow, color: def.color
            });
        },
        placePenalty() {
            game.snapshot().items.splice(0, Infinity, {
                ...nextCell(), kind: 'penalty',
                points: context.CONFIG.PENALTY_POINTS,
                shrink: context.CONFIG.PENALTY_SHRINK,
                expiresAt: now + context.CONFIG.PENALTY_LIFETIME_MS
            });
        },
        placePowerup(id) {
            game.snapshot().items.splice(0, Infinity, { kind: 'item', x: 0, y: 0 });
            game.snapshot().power[id].marker = { ...nextCell(), expiresAt: now + 1000 };
        },
        advance() {
            now += context.CONFIG.START_STEP_MS;
            game.logicStep(now);
        }
    };
}

for (let index = 0; index < 3; index++) {
    test(`food ${index + 1} vibrates once for 50 ms and preserves points and growth`, () => {
        const calls = [];
        const navigator = {
            vibrate(duration) {
                assert.equal(this, navigator);
                calls.push(duration);
                return true;
            }
        };
        const env = setup({ navigator });
        assert.deepEqual(calls, []);
        env.placeFood(index);
        env.advance();
        assert.deepEqual(calls, [50]);
        assert.equal(env.scores.at(-1), env.config.ITEMS[index].points);
        const snapshot = env.game.snapshot();
        assert.equal(snapshot.snake.pendingGrow, env.config.ITEMS[index].grow);
        assert.equal(snapshot.scoreLog.length, 1);
        assert.equal(snapshot.scoreLog[0].v, env.config.ITEMS[index].points);
        snapshot.items.splice(0, Infinity, { kind: 'item', x: 0, y: 0 });
        env.advance();
        assert.deepEqual(calls, [50]);
    });
}

test('the red X vibrates for 150 ms and still subtracts points and shrinks the courier', () => {
    const calls = [];
    const env = setup({ navigator: { vibrate: duration => calls.push(duration) } });
    env.placeFood(2);
    env.advance();
    env.placePenalty();
    env.advance();
    assert.deepEqual(calls, [50, 150]);
    assert.equal(env.scores.at(-1), 2);
    const snapshot = env.game.snapshot();
    assert.equal(snapshot.snake.cells.length, 2);
    assert.equal(snapshot.scoreLog[1].v, -3);
    assert.equal(snapshot.items.some(item => item.kind === 'penalty'), false);
    snapshot.items.splice(0, Infinity, { kind: 'item', x: 0, y: 0 });
    env.advance();
    assert.deepEqual(calls, [50, 150]);
});

for (const id of ['boost', 'slow']) {
    test(`${id} powerup vibrates once for 50 ms and remains active`, () => {
        const calls = [];
        const env = setup({ navigator: { vibrate: duration => calls.push(duration) } });
        env.placePowerup(id);
        env.advance();
        assert.deepEqual(calls, [50]);
        const powerup = env.game.snapshot().power[id];
        assert.equal(powerup.active, true);
        assert.equal(powerup.marker, null);
        assert.equal(powerup.timeLeft, powerup.def.duration());
        if (id === 'boost') assert.equal(env.visaPops, 1);
        env.advance();
        assert.deepEqual(calls, [50]);
    });
}

test('movement and expired penalties do not vibrate', () => {
    const calls = [];
    const env = setup({ navigator: { vibrate: duration => calls.push(duration) } });
    env.game.snapshot().items.splice(0, Infinity,
        { kind: 'item', x: 0, y: 0 },
        { kind: 'penalty', x: 0, y: 1, expiresAt: 0 });
    env.advance();
    assert.deepEqual(calls, []);
    assert.equal(env.game.snapshot().items.some(item => item.kind === 'penalty'), false);
});

test('the existing haptic feedback flag disables all pickup vibrations', () => {
    const calls = [];
    const env = setup({ navigator: { vibrate: duration => calls.push(duration) }, haptics: false });
    env.placeFood();
    env.advance();
    env.placePenalty();
    env.advance();
    env.placePowerup('boost');
    env.advance();
    env.placePowerup('slow');
    env.advance();
    assert.deepEqual(calls, []);
    assert.equal(env.game.snapshot().power.slow.active, true);
});

for (const [name, navigator] of [
    ['missing API', {}],
    ['non-callable API', { vibrate: null }],
    ['rejected vibration', { vibrate: () => false }],
    ['throwing API', { vibrate() { throw new Error('Vibration blocked'); } }]
]) {
    test(`all pickups continue working with ${name}`, () => {
        const env = setup({ navigator });
        env.placeFood(2);
        env.advance();
        env.placePenalty();
        env.advance();
        assert.equal(env.scores.at(-1), 2);
        assert.equal(env.game.snapshot().scoreLog.length, 2);
        for (const id of ['boost', 'slow']) {
            env.placePowerup(id);
            env.advance();
            assert.equal(env.game.snapshot().power[id].active, true);
        }
    });
}
