/* maze.js - generator i logika labiryntu (BEZ ZMIAN) */
window.Maze = (function () {
    const WALL = 1, PATH = 0;
    function make(cols, rows, seed) {
        cols = cols % 2 ? cols : cols + 1;
        rows = rows % 2 ? rows : rows + 1;
        const g = [];
        for (let y = 0; y < rows; y++) g.push(new Array(cols).fill(WALL));
        let rnd = seed || Math.floor(Math.random() * 1e9);
        const rand = () => { rnd = (rnd * 1664525 + 1013904223) % 4294967296; return rnd / 4294967296; };
        const stack = [{ x: 1, y: 1 }];
        g[1][1] = PATH;
        const DIRS = [{x:0,y:-2},{x:2,y:0},{x:0,y:2},{x:-2,y:0}];
        while (stack.length) {
            const cur = stack[stack.length - 1];
            const opts = [];
            for (const d of DIRS) {
                const nx = cur.x + d.x, ny = cur.y + d.y;
                if (nx > 0 && ny > 0 && nx < cols - 1 && ny < rows - 1 && g[ny][nx] === WALL)
                    opts.push({ nx, ny, mx: cur.x + d.x/2, my: cur.y + d.y/2 });
            }
            if (!opts.length) { stack.pop(); continue; }
            const p = opts[Math.floor(rand() * opts.length)];
            g[p.my][p.mx] = PATH;
            g[p.ny][p.nx] = PATH;
            stack.push({ x: p.nx, y: p.ny });
        }
        const deadEnds = [];
        for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
            if (g[y][x] !== PATH) continue;
            let n = 0;
            if (g[y-1][x] === PATH) n++;
            if (g[y+1][x] === PATH) n++;
            if (g[y][x-1] === PATH) n++;
            if (g[y][x+1] === PATH) n++;
            if (n === 1) deadEnds.push({ x, y });
        }
        deadEnds.forEach(de => {
            if (rand() > 0.72) return;
            const cand = [];
            for (const d of [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}]) {
                const wx = de.x + d.x, wy = de.y + d.y;
                const bx = de.x + d.x*2, by = de.y + d.y*2;
                if (bx > 0 && by > 0 && bx < cols-1 && by < rows-1 && g[wy][wx] === WALL && g[by][bx] === PATH)
                    cand.push({ wx, wy });
            }
            if (cand.length) { const c = cand[Math.floor(rand() * cand.length)]; g[c.wy][c.wx] = PATH; }
        });
        const tunnelRow = rows % 4 === 1 ? Math.floor(rows/2) : Math.floor(rows/2) + 1;
        const ty = tunnelRow % 2 ? tunnelRow : tunnelRow - 1;
        g[ty][0] = PATH; g[ty][cols-1] = PATH; g[ty][1] = PATH; g[ty][cols-2] = PATH;
        return { grid: g, cols, rows, tunnelRow: ty };
    }
    function isWall(mz, x, y) {
        if (y < 0 || y >= mz.rows || x < 0 || x >= mz.cols) return true;
        return mz.grid[y][x] === WALL;
    }
    function wrapX(mz, x) { if (x < 0) return mz.cols - 1; if (x >= mz.cols) return 0; return x; }
    function canMove(mz, x, y) {
        const wx = wrapX(mz, x);
        if (y < 0 || y >= mz.rows) return false;
        return mz.grid[y][wx] === PATH;
    }
    function paths(mz) {
        const out = [];
        for (let y = 0; y < mz.rows; y++) for (let x = 0; x < mz.cols; x++)
            if (mz.grid[y][x] === PATH) out.push({ x, y });
        return out;
    }
    function options(mz, x, y) {
        const out = [];
        [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}].forEach(d => { if (canMove(mz, x + d.x, y + d.y)) out.push(d); });
        return out;
    }
    function bfsDist(mz, from, to, limit) {
        const key = p => p.x + ':' + p.y;
        const seen = new Set([key(from)]);
        let frontier = [from], dist = 0;
        const max = limit || 60;
        while (frontier.length && dist < max) {
            const next = [];
            for (const p of frontier) {
                if (p.x === to.x && p.y === to.y) return dist;
                options(mz, p.x, p.y).forEach(d => {
                    const n = { x: wrapX(mz, p.x + d.x), y: p.y + d.y };
                    if (!seen.has(key(n))) { seen.add(key(n)); next.push(n); }
                });
            }
            frontier = next; dist++;
        }
        return max;
    }
    return { WALL, PATH, make, isWall, canMove, wrapX, paths, options, bfsDist };
})();
