const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'game.js'), 'utf8');
// Expose private handlers only in the VM; keep the production Game API unchanged.
const instrumented = source.replace(/    return \{\r?\n        init,/, '    return {\n        onCardClick,\n        resetTimer,\n        showStageComplete,\n        init,');
assert.notEqual(instrumented, source);

function createCard(id) {
    const classes = new Set();
    return {
        dataset: { id },
        classList: {
            add: (...names) => names.forEach(name => classes.add(name)),
            remove: (...names) => names.forEach(name => classes.delete(name)),
            contains: name => classes.has(name)
        },
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 76, height: 76 })
    };
}

function setup(navigator = {}, seconds = 40) {
    const endings = [];
    const Flow = { onGameOver: (score, result) => endings.push({ score, ...result }) };
    const window = { Flow };
    const timeouts = [];
    const intervals = new Map();
    const time = { textContent: '', closest: () => null };
    let nextIntervalId = 1;
    vm.runInNewContext(instrumented, {
        window,
        Flow,
        navigator,
        document: {
            getElementById: id => id === 'stat-time' ? time : null,
            createElement: () => ({ style: {}, addEventListener() {} }),
            body: { appendChild() {} }
        },
        CONFIG: { POINTS_BASE: 10, MAX_MULTIPLIER: 3, STAGES: [{ timeLimit: seconds }] },
        setInterval(callback, delay) {
            assert.equal(delay, 1000);
            const id = nextIntervalId++;
            intervals.set(id, callback);
            return id;
        },
        clearInterval: id => intervals.delete(id),
        setTimeout: (callback, delay) => timeouts.push({ callback, delay })
    });
    window.Game.resetTimer(seconds);
    return {
        game: window.Game,
        timeouts,
        time,
        endings,
        tick(count = 1) {
            for (let i = 0; i < count; i++) {
                for (const callback of [...intervals.values()]) callback();
            }
        }
    };
}

function matchPair(game, id = 'card-1k') {
    const pair = [createCard(id), createCard(id)];
    pair.forEach(card => game.onCardClick(card));
    assert.equal(game.getScore(), 10);
    pair.forEach(card => assert.equal(card.classList.contains('matched'), true));
    return pair;
}

test('a matching pair vibrates once for 50 ms, synchronously on the second click', () => {
    const calls = [];
    const navigator = {
        vibrate(duration) {
            assert.equal(this, navigator);
            calls.push(duration);
            return true;
        }
    };
    const { game } = setup(navigator);
    const first = createCard('card-1k');
    game.onCardClick(first);
    assert.deepEqual(calls, []);
    game.onCardClick(first);
    assert.deepEqual(calls, []);
    game.onCardClick(createCard('card-1k'));
    assert.deepEqual(calls, [50]);
    assert.equal(game.getScore(), 10);
    game.onCardClick(first);
    assert.deepEqual(calls, [50]);
    game.onCardClick(createCard('card-1v'));
    game.onCardClick(createCard('card-1v'));
    assert.deepEqual(calls, [50, 50]);
    assert.equal(game.getScore(), 40);
});

test('a mismatch never vibrates and the next matching pair still works', () => {
    const calls = [];
    const { game, timeouts } = setup({ vibrate: duration => calls.push(duration) });
    const first = createCard('card-1k');
    game.onCardClick(first);
    game.onCardClick(createCard('card-1v'));
    assert.deepEqual(calls, []);
    assert.equal(game.getScore(), 0);
    timeouts.forEach(({ callback }) => callback());
    assert.equal(first.classList.contains('flipped'), false);
    matchPair(game);
    assert.deepEqual(calls, [50]);
});

for (const [name, navigator] of [
    ['missing API', {}],
    ['non-callable API', { vibrate: null }],
    ['rejected vibration', { vibrate: () => false }],
    ['throwing API', { vibrate() { throw new Error('Vibration blocked'); } }]
]) {
    test(`matching and scoring continue with ${name}`, () => {
        const { game } = setup(navigator);
        const pair = matchPair(game);
        pair.forEach(card => game.onCardClick(card));
        assert.equal(game.getScore(), 10);
        game.onCardClick(createCard('card-1v'));
        game.onCardClick(createCard('card-1v'));
        assert.equal(game.getScore(), 40);
    });

    test(`countdown reaches game over with ${name}`, () => {
        const { game, tick, time, endings } = setup(navigator, 6);
        game.onCardClick(createCard('card-1k'));
        tick(6);
        assert.equal(time.textContent, '0:00');
        assert.equal(endings.length, 1);
        assert.equal(endings[0].score, 0);
        tick(3);
        assert.equal(endings.length, 1);
    });
}

test('the last five seconds vibrate once each for 80 ms, but zero does not', () => {
    const calls = [];
    const env = setup({ vibrate: duration => calls.push({ duration, time: env.time.textContent }) });
    env.tick(40);
    assert.deepEqual(calls, []);
    env.game.onCardClick(createCard('card-1k'));
    env.tick(34);
    assert.equal(env.time.textContent, '0:06');
    assert.deepEqual(calls, []);
    for (let seconds = 5; seconds >= 1; seconds--) {
        env.tick();
        assert.equal(calls.length, 6 - seconds);
        assert.deepEqual(calls.at(-1), { duration: 80, time: '0:0' + seconds });
    }
    env.tick(4);
    assert.equal(env.time.textContent, '0:00');
    assert.equal(calls.length, 5);
    assert.equal(env.endings.length, 1);
});

test('pausing suspends the countdown vibrations and resuming continues them', () => {
    const calls = [];
    const { game, tick, time } = setup({ vibrate: duration => calls.push(duration) }, 6);
    game.onCardClick(createCard('card-1k'));
    tick();
    assert.deepEqual(calls, [80]);
    game.pause();
    tick(10);
    assert.deepEqual(calls, [80]);
    assert.equal(time.textContent, '0:05');
    game.resume();
    tick();
    assert.deepEqual(calls, [80, 80]);
    assert.equal(time.textContent, '0:04');
});

for (const action of ['stop', 'showStageComplete']) {
    test(`${action} stops further countdown vibrations`, () => {
        const calls = [];
        const { game, tick } = setup({ vibrate: duration => calls.push(duration) }, 6);
        game.onCardClick(createCard('card-1k'));
        tick();
        assert.deepEqual(calls, [80]);
        game[action]();
        tick(10);
        assert.deepEqual(calls, [80]);
    });
}

test('resetting the stage timer starts a fresh warning sequence without extra intervals', () => {
    const calls = [];
    const { game, tick } = setup({ vibrate: duration => calls.push(duration) }, 6);
    game.onCardClick(createCard('card-1k'));
    tick();
    assert.deepEqual(calls, [80]);
    game.resetTimer(7);
    tick(10);
    assert.deepEqual(calls, [80]);
    game.onCardClick(createCard('card-1v'));
    tick();
    assert.deepEqual(calls, [80]);
    tick(6);
    assert.deepEqual(calls, Array(6).fill(80));
});
