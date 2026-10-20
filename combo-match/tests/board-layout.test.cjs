const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'game.js'), 'utf8');
// Expose the private fitter only inside the VM; the production Game API stays unchanged.
const instrumented = source.replace(/    return \{\r?\n        init,/, '    return {\n        fitBoard,\n        init,');
assert.notEqual(instrumented, source);

function setup(options = {}) {
    const state = {
        rows: 4, cols: 4, size: 76, gap: 6,
        appHeight: 520, paddingTop: 68, paddingBottom: 10,
        stageWidth: 342, overhead: 138.78,
        ...options
    };
    const properties = new Map();
    const dimension = name => parseFloat(properties.get(name)) || state.size;
    const board = {
        style: {
            setProperty: (key, value) => properties.set(key, value),
            removeProperty: key => properties.delete(key)
        },
        getBoundingClientRect: () => ({ height: state.rows * dimension('--card-height') + (state.rows - 1) * state.gap })
    };
    const elements = {
        app: { get clientHeight() { return state.appHeight; } },
        stage: { get clientWidth() { return state.stageWidth + 24; } },
        'game-board': board,
        'play-block': { getBoundingClientRect: () => ({ height: board.getBoundingClientRect().height + state.overhead }) }
    };
    const window = {};
    vm.runInNewContext(instrumented, {
        window,
        document: { getElementById: id => elements[id] },
        getComputedStyle: el => {
            if (el === elements.app) return { paddingTop: state.paddingTop + 'px', paddingBottom: state.paddingBottom + 'px' };
            if (el === elements.stage) return { paddingLeft: '12px', paddingRight: '12px' };
            if (el === board) return {
                rowGap: state.gap + 'px',
                getPropertyValue: name => ({ '--card-size': state.size, '--grid-rows': state.rows, '--grid-cols': state.cols })[name]
            };
            throw new Error('Unexpected style read');
        }
    });
    return { state, elements, properties, dimension, fit: window.Game.fitBoard };
}

test('four columns fit a narrow phone even when there is enough height', () => {
    const env = setup({ appHeight: 740, stageWidth: 272 });
    env.fit();
    assert.equal(env.dimension('--card-width'), 63.5);
    assert.equal(env.dimension('--card-height'), 63.5);
});

test('four rows reserve both HUDs, board padding and the back-button row', () => {
    const env = setup({ cols: 3 });
    env.fit();
    assert.equal(env.dimension('--card-width'), 76);
    assert.ok(env.dimension('--card-height') < 76);
    const used = 4 * env.dimension('--card-height') + 3 * 6 + env.state.overhead + 68 + 10;
    assert.ok(used <= 520);
});

test('all grid shapes fit phone, desktop and 4K layout budgets', () => {
    for (const [cols, rows] of [[3, 3], [3, 4], [4, 4]]) {
        for (const options of [
            {},
            { appHeight: 440, stageWidth: 272 },
            { size: 130, gap: 12, stageWidth: 540, paddingTop: 90, overhead: 170 },
            { size: 210, gap: 20, stageWidth: 938, appHeight: 2160, paddingTop: 20, paddingBottom: 20, overhead: 280 }
        ]) {
            const env = setup({ cols, rows, ...options });
            env.fit();
            const width = cols * env.dimension('--card-width') + (cols - 1) * env.state.gap;
            const height = rows * env.dimension('--card-height') + (rows - 1) * env.state.gap + env.state.overhead;
            assert.ok(width <= env.state.stageWidth + 0.001);
            assert.ok(height <= env.state.appHeight - env.state.paddingTop - env.state.paddingBottom);
        }
    }
});

test('restoring a large viewport removes stale card overrides', () => {
    const env = setup({ stageWidth: 272 });
    env.fit();
    assert.equal(env.properties.size, 2);
    env.state.stageWidth = 400;
    env.state.appHeight = 900;
    env.fit();
    assert.equal(env.properties.size, 0);
});

test('repeated ResizeObserver measurements converge without progressive shrinking', () => {
    const env = setup();
    env.fit();
    const before = Array.from(env.properties);
    for (let i = 0; i < 50; i++) env.fit();
    assert.deepEqual(Array.from(env.properties), before);
});

test('a taller HUD updates dimensions without changing the grid', () => {
    const env = setup();
    env.fit();
    const before = env.dimension('--card-height');
    env.state.overhead += 30;
    env.fit();
    assert.ok(env.dimension('--card-height') < before);
    assert.equal(env.state.rows, 4);
    assert.equal(env.state.cols, 4);
});

test('missing board is harmless during document setup', () => {
    const env = setup();
    delete env.elements['game-board'];
    assert.doesNotThrow(env.fit);
    assert.equal(env.properties.size, 0);
});
