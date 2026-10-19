window.Powerups = (function () {
    const DEFS = {
        boost:{ id:'boost',sprite:'boost',spriteHot:'boostHot',
            enabled:()=>CONFIG.BOOST_ENABLED,duration:()=>CONFIG.BOOST_DURATION_MS,
            firstAt:()=>CONFIG.BOOST_FIRST_AT_SCORE,firstDelay:()=>CONFIG.BOOST_FIRST_DELAY_MS,
            every:()=>CONFIG.BOOST_EVERY_MS,lifetime:()=>CONFIG.BOOST_LIFETIME_MS,
            pulse:()=>CONFIG.BOOST_PULSE_MS,color:()=>CONFIG.BOOST_COLOR,label:()=>CONFIG.BOOST_LABEL },
        slow:{ id:'slow',sprite:'slow',spriteHot:'slowHot',
            enabled:()=>CONFIG.SLOW_ENABLED,duration:()=>CONFIG.SLOW_DURATION_MS,
            firstAt:()=>CONFIG.SLOW_FIRST_AT_SCORE,firstDelay:()=>CONFIG.SLOW_FIRST_DELAY_MS,
            every:()=>CONFIG.SLOW_EVERY_MS,lifetime:()=>CONFIG.SLOW_LIFETIME_MS,
            pulse:()=>CONFIG.SLOW_PULSE_MS,color:()=>CONFIG.SLOW_COLOR,label:()=>CONFIG.SLOW_LABEL }
    };
    function createOne(def){ return {def,active:false,timeLeft:0,spawnTimer:def.firstDelay(),marker:null}; }
    function create(){ return { boost:createOne(DEFS.boost), slow:createOne(DEFS.slow) }; }
    function each(p,fn){ fn(p.boost); fn(p.slow); }
    function updateOne(s,dt,now,score,freeFn,blocked){
        if(s.active){ s.timeLeft-=dt; if(s.timeLeft<=0){s.active=false;s.timeLeft=0;} }
        if(!s.def.enabled())return false;
        if(s.marker&&s.marker.expiresAt<=now) s.marker=null;
        if(s.marker||s.active||blocked)return false;
        if(score<s.def.firstAt())return false;
        s.spawnTimer-=dt; if(s.spawnTimer>0)return false;
        s.spawnTimer=s.def.every();
        const c=freeFn(); if(!c)return false;
        s.marker={kind:s.def.id,x:c.x,y:c.y,born:now,expiresAt:now+s.def.lifetime()};
        return true;
    }
    function update(p,dt,now,score,freeFn){
        const order=Math.random()<0.5?[p.boost,p.slow]:[p.slow,p.boost];
        let onBoard=!!(p.boost.marker||p.slow.marker);
        order.forEach(s=>{ if(updateOne(s,dt,now,score,freeFn,onBoard&&!s.marker)) onBoard=true; });
    }
    function collectAt(p,x,y){
        let hit=null;
        each(p,s=>{ if(s.marker&&s.marker.x===x&&s.marker.y===y) hit=s; });
        if(!hit)return null;
        hit.marker=null; hit.active=true;
        hit.timeLeft=hit.def.duration(); hit.spawnTimer=hit.def.every();
        return hit;
    }
    function markers(p){
        const out=[]; each(p,s=>{ if(s.marker) out.push({marker:s.marker,def:s.def}); }); return out;
    }
    return { DEFS,create,update,collectAt,
        scoreMultiplier:p=>p.boost.active?CONFIG.BOOST_MULTIPLIER:1,
        stepFactor:p=>p.slow.active?CONFIG.SLOW_FACTOR:1,
        progress:s=>s.active?Math.max(0,s.timeLeft/s.def.duration()):0,
        markers, cells:p=>markers(p).map(m=>m.marker) };
})();
