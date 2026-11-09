(() => {
    'use strict';

    const region = document.getElementById('hub-scroll');
    if (!region) return;

    let gesture = null;

    function updateTopBoundary() {
        region.classList.toggle('is-at-top', region.scrollTop <= 1);
    }

    region.addEventListener('scroll', updateTopBoundary, { passive: true });
    updateTopBoundary();

    function resetGesture() {
        gesture = null;
    }

    function blockMultiTouch(event) {
        if (event.touches.length < 2) return false;
        resetGesture();
        if (event.cancelable) event.preventDefault();
        return true;
    }

    region.addEventListener('touchstart', event => {
        if (blockMultiTouch(event)) return;
        const touch = event.touches.length === 1 ? event.touches[0] : null;
        gesture = touch ? {
            id: touch.identifier,
            startX: touch.clientX,
            startY: touch.clientY,
            lastY: touch.clientY
        } : null;
    }, { passive: false });

    region.addEventListener('touchmove', event => {
        if (blockMultiTouch(event)) return;
        if (!gesture || event.touches.length !== 1) {
            resetGesture();
            return;
        }

        const touch = event.touches[0];
        if (touch.identifier !== gesture.id) {
            resetGesture();
            return;
        }

        const dx = touch.clientX - gesture.startX;
        const dy = touch.clientY - gesture.startY;
        const stepY = touch.clientY - gesture.lastY;
        gesture.lastY = touch.clientY;
        if (!event.cancelable || Math.abs(dy) <= Math.abs(dx) || stepY === 0) return;

        const atBottom = region.scrollTop + region.clientHeight >= region.scrollHeight - 1;
        if (stepY < 0 && atBottom) event.preventDefault();
    }, { passive: false });

    region.addEventListener('touchend', resetGesture, { passive: true });
    region.addEventListener('touchcancel', resetGesture, { passive: true });
})();
