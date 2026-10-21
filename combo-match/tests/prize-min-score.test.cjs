const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scripts = path.join(__dirname, '..', 'js');
const eligibleEnd = { eligible: true, suspicious: false };

function setup({ minScore, apiEnabled = true, claimResults } = {}) {
    const elements = new Map();
    const hooks = new Map();
    const navigation = [];
    let claims = 0;
    let endResult = eligibleEnd;

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
                click: () => listeners.get('click')()
            });
        }
        return elements.get(id);
    }

    const window = {};
    const Api = {
        loadRanking: async () => ({ ok: true, items: [] }),
        endGame: async () => endResult ? { ok: true, ...endResult } : { ok: false },
        addToRanking: async () => ({ ok: true }),
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
        },
        interval() {}
    };
    const context = vm.createContext({
        window,
        Api,
        Screens,
        document: { getElementById: element, querySelectorAll: () => [] },
        Image: class { set src(value) { this.onload(); } },
        setTimeout() {}
    });
    for (const [file, name] of [['config.js', 'CONFIG'], ['texts.js', 'T'], ['flow.js', 'Flow']]) {
        vm.runInContext(fs.readFileSync(path.join(scripts, file), 'utf8'), context);
        context[name] = window[name];
    }
    if (minScore !== undefined) context.CONFIG.PRIZE_MIN_SCORE = minScore;
    context.CONFIG.API_ENABLED = apiEnabled;
    window.Flow.init();
    element('btn-prize').textContent = context.T('gameend.win.prize');

    return {
        element,
        config: context.CONFIG,
        t: context.T,
        navigation,
        get claims() { return claims; },
        finish(score, end = eligibleEnd) {
            endResult = end;
            return window.Flow.onGameOver(score, { duration: 1000 });
        },
        returnToEnd: () => Screens.go('gameend', {})
    };
}

for (const score of [0, 1, 199, 200, 201]) {
    test(`the default minimum of 200 gates messages, visibility and claims for score ${score}`, async () => {
        const env = setup();
        assert.equal(env.config.PRIZE_MIN_SCORE, 200);
        await env.finish(score);
        const button = env.element('btn-prize');
        assert.equal(button.classList.contains('hidden'), score < 200);
        assert.equal(env.element('end-title').textContent,
            env.t(score < 200 ? 'gameend.lose.title' : 'gameend.win.title'));
        assert.equal(env.element('end-message').textContent,
            env.t(score < 200 ? 'gameend.lose.message' : 'gameend.win.subtitle'));
        assert.equal(env.element('end-score').classList.contains('hidden'), score === 0);
        if (score > 0) {
            assert.equal(env.element('end-score').textContent, env.t('gameend.win.score', { score }));
        }
        assert.equal(env.element('end-timer').textContent,
            env.t('gameend.timer', { sec: score > 0 ? env.config.WIN_REDIRECT_SEC : env.config.LOSE_REDIRECT_SEC }));
        // Dispatch even when hidden to verify the claim guard.
        await button.click();
        assert.equal(env.claims, score < 200 ? 0 : 1);
        if (score >= 200) {
            assert.equal(env.navigation.at(-1).id, 'prize');
            assert.equal(button.disabled, false);
            assert.equal(button.textContent, env.t('gameend.win.prize'));
        }
    });
}

for (const score of [9, 10, 11]) {
    test(`a configured minimum of 10 gates score ${score}`, async () => {
        const env = setup({ minScore: 10 });
        await env.finish(score);
        assert.equal(env.element('btn-prize').classList.contains('hidden'), score < 10);
        assert.equal(env.element('end-title').textContent,
            env.t(score < 10 ? 'gameend.lose.title' : 'gameend.win.title'));
        await env.element('btn-prize').click();
        assert.equal(env.claims, score < 10 ? 0 : 1);
    });
}

for (const [name, options, end] of [
    ['API disabled', { apiEnabled: false }, eligibleEnd],
    ['API ineligible', {}, { ...eligibleEnd, eligible: false }],
    ['suspicious session', {}, { ...eligibleEnd, suspicious: true }],
    ['missing game-end response', {}, null]
]) {
    test(`meeting the minimum does not bypass ${name}`, async () => {
        const env = setup(options);
        await env.finish(200, end);
        assert.equal(env.element('btn-prize').classList.contains('hidden'), true);
        await env.element('btn-prize').click();
        assert.equal(env.claims, 0);
    });
}

test('a score below the prize minimum can still be added to the ranking', async () => {
    const env = setup();
    await env.finish(199, { ...eligibleEnd, eligible: false });
    assert.equal(env.element('btn-prize').classList.contains('hidden'), true);
    assert.equal(env.element('btn-addrank').classList.contains('hidden'), false);
    assert.match(env.element('end-score').textContent, /199/);
});

test('visibility and messages are recalculated between games and when returning to the result', async () => {
    const env = setup();
    for (const score of [200, 199, 201]) {
        await env.finish(score);
        for (let visit = 0; visit < 2; visit++) {
            assert.equal(env.element('btn-prize').classList.contains('hidden'), score < 200);
            assert.equal(env.element('end-message').textContent,
                env.t(score < 200 ? 'gameend.lose.message' : 'gameend.win.subtitle'));
            if (visit === 0) env.returnToEnd();
        }
    }
});

for (const score of [199, 200]) {
    test(`saving score ${score} does not bypass the prize minimum`, async () => {
        const env = setup();
        await env.finish(score);
        env.element('nick-input').value = 'Player';
        await env.element('btn-nick-add').click();
        env.returnToEnd();
        assert.equal(env.element('btn-prize').classList.contains('hidden'), score < 200);
        assert.equal(env.element('btn-addrank').classList.contains('hidden'), true);
        assert.equal(env.element('end-message').textContent,
            env.t(score < 200 ? 'gameend.lose.message' : 'gameend.win.savedInfo'));
    });
}

test('a network error can still be retried when the minimum is met', async () => {
    const env = setup({ claimResults: [{ ok: false, code: 'NETWORK' }] });
    await env.finish(200);
    await env.element('btn-prize').click();
    assert.equal(env.navigation.at(-1).id, 'error');
    assert.equal(env.navigation.at(-1).data.retry, true);
    env.element('btn-error-retry').click();
    await new Promise(setImmediate);
    assert.equal(env.claims, 2);
    assert.equal(env.navigation.at(-1).id, 'prize');
});
