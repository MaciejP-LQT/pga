const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const games = [
    {
        name: 'combo-match', scripts: ['combo-match', 'js'], copy: 'Kopiuj kod',
        hint: 'Skopiuj kod  i wykorzystaj go w GameON. Możesz też pobrać voucher.'
    },
    {
        name: 'cyber-detective', scripts: ['cyber-detective', 'assets', 'js'], copy: 'Kopiuj',
        hint: 'Skopiuj kod i wykorzystaj go w GameON. Możesz też pobrać voucher.'
    }
];

function setup(game, { search = '', allowDownload = true, allowCopy = true } = {}) {
    const elements = new Map();
    const hooks = new Map();
    const errors = [];
    const prize = { code: 'TEST-CODE', typeName: 'START' };
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
    const window = {};
    const context = vm.createContext({
        window,
        location: { search },
        URLSearchParams,
        Api: { getPrize: () => prize },
        Screens: {
            on: (id, handlers) => hooks.set(id, handlers),
            watchIdle() {},
            back() { assert.fail('Unexpected navigation away from the prize screen'); }
        },
        document: {
            getElementById: element,
            createElement(tag) {
                assert.equal(tag, 'canvas');
                return { getContext: () => drawing, toBlob: callback => callback(null) };
            }
        },
        Image: class {
            set src(value) { this.onerror(); }
        },
        console: {
            error: (...args) => errors.push(args),
            warn: (...args) => errors.push(args)
        }
    });
    const scripts = path.join(__dirname, '..', ...game.scripts);
    for (const [file, name] of [['config.js', 'CONFIG'], ['texts.js', 'T'], ['flow.js', 'Flow']]) {
        vm.runInContext(fs.readFileSync(path.join(scripts, file), 'utf8'), context);
        context[name] = window[name];
    }
    context.CONFIG.PRIZE_ALLOW_DOWNLOAD = allowDownload;
    context.CONFIG.PRIZE_ALLOW_COPY = allowCopy;
    return {
        element,
        async enter(data = { prize }) {
            hooks.get('prize').enter(data);
            await new Promise(setImmediate);
            assert.deepEqual(errors, []);
        }
    };
}

for (const game of games) {
    for (const [search, hidden] of [
        ['', false],
        ['?hideDownload=1', true],
        ['?src=mobile&hideDownload=1&other=value', true],
        ['?hideDownload=0', false],
        ['?hideDownload', false],
        ['?hideDownload=', false],
        ['?hideDownload=true', false],
        ['?hideDownload=01', false],
        ['?hideDownload=10', false],
        ['?hideDownload=2', false],
        ['?HideDownload=1', false]
    ]) {
        test(`${game.name}: download visibility for ${JSON.stringify(search)}`, async () => {
            const env = setup(game, { search });
            await env.enter();
            assert.equal(env.element('btn-download').classList.contains('hidden'), hidden);
            assert.equal(env.element('btn-copy').classList.contains('hidden'), false);
            assert.equal(env.element('prize-code').textContent, 'TEST-CODE');
            assert.equal(env.element('prize-type').textContent, 'START');
            assert.equal(env.element('copy-label').textContent, game.copy);
            assert.equal(env.element('prize-hint').textContent,
                hidden ? 'Skopiuj kod i wykorzystaj go w GameON.' : game.hint);
        });
    }

    for (const search of ['', '?hideDownload=0', '?hideDownload=1']) {
        test(`${game.name}: URL cannot override disabled downloads: ${JSON.stringify(search)}`, async () => {
            const env = setup(game, { search, allowDownload: false });
            await env.enter();
            assert.equal(env.element('btn-download').classList.contains('hidden'), true);
            assert.equal(env.element('prize-hint').textContent, 'Skopiuj kod i wykorzystaj go w GameON.');
        });
    }

    test(`${game.name}: downloads stay hidden on return and for a new prize`, async () => {
        const env = setup(game, { search: '?hideDownload=1' });
        await env.enter();
        await env.enter({});
        assert.equal(env.element('btn-download').classList.contains('hidden'), true);
        await env.enter({ prize: { code: 'NEXT-CODE' } });
        assert.equal(env.element('btn-download').classList.contains('hidden'), true);
        assert.equal(env.element('prize-code').textContent, 'NEXT-CODE');
    });

    test(`${game.name}: hideDownload does not override the copy setting`, async () => {
        const env = setup(game, { search: '?hideDownload=1', allowCopy: false });
        await env.enter();
        assert.equal(env.element('btn-copy').classList.contains('hidden'), true);
    });
}
