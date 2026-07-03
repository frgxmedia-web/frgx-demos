/*
  RippleGrid — vanilla JS port. Requires OGL (lightweight WebGL lib, ~15kb,
  framework-agnostic — no React needed):
    <script type="module">
      import { Renderer, Program, Triangle, Mesh } from 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/src/index.js';
      window.OGL = { Renderer, Program, Triangle, Mesh };
    </script>
    <script src="ripple-grid.js"></script>

  Usage:
    <div id="rippleBg" style="position:absolute;inset:0;"></div>
    <script>
      initRippleGrid('#rippleBg', {
        gridColor: '#9FB4C4', rippleIntensity: 0.04, gridSize: 12,
        gridThickness: 12, opacity: 0.5, mouseInteraction: true
      });
    </script>
*/
function initRippleGrid(selector, opts) {
  const container = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!container || !window.OGL) return null;
  const { Renderer, Program, Triangle, Mesh } = window.OGL;

  const {
    enableRainbow = false,
    gridColor = '#ffffff',
    rippleIntensity = 0.05,
    gridSize = 10.0,
    gridThickness = 15.0,
    fadeDistance = 1.5,
    vignetteStrength = 2.0,
    glowIntensity = 0.1,
    opacity = 1.0,
    gridRotation = 0,
    mouseInteraction = true,
    mouseInteractionRadius = 1
  } = opts || {};

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255] : [1, 1, 1];
  }

  const renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio, 2), alpha: true });
  const gl = renderer.gl;
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.canvas.style.width = '100%';
  gl.canvas.style.height = '100%';
  container.appendChild(gl.canvas);

  const vert = `
attribute vec2 position;
varying vec2 vUv;
void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
}`;

  const frag = `precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform bool enableRainbow;
uniform vec3 gridColor;
uniform float rippleIntensity;
uniform float gridSize;
uniform float gridThickness;
uniform float fadeDistance;
uniform float vignetteStrength;
uniform float glowIntensity;
uniform float opacity;
uniform float gridRotation;
uniform bool mouseInteraction;
uniform vec2 mousePosition;
uniform float mouseInfluence;
uniform float mouseInteractionRadius;
varying vec2 vUv;
float pi = 3.141592;
mat2 rotate(float angle) { float s = sin(angle); float c = cos(angle); return mat2(c, -s, s, c); }
void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;
    if (gridRotation != 0.0) uv = rotate(gridRotation * pi / 180.0) * uv;
    float dist = length(uv);
    float func = sin(pi * (iTime - dist));
    vec2 rippleUv = uv + uv * func * rippleIntensity;
    if (mouseInteraction && mouseInfluence > 0.0) {
        vec2 mouseUv = (mousePosition * 2.0 - 1.0);
        mouseUv.x *= iResolution.x / iResolution.y;
        float mouseDist = length(uv - mouseUv);
        float influence = mouseInfluence * exp(-mouseDist * mouseDist / (mouseInteractionRadius * mouseInteractionRadius));
        float mouseWave = sin(pi * (iTime * 2.0 - mouseDist * 3.0)) * influence;
        rippleUv += normalize(uv - mouseUv) * mouseWave * rippleIntensity * 0.3;
    }
    vec2 a = sin(gridSize * 0.5 * pi * rippleUv - pi / 2.0);
    vec2 b = abs(a);
    float aaWidth = 0.5;
    vec2 smoothB = vec2(smoothstep(0.0, aaWidth, b.x), smoothstep(0.0, aaWidth, b.y));
    vec3 color = vec3(0.0);
    color += exp(-gridThickness * smoothB.x * (0.8 + 0.5 * sin(pi * iTime)));
    color += exp(-gridThickness * smoothB.y);
    color += 0.5 * exp(-(gridThickness / 4.0) * sin(smoothB.x));
    color += 0.5 * exp(-(gridThickness / 3.0) * smoothB.y);
    if (glowIntensity > 0.0) {
        color += glowIntensity * exp(-gridThickness * 0.5 * smoothB.x);
        color += glowIntensity * exp(-gridThickness * 0.5 * smoothB.y);
    }
    float ddd = exp(-2.0 * clamp(pow(dist, fadeDistance), 0.0, 1.0));
    vec2 vignetteCoords = vUv - 0.5;
    float vignetteDistance = length(vignetteCoords);
    float vignette = 1.0 - pow(vignetteDistance * 2.0, vignetteStrength);
    vignette = clamp(vignette, 0.0, 1.0);
    vec3 t;
    if (enableRainbow) {
        t = vec3(uv.x * 0.5 + 0.5 * sin(iTime), uv.y * 0.5 + 0.5 * cos(iTime), pow(cos(iTime), 4.0)) + 0.5;
    } else {
        t = gridColor;
    }
    float finalFade = ddd * vignette;
    float alpha = length(color) * finalFade * opacity;
    gl_FragColor = vec4(color * t * finalFade * opacity, alpha);
}`;

  const uniforms = {
    iTime: { value: 0 },
    iResolution: { value: [1, 1] },
    enableRainbow: { value: enableRainbow },
    gridColor: { value: hexToRgb(gridColor) },
    rippleIntensity: { value: rippleIntensity },
    gridSize: { value: gridSize },
    gridThickness: { value: gridThickness },
    fadeDistance: { value: fadeDistance },
    vignetteStrength: { value: vignetteStrength },
    glowIntensity: { value: glowIntensity },
    opacity: { value: opacity },
    gridRotation: { value: gridRotation },
    mouseInteraction: { value: mouseInteraction },
    mousePosition: { value: [0.5, 0.5] },
    mouseInfluence: { value: 0 },
    mouseInteractionRadius: { value: mouseInteractionRadius }
  };

  const geometry = new Triangle(gl);
  const program = new Program(gl, { vertex: vert, fragment: frag, uniforms });
  const mesh = new Mesh(gl, { geometry, program });

  let targetMouse = { x: 0.5, y: 0.5 }, currentMouse = { x: 0.5, y: 0.5 }, mouseInfluenceTarget = 0;
  let destroyed = false, raf = null;

  function resize() {
    if (destroyed) return;
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    uniforms.iResolution.value = [w, h];
  }
  function onMove(e) {
    if (!mouseInteraction) return;
    const rect = container.getBoundingClientRect();
    targetMouse = { x: (e.clientX - rect.left) / rect.width, y: 1.0 - (e.clientY - rect.top) / rect.height };
  }
  function onEnter() { if (mouseInteraction) mouseInfluenceTarget = 1.0; }
  function onLeave() { if (mouseInteraction) mouseInfluenceTarget = 0.0; }

  addEventListener('resize', resize);
  if (mouseInteraction) {
    container.addEventListener('mousemove', onMove);
    container.addEventListener('mouseenter', onEnter);
    container.addEventListener('mouseleave', onLeave);
  }
  resize();

  function render(t) {
    if (destroyed) return;
    uniforms.iTime.value = t * 0.001;
    currentMouse.x += (targetMouse.x - currentMouse.x) * 0.1;
    currentMouse.y += (targetMouse.y - currentMouse.y) * 0.1;
    uniforms.mouseInfluence.value += (mouseInfluenceTarget - uniforms.mouseInfluence.value) * 0.05;
    uniforms.mousePosition.value = [currentMouse.x, currentMouse.y];
    renderer.render({ scene: mesh });
    raf = requestAnimationFrame(render);
  }
  raf = requestAnimationFrame(render);

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      if (mouseInteraction) {
        container.removeEventListener('mousemove', onMove);
        container.removeEventListener('mouseenter', onEnter);
        container.removeEventListener('mouseleave', onLeave);
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      if (gl.canvas.parentElement) gl.canvas.parentElement.removeChild(gl.canvas);
    }
  };
}
