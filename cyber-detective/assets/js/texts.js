/* =========================================================
   texts.js - wszystkie teksty interfejsu (Maze)
   T(key, vars) czyta sciezke kropkowa i podstawia {zmienne}.
   ========================================================= */
window.TEXTS = {

    common: {
        back:      '\u2039 Wróć',
        home:      'MENU',
        play:      'GRAJ',
        playAgain: 'ZAGRAJ PONOWNIE',
        ranking:   'RANKING',
        howToPlay: 'ZASADY GRY',
        close:     'ZAMKNIJ',
        loading:   'Wczytuję…',
        idleTimer: 'Powrót za {sec} s',
        score:     'Wynik',
        level:     'Poziom',
        lives:     'Życia'
    },

    loader: {
        title:   'Cyber Detective',
        message: 'Wczytuję grę…',
        assets:  'Wczytuję grafiki…',
        api:     'Łączę z serwerem…'
    },

    home: {
        title:    'Cyber\nDetective',
        subtitle: 'Zbieraj tokeny, unikaj dronów. Złote pole odwraca role.'
    },

    howto: {
        title: 'ZASADY GRY',
        rules: [
            'Steruj detektywem za pomocą ekranu dotykowego, strzałek na klawiaturze lub pada.',
            'Zbieraj tokeny i jedzenie — każde daje punkty.',
            'Unikaj dronów — dotknięcie kosztuje jedno życie.',
            'Złote pole pozwala <b>ścigać drony</b>, błękitne je spowalnia.',
            'Wyczyść labirynt z tokenów, aby przejść na kolejny poziom.'
        ],
        prizesTitle: 'NAGRODY',
        prizesText: 'Im wyższy wynik w grze, tym wyższa wartość otrzymanego kodu. ' +
                    'W GameON możesz aktywować tylko 1 kod dziennie, ' +
                    'dlatego najlepiej wykorzystaj kod o najwyższej wartości. ' +
                    'Zgromadzoną pulę możesz wymienić na nagrodę lub zbierać dalej.',
        chaseLabel:  'ścigasz'
    },

    ranking: {
        title:       'RANKING',
        unavailable: 'Ranking jest teraz niedostępny.',
        offline:     'Brak połączenia z rankingiem.',
        empty:       'Brak wyników — zagraj pierwszą grę!',
        yourResult:  'Twój wynik'
    },

    game: {
        countdown:  ['3', '2', '1', 'START!'],
        thumbZone:  'Strefa sterowania',
        hint:       'Dotknij i przeciągnij w dowolnym miejscu',
        hintTouch:  'Dotknij i przeciągnij w dowolnym miejscu',
        hintMouse:  'Strzałki, WASD albo przeciągnij myszą',
        hintPad:    'Steruj D-padem lub gałką',
        visaPop:    'VISA x{mult} PUNKTY',
        visaBar:    'VISA x{mult}',
        caught:     'ZŁAPANY!',
        mazeClear:  'POZIOM {level} ✔',
        levelClear: 'POZIOM {level}',
        chase:      'ŚCIGAJ',
        slow:       'SLOW'
    },

    gameend: {
        timer: 'Powrót do menu za {sec} s',
        /* gracz nie osiągnął PRIZE_MIN_SCORE lub nie zdobył punktów */
        lose: {
            title:   'KONIEC GRY',
            message: 'Upss! Tym razem się nie udało, ale nic straconego — spróbuj ponownie.'
        },
        /* gracz zdobył punkty i osiągnął PRIZE_MIN_SCORE */
        win: {
            title:     'BRAWO!',
            score:     'Twój wynik: {score}',
            subtitle:  'Odbierz punkty w GameON lub zapisz wynik w rankingu.',
            savedInfo: 'Twój wynik jest w rankingu. Odbierz nagrodę!',
            prize:     'ODBIERZ PUNKTY',
            addRank:   'ZAPISZ WYNIK'
        }
    },

    addrank: {
        savedTitle: 'WYNIK ZAPISANY!',
        title:       'ZAPISZ WYNIK',
        score:       'Twój wynik: {score}',
        info:        'Wpisz nick, pod którym zapiszemy Twój wynik.',
        placeholder: 'Twój nick',
        add:         'ZAPISZ',
        errEmpty:    'Wpisz nick, żeby zapisać wynik.',
        errTooShort: 'Nick musi mieć co najmniej {min} znaki.',
        saving:      'Zapisuję…',
        errNickNotAllowed:        'Ten pseudonim nie może zostać opublikowany. Wpisz inny pseudonim.',
        errNickFormat:            'Pseudonim może zawierać 2-20 znaków: litery, cyfry, spacje, kropkę, myślnik i znak podkreślenia.',
        errModerationUnavailable: 'Nie udało się teraz sprawdzić pseudonimu. Spróbuj ponownie.',
        errNotEligible:           'Ta rozgrywka nie kwalifikuje się do zapisania w rankingu.',
        savedAt:      'Zapisano! Miejsce {position} w rankingu.',
        savedPlain:   'Wynik zapisany.',
        alreadySaved: 'Twój wynik jest już w rankingu.',
        errRetry:     'Nie udało się zapisać wyniku. Spróbuj ponownie.'
    },

    prize: {
        title:     'TWÓJ KOD',
        codeLabel: 'Twój kod',
        hint:      'Zapisz kod i wykorzystaj go w aplikacji.',
        screenHint: 'Skopiuj kod i wykorzystaj go w GameON. Możesz też pobrać voucher.',
        voucherHint: 'Wykorzystaj ten kod w GameON.',
        copy:      'Kopiuj',
        copied:    'Skopiowano!',
        download:  'Pobierz jako obraz',
        loading:        'Pobieram kod…',
        footer:     'Kod jednorazowy',
        errNoCodes:     'Kody chwilowo niedostępne. Zgłoś się do obsługi stoiska.',
        errDisabled:    'Wydawanie nagród jest wstrzymane. Zgłoś się do obsługi.',
        errExpired:     'Czas na odebranie nagrody minął.',
        errNotEligible: 'Ta rozgrywka nie kwalifikuje się do nagrody.',
        errNetwork:     'Brak połączenia. Sprawdź internet i spróbuj ponownie.',
        errGeneric:     'Nie udało się pobrać kodu. Zgłoś się do obsługi.'
    },

    error: {
        title:      'COŚ POSZŁO NIE TAK',
        generic:    'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.',
        network:    'Brak połączenia z serwerem. Sprawdź internet.',
        noFreeCode: 'Kody chwilowo się skończyły. Zgłoś się do obsługi stoiska.',
        apiDown:    'Nie udało się połączyć z serwerem gry.',
        retry:      'SPRÓBUJ PONOWNIE',
        quit:       'ZAMKNIJ'
    },

    confirm: {
        title:   'KONIEC GRY?',
        message: 'Twój wynik nie zostanie zapisany. ' +
                 'Czy na pewno chcesz wrócić do menu?',
        yes:     'PRZERWIJ',
        no:      'WRÓĆ DO GRY'
    }
};

window.T = function (key, vars) {
    const parts = String(key).split('.');
    let node = window.TEXTS;
    for (const p of parts) {
        if (node == null) break;
        node = node[p];
    }
    if (node == null) {
        console.warn('[texts] brak klucza:', key);
        return key;
    }
    if (Array.isArray(node)) return node;
    if (typeof node === 'string' && vars) {
        return node.replace(/\{(\w+)\}/g, function (m, name) {
            return vars[name] !== undefined ? vars[name] : m;
        });
    }
    return node;
};
