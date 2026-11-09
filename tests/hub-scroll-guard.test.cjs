const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'scroll-guard.js'), 'utf8');
const touch = (x, y, identifier = 1) => ({ clientX: x, clientY: y, identifier });

function setup(scrollTop = 0) {
    const listeners = new Map();
    const classes = new Set();
    const region = {
        scrollTop,
        clientHeight: 400,
        scrollHeight: 1000,
        classList: {
            toggle(name, active) {
                if (active) classes.add(name);
                else classes.delete(name);
            },
            contains(name) { return classes.has(name); }
        },
        addEventListener(type, listener, options) {
            listeners.set(type, { listener, options });
        }
    };
    vm.runInNewContext(source, {
        document: { getElementById: id => id === 'hub-scroll' ? region : null }
    });
    function dispatch(type, touches = [], cancelable = true) {
        const event = {
            touches,
            cancelable,
            defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; }
        };
        listeners.get(type).listener(event);
        return event;
    }
    return { region, listeners, dispatch };
}

function swipe(scrollTop, x, y) {
    const env = setup(scrollTop);
    env.dispatch('touchstart', [touch(100, 100)]);
    return env.dispatch('touchmove', [touch(x, y)]).defaultPrevented;
}

test('registers non-passive touch handlers only on the Hub scroll region', () => {
    const { listeners } = setup();
    assert.equal(listeners.get('touchmove').options.passive, false);
    assert.equal(listeners.get('touchstart').options.passive, false);
    assert.equal(listeners.get('scroll').options.passive, true);
    assert.equal(listeners.has('click'), false);
    assert.equal(listeners.has('keydown'), false);
});

for (const [name, scrollTop, y, prevented] of [
    ['outward at top', 0, 140, false],
    ['outward at bottom', 600, 60, true],
    ['inward at top', 0, 60, false],
    ['inward at bottom', 600, 140, false],
    ['upward in the middle', 300, 60, false],
    ['downward in the middle', 300, 140, false],
    ['fractional top edge', 0.5, 140, false],
    ['fractional bottom edge', 599.5, 60, true],
    ['negative overscroll at top', -5, 140, false],
    ['overscroll beyond bottom', 605, 60, true]
]) {
    test(`vertical swipe: ${name}`, () => {
        assert.equal(swipe(scrollTop, 100, y), prevented);
    });
}

test('initializes the top-boundary class with rounding and negative overscroll tolerance', () => {
    for (const top of [-5, 0, 0.5, 1, 1.5, 300, 600]) {
        assert.equal(setup(top).region.classList.contains('is-at-top'), top <= 1);
    }
});

test('updates top-boundary state when scrolling in either direction', () => {
    const { region, dispatch } = setup();
    assert.equal(region.classList.contains('is-at-top'), true);
    region.scrollTop = 300;
    dispatch('scroll');
    assert.equal(region.classList.contains('is-at-top'), false);
    region.scrollTop = 600;
    dispatch('scroll');
    assert.equal(region.classList.contains('is-at-top'), false);
    region.scrollTop = 0;
    dispatch('scroll');
    assert.equal(region.classList.contains('is-at-top'), true);
});

test('checks the current boundary when a gesture reaches the bottom', () => {
    const { region, dispatch } = setup(550);
    dispatch('touchstart', [touch(100, 100)]);
    assert.equal(dispatch('touchmove', [touch(100, 80)]).defaultPrevented, false);
    region.scrollTop = 600;
    assert.equal(dispatch('touchmove', [touch(100, 60)]).defaultPrevented, true);
});

test('allows reversing direction back into the list after a blocked move', () => {
    const { dispatch } = setup(600);
    dispatch('touchstart', [touch(100, 100)]);
    assert.equal(dispatch('touchmove', [touch(100, 60)]).defaultPrevented, true);
    assert.equal(dispatch('touchmove', [touch(100, 80)]).defaultPrevented, false);
});

test('preserves horizontal carousel swipes at both boundaries', () => {
    for (const top of [0, 600]) {
        assert.equal(swipe(top, 40, 110), false);
        assert.equal(swipe(top, 160, 90), false);
    }
});

test('does not block stationary touches or a tap', () => {
    const { dispatch } = setup();
    assert.equal(dispatch('touchstart', [touch(100, 100)]).defaultPrevented, false);
    assert.equal(dispatch('touchmove', [touch(100, 100)]).defaultPrevented, false);
    assert.equal(dispatch('touchend').defaultPrevented, false);
});

test('blocks multi-touch movement even without a tracked single-finger gesture', () => {
    const { dispatch } = setup(300);
    assert.equal(dispatch('touchmove', [touch(100, 130), touch(150, 130, 2)]).defaultPrevented, true);
    assert.equal(dispatch('touchmove', [touch(100, 150)]).defaultPrevented, false);
});

test('blocks the second finger and requires a new single-finger gesture afterwards', () => {
    const { dispatch } = setup(600);
    dispatch('touchstart', [touch(100, 100)]);
    assert.equal(dispatch('touchstart', [touch(100, 100), touch(150, 100, 2)]).defaultPrevented, true);
    assert.equal(dispatch('touchmove', [touch(100, 80), touch(150, 80, 2)]).defaultPrevented, true);
    assert.equal(dispatch('touchmove', [touch(100, 60)]).defaultPrevented, false);
    dispatch('touchend');
    dispatch('touchstart', [touch(100, 100)]);
    assert.equal(dispatch('touchmove', [touch(100, 60)]).defaultPrevented, true);
});

test('blocks three or more fingers', () => {
    const { dispatch } = setup(300);
    const touches = [touch(100, 100), touch(150, 100, 2), touch(200, 100, 3)];
    assert.equal(dispatch('touchstart', touches).defaultPrevented, true);
    assert.equal(dispatch('touchmove', touches).defaultPrevented, true);
});

test('does not attempt to cancel non-cancelable multi-touch events', () => {
    const { dispatch } = setup();
    const touches = [touch(100, 100), touch(150, 100, 2)];
    assert.equal(dispatch('touchstart', touches, false).defaultPrevented, false);
    assert.equal(dispatch('touchmove', touches, false).defaultPrevented, false);
});

test('does not attempt to cancel non-cancelable browser events', () => {
    const { dispatch } = setup(600);
    dispatch('touchstart', [touch(100, 100)]);
    assert.equal(dispatch('touchmove', [touch(100, 60)], false).defaultPrevented, false);
});

for (const end of ['touchend', 'touchcancel']) {
    test(`clears the gesture on ${end}`, () => {
        const { dispatch } = setup(600);
        dispatch('touchstart', [touch(100, 100)]);
        dispatch(end);
        assert.equal(dispatch('touchmove', [touch(100, 60)]).defaultPrevented, false);
    });
}

test('ignores an untracked touch or a different finger', () => {
    const { dispatch } = setup(600);
    assert.equal(dispatch('touchmove', [touch(100, 60)]).defaultPrevented, false);
    dispatch('touchstart', [touch(100, 100)]);
    assert.equal(dispatch('touchmove', [touch(100, 60, 2)]).defaultPrevented, false);
    assert.equal(dispatch('touchmove', [touch(100, 40)]).defaultPrevented, false);
});

test('blocks only bottom-directed swipes when the Hub content does not need scrolling', () => {
    const { region, dispatch } = setup();
    region.scrollHeight = region.clientHeight;
    dispatch('touchstart', [touch(100, 100)]);
    assert.equal(dispatch('touchmove', [touch(100, 140)]).defaultPrevented, false);
    assert.equal(dispatch('touchmove', [touch(100, 80)]).defaultPrevented, true);
});

test('does nothing if the scroll region is absent', () => {
    assert.doesNotThrow(() => vm.runInNewContext(source, {
        document: { getElementById: () => null }
    }));
});

test('Hub loads the guard after parsing and exposes its scroll region', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /<script src="scroll-guard\.js\?[^"\s]+" defer><\/script>/);
    assert.match(html, /<div id="hub-scroll" class="hub-scroll"/);
});

test('Hub touch actions allow panning without pinch zoom', () => {
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
    assert.match(css, /\.hub-scroll\s*\{[^}]*touch-action:\s*pan-x pan-y\s*;/);
    assert.match(css, /\.viewport\s*\{[^}]*touch-action:\s*pan-y\s*;/);
});

test('CSS allows scroll chaining only at the top of the Hub region', () => {
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
    assert.match(css, /html, body\s*\{[^}]*overscroll-behavior-y:\s*auto\s*;/);
    assert.match(css, /\.hub-scroll\s*\{[^}]*overscroll-behavior-y:\s*none\s*;/);
    assert.match(css, /\.hub-scroll\.is-at-top\s*\{[^}]*overscroll-behavior-y:\s*auto\s*;/);
});

test('games do not load the Hub touch guard', () => {
    for (const game of ['combo-match', 'cyber-detective', 'delivery-rush', 'gaming-challenge']) {
        const html = fs.readFileSync(path.join(root, game, 'index.html'), 'utf8');
        assert.doesNotMatch(html, /scroll-guard\.js/);
    }
});
