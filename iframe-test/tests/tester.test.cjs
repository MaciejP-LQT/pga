const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const directory = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(directory, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(directory, 'script.js'), 'utf8');

function setup({ protocol = 'http:', resizeObserver = true } = {}) {
    const elements = new Map();
    const navigations = [];
    let observer;
    const baseURI = protocol === 'file:' ? 'file:///C:/games/iframe-test/index.html' : 'http://localhost:5500/iframe-test/';

    for (const [, id] of html.matchAll(/id="([^"]+)"/g)) {
        const listeners = {};
        const classes = new Set();
        const element = {
            value: '', style: {}, listeners, valid: true,
            classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); } },
            classes,
            addEventListener(type, callback) { listeners[type] = callback; },
            fire(type) { listeners[type]({ preventDefault() {} }); },
            reportValidity() { return this.valid; },
            focus() { this.focused = true; },
            select() { this.selected = true; },
            get valueAsNumber() { return Number(this.value); }
        };
        elements.set(id, element);
    }
    for (const id of ['game-select', 'size-preset']) {
        const markup = html.match(new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)</select>`))[1];
        const element = elements.get(id);
        element.options = Array.from(markup.matchAll(/<option value="([^"]+)"([^>]*)>([^<]+)<\/option>/g), match => ({
            value: match[1], textContent: match[3], selected: match[2].includes('selected')
        }));
        element.value = (element.options.find(option => option.selected) || element.options[0]).value;
        Object.defineProperty(element, 'selectedOptions', { get() { return this.options.filter(option => option.value === this.value); } });
    }
    for (const id of ['frame-width', 'frame-height']) {
        elements.get(id).value = html.match(new RegExp(`<input id="${id}"[^>]*value="(\\d+)"`))[1];
    }
    const frame = elements.get('game-frame');
    Object.defineProperty(frame, 'src', {
        get() { return navigations.at(-1); },
        set(value) { navigations.push(value); }
    });
    class Observer {
        constructor(callback) { this.callback = callback; observer = this; }
        observe(target) { this.target = target; }
        emit(width, height) { this.callback([{ contentRect: { width, height } }]); }
    }
    const window = { location: { protocol } };
    if (resizeObserver) window.ResizeObserver = Observer;
    vm.runInNewContext(source, {
        URL, window, ResizeObserver: Observer,
        document: {
            baseURI,
            getElementById(id) {
                assert.ok(elements.has(id), `Missing element ${id}`);
                return elements.get(id);
            }
        }
    });
    return { get: id => elements.get(id), navigations, observer };
}

test('starts Delivery Rush at the exact default phone size', () => {
    const env = setup();
    assert.deepEqual(env.navigations, ['http://localhost:5500/delivery-rush/index.html']);
    assert.equal(env.get('frame-shell').style.width, '390px');
    assert.equal(env.get('frame-shell').style.height, '844px');
    assert.equal(env.get('frame-size').textContent, '390 × 844 px');
    assert.equal(env.get('game-frame').title, 'Delivery Rush — podgląd w iframe');
    assert.equal(env.get('open-game').href, env.navigations[0]);
    assert.equal(env.get('file-warning').hidden, true);
});

test('every game option points to an existing entry and loads inside the iframe', () => {
    const env = setup();
    const select = env.get('game-select');
    for (const option of select.options.filter(option => option.value !== 'custom')) {
        assert.equal(fs.existsSync(path.resolve(directory, option.value)), true, option.value);
        select.value = option.value;
        select.fire('change');
        assert.equal(env.get('game-frame').src, new URL(option.value, 'http://localhost:5500/iframe-test/').href);
        assert.equal(env.get('game-frame').title, `${option.textContent} — podgląd w iframe`);
    }
});

test('custom selection focuses the URL without navigating', () => {
    const env = setup();
    env.get('game-select').value = 'custom';
    env.get('game-select').fire('change');
    assert.equal(env.get('game-url').focused, true);
    assert.equal(env.get('game-url').selected, true);
    assert.equal(env.navigations.length, 1);
});

test('accepts relative and external HTTP(S) URLs including query strings', () => {
    for (const [value, expected] of [
        [' ../combo-match/index.html?test=1#home ', 'http://localhost:5500/combo-match/index.html?test=1#home'],
        ['https://example.com/game?language=pl', 'https://example.com/game?language=pl']
    ]) {
        const env = setup();
        env.get('game-url').value = value;
        env.get('game-url').fire('input');
        env.get('source-form').fire('submit');
        assert.equal(env.get('game-frame').src, expected);
        assert.equal(env.get('open-game').href, expected);
        assert.equal(env.get('game-select').value, 'custom');
    }
});

test('recognizes a built-in game entered by URL', () => {
    const env = setup();
    env.get('game-url').value = '../cyber-detective/index.html';
    env.get('source-form').fire('submit');
    assert.equal(env.get('game-select').value, '../cyber-detective/index.html');
});

test('rejects non-web protocols and recursive embedding without replacing the game', () => {
    for (const value of [
        'javascript:alert(1)', 'data:text/html,test', 'about:blank', 'file:///C:/game.html', 'ftp://example.com',
        './', './index.html?test=1#frame', 'http://localhost:5500/iframe-test', 'http://[invalid'
    ]) {
        const env = setup();
        env.get('game-url').value = value;
        env.get('source-form').fire('submit');
        assert.equal(env.navigations.length, 1, value);
        assert.equal(env.get('frame-status').classes.has('is-error'), true, value);
        assert.equal(env.get('open-game').href, env.navigations[0]);
    }
});

test('presets change the actual frame size without reloading', () => {
    const env = setup();
    const preset = env.get('size-preset');
    for (const option of preset.options.filter(option => option.value !== 'custom')) {
        preset.value = option.value;
        preset.fire('change');
        const [width, height] = option.value.split('x');
        assert.equal(env.get('frame-shell').style.width, `${width}px`);
        assert.equal(env.get('frame-shell').style.height, `${height}px`);
        assert.equal(env.get('frame-width').value, width);
        assert.equal(env.get('frame-height').value, height);
    }
    preset.value = 'custom';
    preset.fire('change');
    assert.equal(env.navigations.length, 1);
});

test('custom dimensions can be applied and swapped without reloading', () => {
    const env = setup();
    env.get('frame-width').value = '640';
    env.get('frame-height').value = '480';
    env.get('size-form').fire('submit');
    assert.equal(env.get('frame-size').textContent, '640 × 480 px');
    assert.equal(env.get('size-preset').value, 'custom');
    env.get('swap-size').fire('click');
    assert.equal(env.get('frame-shell').style.width, '480px');
    assert.equal(env.get('frame-shell').style.height, '640px');
    assert.equal(env.navigations.length, 1);
});

test('invalid forms do not navigate or resize the iframe', () => {
    const env = setup();
    env.get('source-form').valid = false;
    env.get('game-url').value = '../combo-match/index.html';
    env.get('source-form').fire('submit');
    env.get('size-form').valid = false;
    env.get('frame-width').value = '0';
    env.get('size-form').fire('submit');
    env.get('swap-size').fire('click');
    assert.equal(env.navigations.length, 1);
    assert.equal(env.get('frame-shell').style.width, '390px');
    assert.equal(env.get('frame-shell').style.height, '844px');
});

test('manual resizing synchronizes dimensions and presets without navigating', () => {
    const env = setup();
    assert.equal(env.observer.target, env.get('frame-shell'));
    env.observer.emit(1280, 720);
    assert.equal(env.get('size-preset').value, '1280x720');
    assert.equal(env.get('frame-size').textContent, '1280 × 720 px');
    env.observer.emit(555.4, 444.6);
    assert.equal(env.get('frame-size').textContent, '555 × 445 px');
    assert.equal(env.get('size-preset').value, 'custom');
    env.observer.emit(0, 0);
    assert.equal(env.get('frame-size').textContent, '555 × 445 px');
    assert.equal(env.navigations.length, 1);
});

test('observer echoes do not overwrite dimensions being edited', () => {
    const env = setup();
    env.get('frame-width').value = '640';
    env.observer.emit(390, 844);
    assert.equal(env.get('frame-width').value, '640');
    env.get('frame-height').value = '480';
    env.get('size-form').fire('submit');
    assert.equal(env.get('frame-size').textContent, '640 × 480 px');
});

test('reload uses the loaded URL rather than an unsubmitted edit', () => {
    const env = setup();
    env.get('game-url').value = 'https://example.com/unsaved';
    env.get('reload-game').fire('click');
    assert.equal(env.navigations.length, 2);
    assert.equal(env.navigations[1], env.navigations[0]);
    env.get('game-frame').fire('load');
    assert.match(env.get('frame-status').textContent, /Sprawdź w podglądzie/);
});

test('file mode warns about HTTP and works without ResizeObserver', () => {
    const env = setup({ protocol: 'file:', resizeObserver: false });
    assert.equal(env.get('file-warning').hidden, false);
    assert.equal(env.get('game-frame').src, 'file:///C:/games/delivery-rush/index.html');
    env.get('size-preset').value = '360x640';
    env.get('size-preset').fire('change');
    assert.equal(env.get('frame-size').textContent, '360 × 640 px');
});
