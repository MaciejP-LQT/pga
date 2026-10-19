/* assets.js - sprity (BEZ ZMIAN). Flow.boot() wola Assets.loadAll(). */
window.Assets = (function () {
    const FILES = {
        hero: 'assets/images/hero.png', heroBoost: 'assets/images/hero-boost.png',
        heroSlow: 'assets/images/hero-slow.png', heroBlink: 'assets/images/hero-blink.png',
        'drone-1': 'assets/images/drone-1.png', 'drone-2': 'assets/images/drone-2.png',
        'drone-3': 'assets/images/drone-3.png', 'drone-4': 'assets/images/drone-4.png',
        'drone-weak': 'assets/images/drone-weak.png', 'drone-flash': 'assets/images/drone-flash.png',
        'item-1': 'assets/images/item-1.png', 'item-2': 'assets/images/item-2.png', 'item-3': 'assets/images/item-3.png',
        boost: 'assets/images/boost.png', boostHot: 'assets/images/boost-hot.png',
        slow: 'assets/images/slow.png', slowHot: 'assets/images/slow-hot.png',
        wall: 'assets/images/wall.png', wallSmall: 'assets/images/wall_small.png',
        magnifyingGlass: 'assets/images/magnifying_glass.png'
    };
    const images = {};
    function loadAll() {
        return Promise.all(Object.keys(FILES).map(k => new Promise(res => {
            const img = new Image();
            img.onload = () => res();
            img.onerror = () => { console.warn('Brak sprita:', FILES[k]); res(); };
            img.src = FILES[k]; images[k] = img;
        })));
    }
    return { loadAll, get: k => images[k] };
})();
