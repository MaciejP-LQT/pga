/* =========================================================
   drones.js - scigajacy

   ZMIANA (bezpieczne pojawianie sie dronow):
   Wczesniej dron po zlapaniu wracal zawsze do SWOJEGO rogu,
   a przy starcie/odrodzeniu wychodzil z rogu bez sprawdzenia,
   gdzie jest gracz. Jesli gracz stal akurat przy tym rogu,
   dron "pojawial sie" tuz obok i od razu zabieral zycie.

   Teraz:
   1. pickSpawn() - dron pojawia sie w swoim rogu tylko wtedy,
      gdy gracz jest dalej niz CONFIG.DRONE_SAFE_DISTANCE krokow
      (liczone po korytarzach, BFS). W przeciwnym razie wybiera
      NAJDALSZY od gracza rog labiryntu.
   2. graceLeft - przez CONFIG.DRONE_SPAWN_GRACE_MS od pojawienia
      sie dron jest niegrozny i miga (ostrzezenie wizualne),
      zeby gracz zdazyl zareagowac.
   Obie rzeczy dotycza: startu poziomu, wypuszczenia z bazy
   (releaseIn) i powrotu po zlapaniu (respawnLeft).
   ========================================================= */
window.Drones = (function () {
    const KINDS = [
        { id: 'hunter', sprite: 'drone-1', label: 'Tropiciel' },
        { id: 'scout',  sprite: 'drone-2', label: 'Zwiadowca' },
        { id: 'patrol', sprite: 'drone-3', label: 'Patrol' },
        { id: 'wander', sprite: 'drone-4', label: 'Błądzący' }
    ];

    function corners(mz) {
        return [
            { x: mz.cols - 2, y: 1 },
            { x: 1,           y: mz.rows - 2 },
            { x: mz.cols - 2, y: mz.rows - 2 },
            { x: 1,           y: 1 }
        ];
    }

    function safeDist() { return CONFIG.DRONE_SAFE_DISTANCE || 8; }
    function graceMs()  { return CONFIG.DRONE_SPAWN_GRACE_MS || 0; }

    /** Punkt pojawienia sie: preferowany rog, chyba ze gracz jest
        za blisko - wtedy rog najdalszy od gracza (po korytarzach). */
    function pickSpawn(mz, hero, preferred) {
        if (!hero) return { x: preferred.x, y: preferred.y };

        const limit = Math.max(mz.cols, mz.rows) * 3;
        const dPref = Maze.bfsDist(mz, preferred, hero, limit);
        if (dPref >= safeDist()) return { x: preferred.x, y: preferred.y };

        let best = preferred, bestD = dPref;
        corners(mz).forEach(function (c) {
            if (!Maze.canMove(mz, c.x, c.y)) return;
            const d = Maze.bfsDist(mz, c, hero, limit);
            if (d > bestD) { bestD = d; best = c; }
        });
        return { x: best.x, y: best.y };
    }

    function placeAt(d, p) {
        d.x = p.x; d.y = p.y;
        d.px = p.x; d.py = p.y;
        d.dir = { x: 0, y: 0 };
        d.acc = 0;
        d.graceLeft = graceMs();
    }

    function create(mz, count, hero) {
        const list = [];
        const n = Math.min(count || CONFIG.DRONE_COUNT, KINDS.length);
        const spots = corners(mz);
        for (let i = 0; i < n; i++) {
            const k = KINDS[i], s = spots[i];
            const d = {
                acc: 0, stepMs: CONFIG.DRONE_STEP_MS,
                kind: k.id, sprite: k.sprite, label: k.label,
                home: { x: s.x, y: s.y },
                x: s.x, y: s.y, px: s.x, py: s.y, dir: { x: 0, y: 0 },
                weak: false, weakLeft: 0, respawnLeft: 0,
                releaseIn: CONFIG.DRONE_RELEASE_MS * i,
                graceLeft: 0
            };
            /* pierwszy dron startuje od razu - sprawdzamy odleglosc juz teraz */
            if (d.releaseIn <= 0) placeAt(d, pickSpawn(mz, hero, d.home));
            list.push(d);
        }
        return list;
    }

    function targetFor(d, mz, hero) {
        if (d.weak) return { flee: true, x: hero.x, y: hero.y };
        if (d.respawnLeft > 0) return d.home;
        switch (d.kind) {
            case 'hunter': return { x: hero.x, y: hero.y };
            case 'scout': {
                for (let lead = 4; lead >= 1; lead--) {
                    const ax = Maze.wrapX(mz, hero.x + hero.dir.x * lead);
                    const ay = hero.y + hero.dir.y * lead;
                    if (ay >= 0 && ay < mz.rows && Maze.canMove(mz, ax, ay)) return { x: ax, y: ay };
                }
                return { x: hero.x, y: hero.y };
            }
            case 'patrol': {
                const dist = Maze.bfsDist(mz, { x: d.x, y: d.y }, hero, 14);
                return dist < CONFIG.PATROL_TRIGGER ? { x: hero.x, y: hero.y } : d.home;
            }
            default: return null;
        }
    }

    function chooseDir(d, mz, hero) {
        let opts = Maze.options(mz, d.x, d.y);
        if (!opts.length) return d.dir;
        const noBack = opts.filter(function (o) { return !(o.x === -d.dir.x && o.y === -d.dir.y); });
        if (noBack.length) opts = noBack;
        if (opts.length === 1) return opts[0];
        const straight = opts.find(function (o) { return o.x === d.dir.x && o.y === d.dir.y; });
        if (opts.length === 2 && straight) return straight;
        const target = targetFor(d, mz, hero);
        if (!target || Math.random() < CONFIG.DRONE_RANDOMNESS)
            return opts[Math.floor(Math.random() * opts.length)];
        if (d.kind === 'hunter' && !d.weak && d.respawnLeft <= 0) {
            let bestOpt = opts[0], bestDist = Infinity;
            opts.forEach(function (o) {
                const nx = Maze.wrapX(mz, d.x + o.x), ny = d.y + o.y;
                if (ny < 0 || ny >= mz.rows) return;
                const dist = Maze.bfsDist(mz, { x: nx, y: ny }, target, 40);
                if (dist < bestDist) { bestDist = dist; bestOpt = o; }
            });
            return bestOpt;
        }
        let best = opts[0], bestD = Infinity;
        opts.forEach(function (o) {
            const nx = Maze.wrapX(mz, d.x + o.x), ny = d.y + o.y;
            let dx = Math.abs(nx - target.x);
            if (ny === mz.tunnelRow && target.y === mz.tunnelRow) dx = Math.min(dx, mz.cols - dx);
            const dy = Math.abs(ny - target.y);
            const dist = target.flee ? -(dx * dx + dy * dy) : (dx * dx + dy * dy);
            if (dist < bestD) { bestD = dist; best = o; }
        });
        return best;
    }

    function speedFactor(d, slowActive) {
        let f = 1;
        if (d.weak) f *= CONFIG.DRONE_WEAK_SLOWDOWN;
        if (slowActive) f *= CONFIG.SLOW_FACTOR;
        return f;
    }

    function step(drones, mz, hero, dt, baseStepMs, slowActive) {
        drones.forEach(function (d) {
            /* wypuszczenie z bazy - w bezpiecznym miejscu */
            if (d.releaseIn > 0) {
                d.releaseIn -= dt;
                if (d.releaseIn <= 0) placeAt(d, pickSpawn(mz, hero, d.home));
                return;
            }
            /* powrot po zlapaniu - w bezpiecznym miejscu */
            if (d.respawnLeft > 0) {
                d.respawnLeft -= dt;
                if (d.respawnLeft <= 0) {
                    d.weak = false; d.weakLeft = 0;
                    placeAt(d, pickSpawn(mz, hero, d.home));
                }
                return;
            }
            if (d.graceLeft > 0) d.graceLeft -= dt;
            if (d.weak) { d.weakLeft -= dt; if (d.weakLeft <= 0) d.weak = false; }

            d.stepMs = (baseStepMs || CONFIG.DRONE_STEP_MS) * speedFactor(d, slowActive);
            d.acc += dt;
            while (d.acc >= d.stepMs) {
                d.acc -= d.stepMs;
                d.px = d.x; d.py = d.y;
                const dir = chooseDir(d, mz, hero);
                d.dir = dir;
                const nx = Maze.wrapX(mz, d.x + dir.x), ny = d.y + dir.y;
                if (Maze.canMove(mz, nx, ny)) { d.x = nx; d.y = ny; }
                else { d.acc = 0; break; }
            }
        });
    }

    function progress(d) {
        if (d.releaseIn > 0 || d.respawnLeft > 0) return 1;
        return Math.max(0, Math.min(1, d.acc / d.stepMs));
    }

    function makeWeak(drones, ms) {
        drones.forEach(function (d) {
            if (d.respawnLeft > 0) return;
            d.weak = true; d.weakLeft = ms; d.dir = { x: -d.dir.x, y: -d.dir.y };
        });
    }

    function capture(d) {
        d.weak = false; d.weakLeft = 0; d.graceLeft = 0;
        d.respawnLeft = CONFIG.DRONE_RESPAWN_MS;
    }

    function spriteKey(d, now) {
        if (d.respawnLeft > 0) return null;
        /* okres ochronny - dron miga, zeby gracz widzial, ze sie pojawil */
        if (d.graceLeft > 0 && Math.floor(now / 110) % 2 === 0) return null;
        if (!d.weak) return d.sprite;
        if (d.weakLeft < 1800 && Math.floor(d.weakLeft / 180) % 2 === 0) return 'drone-flash';
        return 'drone-weak';
    }

    function passedThrough(d, hero) {
        return d.px === hero.x && d.py === hero.y && d.x === hero.px && d.y === hero.py;
    }

    function hits(d, hero) {
        if (d.respawnLeft > 0 || d.releaseIn > 0) return false;
        if (d.graceLeft > 0 && !d.weak) return false;   /* swiezo pojawiony - niegrozny */
        return (d.x === hero.x && d.y === hero.y) || passedThrough(d, hero);
    }

    return { KINDS, create, step, speedFactor, makeWeak, capture, spriteKey, hits, progress };
})();
