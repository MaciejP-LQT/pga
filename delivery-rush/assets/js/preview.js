/* =========================================================
   preview.js - narzedzia podgladu  (TYLKO DO TESTOW)

   ?touch=1  wymusza pointer:coarse   ?ruler=1  linijka krawedzi
   ?touch=0  wymusza pointer:fine     ?preview=X  profil

   Dodaj do index.html jako PIERWSZY skrypt (przed config.js).
   USUN PRZED WDROZENIEM NA PRODUKCJE.
   ========================================================= */
(function () {
    const params = new URLSearchParams(location.search);
    const forceTouch = params.get('touch') === '1';
    const forceMouse = params.get('touch') === '0';
    const preview    = params.get('preview');
    const ruler      = params.get('ruler') === '1';

    if (!forceTouch && !forceMouse && !preview && !ruler) return;

    if (forceTouch || forceMouse) {
        const orig = window.matchMedia.bind(window);
        window.matchMedia = function (q) {
            const query = String(q);
            if (/pointer\s*:\s*(coarse|fine)/i.test(query)) {
                const wantsCoarse = /coarse/i.test(query);
                return {
                    matches: forceTouch ? wantsCoarse : !wantsCoarse,
                    media: query, onchange: null,
                    addListener(){}, removeListener(){},
                    addEventListener(){}, removeEventListener(){},
                    dispatchEvent(){ return false; }
                };
            }
            return orig(q);
        };
        console.info('[Preview] wskaznik:', forceTouch ? 'dotyk' : 'mysz');
    }

    if (preview) document.documentElement.setAttribute('data-preview', preview);

    /* ---------- linijka: krawedzie viewportu ---------- */
    if (ruler) {
        const draw = () => {
            let box = document.getElementById('__ruler');
            if (!box) {
                box = document.createElement('div');
                box.id = '__ruler';
                box.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999';

                const line = s => {
                    const d = document.createElement('div');
                    d.style.cssText = 'position:absolute;background:rgba(255,60,60,.85);' +
                        (s==='l' ? 'left:0;top:0;bottom:0;width:2px'
                       : s==='r' ? 'right:0;top:0;bottom:0;width:2px'
                       : s==='t' ? 'top:0;left:0;right:0;height:2px'
                       :           'bottom:0;left:0;right:0;height:2px');
                    return d;
                };
                ['l','r','t','b'].forEach(s => box.appendChild(line(s)));

                const tag = document.createElement('div');
                tag.id = '__ruler-tag';
                tag.style.cssText =
                    'position:absolute;top:6px;left:50%;transform:translateX(-50%);' +
                    'color:#fff;font:700 13px Consolas,monospace;padding:5px 12px;' +
                    'border-radius:5px;white-space:nowrap';
                box.appendChild(tag);
                document.body.appendChild(box);
            }

            const de = document.documentElement;
            const oX = de.scrollWidth - de.clientWidth;
            const oY = de.scrollHeight - de.clientHeight;

            /* czy plansza wystaje */
            let extra = '';
            const st = document.getElementById('stage');
            if (st) {
                const r = st.getBoundingClientRect();
                if (r.bottom > de.clientHeight + 2)
                    extra += '  plansza ↓' + Math.round(r.bottom - de.clientHeight) + 'px';
                if (r.right > de.clientWidth + 2)
                    extra += '  plansza →' + Math.round(r.right - de.clientWidth) + 'px';
            }

            const bad = oX > 1 || oY > 1 || extra;
            const tag = document.getElementById('__ruler-tag');

            tag.textContent = 'viewport ' + de.clientWidth + '×' + de.clientHeight +
                (bad ? '  ✕' + (oX>1?' bok '+oX+'px':'') + (oY>1?' dół '+oY+'px':'') + extra
                     : '  ✓ mieści się');
            tag.style.background = bad ? 'rgba(255,60,60,.92)' : 'rgba(62,207,142,.92)';
        };

        if (document.readyState === 'loading')
            document.addEventListener('DOMContentLoaded', () => setTimeout(draw, 300));
        else setTimeout(draw, 300);

        window.addEventListener('resize', () => setTimeout(draw, 100));
        setInterval(draw, 1500);
        console.info('[Preview] linijka wlaczona');
    }
})();
