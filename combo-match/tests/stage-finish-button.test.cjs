const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scripts = path.join(__dirname, '..', 'js');
const source = fs.readFileSync(path.join(scripts, 'game.js'), 'utf8');
// Expose the overlay and score setter only in the VM, without changing the production API.
const instrumented = source.replace(/    return \{\r?\n        init,/,
    '    return {\n        showStageComplete,\n        setScore: value => { score = value; },\n        init,');
assert.notEqual(instrumented, source);

function setup() {
    const endings = [];
    const listeners = new Map();
    const button = {
        textContent: '',
        addEventListener: (name, callback) => listeners.set(name, callback)
    };
    const Flow = { onGameOver: (score, data) => endings.push({ score, ...data }) };
    const window = { Flow };
    const context = vm.createContext({
        window,
        Flow,
        document: { getElementById: id => id === 'btn-stage-finish' ? button : null },
        clearInterval() {},
        setTimeout() {}
    });
    for (const [file, name] of [['config.js', 'CONFIG'], ['texts.js', 'T']]) {
        vm.runInContext(fs.readFileSync(path.join(scripts, file), 'utf8'), context);
        context[name] = window[name];
    }
    vm.runInContext(instrumented, context);
    window.Game.init();
    return {
        config: context.CONFIG,
        button,
        endings,
        show(score) {
            window.Game.setScore(score);
            window.Game.showStageComplete();
        },
        finish: () => listeners.get('click')()
    };
}

for (const score of [0, 90, 199, 200, 201]) {
    test(`the stage finish button uses the correct label for ${score} points`, () => {
        const env = setup();
        assert.equal(env.config.PRIZE_MIN_SCORE, 200);
        env.show(score);
        assert.equal(env.button.textContent, score < 200 ? 'ZAKOŃCZ' : 'ZAKOŃCZ I ODBIERZ NAGRODY');
    });
}

test('the label follows the configured threshold and resets on subsequent overlays', () => {
    const env = setup();
    env.config.PRIZE_MIN_SCORE = 10;
    for (const score of [9, 10, 11, 0]) {
        env.show(score);
        assert.equal(env.button.textContent, score < 10 ? 'ZAKOŃCZ' : 'ZAKOŃCZ I ODBIERZ NAGRODY');
    }
});

for (const score of [90, 200]) {
    test(`finishing between stages still reports the score ${score}`, () => {
        const env = setup();
        env.show(score);
        env.finish();
        assert.equal(env.endings.length, 1);
        assert.equal(env.endings[0].score, score);
        assert.equal(env.endings[0].stage, 1);
        env.finish();
        assert.equal(env.endings.length, 1);
    });
}
