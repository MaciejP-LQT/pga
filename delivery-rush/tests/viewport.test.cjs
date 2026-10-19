const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'viewport.js'), 'utf8');

function setup({ embedded = false, intersectionObserver = true, visualViewport = { height: 640, offsetTop: 0 } } = {}) {
    const styles = new Map();
    const listeners = {};
    const viewportListeners = {};
    const frames = [];
    const probes = [];
    let observer;
    const window = {
        innerHeight: 640,
        addEventListener: (type, fn) => { listeners[type] = fn; },
        visualViewport: visualViewport && {
            ...visualViewport,
            addEventListener: (type, fn) => { viewportListeners[type] = fn; }
        }
    };
    window.self = window;
    window.top = embedded ? new Proxy({}, { get() { throw new Error('Cross-origin access'); } }) : window;
    class Observer {
        constructor(callback, options) {
            observer = this;
            this.callback = callback;
            this.options = options;
            this.observations = 0;
        }
        observe(target) { this.target = target; this.observations++; }
        unobserve() {}
        emit(top, height, isIntersecting = true, boundsTop = 0) {
            this.callback([{
                isIntersecting,
                rootBounds: null,
                boundingClientRect: { top: boundsTop },
                intersectionRect: { top, height }
            }]);
        }
    }
    if (intersectionObserver) window.IntersectionObserver = Observer;
    const document = {
        documentElement: { style: { setProperty: (name, value) => styles.set(name, value) } },
        body: { appendChild: element => probes.push(element) },
        createElement: () => ({ style: {}, setAttribute() {} })
    };
    vm.runInNewContext(source, {
        window,
        document,
        IntersectionObserver: Observer,
        requestAnimationFrame: callback => { frames.push(callback); return frames.length; }
    });
    function flush() { frames.splice(0).forEach(callback => callback()); }
    return { window, styles, listeners, viewportListeners, frames, probes, observer, flush };
}

test('standalone follows the visual viewport and browser toolbar changes', () => {
    const env = setup({ visualViewport: { height: 520, offsetTop: 0 } });
    env.flush();
    assert.equal(env.styles.get('--viewport-height'), '520px');
    assert.equal(env.probes.length, 0);
    env.window.visualViewport.height = 640;
    env.viewportListeners.resize();
    env.flush();
    assert.equal(env.styles.get('--viewport-height'), '640px');
});

test('cross-origin iframe uses its clipped intersection, without reading the parent', () => {
    const env = setup({ embedded: true });
    env.observer.emit(0, 520);
    assert.equal(env.styles.get('--viewport-height'), '520px');
    assert.equal(env.styles.get('--viewport-top'), '0px');
    assert.equal(env.probes.length, 1);
    assert.equal(env.observer.options.threshold.length, 1001);
    env.observer.emit(0, 640);
    assert.equal(env.styles.get('--viewport-height'), '640px');
    env.observer.emit(0, 440);
    assert.equal(env.styles.get('--viewport-height'), '440px');
});

test('the measurement probe stays independent of the resized game wrapper', () => {
    const env = setup({ embedded: true });
    assert.equal(env.observer.target, env.probes[0]);
    assert.match(env.probes[0].style.cssText, /position:fixed;inset:0/);
});

test('fully hidden iframe keeps its last usable size', () => {
    const env = setup({ embedded: true });
    env.observer.emit(0, 520);
    env.observer.emit(0, 0, false);
    assert.equal(env.styles.get('--viewport-height'), '520px');
    env.observer.emit(0, 0);
    assert.equal(env.styles.get('--viewport-height'), '520px');
});

test('partially scrolled and fractional intersections stay inside visible bounds', () => {
    const env = setup({ embedded: true });
    env.observer.emit(40.2, 519.6);
    assert.equal(env.styles.get('--viewport-top'), '41px');
    assert.equal(env.styles.get('--viewport-height'), '518px');
    env.observer.emit(75, 520, true, 25);
    assert.equal(env.styles.get('--viewport-top'), '50px');
});

test('resize at full intersection forces a fresh observation', () => {
    const env = setup({ embedded: true });
    env.flush();
    const before = env.observer.observations;
    env.listeners.resize();
    env.listeners.pageshow();
    env.viewportListeners.resize();
    assert.equal(env.frames.length, 1);
    env.flush();
    assert.equal(env.observer.observations, before + 1);
    env.observer.emit(0, 720);
    assert.equal(env.styles.get('--viewport-height'), '720px');
});

test('missing observer or VisualViewport falls back to iframe/window dimensions', () => {
    const env = setup({ embedded: true, intersectionObserver: false, visualViewport: null });
    env.flush();
    assert.equal(env.styles.get('--viewport-height'), '640px');
    env.window.innerHeight = 480;
    env.listeners.resize();
    env.flush();
    assert.equal(env.styles.get('--viewport-height'), '480px');
});
