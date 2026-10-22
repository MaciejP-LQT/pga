const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const gamePaths = ['delivery-rush/', 'cyber-detective/', 'combo-match/', 'gaming-challenge/'];

function setup(search = '') {
    function element(tag = 'div') {
        return {
            tag,
            children: [],
            attributes: {},
            style: {},
            classList: { toggle() {} },
            append(...children) { this.children.push(...children); },
            prepend(...children) { this.children.unshift(...children); },
            setAttribute(name, value) { this.attributes[name] = value; },
            removeAttribute(name) { delete this.attributes[name]; },
            addEventListener() {},
            contains() { return false; },
            querySelector(tag) {
                for (const child of this.children) {
                    if (child.tag === tag) return child;
                    const match = child.querySelector(tag);
                    if (match) return match;
                }
                return null;
            },
            cloneNode(deep = false) {
                const clone = element(this.tag);
                clone.href = this.href;
                clone.attributes = { ...this.attributes };
                if (deep) clone.append(...this.children.map(child => child.cloneNode(true)));
                return clone;
            }
        };
    }
    const elements = new Map();
    const document = {
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, element());
            return elements.get(id);
        },
        createElement: element,
        querySelectorAll: () => [],
        addEventListener() {}
    };
    vm.runInNewContext(source, {
        document,
        window: {
            location: { search },
            matchMedia: () => ({ matches: false })
        },
        navigator: {},
        URLSearchParams
    });
    return {
        cards: elements.get('game-grid').children.map(card => card.querySelector('a').href),
        carousel: elements.get('game-track').children.map(slide => slide.querySelector('a').href)
    };
}

for (const [search, suffix] of [
    ['', ''],
    ['?hideDownload=1', '?hideDownload=1'],
    ['?hideDownload=0', '?hideDownload=0'],
    ['?hideDownload=true', '?hideDownload=true'],
    ['?hideDownload', '?hideDownload='],
    ['?hideDownload=', '?hideDownload='],
    ['?src=mobile&hideDownload=1&unrelated=value', '?hideDownload=1'],
    ['?src=mobile', ''],
    ['?HideDownload=1', ''],
    ['?hideDownload=1&hideDownload=0', '?hideDownload=1'],
    ['?hideDownload=1%26other%3Dvalue', '?hideDownload=1%26other%3Dvalue']
]) {
    test(`hub propagates only hideDownload in cards and carousel: ${JSON.stringify(search)}`, () => {
        const env = setup(search);
        const expected = gamePaths.map(game => game + suffix);
        assert.deepEqual(env.cards, expected);
        assert.deepEqual(env.carousel, [expected[3], ...expected, expected[0]]);
        for (const link of [...env.cards, ...env.carousel]) {
            const url = new URL(link, 'https://pga.liquidthread.pl/');
            assert.equal(url.origin, 'https://pga.liquidthread.pl');
            assert.deepEqual([...url.searchParams.keys()], suffix ? ['hideDownload'] : []);
        }
    });
}
