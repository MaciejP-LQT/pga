const assert = require('node:assert/strict');
const { Blob, File } = require('node:buffer');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const games = [
    { name: 'combo-match', scripts: ['combo-match', 'js'], title: 'COMBO-MATCH' },
    { name: 'cyber-detective', scripts: ['cyber-detective', 'assets', 'js'], title: 'Cyber-Detective' }
];
const prize = { code: '22_30_39_00000000', typeName: 'START', validToText: '22.10.2026' };

function setup(game, { android = false } = {}) {
    const elements = new Map();
    const hooks = new Map();
    const renders = [];
    const downloads = [];
    const shared = [];
    const errors = [];
    let cachedPrize = prize;
    let downloadFile;
    function element(id) {
        if (!elements.has(id)) {
            const classes = new Set(['hidden']);
            const listeners = new Map();
            elements.set(id, {
                textContent: '',
                style: { setProperty() {} },
                classList: {
                    contains: name => classes.has(name),
                    remove: name => classes.delete(name),
                    toggle(name, force) {
                        if (force) classes.add(name); else classes.delete(name);
                    }
                },
                addEventListener: (name, callback) => listeners.set(name, callback),
                click: () => listeners.get('click')()
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
        location: { search: '' },
        URLSearchParams,
        File,
        Api: { getPrize: () => cachedPrize },
        Screens: {
            on: (id, handlers) => hooks.set(id, handlers),
            go() {},
            watchIdle() {},
            stopIdle() {},
            back() { assert.fail('Unexpected navigation away from the prize screen'); }
        },
        navigator: {
            userAgent: android ? 'Android' : 'Desktop',
            canShare: () => true,
            share: async data => { shared.push(...data.files); }
        },
        URL: {
            createObjectURL(file) {
                downloadFile = file;
                return 'blob:voucher';
            },
            revokeObjectURL() {}
        },
        document: {
            getElementById: element,
            querySelectorAll: () => [],
            body: { appendChild() {} },
            createElement(tag) {
                if (tag === 'a') {
                    return {
                        click() { downloads.push({ name: this.download, file: downloadFile }); },
                        remove() {}
                    };
                }
                assert.equal(tag, 'canvas');
                return { getContext: () => drawing, toBlob: callback => renders.push(callback) };
            }
        },
        Image: class {
            set src(value) { this.onerror(); }
        },
        setTimeout() {},
        console: { error: (...args) => errors.push(args) }
    });
    const scripts = path.join(__dirname, '..', ...game.scripts);
    for (const [file, name] of [['config.js', 'CONFIG'], ['texts.js', 'T'], ['flow.js', 'Flow']]) {
        vm.runInContext(fs.readFileSync(path.join(scripts, file), 'utf8'), context);
        context[name] = window[name];
    }
    context.CONFIG.API_ENABLED = false;
    context.CONFIG.PRIZE_ALLOW_DOWNLOAD = true;
    window.Flow.init();
    return {
        downloads, shared, texts: window.TEXTS,
        async enter(value = prize) {
            if (value) cachedPrize = value;
            hooks.get('prize').enter(value ? { prize: value } : {});
            await new Promise(setImmediate);
            assert.deepEqual(errors, []);
        },
        finishRender(index = renders.length - 1) {
            renders[index](new Blob(['voucher'], { type: 'image/png' }));
        },
        download: () => element('btn-download').click()
    };
}

for (const game of games) {
    for (const android of [false, true]) {
        test(`${game.name}: the ${android ? 'shared' : 'downloaded'} PNG uses the plain game title, prize type and date`, async () => {
            const env = setup(game, { android });
            await env.enter();
            env.finishRender();
            env.download();
            const file = android ? env.shared[0] : env.downloads[0].file;
            assert.equal(file.name, `${game.title}-START-22.10.2026.png`);
            assert.equal(file.type, 'image/png');
            if (!android) assert.equal(env.downloads[0].name, file.name);
        });

        test(`${game.name}: whitespace throughout the ${android ? 'shared' : 'downloaded'} filename becomes hyphens`, async () => {
            const env = setup(game, { android });
            env.texts.home.title = 'Testowa  gra\nz\tplanu';
            await env.enter({ ...prize, typeName: 'SUPER START', validToText: '22 października 2026' });
            env.finishRender();
            env.download();
            const file = android ? env.shared[0] : env.downloads[0].file;
            assert.equal(file.name, 'Testowa-gra-z-planu-SUPER-START-22-października-2026.png');
            if (!android) assert.equal(env.downloads[0].name, file.name);
        });
    }

    test(`${game.name}: the filename reads home.title rather than a hardcoded game name`, async () => {
        const env = setup(game);
        env.texts.home.title = 'Testowa gra';
        await env.enter({ ...prize, typeName: 'PREMIUM', validToText: '23.10.2026' });
        env.finishRender();
        env.download();
        assert.equal(env.downloads[0].name, 'Testowa-gra-PREMIUM-23.10.2026.png');
    });

    test(`${game.name}: returning to a cached prize retains its filename`, async () => {
        const env = setup(game);
        await env.enter();
        env.finishRender();
        await env.enter(null);
        env.finishRender();
        env.download();
        assert.equal(env.downloads[0].name, `${game.title}-START-22.10.2026.png`);
    });

    test(`${game.name}: a late render cannot replace the latest prize filename`, async () => {
        const env = setup(game);
        await env.enter();
        await env.enter({ ...prize, code: 'NEXT-CODE', typeName: 'PREMIUM', validToText: '23.10.2026' });
        env.finishRender(1);
        env.finishRender(0);
        env.download();
        assert.equal(env.downloads[0].name, `${game.title}-PREMIUM-23.10.2026.png`);
    });

    test(`${game.name}: optional prize fields do not produce undefined in the filename`, async () => {
        const env = setup(game);
        await env.enter({ code: prize.code });
        env.finishRender();
        env.download();
        assert.equal(env.downloads[0].name, `${game.title}--.png`);
    });
}
