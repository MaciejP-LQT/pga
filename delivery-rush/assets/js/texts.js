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
        back:        '‹ Wróć',
        home:        'MENU',
        play:        'GRAJ',
        playAgain:   'ZAGRAJ PONOWNIE',
        ranking:     'RANKING',
        howToPlay:   'ZASADY GRY',
        close:       'ZAMKNIJ',
        loading:     'Wczytuję…',
        score:       'Wynik',
        best:        'Rekord',
        level:       'Poziom',
        idleTimer:   'Powrót za {sec} s'
    },
    /* ---------- 1. LOADER ---------- */
    loader: {
        title:   'DELIVERY RUSH',
        message: 'Przygotowuję grę…',
        assets:  'Wczytuję grafiki…',
        api:     'Łączę z serwerem…'
    },
    /* ---------- 2. HOME ---------- */
    home: {
        title:    'Delivery Rush',
        subtitle: 'Zbieraj punkty i wygrywaj nagrody'
    },
    /* ---------- 3. HOW TO PLAY ---------- */
  
    howto: {
        title: 'ZASADY GRY',
        /* Każdy element = jeden punkt listy; znaczniki b dozwolone. */
        rules: [
            'Steruj skuterem za pomocą ekranu dotykowego, strzałek na klawiaturze lub pada.',
            'Zbieraj zamówienia, każde daje punkty i wydłuża kolejkę toreb.',
            'Nie uderzaj w ścianę ani we własny ogon.',
            'Zamówienia zbieraj najkrótszą drogą, by budować Combo (do x5) - po 5 skrętach bez odbioru zamówienia mnożnik przepada!',
            'Błękitne pole z zegarem spowalnia grę, a czerwone pole z X odejmuje 3 punkty.',
            'Visa: <b>2x punkty</b>.'
        ],
        prizesTitle: 'PUNKTACJA I NAGRODY',
        prizesText: 'Im wyższy wynik, tym więcej punktów otrzymasz w GameON. ' +
                    'Kod odbierzesz bezpośrednio po zakończeniu gry. ' +
                    'Zgromadzone punkty możesz wymienić na dostępną nagrodę ' +
                    'lub zachować i zbierać dalej na nagrody z wyższych progów.'
    },
    /* ---------- 4. RANKING ---------- */
    ranking: {
        title:      'RANKING',
        empty:      'Brak wyników — zagraj pierwszą grę!',
        unavailable:'Ranking chwilowo niedostępny.',
        offline:    'Brak połączenia — ranking niedostępny.',
        yourResult: 'Twój wynik',
        colRank:    '#',
        colNick:    'Gracz',
        colScore:   'Punkty'
    },
    /* ---------- 5. GAME ---------- */
    game: {
        countdown:  ['3', '2', '1', 'START!'],
        hintTouch:  'Dotknij i przeciągnij w dowolnym miejscu',
        hintMouse:  'Strzałki, WASD albo przeciągnij myszą',
        hintPad:    'Steruj D-padem lub gałką',
        thumbZone:  'Strefa sterowania',
        /* combo ZAWSZE z dopiskiem "COMBO" — samo "x2" jest zarezerwowane dla Visy */
        combo:      'COMBO x{mult}',
        comboTag:   'COMBO x{mult}',
        /* Visa: wyskakujący napis po zebraniu karty, dopisek przy jedzeniu,
           etykieta paska i podpis w legendzie */
        visaPop:    'x{mult} PUNKTY',
        visaTag:    'VISA x{mult}',
        visaBar:    'x{mult}',
        visaLegend: 'Karta Visa'
    },
     /* ---------- potwierdzenie wyjścia z gry ---------- */
    confirm: {
        title:   'KONIEC GRY?',
        message: 'Twój wynik nie zostanie zapisany. ' +
                 'Czy na pewno chcesz wrócić do menu?',
        yes:     'TAK, WYJDŹ',
        no:      'NIE, GRAM DALEJ'
    },
    /* ---------- 6. GAMEEND ---------- */
    gameend: {
        /* gracz nie osiągnął PRIZE_MIN_SCORE lub nie zdobył punktów */
        timer: 'Powrót do menu za {sec} s',
        lose: {
            title:   'KONIEC GRY',
            message: 'Upss! Tym razem się nie udało, ' +
                     'ale nic straconego — spróbuj ponownie.'
        },
        /* gracz zdobył punkty i osiągnął PRIZE_MIN_SCORE */
        win: {
            title:     'BRAWO!',
            score:     'Twój wynik: {score}',
            subtitle:  'Odbierz punkty w GameON lub zapisz wynik w rankingu.',
            savedInfo: 'Twój wynik jest w rankingu. Odbierz nagrodę!',
            prize:     'ODBIERZ PUNKTY',
            addRank:   'ZAPISZ WYNIK'
        },
    },
    /* ---------- 7. ADDTORANKING ---------- */
    addrank: {
        savedTitle: 'WYNIK ZAPISANY!',
        title:       'ZAPISZ WYNIK',
        score:       'Twój wynik: {score}',
        info:        'Wpisz nick, pod którym zapiszemy Twój wynik. ' +
                     'Nicki z wulgaryzmami będą usuwane.',
        placeholder: 'Twój nick',
        add:         'ZAPISZ',
        saving:      'Zapisuję…',
        savedAt:     'Miejsce {position} w rankingu',
        savedPlain:  'Wynik zapisany',
        alreadySaved:'Ten wynik jest już w rankingu',
        queued:      'Wynik zostanie zapisany po odzyskaniu połączenia',
        errEmpty:    'Wpisz nick.',
        errTooShort: 'Nick musi mieć co najmniej {min} znaki.',
        errNickNotAllowed: 'Ten pseudonim nie może zostać opublikowany. Wpisz inny pseudonim.',
        errNickFormat: 'Pseudonim może zawierać 2-20 znaków: litery, cyfry, spacje, kropkę, myślnik i znak podkreślenia.',
        errModerationUnavailable: 'Nie udało się teraz sprawdzić pseudonimu. Spróbuj ponownie.',
        errNotEligible: 'Ta rozgrywka nie kwalifikuje się do zapisania w rankingu.',
        errRetry:    'Nie udało się zapisać wyniku. Spróbuj ponownie.',
    },
    /* ---------- 8. PRIZE ---------- */
    prize: {
        title:      'TWÓJ KOD',
        codeLabel:  'Kod nagrody',
        hint:       'Skopiuj kod albo pobierz go, żeby nie zgubić nagrody.',
        noCode:     'Nagrody zostały na dziś wyczerpane.',  
        copy:       'Kopiuj kod',
        copied:     'Skopiowano!',
        download:   'Pobierz',
        downloadPdf:'Pobierz PDF',
        downloadImg:'Pobierz obrazek',
        backToEnd:  'WRÓĆ',
        footer:     'Kod jednorazowy',
        loading:        'Pobieram kod…',
        errNoCodes:     'Kody chwilowo niedostępne. Spróbuj ponownie później.',
        errDisabled:    'Wydawanie nagród jest chwilowo wstrzymane.',
        errGeneric:     'Nie udało się pobrać kodu. Spróbuj ponownie.',
        errExpired:     'Czas na odebranie nagrody minął.',
        errNotEligible: 'Ta rozgrywka nie kwalifikuje się do nagrody.',
        errNetwork:     'Brak połączenia. Sprawdź internet i spróbuj ponownie.'
    },
    /* ---------- 9. ERROR ---------- */
    error: {
        title:      'COŚ POSZŁO NIE TAK',
        quit:       'ZAMKNIJ',
        retry:      'SPRÓBUJ PONOWNIE',
        /* komunikaty wg kodu błędu z API */
        noFreeCode: 'Nagrody zostały chwilowo wyczerpane. ' +
                    'Spróbuj ponownie za chwilę.',
        network:    'Brak połączenia z serwerem. ' +
                    'Sprawdź sieć i spróbuj ponownie.',
        generic:    'Nie udało się rozpocząć gry. Spróbuj ponownie.',
        apiDown:    'Serwer nie odpowiada. Poproś obsługę o pomoc.'
    }
};
/* =========================================================
   T() — pobranie tekstu z podmianą placeholderów
   ========================================================= */
window.T = function (path, vars) {
    const parts = String(path).split('.');
    let node = window.TEXTS;
    for (const p of parts) {
        if (node == null || typeof node !== 'object') { node = undefined; break; }
        node = node[p];
    }
    /* brak klucza — zwracamy go w nawiasach, żeby było widać w UI */
    if (node === undefined) {
        console.warn('[T] brak tekstu:', path);
        return '[' + path + ']';
    }
    if (Array.isArray(node)) return node;
    if (typeof node !== 'string') return node;
    if (!vars) return node;
    return node.replace(/\{(\w+)\}/g, (m, k) =>
        vars[k] !== undefined ? vars[k] : m);
};
