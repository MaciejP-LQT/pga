window.ItemFactory = (function () {
    let lastItemKey = null;

    function reset() {
        lastItemKey = null;
    }

    function randomDef() {
        const available = CONFIG.ITEMS.filter(d =>
            Number.isFinite(d.weight) && d.weight > 0
        );
        if (!available.length) return null;

        const alternatives = available.filter(d => d.key !== lastItemKey);
        const pool = alternatives.length ? alternatives : available;
        const total = pool.reduce((sum, d) => sum + d.weight, 0);
        let r = Math.random() * total;
        for (const d of pool) {
            r -= d.weight;
            if (r < 0) return d;
        }
        return pool[pool.length - 1];
    }
    function freeCell(occ){
        const n=CONFIG.TILE_COUNT, taken=new Set(occ.map(c=>c.x+':'+c.y)), free=[];
        for(let x=0;x<n;x++) for(let y=0;y<n;y++) if(!taken.has(x+':'+y)) free.push({x,y});
        return free.length?free[Math.floor(Math.random()*free.length)]:null;
    }
    function spawnItem(occ){
        const c=freeCell(occ); if(!c)return null;
        const d=randomDef(); if(!d)return null;
        lastItemKey = d.key;
        return { kind:'item',x:c.x,y:c.y,sprite:d.key,label:d.label,
                 points:d.points,grow:d.grow,color:d.color,born:performance.now() };
    }
    function spawnPenalty(occ){
        const c=freeCell(occ); if(!c)return null;
        return { kind:'penalty',x:c.x,y:c.y,sprite:'penalty',label:CONFIG.PENALTY_LABEL,
                 points:CONFIG.PENALTY_POINTS,shrink:CONFIG.PENALTY_SHRINK,
                 color:CONFIG.PENALTY_COLOR,born:performance.now(),
                 expiresAt:performance.now()+CONFIG.PENALTY_LIFETIME_MS };
    }
    return { spawnItem,spawnPenalty,freeCell,reset };
})();
