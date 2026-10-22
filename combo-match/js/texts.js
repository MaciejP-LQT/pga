/* =========================================================
   texts.js — WSZYSTKIE teksty w jednym miejscu

   Zasada: w kodzie nie ma żadnych stringów widocznych dla gracza.
   Zmiana copy = edycja tego pliku, bez dotykania logiki.

   UŻYCIE:
     T('home.play')                      → "GRAJ"
     T('gameend.win.title', {score: 42}) → "Brawo! Zdobyłeś 42 pkt"

   PLACEHOLDERY: {nazwa} w tekście, podmieniane z drugiego argumentu.
   Brakujący klucz zwraca sam klucz w nawiasach — łatwo wyłapać literówkę.
   ========================================================= */
window.TEXTS = {
  /* ---------- wspólne ---------- */
  common: {
    back: "‹ Wróć",
    home: "MENU",
    play: "GRAJ",
    playAgain: "ZAGRAJ PONOWNIE",
    ranking: "RANKING",
    howToPlay: "ZASADY GRY",
    close: "ZAMKNIJ",
    loading: "Wczytuję…",
    score: "Punkty",
    idleTimer: "Powrót za {sec} s",
  },

  /* ---------- 1. LOADER ---------- */
  loader: {
    title:
      '<span class="title-blue">COMBO</span> <span class="title-gold">MATCH</span>',
    message: "Przygotowuję grę…",
    assets: "Wczytuję grafiki…",
    api: "Łączę z serwerem…",
  },

  /* ---------- 2. HOME ---------- */
  home: {
    title:
      '<span class="title-blue">COMBO</span> <span class="title-gold">MATCH</span>',
    subtitle: "Odkrywaj pary, zapamiętuj układy, zdobywaj nagrody!",
  },

  /* ---------- 3. HOW TO PLAY ---------- */
  howto: {
    title: "ZASADY GRY",

    rules: [
      "Odkrywaj karty po dwie — szukaj identycznych par.",
      "Za każdą dopasowaną parę dostajesz <b>10 punktów × bonus</b>.",
      "Trafienia z rzędu dają <b>bonus ×3</b> — pudło resetuje go.",
      "Każdy etap ma limit czasu — graj szybko i precyzyjnie!",
      "Im dalej zajdziesz, tym więcej kart na planszy i mniej czasu na odkrycie.",
    ],
    prizesTitle: 'NAGRODY',
    prizesText: 'Im wyższy wynik w grze, tym wyższa wartość otrzymanego kodu. ' +
                'W GameON możesz aktywować tylko 1 kod dziennie, ' +
                'dlatego najlepiej wykorzystaj kod o najwyższej wartości. ' +
                'Zgromadzoną pulę możesz wymienić na nagrodę lub zbierać dalej.',
  },

  /* ---------- 4. RANKING ---------- */
  ranking: {
    title: "RANKING",
    empty: "Brak wyników — zagraj pierwszą grę!",
    unavailable: "Ranking chwilowo niedostępny.",
    offline: "Brak połączenia — ranking niedostępny.",
    yourResult: "Twój wynik",
  },

  /* ---------- 5. GAME ---------- */
  game: {
    stage: "Etap {n}",
    stageComplete: "🏆 Etap {n} ukończony!",
    nextStage: "Przechodzisz do Etapu {n}",
    nextStageBtn: "NASTĘPNY ETAP",
    finishOnlyBtn: "ZAKOŃCZ",
    finishBtn: "ZAKOŃCZ I ODBIERZ NAGRODY",
    timeUp: "Czas minął!",
  },

  /* ---------- potwierdzenie wyjścia z gry ---------- */
  confirm: {
    title: "KONIEC GRY?",
    message:
      "Twój wynik nie zostanie zapisany. " +
      "Czy na pewno chcesz wrócić do menu?",
    yes: "TAK, WYJDŹ",
    no: "NIE, GRAM DALEJ",
  },

  /* ---------- 6. GAMEEND ---------- */
  gameend: {
    timer: "Powrót do menu za {sec} s",

    lose: {
      title: "KONIEC GRY",
      message: "Czas minął! Spróbuj ponownie — " + "z każdą grą jest łatwiej.",
    },

    win: {
      title: "BRAWO!",
      score: "Twój wynik: {score}",
      subtitle: "Odbierz nagrodę albo zapisz się w rankingu.",
      savedInfo: "Twój wynik jest w rankingu. Odbierz nagrodę!",
      prize: "ODBIERZ NAGRODĘ",
      addRank: "ZAPISZ WYNIK",
    },
  },

  /* ---------- 7. ADDTORANKING ---------- */
  addrank: {
    title: "ZAPISZ WYNIK",
    score: "Twój wynik: {score}",
    info:
      "Wpisz nick, pod którym zapiszemy Twój wynik. " +
      "Nicki z wulgaryzmami będą usuwane.",
    placeholder: "Twój nick",
    add: "ZAPISZ",
    saving: "Zapisuję…",
    savedAt: "Miejsce {position} w rankingu",
    savedPlain: "Wynik zapisany",
    alreadySaved: "Ten wynik jest już w rankingu",
    errEmpty: "Wpisz nick.",
    errTooShort: "Nick musi mieć co najmniej {min} znaki.",

    errNickNotAllowed:
      "Ten pseudonim nie może zostać opublikowany. Wpisz inny pseudonim.",
    errNickFormat:
      "Pseudonim może zawierać 2-20 znaków: litery, cyfry, spacje, kropkę, myślnik i znak podkreślenia.",
    errModerationUnavailable:
      "Nie udało się teraz sprawdzić pseudonimu. Spróbuj ponownie.",
    errNotEligible: "Ta rozgrywka nie kwalifikuje się do zapisania w rankingu.",
    errRetry: "Nie udało się zapisać. Spróbuj ponownie.",
  },

  /* ---------- 8. PRIZE ---------- */
  prize: {
    gameTitle: "COMBO MATCH",
    title: "TWOJA NAGRODA",
    codeLabel: "Twój kod",
    hint: "Skopiuj kod  i wykorzystaj go w GameON. Możesz też pobrać voucher.",
    hintCopyOnly: "Skopiuj kod i wykorzystaj go w GameON.",
    copy: "Kopiuj kod",
    copied: "Skopiowano!",
    download: "Pobierz",

    loading: "Pobieram kod…",
    errNoCodes: "Kody chwilowo niedostępne. Zgłoś się do obsługi stoiska.",
    errDisabled: "Wydawanie nagród jest wstrzymane. Zgłoś się do obsługi.",
    errExpired: "Czas na odebranie nagrody minął.",
    errNotEligible: "Ta rozgrywka nie kwalifikuje się do nagrody.",
    errNetwork: "Brak połączenia. Sprawdź internet i spróbuj ponownie.",
    errGeneric: "Nie udało się pobrać kodu. Zgłoś się do obsługi.",
  },

  /* ---------- 9. ERROR ---------- */
  error: {
    title: "COŚ POSZŁO NIE TAK",
    quit: "ZAMKNIJ",
    retry: "SPRÓBUJ PONOWNIE",

    noFreeCode:
      "Nagrody zostały chwilowo wyczerpane. " + "Spróbuj ponownie za chwilę.",
    network:
      "Brak połączenia z serwerem. " + "Sprawdź sieć i spróbuj ponownie.",
    generic: "Nie udało się rozpocząć gry. Spróbuj ponownie.",
    apiDown: "Serwer nie odpowiada. Poproś obsługę o pomoc.",
  },
};

/* =========================================================
   T() — pobranie tekstu z podmianą placeholderów
   ========================================================= */
window.T = function (path, vars) {
  const parts = String(path).split(".");
  let node = window.TEXTS;

  for (const p of parts) {
    if (node == null || typeof node !== "object") {
      node = undefined;
      break;
    }
    node = node[p];
  }

  if (node === undefined) {
    console.warn("[T] brak tekstu:", path);
    return "[" + path + "]";
  }

  if (Array.isArray(node)) return node;
  if (typeof node !== "string") return node;

  if (!vars) return node;

  return node.replace(/\{(\w+)\}/g, (m, k) =>
    vars[k] !== undefined ? vars[k] : m,
  );
};
