/* =========================================================
   effects.js — cząsteczki, napisy (floaters), shake, flash
   =========================================================
   NAPISY ZAWSZE W GRANICACH PLANSZY
   Wcześniej napis był rysowany wyśrodkowany nad polem bez
   względu na krawędzie — przy bocznej/górnej ścianie dłuższe
   teksty ("COMBO x2", "VISA x2") były ucinane, a na mobile
   (mała plansza) prawie zawsze.
   Teraz w draw():
     1. rozmiar czcionki ma minimum (czytelność na telefonie),
     2. tekst szerszy niż plansza jest proporcjonalnie zmniejszany,
     3. środek napisu jest przesuwany tak, żeby cały tekst
        (z obrysem i skalą "big") mieścił się w planszy.
   ========================================================= */
window.Effects = (function () {
    let particles=[],floaters=[];
    let shakeTime=0,shakeDur=0,shakePow=0,flashTime=0,flashColor=null;
    /* minimalny rozmiar czcionki napisów (px CSS) — mobile */
    const FLOATER_MIN_FONT = 13;
    /* odstęp napisu od krawędzi planszy (px CSS) */
    const FLOATER_EDGE_PAD = 4;
    function clamp(v,min,max){ return max<min ? (min+max)/2 : Math.min(max,Math.max(min,v)); }
    function burst(x,y,color,count,power){
        if(!CONFIG.PARTICLES_ENABLED)return;
        const n=count||CONFIG.PARTICLE_COUNT, sp=power||CONFIG.PARTICLE_SPEED;
        for(let i=0;i<n;i++){
            if(particles.length>=CONFIG.PARTICLE_MAX)break;
            const a=(Math.PI*2*i)/n+(Math.random()-0.5)*0.8, v=sp*(0.55+Math.random()*0.75);
            particles.push({x:x+0.5,y:y+0.5,vx:Math.cos(a)*v,vy:Math.sin(a)*v,
                life:CONFIG.PARTICLE_LIFE_MS*(0.7+Math.random()*0.6),maxLife:CONFIG.PARTICLE_LIFE_MS,
                size:0.10+Math.random()*0.13,color:color||'#fff',spin:(Math.random()-0.5)*12});
        }
    }
    function floatText(x,y,text,color,big){
        if(!CONFIG.FLOATERS_ENABLED)return;
        while(floaters.length>=12) floaters.shift();
        floaters.push({x:x+0.5,y:y+0.5,text,color:color||'#fff',big:!!big,
            life:CONFIG.FLOATER_LIFE_MS,maxLife:CONFIG.FLOATER_LIFE_MS});
    }
    function shake(dur,pow){
        if(!CONFIG.SHAKE_ENABLED)return;
        if(pow>=shakePow||shakeTime<=0){shakeTime=dur;shakeDur=dur;shakePow=pow;}
    }
    function flash(c){ flashColor=c; flashTime=CONFIG.FLASH_MS; }
    function update(dt){
        const s=dt/1000;
        for(let i=particles.length-1;i>=0;i--){
            const p=particles[i]; p.life-=dt;
            if(p.life<=0){particles.splice(i,1);continue;}
            p.x+=p.vx*s; p.y+=p.vy*s; p.vy+=CONFIG.PARTICLE_GRAVITY*s; p.vx*=0.97;
        }
        for(let i=floaters.length-1;i>=0;i--){
            floaters[i].life-=dt; if(floaters[i].life<=0)floaters.splice(i,1);
        }
        if(shakeTime>0){shakeTime-=dt;if(shakeTime<=0){shakeTime=0;shakePow=0;}}
        if(flashTime>0){flashTime-=dt;if(flashTime<=0){flashTime=0;flashColor=null;}}
    }
    function draw(ctx,tile){
        particles.forEach(p=>{
            const t=Math.max(0,p.life/p.maxLife);
            ctx.save(); ctx.globalAlpha=t; ctx.fillStyle=p.color;
            ctx.translate(p.x*tile,p.y*tile); ctx.rotate(p.spin*(1-t));
            const s=p.size*tile*(0.4+t*0.6); ctx.fillRect(-s/2,-s/2,s,s); ctx.restore();
        });
        const board = tile*CONFIG.TILE_COUNT;
        const pad = FLOATER_EDGE_PAD;
        floaters.forEach(f=>{
            const t=1-f.life/f.maxLife, alpha=f.life<260?f.life/260:1;
            const rise=CONFIG.FLOATER_RISE*(1-Math.pow(1-t,3));
            let sc=f.big?1+0.35*Math.sin(Math.min(1,t*3)*Math.PI):1;
            const fontPx=Math.max(FLOATER_MIN_FONT, Math.round(tile*(f.big?0.95:0.8)));
            const line=Math.max(2,fontPx*0.17);
            ctx.save(); ctx.globalAlpha=alpha;
            ctx.font=`700 ${fontPx}px system-ui, sans-serif`;
            ctx.textAlign='center'; ctx.textBaseline='middle';
            /* rzeczywisty rozmiar napisu po skali (+ obrys) */
            let w=(ctx.measureText(f.text).width+line)*sc;
            const maxW=board-pad*2;
            if(w>maxW){ sc*=maxW/w; w=maxW; }
            const h=(fontPx+line)*sc;
            /* przesunięcie do środka planszy, jeśli wystaje */
            const cx=clamp(f.x*tile, w/2+pad, board-w/2-pad);
            const cy=clamp((f.y-rise)*tile, h/2+pad, board-h/2-pad);
            ctx.translate(cx,cy); ctx.scale(sc,sc);
            ctx.lineWidth=line; ctx.lineJoin='round'; ctx.strokeStyle='rgba(0,0,0,.75)';
            ctx.strokeText(f.text,0,0); ctx.fillStyle=f.color; ctx.fillText(f.text,0,0);
            ctx.restore();
        });
    }
    function shakeOffset(){
        if(shakeTime<=0)return {x:0,y:0};
        const t=shakeTime/shakeDur, p=shakePow*t*t;
        return {x:(Math.random()*2-1)*p,y:(Math.random()*2-1)*p};
    }
    function drawFlash(ctx,size){
        if(flashTime<=0||!flashColor)return;
        ctx.save(); ctx.globalAlpha=flashTime/CONFIG.FLASH_MS;
        ctx.fillStyle=flashColor; ctx.fillRect(-40,-40,size+80,size+80); ctx.restore();
    }
    function clear(){
        particles=[];floaters=[];shakeTime=shakeDur=shakePow=0;flashTime=0;flashColor=null;
    }
    return { burst,floatText,shake,flash,update,draw,clear,shakeOffset,drawFlash };
})();
