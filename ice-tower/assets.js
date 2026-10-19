/* Mapa assetow: klucz -> sciezka do PNG.
   PNG-i sa zapisane w rozdzielczosci 3x wiekszej niz rozmiar rysowania
   (stala RES w generatorach = ASSET_RES w game.js) i skwantyzowane
   do palety - styl B ma malo kolorow, wiec strata jest niewidoczna. */
window.ASSETS = {
  "bb_intel_l": "assets/bb_intel_l.png",
  "bb_intel_r": "assets/bb_intel_r.png",
  "bb_kfc_l": "assets/bb_kfc_l.png",
  "bb_kfc_r": "assets/bb_kfc_r.png",
  "bb_msi_l": "assets/bb_msi_l.png",
  "bb_msi_r": "assets/bb_msi_r.png",
  "bg_city": "assets/bg_city.png",
  "bg_cloud": "assets/bg_cloud.png",
  "bg_tower": "assets/bg_tower.png",
  "char_idle": "assets/char_idle.png",
  "char_sheet": "assets/char_sheet.png",
  "drone_sheet": "assets/drone_sheet.png",
  "dust_sheet": "assets/dust_sheet.png",
  "it_bucket": "assets/it_bucket.png",
  "it_burger": "assets/it_burger.png",
  "it_chip": "assets/it_chip.png",
  "it_core": "assets/it_core.png",
  "it_cpu": "assets/it_cpu.png",
  "it_cup": "assets/it_cup.png",
  "it_fries": "assets/it_fries.png",
  "it_keyboard": "assets/it_keyboard.png",
  "it_laptop": "assets/it_laptop.png",
  "it_monitor": "assets/it_monitor.png",
  "it_mouse": "assets/it_mouse.png",
  "it_star": "assets/it_star.png",
  "it_strips": "assets/it_strips.png",
  "p_blue": "assets/p_blue.png",
  "p_gold": "assets/p_gold.png",
  "p_lime": "assets/p_lime.png",
  "p_neon": "assets/p_neon.png",
  "p_red": "assets/p_red.png",
  "p_white": "assets/p_white.png",
  "plat_break": "assets/plat_break.png",
  "plat_cloud": "assets/plat_cloud.png",
  "plat_kfc": "assets/plat_kfc.png",
  "plat_move": "assets/plat_move.png",
  "plat_normal": "assets/plat_normal.png",
  "plat_spring": "assets/plat_spring.png"
};

/* === POSTAC Z UNITY (wygenerowane przez pack_sprites.py) === */
window.ASSETS["pl_fall"] = "assets/player/fall.png";
window.ASSETS["pl_hello"] = "assets/player/hello.png";
window.ASSETS["pl_idle"] = "assets/player/idle.png";
window.ASSETS["pl_jump_up"] = "assets/player/jump_up.png";
window.ASSETS["pl_land"] = "assets/player/land.png";
window.ASSETS["pl_puff_v1"] = "assets/player/puff_v1.png";
window.ASSETS["pl_walk"] = "assets/player/walk.png";
window.ASSETS["pl_walk_start"] = "assets/player/walk_start.png";
window.ASSETS["pl_walk_stop"] = "assets/player/walk_stop.png";
window.PLAYER_ATLAS = {
  "fall": {
    "count": 5,
    "cols": 5,
    "fw": 162,
    "fh": 296,
    "gap": 2,
    "ox": 196,
    "oy": 78,
    "w": 325,
    "h": 592,
    "srcW": 720,
    "srcH": 720,
    "step": 1
  },
  "hello": {
    "count": 70,
    "cols": 24,
    "fw": 168,
    "fh": 288,
    "gap": 2,
    "ox": 152,
    "oy": 87,
    "w": 336,
    "h": 575,
    "srcW": 720,
    "srcH": 720,
    "step": 1
  },
  "idle": {
    "count": 26,
    "cols": 26,
    "fw": 142,
    "fh": 284,
    "gap": 2,
    "ox": 200,
    "oy": 93,
    "w": 285,
    "h": 568,
    "srcW": 720,
    "srcH": 720,
    "step": 1
  },
  "jump_up": {
    "count": 31,
    "cols": 18,
    "fw": 214,
    "fh": 314,
    "gap": 2,
    "ox": 93,
    "oy": 41,
    "w": 428,
    "h": 627,
    "srcW": 720,
    "srcH": 720,
    "step": 1
  },
  "land": {
    "count": 12,
    "cols": 12,
    "fw": 186,
    "fh": 290,
    "gap": 2,
    "ox": 166,
    "oy": 95,
    "w": 371,
    "h": 579,
    "srcW": 720,
    "srcH": 720,
    "step": 1
  },
  "puff_v1": {
    "count": 32,
    "cols": 17,
    "fw": 226,
    "fh": 178,
    "gap": 2,
    "ox": 110,
    "oy": 74,
    "w": 451,
    "h": 357,
    "srcW": 720,
    "srcH": 480,
    "step": 1
  },
  "walk": {
    "count": 26,
    "cols": 24,
    "fw": 168,
    "fh": 285,
    "gap": 2,
    "ox": 180,
    "oy": 102,
    "w": 337,
    "h": 570,
    "srcW": 720,
    "srcH": 720,
    "step": 1
  },
  "walk_start": {
    "count": 9,
    "cols": 9,
    "fw": 136,
    "fh": 282,
    "gap": 2,
    "ox": 208,
    "oy": 99,
    "w": 272,
    "h": 563,
    "srcW": 720,
    "srcH": 720,
    "step": 1
  },
  "walk_stop": {
    "count": 17,
    "cols": 17,
    "fw": 164,
    "fh": 282,
    "gap": 2,
    "ox": 184,
    "oy": 100,
    "w": 329,
    "h": 563,
    "srcW": 720,
    "srcH": 720,
    "step": 1
  }
};
