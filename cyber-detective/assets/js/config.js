/* =========================================================
   config.js - liczby, flagi i dane encji gry (Maze)

   ZASADA (jak w Snake): brak tekstow UI - te sa w texts.js.
   WYJATEK: ITEMS[].label (atrybut encji gry).
   ========================================================= */
window.CONFIG = {


   FIXED_LAYOUT_LEVELS: 8,
   FIXED_LEVEL_SEEDS: [3277, 2984, 3021, 1843, 617, 3897, 2458, 3374],

    LEVEL_CLEAR_DELAY_MS: 1800,   // pauza po zjedzeniu ostatniej lupy (ms)
    LEVEL_CLEAR_BONUS: 100,       // bonus za wyczyszczenie labiryntu

   /* ---------- LABIRYNT I TEMPO ---------- */
    MAZE_COLS: 13, MAZE_ROWS: 13,   // jedna plansza dla wszystkich rozdzielczosci
    MAZE_COLS_MOBILE: 13, MAZE_ROWS_MOBILE: 13,
    AUTO_MAZE_SIZE: false,          // false = zawsze MAZE_COLS x MAZE_ROWS

    HERO_STEP_MS: 155,
    DRONE_STEP_MS: 165,
    SPEEDUP_EVERY_LEVEL: 8,
    MIN_STEP_MS: 80,          // = MinEventSpacingMs w DictGame

    COUNTDOWN_STEP_MS: 700,
    COUNTDOWN_ON_RESUME: true,

    /* ---------- ZYCIA ---------- */
    LIVES: 3,
    DEATH_PAUSE_MS: 1400,

    /* ---------- DRONY ---------- */
    DRONE_COUNT: 2,                // 13x13: 2 drony (3 = trudniej)
    DRONE_RELEASE_MS: 2600,
    DRONE_RESPAWN_MS: 4000,
    DRONE_WEAK_SLOWDOWN: 1.7,
    DRONE_RANDOMNESS: 0.12,
    PATROL_TRIGGER: 6,
    DRONE_SAFE_DISTANCE: 6,       // min. odleglosc (kroki) drona od gracza przy pojawieniu
    DRONE_SPAWN_GRACE_MS: 1200,   // ile ms swiezy dron jest niegrozny (miga)
    HERO_SHIELD_MS: 2000,         // oslona gracza po odrodzeniu / starcie poziomu
    /* ---------- TOKENY ---------- */
    TOKEN_POINTS: 1,
    TOKEN_COLOR: '#F7B600',

    /* ---------- PRZEDMIOTY ---------- */
    ITEMS: [
        { key: 'item-1', label: 'Frytki', points: 10, weight: 58, color: '#FFD54F' },
        { key: 'item-2', label: 'Napój',  points: 25, weight: 30, color: '#E4002B' },
        { key: 'item-3', label: 'Lody',   points: 50, weight: 12, color: '#FFF1E2' }
    ],
    ITEM_EVERY_MS: 9000,
    ITEM_LIFETIME_MS: 7000,

    /* ---------- BOOST ---------- */
    BOOST_ENABLED: true,
    BOOST_LABEL: 'Boost',
    BOOST_COUNT: 2,                // karty Visa na planszy
    BOOST_DURATION_MS: 7000,
    BOOST_MULTIPLIER: 2,
    BOOST_COLOR: '#F7B600',
    BOOST_PULSE_MS: 620,
    CAPTURE_POINTS: [100, 200, 400, 800],   // max = MaxSingleEventValue w DictGame

    /* ---------- SLOW ---------- */
    SLOW_ENABLED: true,
    SLOW_LABEL: 'Spowolnienie',
    SLOW_COUNT: 1,
    SLOW_FACTOR: 2.25,
    SLOW_DURATION_MS: 6000,
    SLOW_COLOR: '#90CAF9',
    SLOW_PULSE_MS: 900,

    /* ---------- EFEKTY ---------- */
    PARTICLES_ENABLED: true,
    PARTICLE_COUNT: 9,
    PARTICLE_LIFE_MS: 520,
    PARTICLE_SPEED: 3.4,
    PARTICLE_GRAVITY: 6.5,
    PARTICLE_MAX: 160,

    FLOATERS_ENABLED: true,
    FLOATER_LIFE_MS: 800,
    FLOATER_RISE: 1.5,

    SHAKE_ENABLED: true,
    SHAKE_EAT_MS: 70,       SHAKE_EAT_POWER: 1.2,
    SHAKE_BOOST_MS: 200,    SHAKE_BOOST_POWER: 4.5,
    SHAKE_SLOW_MS: 160,     SHAKE_SLOW_POWER: 2.5,
    SHAKE_CAPTURE_MS: 220,  SHAKE_CAPTURE_POWER: 5.5,
    SHAKE_DEATH_MS: 460,    SHAKE_DEATH_POWER: 12,

    /* STRINGI, nie liczby - ida wprost do ctx.fillStyle */
    FLASH_BOOST: 'rgba(247,182,0,.30)',
    FLASH_SLOW:  'rgba(144,202,249,.26)',
    FLASH_DEATH: 'rgba(244,67,54,.52)',
    FLASH_MS: 320,

    BLINK_MIN_DELAY_MS: 1800,
    BLINK_MAX_DELAY_MS: 5200,
    BLINK_CLOSED_MS: 110,

    /* ---------- STEROWANIE ---------- */
    JOY_DEAD_ZONE: 14,
    JOY_MAX_RADIUS: 46,
    SHOW_THUMB_ZONE: true,

    /* ---------- INTEGRACJA Z API ---------- */
    API_SOURCE_DEFAULT: 'web',
    API_ENABLED: true,
    API_BASE_URL: 'https://gameon-api.liquidthread.pl',
    API_GAME_ID: 2,            // Id gry "maze" w DictGame
    API_CLIENT_TAG: 'maze',
    API_TIMEOUT_MS: 8000,
    API_MAX_ATTEMPTS: 8,

    RANKING_TTL_MS: 3000,

    /* ---------- EKRANY I NAWIGACJA ---------- */
    LOADER_MIN_MS: 600,
    SHOW_BACK_BUTTON: true,
    BACK_URL: '',

    HIDE_RANKING_IF_EMPTY: true,
    TOP_SIZE: 10,

    IDLE_TIMEOUT_SEC: 0,
    LOSE_REDIRECT_SEC: 0,
    WIN_REDIRECT_SEC: 0,

    ASK_FOR_NICK: true,
    NICK_MIN_LENGTH: 2,
    NICK_MAX_LENGTH: 20,
    NICK_MIN_SCORE: 1,

    SHOW_PRIZE_SCREEN: true,
    PRIZE_ALLOW_COPY: true,
    PRIZE_ALLOW_DOWNLOAD: true,

    /* ---------- WYGLAD ---------- */
    SHOW_LOGO_MAIN: true,
    LOGO_MAIN_MODE: 'reverse',
    LOGO_MAIN_FILE: 'assets/images/logo-visa.png',
    LOGO_MAIN_FILE_COLOR: 'assets/images/logo-visa.png',
    LOGO_PLATE_PADDING: 14,
    LOGO_PLATE_PADDING_SMALL: 8,
    LOGO_CORNER_OPACITY: 0.5,

    SHOW_HINT_ON_DESKTOP: true,
    HINT_VISIBLE_MS: 2600
};
