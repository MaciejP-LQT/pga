const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { setupGame } = require('./game-harness.cjs');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'flow.js'), 'utf8');

for (const expired of [false, true]) {
    test(`back navigation ${expired ? 'does not cover game over' : 'pauses and opens confirmation'}`, () => {
        const env = setupGame();
        env.advance(3000);
        if (expired) env.elapse(40000);
        const navigation = [];
        const window = { Game: env.game };
        vm.runInNewContext(source, {
            window,
            Game: env.game,
            Screens: { on() {}, go: (...args) => navigation.push(args) }
        });
        window.Flow.goBack('confirm');
        if (expired) {
            assert.equal(env.endings.length, 1);
            assert.deepEqual(navigation, []);
        } else {
            assert.equal(navigation.length, 1);
            assert.equal(navigation[0][0], 'confirm');
            env.advance(10000);
            assert.equal(env.time.textContent, '0:40');
        }
    });
}
