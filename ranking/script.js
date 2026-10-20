/* =========================================================
   RANKING DISPLAY — Visa Games
   Rotacja rankingów: 8s na grę w pętli
   ========================================================= */
(function () {
  "use strict";

  const API_BASE = "https://gameon-api.liquidthread.pl/api/ranking-list";
  const TOP_N = 10;
  const TRANSITION_MS = 1200; // czas trwania animacji w ms

  /* -- Parametry URL: ?slide=10&refresh=15 (wartości w sekundach) -- */
  const _urlParams = new URLSearchParams(window.location.search);

  const _slideParam = parseFloat(_urlParams.get("slide"));
  const SLIDE_DURATION = Math.max(_slideParam > 0 ? _slideParam : 10, 3) * 1000; // min 3 s, domyślnie 10 s

  const _refreshParam = parseFloat(_urlParams.get("refresh"));
  const DATA_REFRESH_MS = Math.max(_refreshParam > 0 ? _refreshParam : 15, 5) * 1000; // min 5 s, domyślnie 15 s

  const DATA_REFRESH_SEC = Math.round(DATA_REFRESH_MS / 1000);

  const GAMES = [
    { id: 1, name: "Delivery Rush" },
    { id: 2, name: "Cyber Detective" },
    { id: 3, name: "Combo Match" },
    { id: 4, name: "Gaming Challenge" },
  ];

  const app = document.getElementById("ranking-app");

  let rankingData = {};
  let currentSlide = 0;
  let totalSlides = GAMES.length;
  let slideTimer = null;

  /* ---------------------------------------------------------
       PIXEL ART SVG ICONS (TOP 1 CROWN, TOP 2 & 3 TROPHIES)
       --------------------------------------------------------- */
  const SVG_CROWN_1 = `
    <svg class="pixel-art-icon" viewBox="0 0 56 44" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
        <!-- Floating Sparkles on left -->
        <rect x="1" y="18" width="3" height="3" fill="#FFE855" />
        <rect x="6" y="9" width="3" height="3" fill="#FFE855" />
        <rect x="4" y="10" width="7" height="1" fill="#FFE855" />
        <rect x="7" y="7" width="1" height="7" fill="#FFE855" />
        <rect x="11" y="2" width="3" height="3" fill="#FFE855" />

        <!-- Crown Black Outline -->
        <rect x="14" y="32" width="40" height="3" fill="#140d02" />
        <rect x="12" y="17" width="3" height="16" fill="#140d02" />
        <rect x="52" y="17" width="3" height="16" fill="#140d02" />

        <!-- Spikes Outline (5 Points) -->
        <rect x="12" y="14" width="5" height="3" fill="#140d02" />
        <rect x="15" y="11" width="5" height="3" fill="#140d02" />
        <rect x="18" y="8" width="6" height="3" fill="#140d02" />
        <rect x="24" y="11" width="4" height="3" fill="#140d02" />
        <rect x="28" y="14" width="4" height="3" fill="#140d02" />

        <!-- Tall Center Spike Outline -->
        <rect x="30" y="10" width="7" height="3" fill="#140d02" />
        <rect x="32" y="4" width="4" height="6" fill="#140d02" />
        <rect x="30" y="6" width="8" height="3" fill="#140d02" />

        <!-- Right Spikes Outline -->
        <rect x="35" y="14" width="4" height="3" fill="#140d02" />
        <rect x="39" y="11" width="4" height="3" fill="#140d02" />
        <rect x="43" y="8" width="6" height="3" fill="#140d02" />
        <rect x="47" y="11" width="5" height="3" fill="#140d02" />
        <rect x="50" y="14" width="5" height="3" fill="#140d02" />

        <!-- Gold Fill Base & Body -->
        <rect x="15" y="29" width="38" height="3" fill="#d18700" />
        <rect x="15" y="17" width="38" height="12" fill="#f8b612" />

        <!-- Spikes Fill -->
        <rect x="18" y="11" width="6" height="6" fill="#ffd33b" />
        <rect x="43" y="11" width="6" height="6" fill="#f8b612" />
        <rect x="31" y="7" width="6" height="10" fill="#ffe566" />
        <rect x="32" y="5" width="4" height="2" fill="#fff599" />
        <rect x="19" y="9" width="4" height="2" fill="#fff599" />

        <!-- Highlights & Shadow Accents -->
        <rect x="15" y="17" width="3" height="12" fill="#ffe566" />
        <rect x="49" y="17" width="4" height="12" fill="#ba7200" />
        <rect x="17" y="27" width="34" height="2" fill="#df9700" />

        <!-- Bold Digit "1" in the Center -->
        <rect x="32" y="17" width="5" height="11" fill="#140d02" />
        <rect x="29" y="18" width="3" height="4" fill="#140d02" />
        <rect x="28" y="26" width="14" height="2" fill="#140d02" />
    </svg>`;

  const SVG_TROPHY_2 = `
    <svg class="pixel-art-icon" viewBox="0 0 56 44" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
        <!-- Trophy Dark Outline -->
        <rect x="17" y="6" width="24" height="3" fill="#151d27" />
        <rect x="15" y="9" width="28" height="2" fill="#151d27" />

        <!-- Handles Outline -->
        <rect x="9" y="9" width="6" height="3" fill="#151d27" />
        <rect x="8" y="12" width="3" height="10" fill="#151d27" />
        <rect x="10" y="21" width="6" height="3" fill="#151d27" />
        <rect x="43" y="9" width="6" height="3" fill="#151d27" />
        <rect x="47" y="12" width="3" height="10" fill="#151d27" />
        <rect x="42" y="21" width="6" height="3" fill="#151d27" />

        <!-- Cup Outer Bowl -->
        <rect x="14" y="11" width="3" height="10" fill="#151d27" />
        <rect x="41" y="11" width="3" height="10" fill="#151d27" />
        <rect x="17" y="21" width="3" height="4" fill="#151d27" />
        <rect x="38" y="21" width="3" height="4" fill="#151d27" />
        <rect x="19" y="25" width="20" height="3" fill="#151d27" />

        <!-- Stem & Base Outline -->
        <rect x="25" y="28" width="8" height="4" fill="#151d27" />
        <rect x="18" y="32" width="22" height="4" fill="#151d27" />

        <!-- Silver Fills -->
        <rect x="11" y="12" width="4" height="9" fill="#d2dce6" />
        <rect x="43" y="12" width="4" height="9" fill="#8898a8" />

        <!-- Cup Body -->
        <rect x="17" y="11" width="24" height="10" fill="#c3d0dc" />
        <rect x="17" y="11" width="4" height="10" fill="#f0f5fa" />
        <rect x="37" y="11" width="4" height="10" fill="#7d8f9f" />
        <rect x="20" y="21" width="18" height="4" fill="#a4b4c4" />
        <rect x="26" y="28" width="6" height="4" fill="#c3d0dc" />
        <rect x="19" y="33" width="20" height="2" fill="#c3d0dc" />
        <rect x="19" y="33" width="4" height="2" fill="#f0f5fa" />
        <rect x="35" y="33" width="4" height="2" fill="#7d8f9f" />

        <!-- Bold Digit "2" in Center -->
        <rect x="26" y="13" width="7" height="2" fill="#151d27" />
        <rect x="31" y="15" width="2" height="3" fill="#151d27" />
        <rect x="26" y="17" width="6" height="2" fill="#151d27" />
        <rect x="25" y="19" width="2" height="2" fill="#151d27" />
        <rect x="25" y="21" width="8" height="2" fill="#151d27" />
    </svg>`;

  const SVG_TROPHY_3 = `
    <svg class="pixel-art-icon" viewBox="0 0 56 44" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
        <!-- Trophy Dark Outline -->
        <rect x="17" y="6" width="24" height="3" fill="#241005" />
        <rect x="15" y="9" width="28" height="2" fill="#241005" />

        <!-- Handles Outline -->
        <rect x="9" y="9" width="6" height="3" fill="#241005" />
        <rect x="8" y="12" width="3" height="10" fill="#241005" />
        <rect x="10" y="21" width="6" height="3" fill="#241005" />
        <rect x="43" y="9" width="6" height="3" fill="#241005" />
        <rect x="47" y="12" width="3" height="10" fill="#241005" />
        <rect x="42" y="21" width="6" height="3" fill="#241005" />

        <!-- Cup Outer Bowl -->
        <rect x="14" y="11" width="3" height="10" fill="#241005" />
        <rect x="41" y="11" width="3" height="10" fill="#241005" />
        <rect x="17" y="21" width="3" height="4" fill="#241005" />
        <rect x="38" y="21" width="3" height="4" fill="#241005" />
        <rect x="19" y="25" width="20" height="3" fill="#241005" />

        <!-- Stem & Base Outline -->
        <rect x="25" y="28" width="8" height="4" fill="#241005" />
        <rect x="18" y="32" width="22" height="4" fill="#241005" />

        <!-- Bronze Fills -->
        <rect x="11" y="12" width="4" height="9" fill="#d97f42" />
        <rect x="43" y="12" width="4" height="9" fill="#8a4014" />

        <!-- Cup Body -->
        <rect x="17" y="11" width="24" height="10" fill="#c97337" />
        <rect x="17" y="11" width="4" height="10" fill="#f5aa75" />
        <rect x="37" y="11" width="4" height="10" fill="#78330c" />
        <rect x="20" y="21" width="18" height="4" fill="#a85925" />
        <rect x="26" y="28" width="6" height="4" fill="#c97337" />
        <rect x="19" y="33" width="20" height="2" fill="#c97337" />
        <rect x="19" y="33" width="4" height="2" fill="#f5aa75" />
        <rect x="35" y="33" width="4" height="2" fill="#78330c" />

        <!-- Bold Digit "3" in Center -->
        <rect x="26" y="13" width="7" height="2" fill="#241005" />
        <rect x="31" y="14" width="2" height="3" fill="#241005" />
        <rect x="27" y="17" width="5" height="2" fill="#241005" />
        <rect x="31" y="18" width="2" height="3" fill="#241005" />
        <rect x="26" y="21" width="7" height="2" fill="#241005" />
    </svg>`;

  /* ---------------------------------------------------------
       FETCH DATA
       --------------------------------------------------------- */
  async function fetchRanking(gameId) {
    try {
      const res = await fetch(`${API_BASE}?gameId=${gameId}&top=${TOP_N}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.items || [];
    } catch (err) {
      console.warn(`Ranking fetch failed for gameId=${gameId}:`, err);
      return [];
    }
  }

  async function fetchAllRankings() {
    const promises = GAMES.map((g) => fetchRanking(g.id));
    const results = await Promise.all(promises);
    GAMES.forEach((g, i) => {
      rankingData[g.id] = results[i];
    });
  }

  /* ---------------------------------------------------------
       BUILD HTML
       --------------------------------------------------------- */
  function buildPodiumCard(pos, item, svgIcon, rankClass) {
    const hasData = Boolean(item);
    const nick = hasData ? escapeHTML(item.displayNick) : "—";
    const score = hasData ? item.result : "—";

    return `
            <div class="podium-card ${rankClass}">
                <div class="podium-pos">${pos}</div>
                <div class="podium-badge">
                    ${svgIcon}
                </div>
                <div class="podium-nick" title="${nick}">${nick}</div>
                <div class="podium-score">${score}</div>
            </div>
        `;
  }

  function buildRanksListHTML(items) {
    const rows = [];
    for (let pos = 4; pos <= 10; pos++) {
      const item = items && items[pos - 1];
      const hasData = Boolean(item);
      const nick = hasData ? escapeHTML(item.displayNick) : "—";
      const score = hasData ? item.result : "—";

      rows.push(`
                <div class="rank-row">
                    <span class="rank-num">${pos}.</span>
                    <span class="rank-nick" title="${nick}">${nick}</span>
                    <span class="rank-score">${score}</span>
                </div>
            `);
    }
    return rows.join("");
  }

  function buildSingleSlide(game) {
    const items = rankingData[game.id] || [];
    const div = document.createElement("div");
    div.className = "ranking-slide";
    div.dataset.slideIndex = GAMES.indexOf(game);

    const card1 = buildPodiumCard(1, items[0], SVG_CROWN_1, "podium-card-gold");
    const card2 = buildPodiumCard(
      2,
      items[1],
      SVG_TROPHY_2,
      "podium-card-silver",
    );
    const card3 = buildPodiumCard(
      3,
      items[2],
      SVG_TROPHY_3,
      "podium-card-bronze",
    );

    div.innerHTML = `
            <div class="panel">
                <div class="panel-inner">
                    <!-- LEWA KOLUMNA: NAZWA GRY, RANKING, PODIUM (TOP 3) -->
                    <div class="panel-left">
                        <header class="header-box">
                            <h1 class="game-name">${escapeHTML(game.name)}</h1>
                            <div class="ranking-title">RANKING</div>
                            <div class="ranking-tagline">GRAJ. ZBIERAJ PUNKTY. ZGARNIAJ NAGRODY.</div>
                        </header>

                        <div class="podium-group">
                            ${card1}
                            ${card2}
                            ${card3}
                        </div>
                    </div>

                    <!-- PRAWA KOLUMNA: STATUS NA ŻYWO + POZYCJE 4 - 10 -->
                    <div class="panel-right">
                        <img class="game-bg-image" src="assets/game-${game.id}.png" alt="" aria-hidden="true" />
                        <div class="status-header">
                            <div class="live-pill">
                                <span class="live-dot"></span>
                                <span class="live-text">NA ŻYWO</span>
                            </div>
                            <div class="refresh-badge">AKTUALIZACJA CO ${DATA_REFRESH_SEC} S</div>
                        </div>

                        <div class="ranks-list">
                            ${buildRanksListHTML(items)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    return div;
  }

  function buildAllSlides() {
    app.innerHTML = "";
    GAMES.forEach((game) => {
      app.appendChild(buildSingleSlide(game));
    });
  }

  /* ---------------------------------------------------------
       SLIDE ROTATION
       --------------------------------------------------------- */
  function showSlide(index) {
    const slides = app.querySelectorAll(".ranking-slide");

    slides.forEach((slide, i) => {
      if (i === currentSlide && i !== index) {
        slide.classList.add("slide-exit");
        slide.classList.remove("slide-enter");
        setTimeout(() => {
          slide.classList.remove("active", "slide-exit");
        }, TRANSITION_MS);
      } else if (i === index) {
        slide.classList.add("active", "slide-enter");
        slide.classList.remove("slide-exit");
        setTimeout(() => {
          slide.classList.remove("slide-enter");
        }, TRANSITION_MS);
      }
    });

    currentSlide = index;
  }

  function nextSlide() {
    const nextIndex = (currentSlide + 1) % totalSlides;
    showSlide(nextIndex);
  }

  function startRotation() {
    showSlide(0);

    slideTimer = setInterval(() => {
      nextSlide();
    }, SLIDE_DURATION);
  }

  /* ---------------------------------------------------------
       PERIODYCZNE ODŚWIEŻANIE DANYCH
       --------------------------------------------------------- */
  function startDataRefresh() {
    setInterval(async () => {
      await fetchAllRankings();
      rebuildSlides();
    }, DATA_REFRESH_MS);
  }

  function rebuildSlides() {
    const wasIndex = currentSlide;
    buildAllSlides();
    const slides = app.querySelectorAll(".ranking-slide");
    if (slides[wasIndex]) {
      slides[wasIndex].classList.add("active");
    }
  }

  /* ---------------------------------------------------------
       UTILS
       --------------------------------------------------------- */
  function escapeHTML(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ---------------------------------------------------------
       INIT
       --------------------------------------------------------- */
  async function init() {
    app.innerHTML =
      '<div class="loading-msg">Ładowanie rankingów<span class="loader-dots"></span></div>';

    await fetchAllRankings();
    buildAllSlides();
    startRotation();
    startDataRefresh();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
