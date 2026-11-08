const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'game.js'), 'utf8');
// Expose private helpers only in the VM; the production API remains unchanged.
const instrumented = source.replace(/    return \{\r?\n        init,/,
    '    return {\n        onCardClick,\n        createCardElement,\n        resetTimer,\n        startTimer,\n        showStageComplete,\n        init,');
assert.notEqual(instrumented, source);

function element(tag = 'div') {
    const classes = new Set();
    const listeners = new Map();
    let markup = '';
    let text = '';
    return {
        tagName: tag.toUpperCase(),
        dataset: {},
        children: [],
        style: { setProperty() {}, removeProperty() {} },
        get className() { return [...classes].join(' '); },
        set className(value) {
            classes.clear();
            value.split(/\s+/).filter(Boolean).forEach(name => classes.add(name));
        },
        classList: {
            add: (...names) => names.forEach(name => classes.add(name)),
            remove: (...names) => names.forEach(name => classes.delete(name)),
            contains: name => classes.has(name),
            toggle(name, force = !classes.has(name)) {
                if (force) classes.add(name); else classes.delete(name);
                return force;
            }
        },
        get textContent() { return text; },
        set textContent(value) { text = String(value); },
        get innerHTML() { return markup; },
        set innerHTML(value) {
            markup = value;
            this.children = [];
            if (value.includes('card-inner')) {
                const inner = element();
                inner.className = 'card-inner';
                for (const side of ['back', 'front']) {
                    const face = element();
                    face.className = 'card-face card-' + side;
                    inner.appendChild(face);
                }
                this.appendChild(inner);
            }
        },
        appendChild(child) { this.children.push(child); },
        replaceChildren(...children) { this.children = children; },
        querySelector(selector) {
            for (const child of this.children) {
                if (selector.startsWith('.') ? child.classList.contains(selector.slice(1)) : child.tagName === selector.toUpperCase()) return child;
                const found = child.querySelector(selector);
                if (found) return found;
            }
            return null;
        },
        addEventListener: (name, fn) => listeners.set(name, fn),
        click() { listeners.get('click')?.(); },
        closest() { return null; },
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 76, height: 76 }),
        remove() {}
    };
}

function setupGame({ navigator = {}, seconds = 40, pairs = 4 } = {}) {
    let now = 0;
    let nextId = 1;
    const timers = new Map();
    function schedule(callback, delay, repeat) {
        const id = nextId++;
        timers.set(id, { callback, at: now + delay, delay, repeat });
        return id;
    }
    function invoke(id, timer) {
        if (timer.repeat) timer.at = now + timer.delay;
        else timers.delete(id);
        timer.callback();
    }
    function advance(ms) {
        const end = now + ms;
        while (true) {
            const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
            if (!next) break;
            now = Math.max(now, next[1].at);
            invoke(...next);
        }
        now = end;
    }
    const elements = Object.fromEntries([
        'game-board', 'stat-score', 'stat-bonus', 'hud-bonus', 'stat-pairs', 'stat-time',
        'stage-badge', 'stage-overlay', 'stage-overlay-title', 'stage-overlay-info',
        'stage-overlay-score', 'stage-overlay-time', 'btn-next-stage', 'btn-stage-restart',
        'btn-stage-finish', 'countdown-overlay', 'countdown-value'
    ].map(id => [id, element()]));
    elements['stage-overlay'].classList.add('hidden');
    elements['countdown-overlay'].classList.add('hidden');
    const endings = [];
    const Flow = { onGameOver: (score, result) => endings.push({ score, ...result }) };
    const window = { Flow };
    const CONFIG = {
        POINTS_BASE: 10, MAX_MULTIPLIER: 3, PRIZE_MIN_SCORE: 200,
        STAGES: [{ cols: 3, rows: 3, pairs, timeLimit: seconds }, { cols: 3, rows: 4, pairs: 6, timeLimit: 50 }],
        CARD_IMAGES_K: Array.from({ length: 8 }, (_, i) => ({ id: `card-${i + 1}k`, src: `assets/card-${i + 1}k.jpg` })),
        CARD_IMAGES_V: Array.from({ length: 8 }, (_, i) => ({ id: `card-${i + 1}v`, src: `assets/card-${i + 1}v.jpg` }))
    };
    vm.runInNewContext(instrumented, {
        window, Flow, navigator, CONFIG,
        T: key => key,
        performance: { now: () => now },
        Date: class extends Date { static now() { return now; } },
        document: {
            getElementById: id => elements[id] || null,
            createElement: element,
            body: element('body')
        },
        ResizeObserver: class { observe() {} },
        setInterval: (fn, delay) => schedule(fn, delay, true),
        clearInterval: id => timers.delete(id),
        setTimeout: (fn, delay) => schedule(fn, delay, false),
        clearTimeout: id => timers.delete(id)
    });
    const game = window.Game;
    game.init();
    game.start();
    return {
        game, elements, endings, timers, config: CONFIG, advance,
        get now() { return now; },
        time: elements['stat-time'],
        cards: () => elements['game-board'].children.filter(card => card.classList.contains('card')),
        createCard: id => game.createCardElement({ id, src: `assets/${id}.jpg` }),
        tick: (count = 1) => advance(count * 1000),
        elapse(ms) { now += ms; },
        flush() {
            for (const [id, timer] of [...timers]) {
                if (timers.has(id) && timer.at <= now) invoke(id, timer);
            }
        }
    };
}

module.exports = { setupGame };
