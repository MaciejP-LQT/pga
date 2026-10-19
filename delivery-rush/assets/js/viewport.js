(() => {
    'use strict';

    const root = document.documentElement;
    const embedded = window.self !== window.top;
    let observer;
    let probe;
    let pendingFrame = 0;

    function setViewport(top, height) {
        if (height <= 0) return;
        const offset = Math.max(0, Math.ceil(top));
        const bottom = Math.floor(top + height);
        if (bottom <= offset) return;
        root.style.setProperty('--viewport-top', offset + 'px');
        root.style.setProperty('--viewport-height', (bottom - offset) + 'px');
    }

    function measure() {
        pendingFrame = 0;
        if (observer) {
            // Re-observe even at ratio 1: resizing a fully visible iframe need not cross a threshold.
            observer.unobserve(probe);
            observer.observe(probe);
            return;
        }
        const viewport = window.visualViewport;
        setViewport(viewport ? viewport.offsetTop : 0, viewport ? viewport.height : window.innerHeight);
    }

    function scheduleMeasure() {
        if (!pendingFrame) pendingFrame = requestAnimationFrame(measure);
    }

    setViewport(0, window.innerHeight);

    if (embedded && 'IntersectionObserver' in window) {
        // In a cross-origin iframe visualViewport still reports the entire iframe.
        // intersectionRect also accounts for clipping by the embedding page; rootBounds may be null.
        probe = document.createElement('div');
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = 'position:fixed;inset:0;pointer-events:none;visibility:hidden;';
        document.body.appendChild(probe);
        observer = new IntersectionObserver(entries => {
            const entry = entries[entries.length - 1];
            if (!entry.isIntersecting) return;
            setViewport(
                entry.intersectionRect.top - entry.boundingClientRect.top,
                entry.intersectionRect.height
            );
        }, { threshold: Array.from({ length: 1001 }, (_, i) => i / 1000) });
        observer.observe(probe);
    }

    window.addEventListener('resize', scheduleMeasure, { passive: true });
    window.addEventListener('pageshow', scheduleMeasure, { passive: true });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', scheduleMeasure, { passive: true });
        window.visualViewport.addEventListener('scroll', scheduleMeasure, { passive: true });
    }
    scheduleMeasure();
})();
