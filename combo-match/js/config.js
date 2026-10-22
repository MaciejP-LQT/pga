/* =========================================================
   config.js — konfiguracja gry Memory

   Liczby, flagi, dane encji i ustawienia API.
   Teksty interfejsu → texts.js.
   ========================================================= */
window.CONFIG = {
  /* =====================================================
       KARTY — obrazki do dopasowania
       Pula „k" i pula „v" — na planszy zawsze połowa z każdej.
       ===================================================== */
  CARD_IMAGES_K: [
    { id: "card-1k", src: "assets/card-1k.jpg" },
    { id: "card-2k", src: "assets/card-2k.jpg" },
    { id: "card-3k", src: "assets/card-3k.jpg" },
    { id: "card-4k", src: "assets/card-4k.jpg" },
    { id: "card-5k", src: "assets/card-5k.jpg" },
    { id: "card-6k", src: "assets/card-6k.jpg" },
    { id: "card-7k", src: "assets/card-7k.jpg" },
    { id: "card-8k", src: "assets/card-8k.jpg" },
  ],

  CARD_IMAGES_V: [
    { id: "card-1v", src: "assets/card-1v.jpg" },
    { id: "card-2v", src: "assets/card-2v.jpg" },
    { id: "card-3v", src: "assets/card-3v.jpg" },
    { id: "card-4v", src: "assets/card-4v.jpg" },
    { id: "card-5v", src: "assets/card-5v.jpg" },
    { id: "card-6v", src: "assets/card-6v.jpg" },
    { id: "card-7v", src: "assets/card-7v.jpg" },
    { id: "card-8v", src: "assets/card-8v.jpg" },
  ],

  /* =====================================================
       PUNKTACJA
       ===================================================== */
  POINTS_BASE: 10,
  MAX_MULTIPLIER: 3,

  /* =====================================================
       ETAPY
       Etap 1 = Łatwy  (3×3, 4 pary,  40 s)
       Etap 2 = Normalny (3×4, 6 par,  50 s)
       Etap 3+ = Trudny  (4×4, 8 par, 100 s)
       ===================================================== */
  STAGES: [
    { cols: 3, rows: 3, pairs: 4, timeLimit: 40 },
    { cols: 3, rows: 4, pairs: 6, timeLimit: 50 },
    { cols: 4, rows: 4, pairs: 8, timeLimit: 100 },
    { cols: 4, rows: 4, pairs: 8, timeLimit: 90 },
    { cols: 4, rows: 4, pairs: 8, timeLimit: 75 },
    { cols: 4, rows: 4, pairs: 8, timeLimit: 60 },
    { cols: 4, rows: 4, pairs: 8, timeLimit: 50 },
    { cols: 4, rows: 4, pairs: 8, timeLimit: 40 },
    { cols: 4, rows: 4, pairs: 8, timeLimit: 35 },
  ],

  /* =====================================================
       INTEGRACJA Z API
       ===================================================== */
  API_SOURCE_DEFAULT: "web",
  API_ENABLED: true,
  API_BASE_URL: "https://gameon-api.liquidthread.pl",
  API_GAME_ID: 3,
  API_CLIENT_TAG: "memory",
  API_TIMEOUT_MS: 8000,
  API_MAX_ATTEMPTS: 8,

  /* =====================================================
       RANKING
       ===================================================== */
  RANKING_TTL_MS: 3000,
  HIDE_RANKING_IF_EMPTY: true,
  TOP_SIZE: 10,

  /* =====================================================
       EKRANY I NAWIGACJA
       ===================================================== */
  LOADER_MIN_MS: 600,

  SHOW_BACK_BUTTON: true,
  BACK_URL: "",

  IDLE_TIMEOUT_MS: 20000,
  IDLE_TIMEOUT_SEC: 20,

  LOSE_REDIRECT_SEC: 20,
  WIN_REDIRECT_SEC: 30,

  ASK_FOR_NICK: true,
  NICK_MIN_LENGTH: 2,
  NICK_MAX_LENGTH: 20,
  NICK_MIN_SCORE: 1,

  /* Minimalny wynik dla komunikatu wygranej i odbioru nagrody (włącznie).
     Nadal wymagana jest zgoda API na wydanie nagrody. */
  PRIZE_MIN_SCORE: 200,
  SHOW_PRIZE_SCREEN: true,
  PRIZE_ALLOW_COPY: true,
  /* ?hideDownload=1 w URL ukrywa przycisk „Pobierz” także przy włączonej fladze. */
  PRIZE_ALLOW_DOWNLOAD: true,
};
