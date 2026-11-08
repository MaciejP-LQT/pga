const assert = require('node:assert/strict');
const test = require('node:test');
const { setupGame } = require('./game-harness.cjs');

const hidden = el => el.classList.contains('hidden');
const flipped = card => card.classList.contains('flipped');
const image = card => card.querySelector('img');

function pair(env, id = 'card-1k') {
    const cards = [env.createCard(id), env.createCard(id)];
    cards.forEach(card => card.click());
    return cards;
}

test('unseen cards have identical markup, no identity attributes and no images', () => {
    const env = setupGame();
    const cards = env.cards();
    assert.equal(cards.length, 8);
    assert.equal(env.elements['game-board'].children.length, 9);
    assert.equal(new Set(cards.map(card => card.innerHTML)).size, 1);
    for (const card of cards) {
        assert.equal(card.className, 'card');
        assert.deepEqual(card.dataset, {});
        assert.doesNotMatch(card.innerHTML, /data-|src=|alt=|card-\d/);
        assert.equal(image(card), null);
    }
});

test('each stage counts 3, 2, 1 and starts its timer without any click', () => {
    const env = setupGame();
    const card = env.cards()[0];
    for (const value of ['3', '2', '1']) {
        assert.equal(env.elements['countdown-value'].textContent, value);
        assert.equal(hidden(env.elements['countdown-overlay']), false);
        card.click();
        assert.equal(flipped(card), false);
        assert.equal(image(card), null);
        assert.equal(env.time.textContent, '0:40');
        env.advance(1000);
    }
    assert.equal(hidden(env.elements['countdown-overlay']), true);
    env.advance(1000);
    assert.equal(env.time.textContent, '0:39');
    card.click();
    assert.equal(flipped(card), true);
    assert.ok(image(card));
});

test('only a revealed card receives an image and mismatches remove both images', () => {
    const env = setupGame();
    env.advance(3000);
    const first = env.createCard('card-1k');
    const second = env.createCard('card-1v');
    first.click();
    assert.equal(image(first).src, 'assets/card-1k.jpg');
    assert.equal(image(first).alt, '');
    assert.equal(image(first).draggable, false);
    assert.equal(image(second), null);
    assert.ok(env.cards().every(card => !image(card)));
    second.click();
    env.advance(999);
    assert.ok(image(first));
    assert.ok(image(second));
    env.advance(1);
    assert.equal(image(first), null);
    assert.equal(image(second), null);
    assert.equal(flipped(first), false);
    assert.equal(flipped(second), false);
    first.click();
    assert.equal(image(first).src, 'assets/card-1k.jpg');
});

test('matching uses private data rather than forged data-id attributes', () => {
    const env = setupGame();
    env.advance(3000);
    const first = env.createCard('card-1k');
    const second = env.createCard('card-1v');
    first.dataset.id = second.dataset.id = 'forged-pair';
    first.click();
    second.click();
    assert.equal(env.game.getScore(), 0);
    env.advance(1000);
    const matched = pair(env);
    assert.equal(env.game.getScore(), 10);
    matched.forEach(card => {
        assert.equal(card.classList.contains('matched'), true);
        assert.ok(image(card));
        card.click();
    });
    assert.equal(env.game.getScore(), 10);
});

test('a delayed countdown callback does not grant extra playing time', () => {
    const env = setupGame();
    env.elapse(8500);
    env.flush();
    assert.equal(hidden(env.elements['countdown-overlay']), true);
    assert.equal(env.time.textContent, '0:35');
    env.elapse(34500);
    env.flush();
    assert.equal(env.time.textContent, '0:00');
    assert.equal(env.endings.length, 1);
});

test('the game expires even if the browser misses the entire countdown and stage', () => {
    const env = setupGame();
    env.elapse(60000);
    env.flush();
    assert.equal(env.time.textContent, '0:00');
    assert.equal(env.endings.length, 1);
    assert.equal(env.timers.size, 0);
    assert.equal(hidden(env.elements['countdown-overlay']), true);
});

test('a throttled timer catches up to the deadline instead of subtracting one second', () => {
    const env = setupGame();
    env.advance(3000);
    env.elapse(17500);
    env.flush();
    assert.equal(env.time.textContent, '0:23');
    env.elapse(22500);
    env.flush();
    assert.equal(env.endings.length, 1);
    assert.equal(env.endings[0].duration, 43000);
    assert.equal(env.time.textContent, '0:00');
});

test('clicking an expired stage cannot reveal a card or score before the next timer callback', () => {
    const env = setupGame();
    env.advance(3000);
    const first = env.createCard('card-1k');
    const second = env.createCard('card-1k');
    first.click();
    env.elapse(40000);
    second.click();
    assert.equal(image(second), null);
    assert.equal(flipped(second), false);
    assert.equal(env.game.getScore(), 0);
    assert.equal(env.endings.length, 1);
    env.flush();
    env.game.resume();
    second.click();
    assert.equal(env.endings.length, 1);
});

test('pausing the countdown preserves its remaining fraction without unlocking cards', () => {
    const env = setupGame();
    env.advance(1250);
    env.game.pause();
    env.advance(5000);
    env.game.pause();
    env.advance(5000);
    assert.equal(env.elements['countdown-value'].textContent, '2');
    env.cards()[0].click();
    assert.equal(image(env.cards()[0]), null);
    env.game.resume();
    env.game.resume();
    env.advance(1749);
    assert.equal(hidden(env.elements['countdown-overlay']), false);
    env.advance(51);
    assert.equal(hidden(env.elements['countdown-overlay']), true);
    assert.equal(env.time.textContent, '0:40');
    env.advance(1000);
    assert.equal(env.time.textContent, '0:39');
});

test('pausing play preserves subsecond time and repeated pauses/resumes do not extend it', () => {
    const env = setupGame();
    env.advance(4250);
    env.game.pause();
    env.advance(4000);
    env.game.pause();
    env.advance(6000);
    assert.equal(env.time.textContent, '0:39');
    env.game.resume();
    env.game.resume();
    env.advance(700);
    assert.equal(env.time.textContent, '0:39');
    env.advance(50);
    assert.equal(env.time.textContent, '0:38');
    env.advance(38000);
    assert.equal(env.endings.length, 1);
});

test('pausing after expiry cannot resurrect a finished stage', () => {
    const env = setupGame();
    env.advance(3000);
    env.elapse(40000);
    assert.equal(env.game.pause(), false);
    env.game.resume();
    assert.equal(env.endings.length, 1);
    assert.equal(env.timers.size, 0);
});

for (const elapsed of [1200, 4200]) {
    test(`stopping after ${elapsed} ms cancels countdowns and delayed stage work`, () => {
        const env = setupGame();
        env.advance(elapsed);
        env.game.stop();
        assert.equal(env.timers.size, 0);
        assert.equal(hidden(env.elements['countdown-overlay']), true);
        env.game.resume();
        env.advance(60000);
        env.cards()[0].click();
        assert.equal(env.endings.length, 0);
        assert.equal(image(env.cards()[0]), null);
    });
}

test('restarting cancels mismatch callbacks and rejects cards from the previous stage', () => {
    const env = setupGame();
    env.advance(3000);
    const oldCards = [env.createCard('card-1k'), env.createCard('card-1v')];
    oldCards.forEach(card => card.click());
    env.advance(200);
    env.game.start();
    const card = env.cards()[0];
    env.advance(1200);
    card.click();
    assert.equal(image(card), null);
    assert.equal(hidden(env.elements['countdown-overlay']), false);
    env.advance(1800);
    oldCards.forEach(oldCard => {
        oldCard.classList.remove('flipped');
        oldCard.click();
    });
    assert.equal(env.game.getScore(), 0);
    card.click();
    assert.equal(flipped(card), true);
    assert.equal([...env.timers.values()].filter(timer => timer.repeat).length, 1);
});

test('restarting during the countdown gives exactly one fresh countdown', () => {
    const env = setupGame();
    env.advance(2500);
    env.game.start();
    env.advance(1000);
    assert.equal(env.elements['countdown-value'].textContent, '2');
    assert.equal(hidden(env.elements['countdown-overlay']), false);
    env.advance(2000);
    assert.equal(hidden(env.elements['countdown-overlay']), true);
    assert.equal([...env.timers.values()].filter(timer => timer.repeat).length, 1);
});

test('the last legal match stops the clock before its celebration animation', () => {
    const env = setupGame();
    env.advance(3000);
    pair(env, 'card-1k');
    pair(env, 'card-2k');
    pair(env, 'card-1v');
    env.advance(39900);
    pair(env, 'card-2v');
    assert.equal(env.game.getScore(), 100);
    env.advance(600);
    assert.equal(env.endings.length, 0);
    assert.equal(hidden(env.elements['stage-overlay']), false);
    assert.equal(env.elements['stage-overlay-time'].textContent, '0:39');
    env.elements['btn-next-stage'].click();
    assert.equal(env.game.getStage(), 2);
    assert.equal(env.game.getScore(), 100);
    assert.equal(env.cards().length, 12);
    assert.equal(env.elements['countdown-value'].textContent, '3');
    assert.equal(env.time.textContent, '0:50');
    assert.ok(env.cards().every(card => !image(card)));
    env.advance(4000);
    assert.equal(env.time.textContent, '0:49');
});

test('a pending stage-complete callback cannot reopen an overlay after restart', () => {
    const env = setupGame();
    env.advance(3000);
    for (const id of ['card-1k', 'card-2k', 'card-1v', 'card-2v']) pair(env, id);
    env.game.start();
    env.advance(1000);
    assert.equal(hidden(env.elements['stage-overlay']), true);
    assert.equal(hidden(env.elements['countdown-overlay']), false);
    assert.equal(env.game.getScore(), 0);
});
