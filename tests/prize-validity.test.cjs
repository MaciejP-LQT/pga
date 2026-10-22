const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const games = [
    { name: 'combo-match', scripts: ['combo-match', 'js'], sessionKey: 'memory.session' },
    { name: 'cyber-detective', scripts: ['cyber-detective', 'assets', 'js'], sessionKey: 'gameapi.session' }
];

function setup(game, search = '') {
    const elements = new Map();
    const hooks = new Map();
    const storage = new Map();
    const requests = [];
    const errors = [];
    let responsePrize;
    function element(id) {
        if (!elements.has(id)) {
            const classes = new Set(['hidden']);
            elements.set(id, {
                textContent: '',
                style: { setProperty() {} },
                classList: {
                    contains: name => classes.has(name),
                    remove: name => classes.delete(name),
                    toggle(name, force) {
                        if (force) classes.add(name); else classes.delete(name);
                    }
                }
            });
        }
        return elements.get(id);
    }
    const drawing = Object.fromEntries([
        'fillRect', 'beginPath', 'moveTo', 'lineTo', 'arcTo', 'arc',
        'closePath', 'fill', 'stroke', 'setLineDash', 'fillText', 'roundRect'
    ].map(name => [name, () => {}]));
    drawing.createLinearGradient = () => ({ addColorStop() {} });
    drawing.measureText = text => ({ width: text.length * 10 });
    const window = { addEventListener() {} };
    const context = vm.createContext({
        window,
        location: { search },
        URLSearchParams,
        AbortController,
        setTimeout,
        clearTimeout,
        localStorage: {
            getItem: key => storage.get(key) || null,
            setItem: (key, value) => storage.set(key, value)
        },
        async fetch(url, options) {
            const request = JSON.parse(options.body);
            requests.push(request.eventName);
            let data;
            switch (request.eventName) {
                case 'GameStart': data = { uid: 'test-session', data: { token: 'test-token' } }; break;
                case 'GameEnd': data = { data: { codeEligible: true } }; break;
                case 'GameCodeIssue': data = { data: responsePrize }; break;
                default: assert.fail('Unexpected request: ' + request.eventName);
            }
            return { ok: true, status: 200, text: async () => JSON.stringify(data) };
        },
        Screens: {
            on: (id, handlers) => hooks.set(id, handlers),
            watchIdle() {},
            back() { assert.fail('Unexpected navigation away from the prize screen'); }
        },
        document: {
            addEventListener() {},
            getElementById: element,
            createElement(tag) {
                assert.equal(tag, 'canvas');
                return { getContext: () => drawing, toBlob: callback => callback(null) };
            }
        },
        Image: class {
            set src(value) { this.onerror(); }
        },
        console: { info() {}, warn() {}, error: (...args) => errors.push(args) }
    });
    const scripts = path.join(__dirname, '..', ...game.scripts);
    for (const [file, name] of [['config.js', 'CONFIG'], ['texts.js', 'T'], ['api.js', 'Api'], ['flow.js', 'Flow']]) {
        vm.runInContext(fs.readFileSync(path.join(scripts, file), 'utf8'), context);
        context[name] = window[name];
    }
    context.CONFIG.API_ENABLED = true;
    context.CONFIG.PRIZE_ALLOW_DOWNLOAD = true;
    return {
        element, storage, requests, api: window.Api,
        async claim(validToText) {
            responsePrize = { code: 'TEST-CODE', typeName: 'START', validToText };
            assert.equal((await window.Api.startSession()).ok, true);
            assert.equal((await window.Api.endGame(100, 1000, [])).ok, true);
            const result = await window.Api.claimPrize();
            assert.equal(result.ok, true);
            return result.prize;
        },
        async enter(prize) {
            hooks.get('prize').enter(prize ? { prize } : {});
            await new Promise(setImmediate);
            assert.deepEqual(errors, []);
        }
    };
}

for (const game of games) {
    for (const search of ['', '?hideDownload=1']) {
        test(`${game.name}: API date is displayed, persisted and cached with ${JSON.stringify(search)}`, async () => {
            const env = setup(game, search);
            const prize = await env.claim('22.10.2026');
            assert.equal(prize.validToText, '22.10.2026');
            assert.equal(JSON.parse(env.storage.get(game.sessionKey)).prize.validToText, '22.10.2026');
            await env.enter(prize);
            assert.equal(env.element('prize-code').textContent, 'TEST-CODE');
            assert.equal(env.element('prize-validity').textContent, 'Ważny w dniu: 22.10.2026');
            assert.equal(env.element('prize-validity').classList.contains('hidden'), false);
            assert.equal(env.element('btn-download').classList.contains('hidden'), search !== '');
            const cached = await env.api.claimPrize();
            assert.equal(cached.cached, true);
            assert.equal(cached.prize, prize);
            env.element('prize-validity').textContent = '';
            await env.enter();
            assert.equal(env.element('prize-validity').textContent, 'Ważny w dniu: 22.10.2026');
            assert.deepEqual(env.requests, ['GameStart', 'GameEnd', 'GameCodeIssue']);
        });
    }

    for (const value of [undefined, null, '', '   ', 123, {}]) {
        test(`${game.name}: invalid date clears the previous footer: ${JSON.stringify(value)}`, async () => {
            const env = setup(game);
            await env.enter(await env.claim('22.10.2026'));
            await env.enter(await env.claim(value));
            assert.equal(env.element('prize-code').textContent, 'TEST-CODE');
            assert.equal(env.element('prize-validity').textContent, '');
            assert.equal(env.element('prize-validity').classList.contains('hidden'), true);
        });
    }

    test(`${game.name}: a new prize replaces the date without reformatting the API text`, async () => {
        const env = setup(game);
        await env.enter(await env.claim('22.10.2026'));
        await env.enter(await env.claim('  23.10.2026  '));
        assert.equal(env.element('prize-validity').textContent, 'Ważny w dniu: 23.10.2026');
        assert.equal(env.element('prize-validity').classList.contains('hidden'), false);
    });

    test(`${game.name}: the date follows the hint inside the ticket body`, () => {
        const html = fs.readFileSync(path.join(__dirname, '..', game.name, 'index.html'), 'utf8');
        const body = html.match(/<div class="prize-ticket-body">([\s\S]*?)<\/article>/);
        assert.ok(body);
        assert.match(body[1], /<p class="prize-hint" id="prize-hint"><\/p>\s*<p id="prize-validity" class="prize-validity hidden"><\/p>\s*<\/div>/);
        assert.equal((html.match(/id="prize-validity"/g) || []).length, 1);
    });
}
