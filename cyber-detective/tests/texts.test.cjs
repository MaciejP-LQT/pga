const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scripts = path.join(__dirname, '..', 'assets', 'js');

function element(html = '', className = '') {
    const classes = new Set(className.split(' ').filter(Boolean));
    const selectors = new Map();
    let items;
    return {
        dataset: {},
        children: [],
        style: { setProperty() {} },
        classList: {
            add: (...names) => names.forEach(name => classes.add(name)),
            remove: (...names) => names.forEach(name => classes.delete(name)),
            contains: name => classes.has(name),
            toggle(name, force) {
                if (force) classes.add(name); else classes.delete(name);
            }
        },
        get innerHTML() { return html; },
        set innerHTML(value) { html = value; items = undefined; selectors.clear(); },
        get textContent() { return html.replace(/<[^>]*>/g, ''); },
        set textContent(value) { this.innerHTML = value; },
        setAttribute() {},
        removeAttribute() {},
        appendChild(child) { this.children.push(child); },
        querySelector(selector) {
            if (!selectors.has(selector)) {
                const match = html.match(new RegExp('<' + selector + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + selector + '>'));
                if (!match && selector !== 'img') return null;
                const child = element(match ? match[1] : '');
                selectors.set(selector, child);
                this.children.push(child);
            }
            return selectors.get(selector);
        },
        querySelectorAll(selector) {
            if (selector !== 'li') return [];
            if (!items) {
                items = Array.from(html.matchAll(/<li(?: class="([^"]*)")?>([\s\S]*?)<\/li>/g),
                    match => element(match[2], match[1]));
            }
            return items;
        }
    };
}

function setup() {
    const ids = new Map([
        'howto-rules', 'legend', 'stage', 'power-bars',
        'boost-bar', 'boost-fill', 'slow-bar', 'slow-fill'
    ].map(id => [id, element()]));
    const label = element();
    const observers = [];
    const hooks = new Map();
    const warnings = [];
    class MutationObserver {
        constructor(callback) { this.callback = callback; }
        observe(target) { observers.push({ target, callback: this.callback }); }
    }
    const window = { MutationObserver };
    const context = vm.createContext({
        window,
        MutationObserver,
        document: {
            getElementById: id => ids.get(id) || null,
            querySelector: selector => selector === '#boost-bar .power-label' ? label : null,
            createElement: () => element(),
            body: { classList: { toggle() {} } }
        },
        Screens: {
            on: (id, handlers) => hooks.set(id, handlers),
            watchIdle() {}
        },
        console: { log() {}, warn: (...args) => warnings.push(args) }
    });
    for (const [file, name] of [
        ['config.js', 'CONFIG'], ['texts.js', 'T'], ['ui.js', 'UI'],
        ['maze-delivery-ui.js', null], ['flow.js', 'Flow']
    ]) {
        vm.runInContext(fs.readFileSync(path.join(scripts, file), 'utf8'), context, { filename: file });
        if (name) context[name] = window[name];
    }
    return {
        texts: window.TEXTS,
        config: window.CONFIG,
        ui: window.UI,
        ids,
        label,
        observers,
        warnings,
        enter() {
            hooks.get('howto').enter();
            observers.forEach(observer => observer.callback());
            assert.deepEqual(warnings, []);
        }
    };
}

function rules(env) {
    return env.ids.get('howto-rules').querySelectorAll('li').map(item => item.innerHTML);
}

function boostLabel(env) {
    return env.ids.get('legend').querySelectorAll('li')
        .find(item => item.classList.contains('is-boost')).querySelector('b');
}

test('HOW-TO displays every rule from texts.js without replacing or combining entries', () => {
    const env = setup();
    env.enter();
    assert.deepEqual(rules(env), Array.from(env.texts.howto.rules));
});

for (const text of [
    'Visa: <b>nowa zasada</b>.',
    'Złote pole — <b>nowy opis</b>.',
    'Możesz <b>ścigać drony</b> na nowych zasadach.',
    '<b>Dowolna treść</b> bez słów kluczowych.'
]) {
    test(`HOW-TO preserves edited rules on repeated visits: ${text}`, () => {
        const env = setup();
        env.texts.howto.rules = [text, 'Drugi punkt.'];
        env.enter();
        assert.deepEqual(rules(env), [text, 'Drugi punkt.']);
        env.texts.howto.rules = ['Jeszcze inny opis Visa.', text];
        env.enter();
        assert.deepEqual(rules(env), ['Jeszcze inny opis Visa.', text]);
    });
}

test('the UI patch observes only the legend, not the rules', () => {
    const env = setup();
    assert.equal(env.observers.length, 1);
    assert.equal(env.observers[0].target, env.ids.get('legend'));
});

test('the boost legend uses howto.chaseLabel and the configured multiplier', () => {
    const env = setup();
    env.texts.howto.chaseLabel = 'nowy opis pościgu';
    env.config.BOOST_MULTIPLIER = 3;
    env.enter();
    assert.equal(boostLabel(env).innerHTML, 'x3<small>nowy opis pościgu</small>');
    env.texts.howto.chaseLabel = 'inny opis';
    env.config.BOOST_MULTIPLIER = 4;
    env.enter();
    assert.equal(boostLabel(env).innerHTML, 'x4<small>inny opis</small>');
});

test('power-up messages and the boost bar use texts.js with multiplier substitution', () => {
    const env = setup();
    assert.equal(typeof env.texts.game.visaTag, 'string');
    assert.equal(typeof env.texts.game.slowPop, 'string');
    env.config.BOOST_MULTIPLIER = 3;
    env.texts.game.visaPop = 'Bonus x{mult}';
    env.texts.game.slowPop = 'Nowe spowolnienie';
    env.texts.game.visaTag = 'Premia x{mult}';
    env.texts.game.visaBar = 'Mnożnik x{mult}';
    env.ui.showVisaPop();
    env.ui.showSlowPop();
    env.ui.setPowerups({ boostLeft: 1000, slowLeft: 1000 });
    const pops = env.ids.get('stage').children;
    assert.equal(pops[0].querySelector('span').textContent, 'Bonus x3');
    assert.equal(pops[1].querySelector('span').textContent, 'Nowe spowolnienie');
    assert.equal(env.ui.visaTag(), 'Premia x3');
    assert.match(env.label.innerHTML, /<span>Mnożnik x3<\/span>/);
    assert.deepEqual(env.warnings, []);
});
