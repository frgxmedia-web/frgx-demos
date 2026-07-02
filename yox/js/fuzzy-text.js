/*
  FuzzyText — vanilla JS port of React Bits' FuzzyText canvas component.
  Ported from a React/canvas source (see FuzzyText.react.jsx in this folder).
  No dependencies — pure Canvas 2D.

  Usage:
    <canvas id="fuzzy"></canvas>
    <script src="fuzzy-text.js"></script>
    <script>
      const handle = initFuzzyText(document.getElementById('fuzzy'), 'YOX', {
        fontSizePx: 160,
        fontWeight: 800,
        fontFamily: "'Poppins',sans-serif",
        color: '#F4F4F1',
        baseIntensity: 0.1,
        hoverIntensity: 0.35,
        fuzzRange: 14,
        direction: 'both',
        letterSpacing: 2,
        // optional: draw extra decoration onto the offscreen canvas before fuzzing
        // (e.g. a macron bar over a letter) — receives per-char x positions/widths.
        onMeasured: (offCtx, chars, offsetX, ascent) => { ... }
      });
      // handle.destroy() to tear down when removing the canvas
    </script>
*/
function initFuzzyText(canvas, text, opts) {
  const {
    fontSizePx = 120,
    fontWeight = 800,
    fontFamily = 'sans-serif',
    color = '#fff',
    enableHover = true,
    baseIntensity = 0.12,
    hoverIntensity = 0.4,
    fuzzRange = 18,
    fps = 60,
    direction = 'horizontal', // 'horizontal' | 'vertical' | 'both'
    transitionDuration = 220,
    clickEffect = false,
    glitchMode = false,
    glitchInterval = 2400,
    glitchDuration = 180,
    gradient = null,
    letterSpacing = 0,
    topPad = 0, // extra px of blank space above the glyphs, for decoration drawn via onMeasured (e.g. an accent bar)
    onMeasured = null
  } = opts || {};

  const ctx = canvas.getContext('2d');
  let animationFrameId, glitchTimeoutId, glitchEndTimeoutId, clickTimeoutId;
  let destroyed = false;

  const offscreen = document.createElement('canvas');
  const offCtx = offscreen.getContext('2d');
  const fontString = `${fontWeight} ${fontSizePx}px ${fontFamily}`;
  offCtx.font = fontString;
  offCtx.textBaseline = 'alphabetic';

  const chars = [...text];
  let totalWidth = 0;
  const charX = [];
  chars.forEach(ch => {
    charX.push(totalWidth);
    totalWidth += offCtx.measureText(ch).width + letterSpacing;
  });
  if (letterSpacing) totalWidth -= letterSpacing;

  const metrics = offCtx.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent || fontSizePx * 0.8;
  const descent = metrics.actualBoundingBoxDescent || fontSizePx * 0.2;
  const tightHeight = Math.ceil(ascent + descent) + topPad;
  const baselineY = ascent + topPad;
  const extraBuffer = 10;
  const offscreenWidth = Math.ceil(totalWidth) + extraBuffer;
  const xOffset = extraBuffer / 2;

  offscreen.width = offscreenWidth;
  offscreen.height = tightHeight;
  offCtx.font = fontString;
  offCtx.textBaseline = 'alphabetic';

  if (gradient && Array.isArray(gradient) && gradient.length >= 2) {
    const grad = offCtx.createLinearGradient(0, 0, offscreenWidth, 0);
    gradient.forEach((c, i) => grad.addColorStop(i / (gradient.length - 1), c));
    offCtx.fillStyle = grad;
  } else {
    offCtx.fillStyle = color;
  }

  chars.forEach((ch, i) => offCtx.fillText(ch, xOffset + charX[i], baselineY));

  if (typeof onMeasured === 'function') {
    onMeasured(offCtx, chars, charX, xOffset, baselineY, fontSizePx);
  }

  const horizontalMargin = fuzzRange + 16;
  canvas.width = offscreenWidth + horizontalMargin * 2;
  canvas.height = tightHeight + horizontalMargin;
  ctx.translate(horizontalMargin, horizontalMargin / 2);

  const interactiveLeft = horizontalMargin + xOffset;
  const interactiveTop = horizontalMargin / 2;
  const interactiveRight = interactiveLeft + totalWidth;
  const interactiveBottom = interactiveTop + tightHeight;

  let isHovering = false, isClicking = false, isGlitching = false;
  let currentIntensity = baseIntensity, targetIntensity = baseIntensity;
  let lastFrameTime = 0;
  const frameDuration = 1000 / fps;

  function startGlitchLoop() {
    if (!glitchMode || destroyed) return;
    glitchTimeoutId = setTimeout(() => {
      if (destroyed) return;
      isGlitching = true;
      glitchEndTimeoutId = setTimeout(() => { isGlitching = false; startGlitchLoop(); }, glitchDuration);
    }, glitchInterval);
  }
  if (glitchMode) startGlitchLoop();

  function run(ts) {
    if (destroyed) return;
    if (ts - lastFrameTime < frameDuration) { animationFrameId = requestAnimationFrame(run); return; }
    lastFrameTime = ts;

    ctx.clearRect(-horizontalMargin, -horizontalMargin, canvas.width + horizontalMargin, canvas.height + horizontalMargin);

    targetIntensity = isClicking || isGlitching ? 1 : isHovering ? hoverIntensity : baseIntensity;
    if (transitionDuration > 0) {
      const step = 1 / (transitionDuration / frameDuration);
      currentIntensity += Math.sign(targetIntensity - currentIntensity) * Math.min(step, Math.abs(targetIntensity - currentIntensity));
    } else {
      currentIntensity = targetIntensity;
    }

    if (direction === 'horizontal' || direction === 'both') {
      for (let j = 0; j < tightHeight; j++) {
        const dx = Math.floor(currentIntensity * (Math.random() - 0.5) * fuzzRange);
        ctx.drawImage(offscreen, 0, j, offscreenWidth, 1, dx, j, offscreenWidth, 1);
      }
    } else {
      ctx.drawImage(offscreen, 0, 0);
    }
    if (direction === 'vertical' || direction === 'both') {
      const snapshot = ctx.getImageData(-horizontalMargin, -horizontalMargin / 2, offscreenWidth + fuzzRange * 2, tightHeight + fuzzRange);
      ctx.clearRect(-horizontalMargin, -horizontalMargin, canvas.width + horizontalMargin, canvas.height + horizontalMargin);
      ctx.putImageData(snapshot, -horizontalMargin, -horizontalMargin / 2);
      for (let i = 0; i < offscreenWidth + fuzzRange; i++) {
        const dy = Math.floor(currentIntensity * (Math.random() - 0.5) * fuzzRange * (direction === 'both' ? 0.5 : 1));
        const col = ctx.getImageData(i - horizontalMargin + fuzzRange, -horizontalMargin / 2, 1, tightHeight + fuzzRange);
        ctx.clearRect(i - horizontalMargin + fuzzRange, -horizontalMargin, 1, tightHeight + 2 * horizontalMargin);
        ctx.putImageData(col, i - horizontalMargin + fuzzRange, dy - horizontalMargin / 2);
      }
    }
    animationFrameId = requestAnimationFrame(run);
  }
  animationFrameId = requestAnimationFrame(run);

  function inside(x, y) { return x >= interactiveLeft && x <= interactiveRight && y >= interactiveTop && y <= interactiveBottom; }
  function onMove(e) {
    if (!enableHover) return;
    const r = canvas.getBoundingClientRect();
    isHovering = inside(e.clientX - r.left, e.clientY - r.top);
  }
  function onLeave() { isHovering = false; }
  function onClick() {
    if (!clickEffect) return;
    isClicking = true;
    clearTimeout(clickTimeoutId);
    clickTimeoutId = setTimeout(() => { isClicking = false; }, 150);
  }
  function onTouch(e) {
    if (!enableHover) return;
    const t = e.touches[0]; if (!t) return;
    const r = canvas.getBoundingClientRect();
    isHovering = inside(t.clientX - r.left, t.clientY - r.top);
  }

  if (enableHover) {
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('touchmove', onTouch, { passive: true });
    canvas.addEventListener('touchend', onLeave);
  }
  if (clickEffect) canvas.addEventListener('click', onClick);

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(animationFrameId);
      clearTimeout(glitchTimeoutId); clearTimeout(glitchEndTimeoutId); clearTimeout(clickTimeoutId);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
      canvas.removeEventListener('touchmove', onTouch);
      canvas.removeEventListener('touchend', onLeave);
      canvas.removeEventListener('click', onClick);
    }
  };
}
