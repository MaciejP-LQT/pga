const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scripts = path.join(__dirname, '..', 'assets', 'js');
const eligibleEnd = { eligible: true, suspicious: false, rankingActive: true };

function setup({ minScore, apiEnabled = true, claimResults } = {}) {
    const elements = new Map();
    const hooks = new Map();
    const navigation = [];
    let claims = 0;
    function element(id) {
        if (!elements.has(id)) {
            const classes = new Set(['hidden']);
            const listeners = new Map();
            elements.set(id, {
                textContent: '',
                disabled: false,
                style: {},
                classList: {
                    contains: name => classes.has(name),
                    add: name => classes.add(name),
                    remove: name => classes.delete(name),
                    toggle(name, force) {
                        const add = force === undefined ? !classes.has(name) : force;
                        if (add) classes.add(name); else classes.delete(name);
                        return add;
                    }
                },
                addEventListener: (name, callback) => listeners.set(name, callback),
                async click() {
                    await listeners.get('click')();
                    await new Promise(setImmediate);
                }
            });
        }
        return elements.get(id);
    }
    const window = {};
    const Api = {
        loadRanking: async () => ({ ok: true, items: [] }),
        async claimPrize() {
            const result = claimResults && claimResults[claims];
            claims++;
            return result || { ok: true, prize: { code: 'TEST-CODE' } };
        }
    };
    window.Api = Api;
    const Screens = {
        on: (id, handlers) => hooks.set(id, handlers),
        go(id, data) {
            navigation.push({ id, data });
            if (id === 'gameend') hooks.get(id).enter(data || {});
        }
    };
    const context = vm.createContext({
        window,
        Api,
        Screens,
        document: { getElementById: element, querySelectorAll: () => [] },
        setTimeout() {}
    });
    for (const [file, name] of [['config.js', 'CONFIG'], ['texts.js', 'T'], ['flow.js', 'Flow']]) {
        vm.runInContext(fs.readFileSync(path.join(scripts, file), 'utf8'), context);
        context[name] = window[name];
    }
    if (minScore !== undefined) context.CONFIG.PRIZE_MIN_SCORE = minScore;
    context.CONFIG.API_ENABLED = apiEnabled;
    window.Flow.init();
    element('btn-prize').textContent = 'ODBIERZ PUNKTY';
    return {
        element,
        config: context.CONFIG,
        t: context.T,
        navigation,
        get claims() { return claims; },
        finish: (score, end = eligibleEnd) => window.Flow.onGameOver(score, end),
        returnToEnd: () => Screens.go('gameend', {})
    };
}

for (const offset of [-1, 0]) {
    test(`the default minimum gates score at threshold offset ${offset}`, async () => {
        const env = setup();
        const score = env.config.PRIZE_MIN_SCORE + offset;
        env.finish(score);
        assert.equal(env.element('btn-prize').classList.contains('hidden'), offset < 0);
        assert.equal(env.element('end-message').textContent,
            env.t(offset < 0 ? 'gameend.lose.message' : 'gameend.win.subtitle'));
        await env.element('btn-prize').click();
        assert.equal(env.claims, offset < 0 ? 0 : 1);
    });
}

for (const score of [0, 1, 9, 10, 11]) {
    test(`a configured minimum of 10 gates visibility, messages and claims for score ${score}`, async () => {
        const env = setup({ minScore: 10 });
        env.finish(score);
        const button = env.element('btn-prize');
        assert.equal(button.classList.contains('hidden'), score < 10);
        assert.equal(env.element('end-title').textContent,
            env.t(score < 10 ? 'gameend.lose.title' : 'gameend.win.title'));
        assert.equal(env.element('end-message').textContent,
            env.t(score < 10 ? 'gameend.lose.message' : 'gameend.win.subtitle'));
        assert.equal(env.element('end-score').classList.contains('hidden'), score === 0);
        // Dispatch the handler even when hidden to verify the claim guard.
        await button.click();
        assert.equal(env.claims, score < 10 ? 0 : 1);
        if (score >= 10) {
            assert.equal(env.navigation.at(-1).id, 'prize');
            assert.equal(button.disabled, false);
            assert.equal(button.textContent, 'ODBIERZ PUNKTY');
        }
    });
}

for (const [name, options, end] of [
    ['API disabled', { apiEnabled: false }, eligibleEnd],
    ['API ineligible', {}, { ...eligibleEnd, eligible: false }],
    ['suspicious session', {}, { ...eligibleEnd, suspicious: true }],
    ['missing game-end response', {}, null]
]) {
    test(`meeting the minimum does not bypass ${name}`, async () => {
        const env = setup({ minScore: 10, ...options });
        env.finish(10, end);
        assert.equal(env.element('btn-prize').classList.contains('hidden'), true);
        await env.element('btn-prize').click();
        assert.equal(env.claims, 0);
    });
}

test('a score below the prize minimum can still be added to the ranking', () => {
    const env = setup({ minScore: 10 });
    env.finish(9);
    assert.equal(env.element('btn-prize').classList.contains('hidden'), true);
    assert.equal(env.element('btn-addrank').classList.contains('hidden'), false);
    assert.match(env.element('end-score').textContent, /9/);
});

test('visibility and messages are recalculated on the next game and when returning to its result', () => {
    const env = setup({ minScore: 10 });
    env.finish(10);
    assert.equal(env.element('btn-prize').classList.contains('hidden'), false);
    assert.equal(env.element('end-message').textContent, env.t('gameend.win.subtitle'));
    env.returnToEnd();
    assert.equal(env.element('btn-prize').classList.contains('hidden'), false);
    assert.equal(env.element('end-message').textContent, env.t('gameend.win.subtitle'));
    env.finish(9);
    assert.equal(env.element('btn-prize').classList.contains('hidden'), true);
    assert.equal(env.element('end-message').textContent, env.t('gameend.lose.message'));
    env.returnToEnd();
    assert.equal(env.element('btn-prize').classList.contains('hidden'), true);
    assert.equal(env.element('end-message').textContent, env.t('gameend.lose.message'));
    env.finish(11);
    assert.equal(env.element('btn-prize').classList.contains('hidden'), false);
    assert.equal(env.element('end-message').textContent, env.t('gameend.win.subtitle'));
});

test('a network error can still be retried when the minimum is met', async () => {
    const env = setup({ minScore: 10, claimResults: [{ ok: false, code: 'NETWORK' }] });
    env.finish(10);
    await env.element('btn-prize').click();
    assert.equal(env.navigation.at(-1).id, 'error');
    assert.equal(env.navigation.at(-1).data.retry, true);
    await env.element('btn-error-retry').click();
    assert.equal(env.claims, 2);
    assert.equal(env.navigation.at(-1).id, 'prize');
});
