const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scripts = path.join(__dirname, '..', 'assets', 'js');
const source = fs.readFileSync(path.join(scripts, 'game.js'), 'utf8');
// Expose private handlers and state only in the VM, not in the production Game API.
const instrumented = source.replace('        init: init, start: start, stop: stop,', [
    '        heroStepLogic, checkCollisions, spawnItem, updateCountdown, respawnAfterDeath,',
    '        setTokens: values => { tokens = new Set(values); tokensLeft = tokens.size; },',
    '        snapshot: () => ({ mz, hero, drones, tokens, powerCells, item, score, scoreLog,',
    '                          lives, boostLeft, slowLeft, state }),',
    '        init: init, start: start, stop: stop,'
].join('\n'));
assert.notEqual(instrumented, source);

function setup({ navigator = {}, haptics = true, lives = 3, shield = 0 } = {}) {
    const window = {};
    const endings = [];
    const scores = [];
    const lifeUpdates = [];
    const canvas = { getContext: () => ({}) };
    const context = vm.createContext({
        window,
        navigator,
        performance: { now: () => 1000 },
        document: {
            readyState: 'loading',
            addEventListener() {},
            getElementById: () => canvas
        },
        UI: {
            setScore: value => scores.push(value),
            setLives: value => lifeUpdates.push(value),
            setLevel() {}, setPowerups() {}, hideBanner() {}, showCountdown() {},
            showHint() {}, setThumbZone() {}, hideCountdown() {}, hideHint() {},
            banner() {}, showVisaPop() {}, showSlowPop() {}, showClearPop() {}
        },
        Effects: { clear() {}, burst() {}, shake() {}, flash() {}, floatText() {} },
        Input: { show() {} },
        Api: { endGame: (...args) => { endings.push(args); return Promise.resolve({ ok: true }); } },
        T: key => key === 'game.countdown' ? ['3', '2', '1'] : key,
        requestAnimationFrame: () => 1,
        setTimeout() {}
    });
    for (const [file, name] of [['config.js', 'CONFIG'], ['maze.js', 'Maze'], ['drones.js', 'Drones']]) {
        vm.runInContext(fs.readFileSync(path.join(scripts, file), 'utf8'), context);
        context[name] = window[name];
    }
    context.CONFIG.HAPTIC_FEEDBACK = haptics;
    context.CONFIG.LIVES = lives;
    context.CONFIG.HERO_SHIELD_MS = shield;
    vm.runInContext(instrumented, context);
    const game = window.Game;
    function finishCountdown() {
        for (let i = 0; i < 3; i++) game.updateCountdown(context.CONFIG.COUNTDOWN_STEP_MS);
        assert.equal(game.isPlaying(), true);
    }
    game.start();
    finishCountdown();
    function approach(cell) {
        const { mz, hero } = game.snapshot();
        const direction = context.Maze.options(mz, cell.x, cell.y)[0];
        assert.ok(direction, 'The target must have an accessible neighbour');
        hero.x = context.Maze.wrapX(mz, cell.x + direction.x);
        hero.y = cell.y + direction.y;
        hero.px = hero.x;
        hero.py = hero.y;
        hero.dir = { x: -direction.x, y: -direction.y };
        hero.next = null;
    }
    return {
        game, scores, lifeUpdates, endings,
        config: context.CONFIG,
        approach,
        collectFood(index = 0) {
            game.spawnItem();
            const item = game.snapshot().item;
            assert.ok(item);
            Object.assign(item, context.CONFIG.ITEMS[index]);
            approach(item);
            game.heroStepLogic();
        },
        collectPowerup(kind) {
            const cell = game.snapshot().powerCells.find(p => p.kind === kind);
            assert.ok(cell);
            approach(cell);
            game.heroStepLogic();
        },
        collide(properties = {}) {
            const { hero, drones } = game.snapshot();
            const drone = drones[0];
            Object.assign(drone, {
                x: hero.x, y: hero.y, px: hero.x, py: hero.y,
                releaseIn: 0, respawnLeft: 0, graceLeft: 0, weak: false,
                ...properties
            });
            game.checkCollisions();
            return drone;
        },
        respawn() {
            game.respawnAfterDeath();
            finishCountdown();
        }
    };
}

for (let index = 0; index < 3; index++) {
    test(`food ${index + 1} vibrates once for 50 ms and preserves scoring`, () => {
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
        env.collectFood(index);
        assert.deepEqual(calls, [50]);
        const snapshot = env.game.snapshot();
        assert.equal(snapshot.item, null);
        assert.equal(snapshot.scoreLog.at(-1).v, env.config.ITEMS[index].points);
        assert.equal(env.scores.at(-1), snapshot.score);
    });
}

for (const kind of ['boost', 'slow']) {
    test(`${kind} powerup vibrates once for 50 ms and keeps its effect`, () => {
        const calls = [];
        const env = setup({ navigator: { vibrate: duration => calls.push(duration) } });
        const before = env.game.snapshot().powerCells.length;
        env.collectPowerup(kind);
        assert.deepEqual(calls, [50]);
        const snapshot = env.game.snapshot();
        assert.equal(snapshot.powerCells.length, before - 1);
        assert.equal(snapshot[kind + 'Left'], env.config[kind.toUpperCase() + '_DURATION_MS']);
        if (kind === 'boost') assert.ok(snapshot.drones.every(drone => drone.weak));
    });
}

for (const last of [false, true]) {
    test(`${last ? 'the final magnifying glass' : 'a magnifying glass'} does not vibrate`, () => {
        const calls = [];
        const env = setup({ navigator: { vibrate: duration => calls.push(duration) } });
        const key = env.game.snapshot().tokens.values().next().value;
        if (last) env.game.setTokens([key]);
        const [x, y] = key.split(':').map(Number);
        env.approach({ x, y });
        env.game.heroStepLogic();
        const snapshot = env.game.snapshot();
        assert.deepEqual(calls, []);
        assert.equal(snapshot.tokens.has(key), false);
        assert.equal(snapshot.score, env.config.TOKEN_POINTS + (last ? env.config.LEVEL_CLEAR_BONUS : 0));
        assert.equal(snapshot.state, last ? 'clear' : 'play');
    });
}

test('being caught vibrates for 150 ms once per lost life, including after respawn', () => {
    const calls = [];
    const env = setup({ navigator: { vibrate: duration => calls.push(duration) } });
    env.collide();
    assert.deepEqual(calls, [150]);
    assert.equal(env.game.snapshot().lives, 2);
    assert.equal(env.game.snapshot().state, 'dying');
    env.game.checkCollisions();
    assert.deepEqual(calls, [150]);
    env.respawn();
    env.collide();
    assert.deepEqual(calls, [150, 150]);
    assert.equal(env.game.snapshot().lives, 1);
    assert.deepEqual(env.lifeUpdates, [3, 2, 1]);
});

test('losing the last life vibrates once and still ends the game', () => {
    const calls = [];
    const env = setup({ navigator: { vibrate: duration => calls.push(duration) }, lives: 1 });
    env.collide();
    env.game.checkCollisions();
    assert.deepEqual(calls, [150]);
    assert.equal(env.game.snapshot().lives, 0);
    assert.equal(env.game.snapshot().state, 'over');
    assert.equal(env.endings.length, 1);
});

for (const [name, options, drone] of [
    ['hero shield', { shield: 2000 }, {}],
    ['drone spawn grace', {}, { graceLeft: 1000 }],
    ['capturing a weakened drone', {}, { weak: true }]
]) {
    test(`${name} does not cause a life-loss vibration`, () => {
        const calls = [];
        const env = setup({ ...options, navigator: { vibrate: duration => calls.push(duration) } });
        env.collide(drone);
        assert.deepEqual(calls, []);
        assert.equal(env.game.snapshot().lives, 3);
        assert.equal(env.game.isPlaying(), true);
    });
}

test('the haptic feedback flag disables both collection and life-loss vibrations', () => {
    const calls = [];
    const env = setup({ navigator: { vibrate: duration => calls.push(duration) }, haptics: false });
    env.collectFood();
    env.collectPowerup('boost');
    env.collectPowerup('slow');
    env.collide();
    assert.deepEqual(calls, []);
    assert.equal(env.game.snapshot().lives, 2);
});

for (const [name, navigator] of [
    ['missing API', {}],
    ['non-callable API', { vibrate: null }],
    ['rejected vibration', { vibrate: () => false }],
    ['throwing API', { vibrate() { throw new Error('Vibration blocked'); } }]
]) {
    test(`collection and life loss keep working with ${name}`, () => {
        const env = setup({ navigator });
        env.collectFood();
        assert.equal(env.game.snapshot().item, null);
        assert.equal(env.game.snapshot().scoreLog.at(-1).v, env.config.ITEMS[0].points);
        env.collectPowerup('boost');
        assert.equal(env.game.snapshot().boostLeft, env.config.BOOST_DURATION_MS);
        env.collectPowerup('slow');
        assert.equal(env.game.snapshot().slowLeft, env.config.SLOW_DURATION_MS);
        env.collide();
        assert.equal(env.game.snapshot().lives, 2);
        assert.equal(env.game.snapshot().state, 'dying');
    });
}
