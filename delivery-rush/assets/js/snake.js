window.Snake = (function () {

    /* Domyślna długość startowa — używana, gdy CONFIG.START_LENGTH
       nie istnieje albo ma bezsensowną wartość.

       Bez tego zabezpieczenia brak klucza dawał pustą tablicę cells,
       a błąd wychodził dopiero w step() przy odczycie cells[0].x
       — daleko od prawdziwej przyczyny. */
    const DEFAULT_START_LENGTH = 3;

    function startLength(){
        /* Number() zamienia '5' na 5 — konfiguracja bywa edytowana ręcznie
           i łatwo o liczbę w cudzysłowie. */
        const n = Number(CONFIG.START_LENGTH);

        if (!isFinite(n) || n < 1) {
            console.warn('[Snake] CONFIG.START_LENGTH =', CONFIG.START_LENGTH,
                         '— używam domyślnej wartości', DEFAULT_START_LENGTH);
            return DEFAULT_START_LENGTH;
        }

        /* wąż nie może być dłuższy niż plansza */
        return Math.min(Math.floor(n), CONFIG.TILE_COUNT - 1);
    }

    function create(){
        const len = startLength();
        const st = Math.floor(CONFIG.TILE_COUNT/2), cells=[];

        for(let i=0;i<len;i++) cells.push({x:st-i,y:st});

        return { cells, prev:cells.map(c=>({x:c.x,y:c.y})),
                 dir:{x:1,y:0}, queue:[], pendingGrow:0, started:false };
    }

    function refDir(s){ return s.queue.length?s.queue[s.queue.length-1]:s.dir; }

    function setDirection(s,dir){
        if(!dir) return false;
        const r=refDir(s);
        if(dir.x===r.x&&dir.y===r.y){ s.started=true; return false; }
        if(dir.x===-r.x&&dir.y===-r.y) return false;
        if(s.queue.length>=2) s.queue[s.queue.length-1]=dir; else s.queue.push(dir);
        s.started=true; return true;
    }

    function step(s){
        /* Ostatnia linia obrony: gdyby cells mimo wszystko było puste,
           lepiej zgłosić czytelny błąd niż "undefined reading x". */
        if(!s.cells || !s.cells.length){
            throw new Error('Snake.step: pusta tablica cells — ' +
                            'sprawdź CONFIG.START_LENGTH i CONFIG.TILE_COUNT');
        }

        if(s.queue.length) s.dir=s.queue.shift();
        s.prev=s.cells.map(c=>({x:c.x,y:c.y}));
        const h={x:s.cells[0].x+s.dir.x, y:s.cells[0].y+s.dir.y};
        s.cells.unshift(h);
        if(s.pendingGrow>0){ s.pendingGrow--; s.prev.unshift({x:s.prev[0].x,y:s.prev[0].y}); }
        else s.cells.pop();
        return h;
    }

    function grow(s,n){ s.pendingGrow+=n; }

    function shrink(s,n){ for(let i=0;i<n;i++){ if(s.cells.length<=2)break; s.cells.pop(); s.prev.pop(); } }

    function hitsWall(h){ return h.x<0||h.y<0||h.x>=CONFIG.TILE_COUNT||h.y>=CONFIG.TILE_COUNT; }

    function hitsSelf(s){ const h=s.cells[0]; return s.cells.some((c,i)=>i>0&&c.x===h.x&&c.y===h.y); }

    return { create,setDirection,step,grow,shrink,hitsWall,hitsSelf,refDir };
})();
