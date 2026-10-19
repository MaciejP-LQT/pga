window.Scores = (function () {
    function read(k,fb){ try{const r=localStorage.getItem(k);return r===null?fb:JSON.parse(r);}catch(e){return fb;} }
    function write(k,v){ try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;} }
    function list(){ const a=read(CONFIG.SCORES_KEY,[]); return Array.isArray(a)?a:[]; }
    function best(){ const t=list(); return t.length?t[0].score:0; }
    function add(score){
        const top=list(), prev=top.length?top[0].score:0;
        const e={score,date:new Date().toISOString().slice(0,10)};
        top.push(e); top.sort((a,b)=>b.score-a.score);
        const rank=top.indexOf(e)+1;
        write(CONFIG.SCORES_KEY, top.slice(0,CONFIG.TOP_SIZE));
        return { rank:rank<=CONFIG.TOP_SIZE?rank:0, isTop:rank<=CONFIG.TOP_SIZE,
                 isBest:score>prev&&score>0, best:Math.max(prev,score) };
    }
    return { list,best,add,reset:()=>write(CONFIG.SCORES_KEY,[]) };
})();
