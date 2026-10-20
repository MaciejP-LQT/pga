/* =========================================================
   config.js — liczby, flagi i dane encji gry

   ZASADA: tu nie ma tekstów interfejsu (przyciski, komunikaty,
   opisy ekranów) — te są w texts.js.

   WYJĄTEK: nazwy przedmiotów (ITEMS[].label, PENALTY_LABEL,
   BOOST_LABEL, SLOW_LABEL). To nie jest copy UI, tylko atrybut
   encji gry — food.js i powerups.js czytają je bezpośrednio
   przy tworzeniu obiektów. Przeniesienie ich do texts.js
   wymagałoby przepisania tych modułów bez żadnego zysku.

   ⚠ UWAGA NA TYPY:
   FLASH_* muszą być STRINGAMI z kolorem — effects.js podaje je
   wprost do ctx.fillStyle. Liczba nie rzuci błędu, tylko cicho
   wyłączy efekt.

   =========================================================
   ZMIANY W TEJ WERSJI (balans trudności wg feedbacku)

   1. SPEEDUP_EVERY_ITEMS zamiast SPEEDUP_EVERY_POINTS —
      przyspieszenie liczy się od liczby zjedzonych elementów,
      nie od punktów. Wcześniej combo/boost windowały tempo
      przyspieszenia niezależnie od realnej liczby ruchów gracza.

   2. COMBO_TURN_LIMIT zamiast COMBO_WINDOW_MS — combo wygasa
      po N skrętach bez jedzenia, nie po czasie. Jazda na wprost
      nie zużywa limitu.

   3. JOY_STEP_PX_MIN / JOY_DEAD_ZONE_MIN — próg swipe'a maleje
      wraz ze wzrostem prędkości gry, żeby fizyczny czas potrzebny
      na zarejestrowanie skrętu nie rósł względem coraz krótszego
      kroku gry (główna przyczyna "rozbijania się o ścianę").

   4. SLOW_RAMP_MS / SLOW_RESTORE_MAX_WAIT_MS — powrót z efektu
      spowolnienia jest teraz płynny i uruchamia się dopiero przy
      najbliższym skręcie gracza (nie w środku prostej), z limitem
      bezpieczeństwa na wypadek jazdy bez skrętów.
   ========================================================= */
window.CONFIG = {
    /* Panel diagnostyczny FPS - wlacz tylko podczas testow. */
    DEBUG_PERFORMANCE: false,
    DEBUG_PERFORMANCE_REFRESH_MS: 500,


    /* =====================================================
       PLANSZA I TEMPO
       ===================================================== */

    /* Liczba kratek = TRUDNOŚĆ gry.
       Musi być IDENTYCZNA na każdym urządzeniu, bo ranking
       i progi nagród są wspólne dla kiosku, konsoli i telefonów.
       Dlatego AUTO_TILE_COUNT jest wyłączone. */
    TILE_COUNT: 12,
    AUTO_TILE_COUNT: false,

    /* używane tylko przy AUTO_TILE_COUNT: true */
    TILE_COUNT_MOBILE: 14,
    TILE_COUNT_SMALL: 12,

    START_STEP_MS: 200,          // czas na krok węża (mniej = szybciej)
    MIN_STEP_MS: 55,             // najszybsze tempo

    /* Co ile ZJEDZONYCH ELEMENTÓW (nie punktów) tempo rośnie.
       8 zamiast dawnych "co 5 punktów" — przy elementach wartych
       1/3/5 pkt i comboX/boostX2 stare progi mijały się bardzo
       szybko, dając wrażenie gwałtownego przyspieszenia już
       po 5-6 zjedzonych sztukach. */
    SPEEDUP_EVERY_ITEMS: 8,
    SPEEDUP_MS: 8,                // o ile ms krok skraca się na każdym progu

    /* Ile segmentów ma wąż na starcie.
       BEZ TEGO KLUCZA snake.js tworzy pustą tablicę cells
       i gra wywala się przy pierwszym kroku. */
    START_LENGTH: 3,

    COUNTDOWN_STEP_MS: 700,
    COUNTDOWN_ON_RESUME: true,
    AUTO_START_DIR: { x: 1, y: 0 },

    /* =====================================================
       PRZEDMIOTY

       key MUSI odpowiadać kluczowi w assets.js:
         item-1, item-2, item-3, penalty, boost, slow
       Inna nazwa = sprite się nie załaduje i rysuje się
       zastępczy kwadrat.
       ===================================================== */

    ITEMS: [
        { key:'item-1', label:'Frytki', points:1, grow:1, weight:58, color:'#FFD54F' },
        { key:'item-2', label:'Napój',  points:3, grow:2, weight:30, color:'#E4002B' },
        { key:'item-3', label:'Lody',   points:5, grow:3, weight:12, color:'#FFF1E2' }
    ],

    PENALTY_ENABLED: true,
    PENALTY_LABEL: 'Przypalone',
    PENALTY_AFTER_SCORE: 5,
    PENALTY_CHANCE: 0.35,
    PENALTY_LIFETIME_MS: 6000,
    PENALTY_POINTS: -3,
    PENALTY_SHRINK: 2,
    PENALTY_COLOR: '#6d4c41',

    /* =====================================================
       WZMOCNIENIA
       ===================================================== */

    BOOST_ENABLED: true,
    BOOST_LABEL: 'Boost',
    BOOST_MULTIPLIER: 2,
    BOOST_DURATION_MS: 7000,
    BOOST_FIRST_AT_SCORE: 3,
    BOOST_FIRST_DELAY_MS: 4000,
    BOOST_EVERY_MS: 11000,
    BOOST_LIFETIME_MS: 7000,
    BOOST_COLOR: '#F7B600',
    BOOST_PULSE_MS: 620,

    SLOW_ENABLED: true,
    SLOW_LABEL: 'Spowolnienie',
    SLOW_FACTOR: 1.85,
    SLOW_DURATION_MS: 6000,
    SLOW_FIRST_AT_SCORE: 12,
    SLOW_FIRST_DELAY_MS: 6000,
    SLOW_EVERY_MS: 15000,
    SLOW_LIFETIME_MS: 6500,
    SLOW_COLOR: '#90CAF9',
    SLOW_PULSE_MS: 900,

    /* Powrót do normalnej prędkości po wygaśnięciu spowolnienia:
       - nie następuje natychmiast w środku prostej, tylko przy
         najbliższym skręcie gracza (mniej zaskakujące)
       - gdy jednak nastąpi, jest PŁYNNY (ramp), nie skokowy
       - SLOW_RESTORE_MAX_WAIT_MS to bezpiecznik: jeśli gracz
         długo nie skręca, restart i tak następuje po tym czasie,
         żeby efekt nie trwał w nieskończoność */
    SLOW_RAMP_MS: 900,
    SLOW_RESTORE_MAX_WAIT_MS: 1200,

    /* COMBO — aktywne dopóki gracz nie wykona więcej niż
       COMBO_TURN_LIMIT zmian kierunku bez zjedzenia kolejnego
       elementu. Jazda na wprost NIE zużywa limitu — dzięki temu
       combo zależy od decyzji gracza, nie od zegara ani od tego,
       jak szybko akurat leci wąż. */
    COMBO_ENABLED: true,
    COMBO_TURN_LIMIT: 4,
    COMBO_MIN: 2,
    COMBO_MAX: 5,

    /* =====================================================
       MRUGANIE WĘŻA
       ===================================================== */

    BLINK_MIN_DELAY_MS: 1800,
    BLINK_MAX_DELAY_MS: 5200,
    BLINK_HALF_MS: 55,
    BLINK_CLOSED_MS: 95,
    BLINK_DOUBLE_CHANCE: 0.22,

    /* =====================================================
       EFEKTY
       ===================================================== */

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
    SHAKE_EAT_MS: 90,       SHAKE_EAT_POWER: 1.6,
    SHAKE_BOOST_MS: 200,    SHAKE_BOOST_POWER: 4.5,
    SHAKE_SLOW_MS: 160,     SHAKE_SLOW_POWER: 2.5,
    SHAKE_PENALTY_MS: 260,  SHAKE_PENALTY_POWER: 7,
    SHAKE_DEATH_MS: 420,    SHAKE_DEATH_POWER: 11,

    /* ⚠ STRINGI, nie liczby — idą wprost do ctx.fillStyle */
    FLASH_BOOST:   'rgba(247,182,0,.30)',
    FLASH_SLOW:    'rgba(144,202,249,.26)',
    FLASH_PENALTY: 'rgba(255,87,34,.38)',
    FLASH_DEATH:   'rgba(244,67,54,.50)',
    FLASH_MS: 320,

    /* =====================================================
       STEROWANIE
       ===================================================== */

    /* Wartości BAZOWE (przy starcie gry, stepMs = START_STEP_MS).
       Malej ą automatycznie wraz ze wzrostem prędkości — patrz
       JOY_STEP_PX_MIN / JOY_DEAD_ZONE_MIN poniżej. game.js
       nadpisuje CONFIG.JOY_STEP_PX i CONFIG.JOY_DEAD_ZONE
       w locie; input.js zawsze czyta aktualną wartość. */
    JOY_DEAD_ZONE: 14,           // px na PIERWSZY skręt w geście
    JOY_MAX_RADIUS: 46,          // promień joysticka (bez zmian niezależnie od prędkości)
    JOY_STEP_PX: 18,             // px na kolejne skręty bez podnoszenia palca
    JOY_AXIS_BIAS: 1.3,          // przewaga osi wymagana do skrętu

    /* Wartości PRZY MAKSYMALNEJ prędkości (stepMs = MIN_STEP_MS).
       Mniejszy fizyczny dystans = szybsza rejestracja skrętu,
       co kompensuje krótszy czas na reakcję przy szybkiej grze.
       To bezpośrednia odpowiedź na "rozbijam się o ścianę" —
       nie zmienia zasad kolizji, tylko przywraca proporcję między
       czasem potrzebnym na wykonanie skrętu a czasem trwania kroku. */
    JOY_STEP_PX_MIN: 9,
    JOY_DEAD_ZONE_MIN: 7,

    GAMEPAD_ENABLED: true,
    PAD_DEAD_ZONE: 0.5,

    HAPTIC_FEEDBACK: true,
    HAPTIC_MS: 8,             // zmiana kierunku
    HAPTIC_ITEM_MS: 50,       // jedzenie i wzmocnienia
    HAPTIC_PENALTY_MS: 150,   // czerwony X

    SHOW_THUMB_ZONE: true,
    THUMB_ZONE_ON_DESKTOP: false,

    /* =====================================================
       INTEGRACJA Z API
       ===================================================== */
    API_SOURCE_DEFAULT: 'web',
    API_ENABLED: true,
    API_BASE_URL: 'https://gameon-api.liquidthread.pl',
    API_GAME_ID: 1,
    API_CLIENT_TAG: 'snake',
    API_TIMEOUT_MS: 8000,
    API_MAX_ATTEMPTS: 8,

    /* Jak długo licznik rankingu jest uznawany za świeży (ms).
     Chroni przed podwójnym zapytaniem boot() -> home.enter(). */
    RANKING_TTL_MS: 3000,
    IDLE_TIMEOUT_MS: 10000,
    IDLE_TIMEOUT_SEC: 0,
    /* =====================================================
       EKRANY I NAWIGACJA
       ===================================================== */

    LOADER_MIN_MS: 600,

    SHOW_BACK_BUTTON: true,
    BACK_URL: '',

    HIDE_RANKING_IF_EMPTY: true,
    TOP_SIZE: 10,
    TOP_PREVIEW_SIZE: 5,

    LOSE_REDIRECT_SEC: 0,
   
    /* Auto-powrót do menu z ekranu końcowego (sekundy). 0 = wyłączone.
     Przy wygranej licznik zatrzymuje się, gdy gracz cokolwiek kliknie —
     nie chcemy wyrzucać kogoś, kto właśnie wpisuje nick. */
    WIN_REDIRECT_SEC: 0,

    ASK_FOR_NICK: true,
    NICK_MIN_LENGTH: 2,
    NICK_MAX_LENGTH: 20,
    NICK_MIN_SCORE: 1,

    SHOW_PRIZE_SCREEN: true,
    PRIZE_ALLOW_COPY: true,
    PRIZE_ALLOW_DOWNLOAD: true,

    /* =====================================================
       WYGLĄD
       ===================================================== */

    SHOW_LOGO_MAIN: true,
    LOGO_MAIN_MODE: 'reverse',
    LOGO_MAIN_FILE: 'assets/images/logo-visa.png',
    LOGO_MAIN_FILE_COLOR: 'assets/images/logo-visa.png',
    LOGO_PLATE_PADDING: 14,
    LOGO_PLATE_PADDING_SMALL: 8,
    LOGO_CORNER_OPACITY: 0.5,

    LEGEND_MODE: 'compact',
    SHOW_BEST: false,

    SHOW_HINT_ON_DESKTOP: true,
    HINT_VISIBLE_MS: 2600
};

/* =========================================================
   USUNIĘTE KLUCZE (zastąpione powyżej)

   SPEEDUP_EVERY_POINTS  → SPEEDUP_EVERY_ITEMS (liczy zjedzone, nie punkty)
   COMBO_WINDOW_MS       → COMBO_TURN_LIMIT (liczy skręty, nie czas)

   Jeśli gdzieś jeszcze odwołujesz się do starych kluczy poza
   game.js (np. w ui.js do wyświetlania paska czasu combo),
   zamień na odczyt turnsSinceEat/COMBO_TURN_LIMIT z Game —
   patrz sekcja "opcjonalny licznik combo" w CZYTAJ.md.
   ========================================================= */
