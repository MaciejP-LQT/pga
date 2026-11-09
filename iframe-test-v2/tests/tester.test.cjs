const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const directory = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(directory, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(directory, 'script.js'), 'utf8');

function setup({ search = '', protocol = 'http:', resizeObserver = true } = {}) {
    const baseURI = protocol === 'file:' ? 'file:///C:/games/iframe-test-v2/' : 'http://localhost:5500/iframe-test-v2/';
    const navigations = [new URL('../index.html', baseURI).href];
    const elements = new Map();
    const listeners = {};
    let observer;
    function element(attributes = {}) {
        const classes = new Set();
        const events = {};
        return {
            value: '', textContent: '', hidden: false, valid: true, classes,
            dataset: {}, attributes,
            classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
            addEventListener(type, callback) { events[type] = callback; },
            fire(type) { events[type]({ preventDefault() {} }); },
            getAttribute(name) { return this.attributes[name] ?? null; },
            setAttribute(name, value) { this.attributes[name] = value; },
            removeAttribute(name) { delete this.attributes[name]; },
            getBoundingClientRect() { return { width: 930, height: 824 }; },
            reportValidity() { return this.valid; },
            showModal() { this.open = true; },
            close() { this.open = false; },
            focus() { this.focused = true; },
            select() { this.selected = true; }
        };
    }
    for (const [, id] of html.matchAll(/id="([^"]+)"/g)) elements.set(id, element());
    const frame = elements.get('game-frame');
    frame.attributes.src = '../index.html';
    Object.defineProperty(frame, 'src', {
        get: () => navigations.at(-1),
        set: value => navigations.push(value)
    });
    const selectMarkup = html.match(/<select id="game-select">([\s\S]*?)<\/select>/)[1];
    const select = elements.get('game-select');
    select.options = Array.from(selectMarkup.matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g), match => ({
        value: match[1], textContent: match[2]
    }));
    select.value = select.options[0].value;
    const navigation = Array.from(html.matchAll(/data-source="([^"]+)"/g), match => {
        const button = element();
        button.dataset.source = match[1];
        return button;
    });
    class Observer {
        constructor(callback) { this.callback = callback; observer = this; }
        observe(target) { this.target = target; }
    }
    const window = {
        innerWidth: 1145, innerHeight: 889, devicePixelRatio: 1,
        location: { protocol, origin: new URL(baseURI).origin, search },
        addEventListener(type, callback) { listeners[type] = callback; }
    };
    if (resizeObserver) window.ResizeObserver = Observer;
    vm.runInNewContext(source, {
        URL, URLSearchParams, window, ResizeObserver: Observer,
        document: {
            baseURI,
            getElementById(id) { assert.ok(elements.has(id), id); return elements.get(id); },
            querySelectorAll(selector) { assert.equal(selector, '[data-source]'); return navigation; }
        }
    });
    return { get: id => elements.get(id), navigations, navigation, observer, listeners };
}

test('loads the local hub without a duplicate initial navigation', () => {
    const env = setup();
    assert.deepEqual(env.navigations, ['http://localhost:5500/index.html']);
    assert.equal(env.get('game-select').value, '../index.html');
    assert.equal(env.navigation[0].getAttribute('aria-current'), 'page');
    assert.equal(env.get('file-warning').hidden, true);
    assert.match(env.get('origin-info').textContent, /ten sam origin/);
    assert.match(env.get('frame-metrics').textContent, /iframe: 930 × 824 px/);
});

test('each built-in selection exists and navigates the iframe', () => {
    const env = setup();
    for (const option of env.get('game-select').options.filter(item => item.value !== 'custom')) {
        assert.equal(fs.existsSync(path.resolve(directory, option.value)), true, option.value);
        env.get('game-select').value = option.value;
        env.get('game-select').fire('change');
        assert.equal(env.get('game-frame').src, new URL(option.value, 'http://localhost:5500/iframe-test-v2/').href);
        assert.equal(env.get('game-frame').title, option.textContent);
    }
});

test('sidebar can return to the hub even after navigation inside its frame', () => {
    const env = setup();
    env.navigation[0].fire('click');
    assert.equal(env.navigations.length, 2);
    assert.equal(env.navigations.at(-1), 'http://localhost:5500/index.html');
    env.navigation[1].fire('click');
    assert.equal(env.get('game-select').value, '../gaming-challenge/index.html');
    assert.equal(env.navigation[0].getAttribute('aria-current'), null);
    assert.equal(env.navigation[1].getAttribute('aria-current'), 'page');
});

test('custom source opens settings and valid HTTP(S) URLs preserve query and hash', () => {
    const env = setup();
    env.get('game-select').value = 'custom';
    env.get('game-select').fire('change');
    assert.equal(env.get('settings').open, true);
    assert.equal(env.get('game-url').focused, true);
    assert.equal(env.navigations.length, 1);
    env.get('game-url').value = ' https://example.com/game/?test=1#start ';
    env.get('source-form').fire('submit');
    assert.equal(env.get('game-frame').src, 'https://example.com/game/?test=1#start');
    assert.equal(env.get('open-game').href, env.navigations.at(-1));
    assert.equal(env.get('settings').open, false);
    assert.match(env.get('origin-info').textContent, /jest cross-origin/);
    assert.ok(env.navigation.every(button => button.getAttribute('aria-current') === null));
});

test('cancelling custom selection restores the actual selected source without navigating', () => {
    const env = setup();
    env.get('game-select').value = 'custom';
    env.get('game-select').fire('change');
    env.get('settings').close();
    env.get('settings').fire('close');
    assert.equal(env.get('game-select').value, '../index.html');
    assert.equal(env.navigations.length, 1);
});

test('src query can select a local game or a different origin including a different port', () => {
    for (const value of ['../gaming-challenge/index.html', 'http://localhost:5501/index.html?hideDownload=1']) {
        const env = setup({ search: `?src=${encodeURIComponent(value)}` });
        assert.equal(env.navigations.at(-1), new URL(value, 'http://localhost:5500/iframe-test-v2/').href);
        assert.equal(env.get('game-select').value, value.startsWith('..') ? value : 'custom');
    }
});

test('rejects recursive, empty, malformed and non-web sources without navigating', () => {
    for (const value of [
        '', ' ', './', './index.html?x=1', 'http://localhost:5500/iframe-test-v2',
        'javascript:alert(1)', 'data:text/html,test', 'about:blank', 'file:///C:/game.html',
        'ftp://example.com', 'http://[invalid'
    ]) {
        const env = setup();
        env.get('game-url').value = value;
        env.get('source-form').fire('submit');
        assert.equal(env.navigations.length, 1, value);
        assert.equal(env.get('game-url').getAttribute('aria-invalid'), 'true', value);
        assert.equal(env.get('frame-status').classes.has('is-error'), true, value);
        env.get('game-frame').fire('load');
        assert.match(env.get('frame-status').textContent, /nie została zmieniona/);
    }
});

test('invalid query opens settings with the rejected value and keeps the default hub', () => {
    const env = setup({ search: '?src=javascript%3Aalert(1)' });
    assert.equal(env.navigations.length, 1);
    assert.equal(env.get('settings').open, true);
    assert.equal(env.get('game-url').value, 'javascript:alert(1)');
});

test('corrected source clears validation; invalid form does not navigate', () => {
    const env = setup();
    env.get('game-url').value = './';
    env.get('source-form').fire('submit');
    env.get('game-url').value = '../combo-match/index.html';
    env.get('source-form').fire('submit');
    assert.equal(env.get('game-url').getAttribute('aria-invalid'), null);
    assert.equal(env.get('frame-status').classes.has('is-error'), false);
    env.get('source-form').valid = false;
    env.get('source-form').fire('submit');
    assert.equal(env.navigations.length, 2);
});

test('resize and opening settings never navigate; reload reopens the selected source', () => {
    const env = setup();
    env.listeners.resize();
    env.observer.callback();
    env.get('open-settings').fire('click');
    assert.equal(env.navigations.length, 1);
    assert.equal(env.observer.target, env.get('game-frame'));
    env.get('reload-game').fire('click');
    assert.equal(env.navigations.length, 2);
    env.get('game-frame').fire('load');
    assert.match(env.get('frame-status').textContent, /Nie oznacza to/);
});

test('works without ResizeObserver and warns when opened from disk', () => {
    const env = setup({ protocol: 'file:', resizeObserver: false });
    assert.equal(env.get('file-warning').hidden, false);
    env.listeners.resize();
    assert.equal(env.navigations.length, 1);
});

test('iframe permissions match the observed production embedding', () => {
    const frameMarkup = html.match(/<iframe\b[^>]*>/)[0];
    assert.doesNotMatch(frameMarkup, /\b(?:sandbox|allow|allowfullscreen|loading)\s*(?:=|>)/i);
    assert.match(frameMarkup, /src="\.\.\/index\.html"/);
});
