window.Blink = (function () {
    const P={OPEN:'open',CLOSING:'closing',CLOSED:'closed',OPENING:'opening'};
    function delay(){ return CONFIG.BLINK_MIN_DELAY_MS+Math.random()*(CONFIG.BLINK_MAX_DELAY_MS-CONFIG.BLINK_MIN_DELAY_MS); }
    function create(){ return {phase:P.OPEN,timer:delay(),repeat:0}; }
    function update(b,dt){
        b.timer-=dt; if(b.timer>0)return;
        switch(b.phase){
            case P.OPEN: b.phase=P.CLOSING; b.timer+=CONFIG.BLINK_HALF_MS;
                if(b.repeat===0&&Math.random()<CONFIG.BLINK_DOUBLE_CHANCE)b.repeat=1; break;
            case P.CLOSING: b.phase=P.CLOSED; b.timer+=CONFIG.BLINK_CLOSED_MS; break;
            case P.CLOSED: b.phase=P.OPENING; b.timer+=CONFIG.BLINK_HALF_MS; break;
            case P.OPENING: b.phase=P.OPEN;
                if(b.repeat>0){b.repeat--;b.timer+=90;} else b.timer+=delay(); break;
        }
    }
    function trigger(b,dbl){ if(!b||b.phase!==P.OPEN)return; b.timer=0; if(dbl)b.repeat=1; }
    function spriteKey(b){
        if(b.phase===P.CLOSED)return 'headBlink';
        if(b.phase===P.CLOSING||b.phase===P.OPENING)return 'headHalf';
        return 'head';
    }
    return { create,update,trigger,spriteKey };
})();
