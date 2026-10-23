const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const games = [
    { name: 'combo-match', assets: ['combo-match'], css: ['style.css'], fontPrefix: 'fonts/' },
    { name: 'cyber-detective', assets: ['cyber-detective', 'assets'], css: ['css', 'style-common.css'], fontPrefix: '../fonts/' },
    { name: 'delivery-rush', assets: ['delivery-rush', 'assets'], css: ['css', 'style-common.css'], fontPrefix: '../fonts/' }
];
const fontFamily = '"Fira Code", Consolas, "Courier New", monospace';
const flush = () => new Promise(setImmediate);

function setup(game, loadFont, code = 'P3000E68D769WZTJ') {
    const assets = path.join(__dirname, '..', ...game.assets);
    const elements = new Map();
    const hooks = new Map();
    const loads = [];
    const measurements = [];
    const painted = [];
    const errors = [];
    let renders = 0;
    const element = id => {
        if (!elements.has(id)) {
            elements.set(id, {
                textContent: '',
                style: { setProperty() {} },
                classList: { remove() {}, toggle() {} }
            });
        }
        return elements.get(id);
    };
    const drawing = Object.fromEntries([
        'fillRect', 'beginPath', 'moveTo', 'lineTo', 'arcTo', 'arc',
        'closePath', 'fill', 'stroke', 'setLineDash', 'roundRect'
    ].map(name => [name, () => {}]));
    drawing.createLinearGradient = () => ({ addColorStop() {} });
    drawing.measureText = text => {
        const width = String(text).length * Number(/(\d+)px/.exec(drawing.font)[1]) * 0.6;
        if (text === code) measurements.push({ font: drawing.font, width });
        return { width };
    };
    drawing.fillText = text => painted.push({ text, font: drawing.font });
    const document = {
        getElementById: element,
        createElement(tag) {
            assert.equal(tag, 'canvas');
            return {
                getContext: () => drawing,
                toBlob(callback) { renders++; callback(null); }
            };
        }
    };
    if (loadFont) {
        document.fonts = {
            load(font, text) { loads.push({ font, text }); return loadFont(font, text); }
        };
    }
    const window = {};
    const context = vm.createContext({
        window, document,
        location: { search: '' },
        URLSearchParams,
        Screens: { on: (id, handlers) => hooks.set(id, handlers), watchIdle() {} },
        Image: class { set src(value) { this.onerror(); } },
        console: { error: (...args) => errors.push(args) }
    });
    for (const [file, name] of [['config.js', 'CONFIG'], ['texts.js', 'T'], ['flow.js', 'Flow']]) {
        vm.runInContext(fs.readFileSync(path.join(assets, 'js', file), 'utf8'), context);
        context[name] = window[name];
    }
    hooks.get('prize').enter({ prize: { code, typeName: 'START' } });
    return { loads, measurements, painted, errors, element, get renders() { return renders; } };
}

for (const game of games) {
    test.describe(game.name, () => {
        test('the on-screen voucher uses local Fira Code SemiBold with both font formats', () => {
            const assets = path.join(__dirname, '..', ...game.assets);
            const css = fs.readFileSync(path.join(assets, ...game.css), 'utf8');
            const face = css.match(/@font-face\s*\{[^}]*font-family:\s*['"]Fira Code['"];[^}]*\}/)[0];
            assert.match(face, /font-weight:\s*600;/);
            for (const format of ['woff2', 'woff']) {
                const source = `${game.fontPrefix}FiraCode-SemiBold.${format}`;
                assert.ok(face.includes(source));
                assert.match(face, new RegExp(`format\\(['"]${format}['"]\\)`));
                assert.ok(fs.existsSync(path.join(assets, 'fonts', `FiraCode-SemiBold.${format}`)));
            }
            const codeRule = css.match(/#prize-code\s*\{([^}]+)\}/)[1];
            assert.match(codeRule, /(?:font|font-family):\s*(?:600 .*|)'Fira Code',\s*Consolas,\s*'Courier New',\s*monospace;/);
            assert.match(codeRule, /(?:font:\s*600 |font-weight:\s*600;)/);
        });

        for (const pixelFontFails of [false, true]) {
            test(`PNG waits for Fira Code before measuring or drawing (pixel font fails: ${pixelFontFails})`, async () => {
                let finishFont;
                const pendingFont = new Promise(resolve => { finishFont = resolve; });
                const env = setup(game, font => font.includes('Fira Code') ? pendingFont :
                    pixelFontFails ? Promise.reject(new Error('Font unavailable')) : Promise.resolve([]));
                await flush();
                assert.deepEqual(env.loads.at(-1), { font: '600 92px ' + fontFamily, text: 'P3000E68D769WZTJ' });
                assert.equal(env.renders, 0);
                assert.deepEqual(env.measurements, []);
                assert.deepEqual(env.painted, []);
                assert.equal(env.element('prize-code').textContent, 'P3000E68D769WZTJ');
                finishFont([]);
                await flush();
                assert.equal(env.renders, 1);
                assert.ok(env.measurements.every(item => item.font.startsWith('600 ') && item.font.endsWith(fontFamily)));
                assert.ok(env.painted.some(item => item.text === 'P3000E68D769WZTJ' && item.font.endsWith(fontFamily)));
                assert.deepEqual(env.errors, []);
            });
        }

        test('long voucher codes still shrink to fit the image frame using Fira Code', async () => {
            const code = 'ABC0123456789'.repeat(4);
            const env = setup(game, () => Promise.resolve([]), code);
            await flush();
            assert.equal(env.renders, 1);
            assert.ok(env.measurements[0].width > 690);
            assert.ok(env.measurements.at(-1).width <= 690);
            assert.equal(env.painted.find(item => item.text === code).font, env.measurements.at(-1).font);
            assert.deepEqual(env.errors, []);
        });

        for (const loadFont of [undefined, () => Promise.reject(new Error('Font unavailable'))]) {
            test(`PNG rendering tolerates ${loadFont ? 'failed font loading' : 'a missing Font Loading API'}`, async () => {
                const env = setup(game, loadFont);
                await flush();
                assert.equal(env.renders, 1);
                assert.ok(env.painted.some(item => item.text === 'P3000E68D769WZTJ' && item.font.endsWith(fontFamily)));
                assert.deepEqual(env.errors, []);
            });
        }
    });
}
