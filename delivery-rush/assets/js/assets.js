window.Assets = (function () {
    const FILES = {
        head:'assets/images/snake-head.png', headHalf:'assets/images/snake-head-half.png',
        headBlink:'assets/images/snake-head-blink.png', headBoost:'assets/images/snake-head-boost.png',
        headSlow:'assets/images/snake-head-slow.png', body:'assets/images/snake-body.png',
        bodyBoost:'assets/images/snake-body-boost.png', bodySlow:'assets/images/snake-body-slow.png',
        corner:'assets/images/snake-corner.png', tail:'assets/images/snake-tail.png',
        'item-1':'assets/images/item-1.png','item-2':'assets/images/item-2.png','item-3':'assets/images/item-3.png',
        penalty:'assets/images/penalty.png', boost:'assets/images/boost.png', boostHot:'assets/images/boost-hot.png',
        slow:'assets/images/slow.png', slowHot:'assets/images/slow-hot.png'
    };
    const images = {};
    function loadAll(){
        return Promise.all(Object.keys(FILES).map(k=>new Promise(res=>{
            const img=new Image();
            img.onload=()=>res();
            img.onerror=()=>{ console.warn('Brak sprita:',FILES[k]); res(); };
            img.src=FILES[k]; images[k]=img;
        })));
    }
    return { loadAll, get:k=>images[k] };
})();
