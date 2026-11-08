const assert = require('node:assert/strict');
const test = require('node:test');
const { setupGame } = require('./game-harness.cjs');

function setup(navigator = {}, seconds = 40) {
    const env = setupGame({ navigator, seconds });
    env.advance(3000);
    return env;
}

function createCard(game, id) {
    return game.createCardElement({ id, src: `assets/${id}.jpg` });
}

function matchPair(game, id = 'card-1k') {
    const pair = [createCard(game, id), createCard(game, id)];
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
    const first = createCard(game, 'card-1k');
    game.onCardClick(first);
    assert.deepEqual(calls, []);
    game.onCardClick(first);
    assert.deepEqual(calls, []);
    game.onCardClick(createCard(game, 'card-1k'));
    assert.deepEqual(calls, [50]);
    assert.equal(game.getScore(), 10);
    game.onCardClick(first);
    assert.deepEqual(calls, [50]);
    game.onCardClick(createCard(game, 'card-1v'));
    game.onCardClick(createCard(game, 'card-1v'));
    assert.deepEqual(calls, [50, 50]);
    assert.equal(game.getScore(), 40);
});

test('a mismatch never vibrates and the next matching pair still works', () => {
    const calls = [];
    const { game, advance } = setup({ vibrate: duration => calls.push(duration) });
    const first = createCard(game, 'card-1k');
    game.onCardClick(first);
    game.onCardClick(createCard(game, 'card-1v'));
    assert.deepEqual(calls, []);
    assert.equal(game.getScore(), 0);
    advance(1000);
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
        game.onCardClick(createCard(game, 'card-1v'));
        game.onCardClick(createCard(game, 'card-1v'));
        assert.equal(game.getScore(), 40);
    });

    test(`countdown reaches game over with ${name}`, () => {
        const { game, tick, time, endings } = setup(navigator, 6);
        game.onCardClick(createCard(game, 'card-1k'));
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
    assert.deepEqual(calls, []);
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
    game.onCardClick(createCard(game, 'card-1k'));
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
        game.onCardClick(createCard(game, 'card-1k'));
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
    game.onCardClick(createCard(game, 'card-1k'));
    tick();
    assert.deepEqual(calls, [80]);
    game.resetTimer(7);
    tick(10);
    assert.deepEqual(calls, [80]);
    game.startTimer();
    tick();
    assert.deepEqual(calls, [80]);
    tick(6);
    assert.deepEqual(calls, Array(6).fill(80));
});
