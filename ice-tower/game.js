/* ==========================================================================
   GAME ON TOWER  —  MSI × Intel × KFC
   Prototyp mechaniki, styl graficzny B (flat vector cartoon)
   --------------------------------------------------------------------------
   Zalozenia z briefu i ustalen wewnetrznych:
     * skok AUTOMATYCZNY, gracz steruje tylko lewo/prawo (obsluga 1 reka)
     * platformy generowane losowo, trudnosc rosnie z wysokoscia
     * brak konca planszy
     * HUD ograniczony do minimum: wynik, wysokosc, punkty GAME ON
     * kolekcje MSI / Intel / KFC z bonusami
     * punkty przekazywane do GAME ON na koniec gry, z dziennym limitem
   ========================================================================== */
(() => {
"use strict";

/* --- male helpery matematyczne (uzywane juz w fit()) --- */
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/* ==========================================================================
   ROZDZIELCZOSC I UKLAD EKRANU
   --------------------------------------------------------------------------
   Gra rysuje w "logicznym" ukladzie o stalej szerokosci BASE_W. Wysokosc H
   wyliczamy z proporcji okna, dzieki czemu na waskim telefonie dostajemy
   wysoka plansze, a na tablecie nizsza - ale nigdy znieksztalcona.

   UWAGA: gra NIE wymusza trybu pelnoekranowego przegladarki. Wypelnia okno,
   ale pasek adresu i nawigacja zostaja. W docelowym osadzeniu w GAME ON
   gra trafi do WebView, ktore samo decyduje o UI.
   ========================================================================== */
const BASE_W = 450;                 // stala szerokosc logiczna
const H_MIN = 680, H_MAX = 1150;    // limity, zeby balans gry nie odjechal

let W = BASE_W, H = 800;            // aktualny uklad logiczny
let DPR = 1;                        // device pixel ratio (ograniczony)

/* Paleta interfejsu - spojna ze stylem B */
const MSI = "#FF2834", INTEL = "#007AD2", KFC = "#E8183C",
      NEON = "#22E0FF", LIME = "#96EB5A", GOLD = "#FFC83C";

const cv = document.getElementById("game");
const ctx = cv.getContext("2d", { alpha: false });

/**
 * Przelicza uklad logiczny i bufor canvasu pod aktualny rozmiar okna.
 * Wywolywana przy starcie, resize i zmianie orientacji.
 */
function fit() {
  const vw = Math.max(1, innerWidth);
  const vh = Math.max(1, innerHeight);

  H = clamp(Math.round(BASE_W * vh / vw), H_MIN, H_MAX);
  W = BASE_W;

  /* DPR ograniczamy do 3. Assety maja zapas rozdzielczosci (ASSET_RES),
     wiec na ekranach 3x obraz jest nadal ostry. Powyzej 3 koszt
     wypelniania pikseli rosnie szybciej niz zysk wizualny. */
  DPR = Math.min(devicePixelRatio || 1, 3);

  cv.width = Math.round(W * DPR);
  cv.height = Math.round(H * DPR);

  /* Na telefonie proporcja zwykle miesci sie w limitach i canvas wypelnia
     caly viewport. Na tablecie/desktopie H zostalo przyciete, wiec
     skalujemy z zachowaniem proporcji i centrujemy (letterbox). */
  const scale = Math.min(vw / W, vh / H);
  const fills = Math.abs(vw / vh - W / H) < 0.02;
  const cssW = fills ? vw : Math.round(W * scale);
  const cssH = fills ? vh : Math.round(H * scale);
  cv.style.width = cssW + "px";
  cv.style.height = cssH + "px";
  cv.style.marginLeft = Math.round((vw - cssW) / 2) + "px";
  cv.style.marginTop = Math.round((vh - cssH) / 2) + "px";

  /* strzalka powrotu w grze: przyklejona do lewego gornego rogu PLANSZY
     (nie okna), w tej samej skali co HUD - na handheldzie plansza jest
     kolumna na srodku, wiec przycisk musi isc razem z nia */
  const k = cssW / W, bb = document.getElementById("btn-game-back");
  if (bb) {
    bb.style.left = Math.round((vw - cssW) / 2 + 10 * k) + "px";
    bb.style.top = Math.round((vh - cssH) / 2 + 12 * k) + "px";
    bb.style.width = bb.style.height = Math.round(42 * k) + "px";
  }
  document.body.classList.toggle("is-letterbox", !fills);

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  /* Wygladzanie WLACZONE: sprite'y sa zapisane w rozdzielczosci
     ASSET_RES-krotnie wyzszej niz rozmiar rysowania, wiec kazde drawImage
     to redukcja. Przy redukcji wygladzanie daje ostry, czysty obraz. */
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (typeof bakePlayer === "function" && Object.keys(IMG).length) bakePlayer();
}
addEventListener("resize", fit);
addEventListener("orientationchange", () => setTimeout(fit, 200));

/* ==========================================================================
   LADOWANIE SPRITE'OW
   ASSETS to mapa { klucz: url } wstrzykiwana przez assets.js (lub base64
   w wersji jednoplikowej). Czekamy az WSZYSTKIE sie zaladuja - rysowanie
   niezaladowanego Image w canvasie po cichu nic nie robi, a efektem
   bylyby znikajace platformy w pierwszych sekundach gry.
   ========================================================================== */
const IMG = {};
/* Grafika z Unity: tlo (parallax) + platforma. Rejestrowane tutaj,
   wiec assets.js nie trzeba zmieniac. */
Object.assign(ASSETS, {
  tw_layer0: "assets/tower/layer0.png",
  tw_layer1: "assets/tower/layer1.png",
  tw_layer2: "assets/tower/layer2.png",
  tw_layer3: "assets/tower/layer3.png",
  tw_layer4: "assets/tower/layer4.png",
  tw_platform: "assets/tower/platform.png"
});
function loadAll(cb) {
  const keys = Object.keys(ASSETS);
  let n = 0;
  keys.forEach(k => {
    const im = new Image();
    im.onload = im.onerror = () => { if (++n === keys.length) cb(); };
    im.src = ASSETS[k];
    IMG[k] = im;
  });
}

/* ==========================================================================
   KOLEKCJE PARTNEROW  (zgodnie z briefem)
   --------------------------------------------------------------------------
   need - ile roznych przedmiotow domyka zestaw
   part - sprite czasteczki uzywany przy efekcie zebrania
   MSI i Intel daja bonus punktowy, KFC - mnoznik punktow.
   ========================================================================== */
const SETS = {
  msi:   { label: "MSI",   color: MSI,   need: 3, part: "p_red",
           items: ["laptop", "keyboard", "mouse", "monitor"] },
  intel: { label: "INTEL", color: INTEL, need: 3, part: "p_blue",
           items: ["cpu", "chip", "core"] },
  kfc:   { label: "KFC",   color: KFC,   need: 5, part: "p_red",
           items: ["bucket", "burger", "strips", "fries", "cup"] }
};
const ITEM_BRAND = {};
for (const b in SETS) for (const it of SETS[b].items) ITEM_BRAND[it] = b;
const ALL_ITEMS = Object.keys(ITEM_BRAND);

/* Przelicznik na punkty GAME ON + dzienny limit (do ustalenia z klientem).
   Dzienny limit zacheca do codziennego powrotu bez dlugich sesji. */
const GO_RATE = 100, GO_DAILY_CAP = 1000;

const KEY_BEST = "goTower-best", KEY_GO = "goTower-go";
let best = Number(localStorage.getItem(KEY_BEST) || 0);
let goToday = Number(localStorage.getItem(KEY_GO) || 0);

let screen = "start", G = null;
const input = { left: false, right: false };

/* --- fizyka (wartosci dobrane eksperymentalnie) --- */
const GRAV = .46, JUMP = -13.4, SPRING = -21, ROCKET = -30, MAXVX = 7.4;
const PLAT_H = 15;                 // wysokosc kolizyjna platformy
const SPR = 30 / 120;              // proporcja sprite'u platformy (h/w)

/* --- assety: skala i rozmiary klatek --- */
const ASSET_RES = 3;                                          // patrz style_b_core.py
const DRONE_FW = 72 * ASSET_RES, DRONE_FH = 40 * ASSET_RES;
const DUST_FW = 48 * ASSET_RES, DUST_FH = 28 * ASSET_RES;

/* --- tlo: sciana wiezowca + billboardy na wysiegnikach --- */
const TOWER_H = 800, PARALLAX = .55;
const BB_DW = 153, BB_DH = 89, BB_INSET = 34, BB_SPACING = 660;
const BB_LIST = [
  { key: "bb_kfc_l",   side: "l" },
  { key: "bb_msi_r",   side: "r" },
  { key: "bb_intel_l", side: "l" },
  { key: "bb_kfc_r",   side: "r" }
];

/* ==========================================================================
   GENERATOR PLATFORM
   Rozklad typow zmienia sie z wysokoscia - to realizuje wymog
   "poziom trudnosci rosnie wraz z wysokoscia" z briefu.
   ========================================================================== */
function platType(alt) {
  const r = Math.random();
  if (alt < 400) return r < .10 ? "kfc" : r < .26 ? "move" : "normal";
  if (alt < 1200) {
    if (r < .09) return "kfc";
    if (r < .17) return "spring";
    if (r < .37) return "move";
    if (r < .49) return "break";
    return "normal";
  }
  if (r < .11) return "kfc";
  if (r < .19) return "spring";
  if (r < .42) return "move";
  if (r < .62) return "break";
  if (r < .69) return "cloud";
  return "normal";
}
const platW = t => t === "break" ? 78 : t === "kfc" ? 104 : t === "cloud" ? 110 : 98;

function newPlat(y, alt) {
  const t = platType(alt), w = platW(t);
  return { x: rnd(10, W - w - 10), y, w, h: PLAT_H, type: t,
           dir: Math.random() < .5 ? -1 : 1, dead: false, shake: 0,
           scored: false, kfcUsed: false };
}

/**
 * Losuje przedmiot, faworyzujac elementy brakujace w kolekcji gracza.
 * Bez tego domkniecie zestawu w jednej sesji byloby kwestia szczescia.
 */
function pickItem(g) {
  const missing = ALL_ITEMS.filter(i => !g.col[ITEM_BRAND[i]].has(i));
  const pool = (missing.length && Math.random() < .72) ? missing : ALL_ITEMS;
  return pool[Math.floor(Math.random() * pool.length)];
}
function spawnItem(pl, g) {
  if (pl.type === "break" || pl.type === "cloud") return;
  const r = Math.random();
  let type = null;
  if (r < .20) type = pickItem(g);
  else if (r < .225 && g.alt > 500) type = "star";
  if (!type) return;
  g.items.push({ x: pl.x + pl.w / 2, y: pl.y - 34, type, t: rnd(0, 6.28), taken: false });
}

/* ==========================================================================
   START NOWEJ ROZGRYWKI
   Pierwsza platforma jest szeroka i wysrodkowana, zeby gracz nigdy
   nie zginal w pierwszej sekundzie.
   ========================================================================== */
function reset() {
  G = {
    px: W / 2 - 19, py: H - 130 - 52, pw: 38, ph: 52, vx: 0, vy: 0, vy0: JUMP, face: 1,
    anim: "hello", animT: 0, helloT: 0, locked: true, grounded: true, groundPl: null,
    landDone: true, groundT: 0, startPhase: true, walked: false,
    alt: 0, score: 0, combo: 0, comboT: 0,
    col: { msi: new Set(), intel: new Set(), kfc: new Set() },
    done: { msi: false, intel: false, kfc: false },
    mult: 0, shield: 0,
    platforms: [], items: [], enemies: [], parts: [], pops: [], dusts: [],
    shakeT: 0, frameT: 0, blink: 0, warn: 0, landT: 0,
    last: performance.now(), fps: 60, fpsAcc: 0, fpsN: 0, lowFps: 0
  };
  G.platforms.push({ x: W / 2 - 75, y: H - 130, w: 150, h: PLAT_H, type: "normal",
                     dir: 1, dead: false, shake: 0, scored: true, kfcUsed: true });
  G.groundPl = G.platforms[0];
  let y = H - 225;
  for (let i = 0; i < 13; i++) {
    const p = newPlat(y, 0);
    G.platforms.push(p);
    if (i > 2) spawnItem(p, G);
    y -= rnd(78, 108);
  }
}

/* --- efekty --- */
function burst(x, y, key, n = 10, spd = 3.6) {
  for (let i = 0; i < n; i++)
    G.parts.push({ x, y, vx: rnd(-spd, spd), vy: rnd(-spd, 1), life: 30, max: 30,
                   img: key, s: rnd(5, 11), rot: rnd(0, 6.28), vr: rnd(-.2, .2) });
}
function pop(x, y, txt, c, size = 17) {
  G.pops.push({ x, y, txt, c, life: 58, max: 58, size });
}
const mult = g => (g.mult > 0 ? 3 : 1);

/* ==========================================================================
   AKTUALIZACJA STANU (jedna klatka)
   --------------------------------------------------------------------------
   dt jest znormalizowane do 60 FPS (dt = 1.0 przy 60 kl/s), wiec fizyka
   dziala tak samo przy 30 i 60 FPS. To krytyczne, bo wiekszosc Androidow
   limituje przegladarke do 30 FPS z uwagi na oszczedzanie baterii.
   ========================================================================== */
function update(dt, now) {
  const g = G;

  /* Kamera jedzie w gore ZAWSZE, tempo rosnie z wysokoscia.
     Bez tego dalo by sie stac na jednej platformie i nabijac punkty. */
  const speed = clamp(.62 + g.alt / 7000, .62, 3.6);
  let rise = (g.locked || g.startPhase) ? 0 : speed * dt;   // kamera czeka na start

  /* --- ruch poziomy --- */
  const acc = .64 * dt;
  if (input.left && !g.locked) { g.vx -= acc; g.face = -1; }
  if (input.right && !g.locked) { g.vx += acc; g.face = 1; }
  if (g.grounded) {
    /* na ziemi: stoi = stoi, hamowanie tylko w walk_stop, predkosc = tempo nog */
    const mv = input.left || input.right;
    if (g.locked || (!mv && (g.anim === "land" || g.anim === "idle"))) g.vx = 0;
    else if (!input.left && !input.right) g.vx *= Math.pow(.7, dt);
    g.vx = clamp(g.vx, -WALK_VX, WALK_VX);
  } else if (!input.left && !input.right) g.vx *= Math.pow(.86, dt);
  g.vx = clamp(g.vx, -MAXVX, MAXVX);

  const oldBottom = g.py + g.ph;
  g.px += g.vx * dt;
  if (!g.grounded) { g.vy += GRAV * dt; g.py += g.vy * dt; }

  /* zawijanie ekranu na bokach */
  if (g.px > W) g.px = -g.pw;
  if (g.px + g.pw < 0) g.px = W;

  /* gdy gracz wchodzi wysoko, kamera dodatkowo przyspiesza */
  const limit = H * .40;
  if (g.py < limit) { rise += (limit - g.py); g.py = limit; }

  /* --- przesuw calego swiata w dol --- */
  g.alt += rise;
  g.score += rise * .11 * mult(g);
  for (const arr of [g.platforms, g.items, g.enemies, g.parts, g.pops, g.dusts])
    for (const o of arr) o.y += rise;

  /* --- ruch platform --- */
  for (const pl of g.platforms) {
    if (pl.type === "move") {
      pl.x += 1.5 * pl.dir * dt;
      if (pl.x < 8) { pl.x = 8; pl.dir = 1; }
      if (pl.x + pl.w > W - 8) { pl.x = W - 8 - pl.w; pl.dir = -1; }
    } else if (pl.type === "cloud") {
      pl.x += .9 * pl.dir * dt;
      if (pl.x < -pl.w) pl.x = W;
      if (pl.x > W) pl.x = -pl.w;
    }
    if (pl.shake > 0) pl.shake -= dt;
  }

  /* --- gracz stoi na platformie (czeka na koniec animacji Land) --- */
  if (g.grounded) {
    const pl = g.groundPl;
    if (!pl || pl.dead || g.px + g.pw - 6 < pl.x || g.px + 6 > pl.x + pl.w) {
      g.grounded = false; g.groundPl = null; g.vy = 0;   // zszedl z krawedzi
    } else {
      if (pl.type === "move") g.px += 1.5 * pl.dir * dt;  // jedzie z platforma
      if (g.startPhase) {                                 // nie spada ze startowej
        const nx = clamp(g.px, pl.x - g.pw / 2 + 8, pl.x + pl.w - g.pw / 2 - 8);
        if (nx !== g.px) { g.px = nx; g.vx = 0; }
      }
      g.py = pl.y - g.ph;
    }
  }
  /* --- kolizje z platformami (tylko przy opadaniu) --- */
  if (!g.grounded && g.vy > 0) {
    const nb = g.py + g.ph;
    for (const pl of g.platforms) {
      if (pl.dead || pl.type === "cloud") continue;
      if (oldBottom <= pl.y + 8 && nb >= pl.y &&
          g.px + g.pw - 6 > pl.x && g.px + 6 < pl.x + pl.w) { land(pl); break; }
    }
  }

  /* --- animacja + auto-skok po zakonczeniu Land (PlayerController.autoJump) --- */
  animStep(g, dt);
  if (g.grounded && !g.locked) {
    /* trzymasz strzalke = chodzisz po platformie; puszczasz = hamowanie i skok */
    const mv = input.left || input.right;
    if (mv) g.groundT = 0; else g.groundT += dt;
    if (g.startPhase) { if (startReady(g)) { g.startPhase = false; doJump(g, JUMP); } }
    else if (!mv && ((g.landDone && g.anim !== "walk_stop" && g.anim !== "walk" && g.anim !== "walk_start")
                     || g.groundT > LAND_TIMEOUT)) doJump(g, JUMP);
  }
  /* --- przedmioty (w trybie mnoznika dziala magnes) --- */
  for (const it of g.items) {
    it.t += .06 * dt;
    if (g.mult > 0) {
      const dx = (g.px + g.pw / 2) - it.x, dy = (g.py + g.ph / 2) - it.y;
      const d = Math.hypot(dx, dy);
      if (d < 160) { it.x += dx / d * 4 * dt; it.y += dy / d * 4 * dt; }
    }
    if (Math.abs((g.px + g.pw / 2) - it.x) < 34 &&
        Math.abs((g.py + g.ph / 2) - it.y) < 40) take(it);
  }
  g.items = g.items.filter(i => !i.taken && i.y < H + 120);

  /* --- drony kurierskie --- */
  for (const e of g.enemies) {
    e.x += e.vx * dt; e.anim += dt;
    if (e.x < 6 || e.x + e.w > W - 6) e.vx *= -1;
    if (!e.hit && g.px + g.pw - 10 > e.x && g.px + 10 < e.x + e.w &&
        g.py + g.ph - 12 > e.y && g.py + 14 < e.y + e.h) {
      if (g.shield > 0 || g.mult > 0) {
        e.hit = true; burst(e.x + e.w / 2, e.y + e.h / 2, "p_gold", 18);
        g.score += 250 * mult(g);
        pop(e.x, e.y, "+" + 250 * mult(g), GOLD); g.shakeT = 9;
      } else {
        g.vy = -7; g.grounded = false; g.groundPl = null; g.shakeT = 14;
        burst(g.px + 19, g.py + 26, "p_red", 20);
      }
    }
  }
  g.enemies = g.enemies.filter(e => !e.hit && e.y < H + 160);

  /* --- recykling platform (object pooling) --- */
  let top = Infinity;
  for (const pl of g.platforms) if (pl.y < top) top = pl.y;
  for (const pl of g.platforms) {
    if (pl.y > H + 70) {
      const np = newPlat(top - rnd(78, 112), g.alt);
      top = np.y;
      Object.assign(pl, np);
      spawnItem(pl, g);
      if (g.alt > 700 && Math.random() < .06 && g.enemies.length < 2)
        g.enemies.push({ x: rnd(20, W - 100), y: pl.y - 110, w: 66, h: 34,
                         vx: rnd(1.3, 2.6) * (Math.random() < .5 ? -1 : 1),
                         hit: false, anim: 0 });
    }
  }

  /* --- timery --- */
  if (g.mult > 0) g.mult = Math.max(0, g.mult - dt / 60);
  if (g.shield > 0) g.shield = Math.max(0, g.shield - dt / 60);
  if (g.comboT > 0) { g.comboT -= dt; if (g.comboT <= 0) g.combo = 0; }
  if (g.shakeT > 0) g.shakeT -= dt;
  if (g.landT > 0) g.landT -= dt;
  g.frameT += dt;
  g.blink = Math.sin(now / 1400) > .96 ? 1 : 0;

  /* --- czasteczki, teksty, kurz --- */
  for (const p of g.parts) { p.x += p.vx; p.y += p.vy; p.vy += .19; p.rot += p.vr; p.life -= dt; }
  g.parts = g.parts.filter(p => p.life > 0);
  for (const p of g.pops) { p.y -= .95 * dt; p.life -= dt; }
  g.pops = g.pops.filter(p => p.life > 0);
  for (const d of g.dusts) d.t += dt;
  g.dusts = g.dusts.filter(d => d.t < animLen("puff_v1") && d.y < H + 60);

  /* --- pomiar FPS -> ostrzezenie o slabym urzadzeniu --- */
  g.fpsAcc += dt; g.fpsN++;
  if (g.fpsN >= 40) {
    g.fps = 60 / (g.fpsAcc / g.fpsN);
    g.fpsAcc = 0; g.fpsN = 0;
    g.lowFps = g.fps < 15 ? g.lowFps + 1 : 0;
  }

  /* --- strefa zagrozenia u dolu + smierc --- */
  g.warn = clamp((g.py - (H - 210)) / 210, 0, 1);
  if (g.py > H + 30) gameOver();
}

/**
 * Ladowanie na platformie. Obsluguje PERFECT (trafienie w srodek),
 * combo oraz efekty specjalne typow platform.
 * Flagi `scored` / `kfcUsed` gwarantuja, ze z jednej platformy nie da sie
 * wycisnac punktow wielokrotnie (zabezpieczenie anty-farmienie).
 */
function land(pl) {
  const g = G;
  g.py = pl.y - g.ph;
  const cx = g.px + g.pw / 2, pcx = pl.x + pl.w / 2;
  const perfect = Math.abs(cx - pcx) < 16;

  g.vy = 0; g.grounded = true; g.groundPl = pl; g.groundT = 0; g.landDone = false;
  if (pl.type === "spring" || pl.type === "break") doJump(g, pl.type === "spring" ? SPRING : JUMP);

  if (pl.type === "spring") {
    burst(pcx, pl.y, "p_lime", 14);
    pop(pcx - 26, pl.y - 30, "BOOST!", LIME);
    g.shakeT = 6;
  }
  if (pl.type === "kfc" && !pl.kfcUsed) {
    pl.kfcUsed = true;
    g.score += 60 * mult(g);
    burst(pcx, pl.y, "p_red", 10);
  }
  if (perfect && !pl.scored) {
    pl.scored = true;
    g.combo++; g.comboT = 150;
    const bonus = 50 * Math.min(g.combo, 8) * mult(g);
    g.score += bonus;
    burst(cx, pl.y, "p_gold", 14);
    pop(cx - 44, pl.y - 34, "PERFECT +" + bonus, GOLD);
  } else if (!perfect) {
    g.combo = 0;
    burst(cx, pl.y, "p_white", 5, 2.2);
  }
  if (pl.type === "break") {
    pl.dead = true; pl.shake = 10;
    burst(pcx, pl.y, "p_red", 10);
  }
}

/**
 * Zebranie przedmiotu. Dublet daje mniej punktow niz nowy element
 * kolekcji - to nagradza swiadome kompletowanie zestawu.
 */
function take(it) {
  const g = G;
  it.taken = true;

  if (it.type === "star") {
    g.shield = 6;
    burst(it.x, it.y, "p_gold", 22);
    pop(it.x - 30, it.y - 12, "TARCZA!", GOLD);
    g.score += 120 * mult(g);
    return;
  }

  const brand = ITEM_BRAND[it.type], set = SETS[brand];
  const fresh = !g.col[brand].has(it.type);
  g.col[brand].add(it.type);
  g.score += (fresh ? 120 : 50) * mult(g);
  burst(it.x, it.y, set.part, fresh ? 16 : 8);
  pop(it.x - 20, it.y - 12,
      fresh ? "+1 " + set.label : "+" + 50 * mult(g),
      fresh ? set.color : "#fff", fresh ? 16 : 14);

  if (!g.done[brand] && g.col[brand].size >= set.need) {
    g.done[brand] = true;
    g.shakeT = 16;
    if (brand === "kfc") {
      g.mult = 12;
      pop(W / 2 - 96, H / 2 - 40, "ZESTAW KFC — x3 PUNKTY!", KFC, 24);
      burst(g.px + 19, g.py + 26, "p_red", 30, 6);
    } else {
      const bonus = 1500;
      g.score += bonus;
      pop(W / 2 - 92, H / 2 - 40, "KOMPLET " + set.label + " +" + bonus, set.color, 23);
      burst(g.px + 19, g.py + 26, set.part, 26, 5);
    }
  }
}

/**
 * Koniec rozgrywki: przeliczenie punktow GAME ON z uwzglednieniem
 * dziennego limitu i wypelnienie ekranu podsumowania.
 */
function gameOver() {
  if (screen !== "play") return;
  const s = Math.floor(G.score);
  if (s > best) { best = s; localStorage.setItem(KEY_BEST, best); }

  const earned = Math.min(Math.floor(s / GO_RATE), Math.max(0, GO_DAILY_CAP - goToday));
  goToday += earned;
  localStorage.setItem(KEY_GO, goToday);

  screen = "over";
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set("ov-score", s.toLocaleString("pl-PL"));
  set("ov-alt", Math.floor(G.alt / 10) + " m");
  set("ov-best", best.toLocaleString("pl-PL"));
  set("ov-go", "+" + earned);
  set("ov-go-left", (GO_DAILY_CAP - goToday) + " pkt");
  set("ov-msi", G.col.msi.size + "/" + SETS.msi.need);
  set("ov-intel", G.col.intel.size + "/" + SETS.intel.need);
  set("ov-kfc", G.col.kfc.size + "/" + SETS.kfc.need);
  show("over");
}

/* ==========================================================================
   RENDEROWANIE
   Kolejnosc warstw: tlo -> platformy -> itemy -> wrogowie -> czastki ->
   kurz -> gracz -> teksty -> HUD. HUD rysowany POZA transformacja
   trzesienia kamery, zeby interfejs nie drgal razem ze scena.
   ========================================================================== */
function mixc(c1, c2, t) {
  const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const a = p(c1), b = p(c2);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
}

/* Paleta nieba dla stylu B: jasna i pogodna na dole, stopniowo
   przechodzaca w zmierzch i noc wraz z wysokoscia. */
const STOPS = [
  { a: 0,     t: "#5BB4F5", m: "#8FD2FF", b: "#CFEBFF" },   // dzien
  { a: 2500,  t: "#2E7FD8", m: "#6FB8F5", b: "#BFE4FF" },   // wyzej
  { a: 7000,  t: "#28407F", m: "#5A7FD0", b: "#9FC4F5" },   // zmierzch
  { a: 14000, t: "#141C4A", m: "#2A3C82", b: "#5A76C8" }    // noc
];

/**
 * Tlo: gradient nieba + gwiazdy + sciana wiezowca + billboardy + chmury.
 * Sciana i billboardy uzywaja TEJ SAMEJ paralaksy (PARALLAX), dzieki
 * czemu tablice sa wizualnie przymocowane do elewacji, a nie "wisza".
 */
/* --------------------------------------------------------------------------
   TLO Z UNITY - port ParallaxLayer.cs
   Kazda warstwa: szerokosc = W, dol warstwy = dol ekranu + offset,
   offset = wysokosc * scrollFactor.
     clamp     - zatrzymuje sie na gorze grafiki (niebo)
     scrollout - zjezdza calkiem w dol i znika
   Kolejnosc = od najdalszej do najblizszej.
   -------------------------------------------------------------------------- */
const BG_LAYERS = [
  { key: "tw_layer0", f: .07, mode: "clamp" },     // niebo: zachod -> gwiazdy
  { key: "tw_layer1", f: .10, mode: "scrollout" }, // daleka panorama
  { key: "tw_layer2", f: .16, mode: "scrollout" }, // wiezowce MSI / Intel / KFC
  { key: "tw_layer3", f: .24, mode: "scrollout" }, // cyber-bloki
  { key: "tw_layer4", f: .34, mode: "scrollout" }  // najblizsza ulica
];
/* Wydajnosc: kazda warstwa jest raz "wypiekana" do rozmiaru ekranu
   (W*DPR), wiec w grze drawImage kopiuje piksele 1:1 bez skalowania.
   Liczymy tez, od ktorego wiersza warstwa jest w 100% nieprzezroczysta -
   warstw calkowicie zaslonietych przez blizsze w ogole nie rysujemy. */
let BG_DPR = 0;
function bakeBg() {
  if (BG_DPR === DPR) return;
  let all = true;
  for (const L of BG_LAYERS) {
    const im = IMG[L.key];
    if (!im || !im.complete || !im.naturalWidth) { all = false; continue; }
    const cw = Math.round(W * DPR), ch = Math.round(im.naturalHeight * W / im.naturalWidth * DPR);
    const c = document.createElement("canvas"); c.width = cw; c.height = ch;
    const cc = c.getContext("2d");
    cc.imageSmoothingEnabled = true; cc.imageSmoothingQuality = "high";
    cc.drawImage(im, 0, 0, cw, ch);
    /* pierwszy wiersz, od ktorego w dol wszystko jest kryte */
    let solid = ch;
    try {
      const d = cc.getImageData(0, 0, cw, ch).data;
      for (let y = ch - 1; y >= 0; y--) {
        let ok = true;
        for (let x = 0, i = y * cw * 4 + 3; x < cw; x++, i += 4) if (d[i] < 255) { ok = false; break; }
        if (!ok) break;
        solid = y;
      }
    } catch (e) { solid = ch; }                       // file:// - bez optymalizacji
    L.c = c; L.solid = solid / DPR; L.LH = ch / DPR;
  }
  if (all) BG_DPR = DPR;
}
function drawBg(g) {
  bakeBg();
  /* pozycje + szukamy najblizszej warstwy, ktora zaslania caly ekran */
  let first = 0;
  const pos = BG_LAYERS.map((L, i) => {
    if (!L.c) return null;
    let off = g.alt * L.f;
    off = L.mode === "clamp" ? clamp(off, 0, Math.max(0, L.LH - H)) : clamp(off, 0, L.LH);
    const top = Math.round((H + off - L.LH) * DPR) / DPR;   // pixelSnap
    if (top + L.solid <= 0 && top + L.LH >= H) first = i;   // kryje caly kadr
    return top;
  });
  if (first === 0 || !BG_LAYERS[first].c) { ctx.fillStyle = "#1a1838"; ctx.fillRect(0, 0, W, H); }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const HD = Math.round(H * DPR);
  for (let i = first; i < BG_LAYERS.length; i++) {
    const L = BG_LAYERS[i], top = pos[i];
    if (!L.c || top >= H) continue;
    const T = Math.round(top * DPR);
    const y0 = Math.max(0, T), y1 = Math.min(HD, T + L.c.height);
    if (y1 <= y0) continue;
    ctx.drawImage(L.c, 0, y0 - T, L.c.width, y1 - y0, 0, y0, L.c.width, y1 - y0);
  }
  ctx.restore();
}

/* --------------------------------------------------------------------------
   PLATFORMA Z UNITY - 3-slice (jak Draw Mode = Tiled w PlatformSpawner.cs)
   platform.png 509x123: lewa koncowka 0-192, panel 192-320 (powtarzany),
   prawa koncowka 320-509. Kawalki sa "wypiekane" do rozmiaru ekranowego
   (jak postac), rysowane 1:1 bez wygladzania -> ostre piksele.
   -------------------------------------------------------------------------- */
const TP_H = 24;                                   // wysokosc platformy na ekranie
const TP_SRC = { l: [0, 192], m: [192, 320], r: [320, 509] };
const TP = {};
let TP_DPR = 0;
function bakePiece(im, x0, x1, tw, th) {
  let src = im, x = x0, y = 0, w = x1 - x0, h = im.naturalHeight;
  while (w / 2 >= tw && h / 2 >= th) {
    const c = document.createElement("canvas");
    c.width = Math.round(w / 2); c.height = Math.round(h / 2);
    const cc = c.getContext("2d");
    cc.imageSmoothingEnabled = true; cc.imageSmoothingQuality = "high";
    cc.drawImage(src, x, y, w, h, 0, 0, c.width, c.height);
    src = c; x = 0; y = 0; w = c.width; h = c.height;
  }
  const out = document.createElement("canvas");
  out.width = tw; out.height = th;
  const oc = out.getContext("2d");
  oc.imageSmoothingEnabled = true; oc.imageSmoothingQuality = "high";
  oc.drawImage(src, x, y, w, h, 0, 0, tw, th);
  return out;
}
function bakePlatform() {
  const im = IMG.tw_platform;
  if (TP_DPR === DPR || !im || !im.complete || !im.naturalWidth) return;
  const th = Math.round(TP_H * DPR), k = th / im.naturalHeight;
  for (const p in TP_SRC) {
    const [a, b] = TP_SRC[p], tw = Math.max(1, Math.round((b - a) * k));
    TP[p] = bakePiece(im, a, b, tw, th);
  }
  TP_DPR = DPR;
}
/* rysuje platforme w pikselach URZADZENIA (bez skalowania = ostro) */
function drawTowerPlat(x, y, w) {
  bakePlatform();
  if (!TP.l) return false;
  const X = Math.round(x * DPR), Y = Math.round(y * DPR), Wd = Math.round(w * DPR);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const lw = TP.l.width, rw = TP.r.width, th = TP.l.height;
  if (Wd <= lw + rw) {                               // waska: same koncowki, przyciete
    const half = Math.floor(Wd / 2);
    ctx.drawImage(TP.l, 0, 0, half, th, X, Y, half, th);
    ctx.drawImage(TP.r, rw - (Wd - half), 0, Wd - half, th, X + half, Y, Wd - half, th);
  } else {
    ctx.drawImage(TP.l, X, Y);
    const mw = TP.m.width;
    let cx = X + lw;
    const end = X + Wd - rw;
    while (cx < end) {
      const part = Math.min(mw, end - cx);
      ctx.drawImage(TP.m, 0, 0, part, th, cx, Y, part, th);
      cx += part;
    }
    ctx.drawImage(TP.r, end, Y);
  }
  ctx.restore();
  return true;
}

function drawPlat(pl) {
  if (pl.y < -60 || pl.y > H + 40 || pl.dead) return;
  const sh = pl.shake > 0 ? rnd(-2.5, 2.5) : 0;
  /* sprezyna, chmura i KFC zostaja w starej grafice - to sygnal mechaniki */
  if (pl.type === "normal" || pl.type === "move" || pl.type === "break") {
    if (!drawTowerPlat(pl.x + sh, pl.y, pl.w)) return;
    if (pl.type === "break") {                       // pekniecia = platforma sie rozpadnie
      ctx.strokeStyle = "rgba(20,10,10,.85)"; ctx.lineWidth = 2;
      ctx.beginPath();
      for (const fx of [.3, .55, .78]) {
        const x = pl.x + sh + pl.w * fx;
        ctx.moveTo(x, pl.y + 2); ctx.lineTo(x - 4, pl.y + 9);
        ctx.lineTo(x + 3, pl.y + 15); ctx.lineTo(x - 2, pl.y + TP_H - 2);
      }
      ctx.stroke();
    }
    return;
  }
  const im = IMG["plat_" + pl.type];
  if (!im || !im.complete) return;
  const h = pl.w * SPR;
  ctx.drawImage(im, pl.x + sh,
                pl.y - (pl.type === "spring" ? 9 : pl.type === "cloud" ? 10 : 0),
                pl.w, pl.type === "cloud" ? h + 6 : h);
}

function drawItem(it) {
  if (it.y < -60 || it.y > H + 60) return;
  const im = IMG["it_" + it.type];
  if (!im || !im.complete) return;
  const s = 46, bob = Math.sin(it.t) * 4;
  ctx.save();
  ctx.translate(it.x, it.y + bob);
  ctx.rotate(Math.sin(it.t * .7) * .1);
  ctx.drawImage(im, -s / 2, -s / 2, s, s);
  ctx.restore();
}

/* --------------------------------------------------------------------------
   SPRITE POSTACI (styl B - flat cartoon robot)
   --------------------------------------------------------------------------
   char_sheet.png: 16 klatek, komorka 348 x 558 px (logicznie 116 x 186
   przy ASSET_RES = 3). Pivot stop = y 450 w pliku, identyczny w KAZDEJ
   klatce, wiec sprite nie "skacze" niezaleznie od fizyki.
   Sheet jest weryfikowany automatycznie przez make_b_char.py.

   Uklad klatek:
     0-1   idle (mrugniecie)        2-3    przysiad / squash po ladowaniu
     4-7   wznoszenie (dysze)       8-9    szczyt skoku
     10-13 spadanie                 14-15  rocket
   -------------------------------------------------------------------------- */
/* --------------------------------------------------------------------------
   POSTAC Z UNITY (port PlayerAnimator.cs + JumpPuffSpawner.cs)
   Arkusze: assets/player/<anim>.png, metadane: window.PLAYER_ATLAS (assets.js)
   -------------------------------------------------------------------------- */
const PA = window.PLAYER_ATLAS;
/* fps = Sample Rate klipu w Unity. jump_up nie uzywa fps - klatka liczona z fizyki */
const PL_FPS  = { idle: 24, hello: 24, walk_start: 24, walk: 24, walk_stop: 36,
                  jump_up: 24, fall: 24, land: 24, puff_v1: 24 };
const PL_LOOP = { idle: true, walk: true, fall: true };
const PL_PIVOT_X = 360;          // srodek canvasu 720 (px oryginalu)
const PL_FEET_Y  = 661;          // linia stop w oryginale 720x720
const PL_SCALE   = 0.17;         // px logiczne na 1 px oryginalu (~98 px wysokosci postaci)
const HELLO_TIMEOUT = 300;       // 5 s - jak helloTimeout w Unity
const LAND_TIMEOUT  = 60;        // 1 s - jak landWaitTimeout w Unity
const START_WAIT = 120;         // 2 s na platformie startowej, jesli gracz nic nie robi
const WALK_VX = 3.5;            // max predkosc chodu na platformie (px/klatke)
const WALK_STOP_VX = 3;         // ladowanie bez kierunku, ale z predkoscia -> hamowanie
const JUMP_SPEED_BONUS = 0.25;   // speedJumpBonus (Unity 0.4) - im szybszy bieg, tym wyzszy skok

const animLen = n => PA[n].count * PA[n].step * 60 / PL_FPS[n]; // w klatkach 60 FPS
function setAnim(g, n) { if (g.anim !== n) { g.anim = n; g.animT = 0; } }
const animDone = g => !PL_LOOP[g.anim] && g.animT >= animLen(g.anim);
function animFrame(g) {
  const m = PA[g.anim];
  if (g.anim === "jump_up") {                       // sprzezone z fizyka
    const k = clamp(1 - g.vy / g.vy0, 0, 1);
    return Math.min(m.count - 1, Math.floor(k * m.count));
  }
  const f = Math.floor(g.animT * PL_FPS[g.anim] / 60 / m.step);
  return PL_LOOP[g.anim] ? f % m.count : Math.min(f, m.count - 1);
}

/* Maszyna stanow = Animator z Unity (Hello -> Idle -> Jump/Fall -> Land -> ...) */
function animStep(g, dt) {
  g.animT += dt;
  if (g.anim === "hello") {
    g.helloT += dt;
    if (animDone(g) || g.helloT > HELLO_TIMEOUT) { g.locked = false; setAnim(g, "idle"); }
    return;
  }
  if (!g.grounded) { setAnim(g, g.vy < 0 ? "jump_up" : "fall"); return; }
  const moving = input.left || input.right;
  if (moving) g.walked = true;
  /* ladowanie: trzymasz kierunek -> rozbieg (Walk start),
     puszczony kierunek przy predkosci -> hamowanie (Walk stop), inaczej Land */
  if (g.anim === "jump_up" || g.anim === "fall") {
    setAnim(g, moving ? "walk_start" : Math.abs(g.vx) > WALK_STOP_VX ? "walk_stop" : "land");
    return;
  }
  if (!g.landDone) {
    if (moving && g.anim === "land") setAnim(g, "walk_start");   // strzalka w trakcie Land -> idzie
    else if (!animDone(g)) return;
    g.landDone = true;                             // = NotifyLandAnimationFinished()
  }
  /* swobodne chodzenie (platforma startowa) */
  if (moving) {
    if (g.anim === "walk_start" && animDone(g)) setAnim(g, "walk");
    else if (g.anim !== "walk" && g.anim !== "walk_start") setAnim(g, "walk_start");
  } else if (g.anim === "walk" || g.anim === "walk_start") setAnim(g, "walk_stop");
  else if (g.anim !== "walk_stop" || animDone(g)) setAnim(g, "idle");
}

/* Start: po Hello mozna pochodzic po platformie startowej.
   Skok, gdy gracz puscil kierunek i postac wyhamowala do Idle, albo po 2 s bez ruchu. */
function startReady(g) {
  if (input.left || input.right) return false;
  return g.walked ? g.anim === "idle" : g.groundT > START_WAIT;
}

/* Wybicie + dymek w miejscu skoku (JumpPuffSpawner) */
function doJump(g, v) {
  g.vy = g.vy0 = v - Math.abs(g.vx) * JUMP_SPEED_BONUS;
  g.grounded = false; g.groundPl = null; g.groundT = 0; g.landDone = false;
  g.dusts.push({ x: g.px + g.pw / 2, y: g.py + g.ph, t: 0 });
  setAnim(g, "jump_up");
}

/* --------------------------------------------------------------------------
   OSTROSC POSTACI
   Arkusz PNG ma inny rozmiar niz postac na ekranie, wiec przegladarka
   skalowala go w kazdej klatce + rysowala na ulamkowych pozycjach -> blur.
   Rozwiazanie: po fit() "wypiekamy" kazdy arkusz do canvasu w DOKLADNYM
   rozmiarze ekranowym (z uwzglednieniem DPR), skalujac stopniowo co 1/2
   (najczystsza redukcja). W grze rysujemy go 1:1, bez wygladzania,
   na pozycjach zaokraglonych do pelnego piksela ekranu.
   -------------------------------------------------------------------------- */
const PL_BAKED = {};
let PL_BAKED_DPR = 0;
function bakePlayer() {
  if (PL_BAKED_DPR === DPR) return;
  let all = true;
  for (const name in PA) {
    const m = PA[name], im = IMG["pl_" + name];
    if (!im || !im.complete || !im.naturalWidth) { all = false; continue; }
    const tw = Math.max(1, Math.round(m.w * PL_SCALE * DPR));
    const th = Math.max(1, Math.round(m.h * PL_SCALE * DPR));
    const rows = Math.ceil(m.count / m.cols);
    /* stopniowa redukcja calego arkusza (bez odstepow miedzy klatkami
       nie da sie - wiec redukujemy kazda klatke osobno) */
    const out = document.createElement("canvas");
    out.width = m.cols * tw; out.height = rows * th;
    const oc = out.getContext("2d");
    oc.imageSmoothingEnabled = true; oc.imageSmoothingQuality = "high";
    let tmp = document.createElement("canvas"), tc = tmp.getContext("2d");
    for (let f = 0; f < m.count; f++) {
      const sx = (f % m.cols) * (m.fw + m.gap), sy = Math.floor(f / m.cols) * (m.fh + m.gap);
      let src = im, x = sx, y = sy, w = m.fw, h = m.fh;
      while (w / 2 >= tw && h / 2 >= th) {          // polowienie
        const nw = Math.round(w / 2), nh = Math.round(h / 2);
        const c = document.createElement("canvas"); c.width = nw; c.height = nh;
        const cc = c.getContext("2d");
        cc.imageSmoothingEnabled = true; cc.imageSmoothingQuality = "high";
        cc.drawImage(src, x, y, w, h, 0, 0, nw, nh);
        src = c; x = 0; y = 0; w = nw; h = nh;
      }
      oc.drawImage(src, x, y, w, h, (f % m.cols) * tw, Math.floor(f / m.cols) * th, tw, th);
    }
    PL_BAKED[name] = { c: out, tw, th };
  }
  if (all) PL_BAKED_DPR = DPR;               // wszystko gotowe -> nie powtarzaj
}
const snap = v => Math.round(v * DPR) / DPR;        // pelny piksel ekranu

/* Rysuje klatke `name`: stopy w (cx, cy) w ukladzie logicznym, face = 1 / -1 */
function drawAnim(name, f, feetY, cx, cy, face) {
  const m = PA[name], b = PL_BAKED[name];
  if (!m || !b) return;
  const w = b.tw / DPR, h = b.th / DPR;
  let ox = (m.ox - m.srcW / 2) * PL_SCALE;
  if (face < 0) ox = -ox - w;                        // lustro wzgledem srodka
  const x = snap(cx + ox), y = snap(cy + (m.oy - feetY) * PL_SCALE);
  const sx = (f % m.cols) * b.tw, sy = Math.floor(f / m.cols) * b.th;
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  if (face < 0) {
    ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1);
    ctx.drawImage(b.c, sx, sy, b.tw, b.th, 0, 0, w, h);
    ctx.restore();
  } else ctx.drawImage(b.c, sx, sy, b.tw, b.th, x, y, w, h);
  ctx.imageSmoothingEnabled = prev;
}
function drawPlayer(g) {
  const f = animFrame(g);
  const cx = g.px + g.pw / 2, cy = g.py + g.ph;
  if (g.shield > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy - 50, 52, 0, 7);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 4;
    ctx.globalAlpha = .45 + Math.sin(performance.now() / 90) * .3;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  /* bez obrotu w locie - obrot zawsze rozmywa pixel-art */
  if (g.mult > 0) { ctx.shadowColor = KFC; ctx.shadowBlur = 26; }
  drawAnim(g.anim, f, PL_FEET_Y, cx, cy, g.face);
  ctx.shadowBlur = 0;
}
function drawPuffs(g) {
  const m = PA.puff_v1;
  for (const d of g.dusts) {
    const f = Math.floor(d.t * PL_FPS.puff_v1 / 60 / m.step);
    if (f >= m.count) continue;
    drawAnim("puff_v1", f, m.oy + m.h, d.x, d.y, 1);   // dol dymka = stopy
  }
}
function drawDrone(e) {
  const im = IMG.drone_sheet;
  if (!im || !im.complete) return;
  const f = Math.floor(e.anim / 3) % 2;
  ctx.drawImage(im, f * DRONE_FW, 0, DRONE_FW, DRONE_FH,
                e.x, e.y, e.w, e.w * DRONE_FH / DRONE_FW);
}

function rrp(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}

/**
 * HUD ograniczony do minimum wymaganego w briefie: wynik, wysokosc,
 * licznik punktow GAME ON. Paski kolekcji sa dodatkiem - bez nich
 * gracz nie wie, czego mu brakuje do domkniecia zestawu.
 */
const HUD_LEFT = 62;
function drawHud(g) {
  ctx.save();
  const grd = ctx.createLinearGradient(0, 0, 0, 104);
  grd.addColorStop(0, "rgba(12,20,52,.5)");
  grd.addColorStop(1, "rgba(12,20,52,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, 104);

  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.font = "900 31px Arial, sans-serif";
  /* x = HUD_LEFT: miejsce na strzalke powrotu (#btn-game-back) w rogu */
  ctx.fillText(Math.floor(g.score).toLocaleString("pl-PL"), HUD_LEFT, 42);
  ctx.font = "700 10px Arial, sans-serif";
  ctx.globalAlpha = .75;
  ctx.fillText("WYNIK", HUD_LEFT, 58);
  ctx.globalAlpha = 1;

  ctx.textAlign = "right";
  ctx.font = "900 23px Arial, sans-serif";
  ctx.fillText(Math.floor(g.alt / 10) + " m", W - 15, 40);
  ctx.font = "700 10px Arial, sans-serif";
  ctx.globalAlpha = .75;
  ctx.fillText("WYSOKOŚĆ", W - 15, 56);
  ctx.globalAlpha = 1;

  /* licznik punktow GAME ON */
  ctx.textAlign = "center";
  const go = Math.min(Math.floor(g.score / GO_RATE), Math.max(0, GO_DAILY_CAP - goToday));
  ctx.fillStyle = "rgba(34,224,255,.18)";
  rrp(W / 2 - 54, 14, 108, 27, 13); ctx.fill();
  ctx.strokeStyle = "rgba(34,224,255,.6)"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = NEON;
  ctx.font = "900 14px Arial, sans-serif";
  ctx.fillText("GAME ON  +" + go, W / 2, 33);

  /* paski kolekcji */
  let bx = 15, by = 68;
  for (const b of ["msi", "intel", "kfc"]) {
    const s = SETS[b];
    const have = Math.min(g.col[b].size, s.need);
    const full = g.done[b];
    const bw = 132, cellW = (bw - 6) / s.need;
    ctx.fillStyle = "rgba(12,20,52,.45)";
    rrp(bx, by, bw, 17, 7); ctx.fill();
    for (let i = 0; i < s.need; i++) {
      ctx.fillStyle = i < have ? s.color : "rgba(255,255,255,.22)";
      rrp(bx + 3 + i * cellW, by + 3, cellW - 3, 11, 4); ctx.fill();
    }
    ctx.fillStyle = full ? s.color : "rgba(255,255,255,.9)";
    ctx.font = "900 9px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(s.label + (full ? " ✓" : ""), bx + 3, by + 27);
    bx += bw + 8;
    if (bx + 132 > W) { bx = 15; by += 30; }
  }

  ctx.textAlign = "left";
  if (g.mult > 0) {
    ctx.fillStyle = KFC;
    rrp(15, 102, 120, 25, 12); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "900 12px Arial, sans-serif";
    ctx.fillText("x3 PUNKTY  " + g.mult.toFixed(1) + "s", 25, 119);
  }

  if (g.combo >= 2) {
    ctx.textAlign = "center";
    ctx.fillStyle = GOLD;
    ctx.font = "900 26px Arial, sans-serif";
    ctx.fillText("PERFECT x" + g.combo, W / 2, 170);
  }

  /* strefa zagrozenia u dolu ekranu */
  if (g.warn > .05) {
    ctx.globalAlpha = g.warn * .85;
    const s = 22, off = (performance.now() / 22) % (s * 2);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, H - 24, W, 24); ctx.clip();
    ctx.fillStyle = "#fff"; ctx.fillRect(0, H - 24, W, 24);
    ctx.fillStyle = MSI;
    for (let x = -s * 2; x < W + s * 2; x += s * 2) {
      ctx.beginPath();
      ctx.moveTo(x + off, H - 24); ctx.lineTo(x + off + s, H - 24);
      ctx.lineTo(x + off + s - 13, H); ctx.lineTo(x + off - 13, H);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* komunikat o zbyt slabym urzadzeniu */
  if (g.lowFps >= 3) {
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(12,20,52,.72)";
    rrp(W / 2 - 138, H - 92, 276, 34, 12); ctx.fill();
    ctx.fillStyle = "#ffc0c8";
    ctx.font = "700 11px Arial, sans-serif";
    ctx.fillText("Niska wydajność urządzenia (" + Math.round(g.fps) + " FPS)", W / 2, H - 70);
  }
  ctx.restore();
}

/* ==========================================================================
   GLOWNA PETLA
   requestAnimationFrame dziala zawsze (takze na ekranach menu),
   ale przetwarzanie nastepuje tylko w stanie "play".
   ========================================================================== */
function loop(now) {
  requestAnimationFrame(loop);
  pollPad();
  if (screen !== "play") return;
  const g = G;
  const dt = clamp((now - g.last) / 16.667, 0, 2.4);
  g.last = now;

  update(dt, now);

  ctx.save();
  if (g.shakeT > 0) ctx.translate(rnd(-4, 4), rnd(-4, 4));

  drawBg(g);
  for (const pl of g.platforms) drawPlat(pl);
  for (const it of g.items) drawItem(it);
  for (const e of g.enemies) drawDrone(e);

  for (const p of g.parts) {
    const im = IMG[p.img];
    if (!im || !im.complete) continue;
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.drawImage(im, -p.s / 2, -p.s / 2, p.s, p.s);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  drawPuffs(g);
  ctx.globalAlpha = 1;
  drawPlayer(g);

  ctx.textAlign = "left";
  for (const p of g.pops) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.font = `900 ${p.size}px Arial, sans-serif`;
    ctx.fillStyle = "rgba(12,20,52,.5)";
    ctx.fillText(p.txt, p.x + 1.5, p.y + 1.5);
    ctx.fillStyle = p.c;
    ctx.fillText(p.txt, p.x, p.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  drawHud(g);
}

/* ==========================================================================
   STEROWANIE
   --------------------------------------------------------------------------
   Zgodnie z rekomendacja: skok jest AUTOMATYCZNY, gracz steruje wylacznie
   lewo/prawo. Na dotyku dzielimy ekran na dwie polowy.
   Mapa `touches` przechowuje kazdy palec osobno - dzieki temu przesuniecie
   palca z lewej na prawa strone dziala bez podnoszenia go, a drugi palec
   nie kasuje pierwszego (typowy blad przy obsludze multi-touch).
   ========================================================================== */
/* --------------------------------------------------------------------------
   ZRODLA WEJSCIA (jak w Delivery Rush / Maze)
   Kazde zrodlo ma wlasny stan, a input.left/right to ich suma, liczona
   w kazdej klatce (syncInput). Dzieki temu puszczenie klawisza nie kasuje
   trzymanego D-pada, a odlaczenie pada nie zostawia "wiszacego" kierunku.
   -------------------------------------------------------------------------- */
const SRC = { key: { l: false, r: false }, touch: { l: false, r: false },
              mouse: { l: false, r: false }, pad: { l: false, r: false } };
function syncInput() {
  input.left = SRC.key.l || SRC.touch.l || SRC.mouse.l || SRC.pad.l;
  input.right = SRC.key.r || SRC.touch.r || SRC.mouse.r || SRC.pad.r;
}
function clearInput() {
  for (const k in SRC) SRC[k].l = SRC[k].r = false;
  touches.clear();
  syncInput();
}
const isTyping = e => {
  const t = e.target, tag = (t && t.tagName || "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || (t && t.isContentEditable);
};

addEventListener("keydown", e => {
  if (isTyping(e)) return;
  if (["ArrowLeft", "a", "A"].includes(e.key)) SRC.key.l = true;
  if (["ArrowRight", "d", "D"].includes(e.key)) SRC.key.r = true;
  if (e.key === "Escape" || e.key === "p" || e.key === "P") {
    if (screen === "play") askExit(); else if (screen === "confirm") resumeGame();
  }
  if ((e.key === " " || e.key === "Enter") && (screen === "start" || screen === "over")) {
    e.preventDefault(); play(); return;
  }
  if (["ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  syncInput();
}, { passive: false });

addEventListener("keyup", e => {
  if (isTyping(e)) return;
  if (["ArrowLeft", "a", "A"].includes(e.key)) SRC.key.l = false;
  if (["ArrowRight", "d", "D"].includes(e.key)) SRC.key.r = false;
  syncInput();
});
addEventListener("blur", clearInput);

const touches = new Map();
const side = cx => {
  const r = cv.getBoundingClientRect();
  return (cx - r.left) < r.width / 2 ? "left" : "right";
};
function applyTouches() {
  SRC.touch.l = SRC.touch.r = false;
  for (const s of touches.values()) {
    if (s === "left") SRC.touch.l = true; else SRC.touch.r = true;
  }
  syncInput();
}
const tSet = e => {
  if (screen !== "play") return;
  for (const t of e.changedTouches) touches.set(t.identifier, side(t.clientX));
  applyTouches(); e.preventDefault();
};
const tEnd = e => {
  for (const t of e.changedTouches) touches.delete(t.identifier);
  applyTouches(); e.preventDefault();
};
cv.addEventListener("touchstart", tSet, { passive: false });
cv.addEventListener("touchmove", tSet, { passive: false });
cv.addEventListener("touchend", tEnd, { passive: false });
cv.addEventListener("touchcancel", tEnd, { passive: false });

/* mysz - wygoda na desktopie */
cv.addEventListener("mousedown", e => {
  if (screen !== "play") return;
  if (side(e.clientX) === "left") SRC.mouse.l = true; else SRC.mouse.r = true;
  syncInput();
});
addEventListener("mouseup", () => { SRC.mouse.l = SRC.mouse.r = false; syncInput(); });

/* --------------------------------------------------------------------------
   GAMEPAD (MSI Claw / handheldy) - port z input.js Delivery Rush
   Gamepady nie wysylaja zdarzen - odpytujemy je w petli loop(), ktora
   dziala zawsze (takze na ekranach menu).
   Standardowe mapowanie W3C:
     buttons[14] / [15]  D-pad lewo / prawo      buttons[12] / [13] gora / dol
     axes[0]             LEWY analog X           axes[2] PRAWY analog X
     buttons[0] A = potwierdz   buttons[1] B = wstecz   buttons[9] Start = pauza
   Czytamy OBA analogi - prawy dziala tak samo jak lewy.
   -------------------------------------------------------------------------- */
const PAD_DEAD = 0.35;
let padSeen = false, padPrev = [];
function padPressed(gp, i) { const b = gp.buttons && gp.buttons[i]; return !!(b && b.pressed); }
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null;
  for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
  if (!gp) {
    if (SRC.pad.l || SRC.pad.r) { SRC.pad.l = SRC.pad.r = false; syncInput(); }
    return;
  }
  if (!padSeen) { padSeen = true; document.body.classList.add("has-gamepad"); if (screen !== "play") focusPrimary(); }

  /* kierunek: D-pad ma priorytet, potem lewy, potem prawy analog */
  let l = padPressed(gp, 14), r = padPressed(gp, 15);
  if (!l && !r && gp.axes) {
    for (const ax of [0, 2]) {
      const v = gp.axes[ax] || 0;
      if (Math.abs(v) >= PAD_DEAD) { if (v < 0) l = true; else r = true; break; }
    }
  }
  if (l !== SRC.pad.l || r !== SRC.pad.r) { SRC.pad.l = l; SRC.pad.r = r; syncInput(); }

  /* przyciski - reagujemy na moment WCISNIECIA, nie na trzymanie */
  const now = [], hit = i => { now[i] = padPressed(gp, i); return now[i] && !padPrev[i]; };
  const A = hit(0), B = hit(1), START = hit(9);
  const UP = hit(12), DOWN = hit(13), LEFT = hit(14), RIGHT = hit(15);
  const axY = gp.axes ? (gp.axes[1] || gp.axes[3] || 0) : 0;
  now.axUp = axY < -0.6; now.axDown = axY > 0.6;
  const AXUP = now.axUp && !padPrev.axUp, AXDOWN = now.axDown && !padPrev.axDown;
  padPrev = now;

  if (screen === "play") {
    if (START || B) askExit();
    return;
  }
  /* menu: strzalki zmieniaja fokus, A klika, B = wstecz */
  if (UP || AXUP || LEFT) moveFocus(-1);
  if (DOWN || AXDOWN || RIGHT) moveFocus(1);
  if (A || (START && screen !== "confirm")) clickFocus();
  if (B) {
    if (screen === "confirm") resumeGame();
    else if (screen === "start") goExit();
    else if (screen === "over") toStart();
  }
}

/* fokus przyciskow w aktywnej warstwie (dla pada i klawiatury) */
function layerButtons() {
  const id = screen === "confirm" ? "confirm" : screen;
  const el = document.getElementById(id);
  return el ? [...el.querySelectorAll("button:not(.hidden)")].filter(b => b.offsetParent) : [];
}
function moveFocus(d) {
  const bs = layerButtons(); if (!bs.length) return;
  let i = bs.indexOf(document.activeElement);
  i = i < 0 ? 0 : (i + d + bs.length) % bs.length;
  bs[i].focus();
}
function clickFocus() {
  const bs = layerButtons(); if (!bs.length) return;
  const f = bs.includes(document.activeElement) ? document.activeElement
          : (bs.find(b => b.classList.contains("primary")) || bs[0]);
  f.click();
}
function focusPrimary() {
  requestAnimationFrame(() => {
    const bs = layerButtons();
    const f = bs.find(b => b.classList.contains("primary")) || bs[0];
    if (f) f.focus({ preventScroll: true });
  });
}

/* ==========================================================================
   PRZELACZANIE EKRANOW
   Menu to warstwy DOM nad canvasem - taniej niz rysowanie UI w canvasie
   i pozwala uzyc natywnego tekstu (ostry na kazdym DPI).
   ========================================================================== */
const BACK_URL = "";                 // dokad prowadzi strzalka z ekranu startowego ("" = historia)
function show(which) {
  for (const id of ["start", "over", "confirm"])
    document.getElementById(id).classList.toggle("hidden", which !== id);
  document.body.dataset.screen = screen;
  if (which !== "none" && padSeen) focusPrimary();   // ramka fokusu tylko przy padzie
}
function play() {
  clearInput();
  reset();
  screen = "play";
  show("none");
}
function toStart() { screen = "start"; show("start"); }
function goExit() {
  if (BACK_URL) location.href = BACK_URL; else history.back();
}
/* pauza + potwierdzenie wyjscia (jak #screen-confirm w Delivery Rush) */
function askExit() {
  if (screen !== "play") return;
  clearInput();
  screen = "confirm";
  show("confirm");
}
function resumeGame() {
  if (screen !== "confirm") return;
  clearInput();
  screen = "play";
  if (G) G.last = performance.now();         // bez skoku czasu po pauzie
  show("none");
}
document.getElementById("btn-play").addEventListener("click", play);
document.getElementById("btn-again").addEventListener("click", play);
document.getElementById("btn-confirm-yes").addEventListener("click", toStart);
document.getElementById("btn-confirm-no").addEventListener("click", resumeGame);
document.getElementById("btn-game-back").addEventListener("click", askExit);
document.getElementById("btn-start-back").addEventListener("click", goExit);
document.getElementById("btn-over-back").addEventListener("click", toStart);
document.addEventListener("visibilitychange", () => { if (document.hidden) askExit(); });

/* Hook diagnostyczny - aktywny tylko gdy ustawiono window.__GOT_DEBUG__
   przed zaladowaniem skryptu. Uzywany przez automatyczne testy
   (bot sterujacy) i przy strojeniu balansu. W produkcji nieaktywny. */
if (typeof window !== "undefined" && window.__GOT_DEBUG__) {
  window.__GOT__ = {
    get state() { return G; },
    get input() { return input; },
    SETS, play
  };
}

/* --- start --- */
loadAll(() => {
  fit();
  const e = document.getElementById("best-start");
  if (e) e.textContent = best.toLocaleString("pl-PL");
  const l = document.getElementById("go-left");
  if (l) l.textContent = Math.max(0, GO_DAILY_CAP - goToday);
  document.getElementById("loading").style.display = "none";
  show("start");
  requestAnimationFrame(loop);
});

})();
