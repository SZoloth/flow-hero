import { cssGradient, hexToOklab } from './color';
import { wandererActive } from './idle';
import { BLEND_MODES, DEFAULT_PATCH, parsePatch, type FlowPatch } from './patch';
import { COMPOSITE, MAX_POINTS, SIMULATE, VERTEX } from './shaders';

export type FlowMode = 'webgl' | 'still' | 'fallback';

export interface FlowStatus {
  /** webgl: animating. still: reduced motion, one frame. fallback: static CSS gradient. */
  mode: FlowMode;
  /** Why the hero is in fallback, if it is. */
  reason: string | undefined;
  /** Whether the frame loop is currently scheduled. */
  running: boolean;
  /** UNMASKED_RENDERER_WEBGL when the browser exposes it. */
  renderer: string;
  /** Ink buffer format. */
  format: 'rgba16f' | 'rgba8' | 'none';
  /** Canvas backing size in device pixels. */
  width: number;
  height: number;
}

export interface FlowHeroOptions {
  /** Force the 8-bit ink buffer even when float targets exist (for testing the fallback path). */
  forceRGBA8?: boolean;
  /** Ignore prefers-reduced-motion. */
  ignoreReducedMotion?: boolean;
}

export interface FlowHero {
  readonly canvas: HTMLCanvasElement;
  readonly patch: FlowPatch;
  readonly status: FlowStatus;
  setPatch(patch: unknown): void;
  pause(): void;
  resume(): void;
  /** Advance and render one frame of `dt` seconds, whether or not the loop runs. */
  step(dt?: number): void;
  /** Feed a pointer position in CSS pixels relative to the canvas's top-left corner. */
  pointer(x: number, y: number): void;
  /** End the current stroke so the next pointer() starts a new one. */
  lift(): void;
  destroy(): void;
}

interface Point {
  x: number;
  y: number;
}

interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
}

interface Gpu {
  gl: WebGL2RenderingContext;
  sim: WebGLProgram;
  comp: WebGLProgram;
  vao: WebGLVertexArrayObject;
  packed: boolean;
  targets: [Target, Target] | undefined;
  simW: number;
  simH: number;
  read: 0 | 1;
  loc: Map<string, WebGLUniformLocation | null>;
}

const SOFTWARE = /swiftshader|llvmpipe|software/i;
const MAX_DT = 1 / 20;
const STILL_STEPS = 80;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('createShader failed');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    throw new Error(gl.getShaderInfoLog(sh) ?? 'shader compile failed');
  }
  return sh;
}

function link(gl: WebGL2RenderingContext, frag: string): WebGLProgram {
  const prog = gl.createProgram();
  if (!prog) throw new Error('createProgram failed');
  const shaders = [compile(gl, gl.VERTEX_SHADER, VERTEX), compile(gl, gl.FRAGMENT_SHADER, frag)];
  for (const sh of shaders) gl.attachShader(prog, sh);
  gl.linkProgram(prog);
  for (const sh of shaders) gl.deleteShader(sh);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(prog) ?? 'link failed');
  return prog;
}

function makeTarget(gl: WebGL2RenderingContext, w: number, h: number, packed: boolean): Target {
  const tex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!tex || !fbo) throw new Error('texture allocation failed');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (packed) {
    const zero = new Uint8Array(w * h * 4);
    for (let i = 0; i < zero.length; i += 4) zero[i] = zero[i + 1] = 128;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, zero);
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  if (!packed) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!ok) {
    gl.deleteTexture(tex);
    gl.deleteFramebuffer(fbo);
    throw new Error('incomplete framebuffer');
  }
  return { tex, fbo };
}

/** Seeded wanderer path in short-side units, centred on the canvas. */
function wanderer(t: number, w: number, h: number): Point {
  return {
    x: w / 2 + w * (0.3 * Math.sin(t * 0.83 + 0.4) + 0.12 * Math.sin(t * 2.11 + 2.3)),
    y: h / 2 + h * (0.26 * Math.sin(t * 1.07 + 1.9) + 0.1 * Math.cos(t * 1.73 + 0.7)),
  };
}

export function createFlowHero(target: HTMLElement, patchInput?: unknown, options: FlowHeroOptions = {}): FlowHero {
  let patch = parsePatch(patchInput ?? DEFAULT_PATCH);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('data-flow-hero', '');
  const backdrop = document.createElement('div');
  backdrop.setAttribute('aria-hidden', 'true');
  const layer = { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', pointerEvents: 'none', zIndex: '-1' };
  Object.assign(canvas.style, layer);
  Object.assign(backdrop.style, layer);
  const hostStyle = getComputedStyle(target);
  if (hostStyle.position === 'static') target.style.position = 'relative';
  if (hostStyle.isolation !== 'isolate') target.style.isolation = 'isolate';
  target.prepend(backdrop, canvas);

  const status: FlowStatus = { mode: 'webgl', reason: undefined, running: false, renderer: '', format: 'none', width: 0, height: 0 };
  let gpu: Gpu | undefined;
  let destroyed = false;
  let userPaused = false;
  let onScreen = true;
  let tabVisible = document.visibilityState !== 'hidden';
  let raf = 0;
  let lastFrame = 0;
  let time = 0;
  let frame = 0;
  let lastInput = -Infinity;
  let idlePhase = 0;
  let cssW = 1;
  let cssH = 1;
  let stroke: Point | undefined;
  let idlePrev: Point | undefined;
  let pending: Point[] = [];
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let dprQuery: MediaQueryList | undefined;
  const reduced = (): boolean => !options.ignoreReducedMotion && motionQuery.matches;

  function paintBackdrop(): void {
    // Set twice: browsers without `in oklab` keep the plain sRGB gradient.
    backdrop.style.background = cssGradient(patch.background.colors, patch.background.angle);
    backdrop.style.background = `linear-gradient(in oklab ${patch.background.angle}deg, ${patch.background.colors.join(', ')})`;
  }

  function enterFallback(reason: string): void {
    status.mode = 'fallback';
    status.reason = reason;
    canvas.dataset.flowHero = 'fallback';
    canvas.style.visibility = 'hidden';
    stop();
  }

  function initGpu(): void {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: true,
    });
    if (!gl) return enterFallback('no-webgl2');
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    status.renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
    if (SOFTWARE.test(status.renderer)) return enterFallback('software-renderer');
    try {
      const sim = link(gl, SIMULATE);
      const comp = link(gl, COMPOSITE);
      const vao = gl.createVertexArray();
      if (!vao) throw new Error('vertex array failed');
      const floatTargets = gl.getExtension('EXT_color_buffer_float') ?? gl.getExtension('EXT_color_buffer_half_float');
      gpu = { gl, sim, comp, vao, packed: options.forceRGBA8 === true || !floatTargets, targets: undefined, simW: 0, simH: 0, read: 0, loc: new Map() };
      try {
        resize(true);
      } catch (err) {
        if (gpu.packed) throw err;
        gpu.packed = true;
        resize(true);
      }
      status.format = gpu.packed ? 'rgba8' : 'rgba16f';
    } catch (err) {
      gpu = undefined;
      if (!gl.isContextLost()) console.warn('[flow-hero] WebGL setup failed, using CSS fallback.', err);
      return enterFallback('shader');
    }
    status.mode = reduced() ? 'still' : 'webgl';
    status.reason = undefined;
    canvas.dataset.flowHero = status.mode;
    canvas.style.visibility = '';
  }

  function uniform(prog: WebGLProgram, name: string): WebGLUniformLocation | null {
    const g = gpu as Gpu;
    const key = (prog === g.sim ? 's:' : 'c:') + name;
    let loc = g.loc.get(key);
    if (loc === undefined) {
      loc = g.gl.getUniformLocation(prog, name);
      g.loc.set(key, loc);
    }
    return loc;
  }

  const EMPTY_SEGS = new Float32Array(MAX_POINTS * 4);
  const EMPTY_BRUSH = new Float32Array(MAX_POINTS * 2);

  function runSim(g: Gpu, src: Target, dst: Target, dt: number, segs: Float32Array = EMPTY_SEGS, brush: Float32Array = EMPTY_BRUSH, count = 0): void {
    const { gl } = g;
    const s = short();
    const ink = patch.ink;
    gl.bindVertexArray(g.vao);
    gl.disable(gl.BLEND);
    gl.useProgram(g.sim);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
    gl.viewport(0, 0, g.simW, g.simH);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    const S = (n: string) => uniform(g.sim, n);
    gl.uniform1i(S('uPrev'), 0);
    gl.uniform1i(S('uPacked'), g.packed ? 1 : 0);
    gl.uniform2f(S('uUnit'), s / cssW, s / cssH);
    gl.uniform1f(S('uDt'), dt);
    gl.uniform1f(S('uTime'), time);
    gl.uniform1f(S('uSeed'), frame);
    gl.uniform1f(S('uDecay'), 4 / ink.lifetime);
    gl.uniform1f(S('uDrift'), ink.drift * 1.2);
    gl.uniform1f(S('uSpread'), ink.spread * 14);
    gl.uniform1f(S('uBlurRadius'), 0.003 + ink.spread * 0.004);
    gl.uniform1i(S('uCount'), count);
    gl.uniform4fv(S('uSeg'), segs);
    gl.uniform2fv(S('uBrush'), brush);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Allocates ink buffers at the current size, resampling the old trail into them. */
  function allocTargets(keepTrail: boolean): void {
    const g = gpu as Gpu;
    const { gl } = g;
    const old = g.targets;
    const next: [Target, Target] = [makeTarget(gl, g.simW, g.simH, g.packed), makeTarget(gl, g.simW, g.simH, g.packed)];
    if (old && keepTrail) runSim(g, old[g.read], next[0], 0);
    for (const t of old ?? []) {
      gl.deleteTexture(t.tex);
      gl.deleteFramebuffer(t.fbo);
    }
    g.targets = next;
    g.read = 0;
  }

  function measure(): void {
    const rect = canvas.getBoundingClientRect();
    cssW = Math.max(1, rect.width);
    cssH = Math.max(1, rect.height);
  }

  function resize(force = false): void {
    measure();
    if (!gpu) return;
    const max = gpu.gl.getParameter(gpu.gl.MAX_TEXTURE_SIZE) as number;
    const dpr = Math.min(window.devicePixelRatio || 1, patch.quality.maxDpr);
    const w = Math.min(max, Math.max(1, Math.round(cssW * dpr * patch.quality.resolution)));
    const h = Math.min(max, Math.max(1, Math.round(cssH * dpr * patch.quality.resolution)));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    status.width = w;
    status.height = h;
    const sw = Math.max(1, Math.round(w / 2));
    const sh = Math.max(1, Math.round(h / 2));
    if (force || !gpu.targets || sw !== gpu.simW || sh !== gpu.simH) {
      gpu.simW = sw;
      gpu.simH = sh;
      allocTargets(!force);
    }
  }

  function short(): number {
    return Math.min(cssW, cssH);
  }

  function collectStroke(dt: number): { segs: Float32Array; brush: Float32Array; count: number } {
    const s = short();
    if (wandererActive(patch.idle.mode, time, lastInput, finePointer)) {
      idlePhase += dt * patch.idle.speed;
      const p = wanderer(idlePhase, cssW / s, cssH / s);
      if (idlePrev) pending = [{ x: idlePrev.x * s, y: idlePrev.y * s }, { x: p.x * s, y: p.y * s }];
      idlePrev = p;
    } else {
      idlePrev = undefined;
    }
    let pts = pending;
    pending = stroke && !idlePrev ? [stroke] : [];
    if (pts.length > MAX_POINTS + 1) {
      const pick: Point[] = [];
      for (let i = 0; i <= MAX_POINTS; i++) pick.push(pts[Math.round((i * (pts.length - 1)) / MAX_POINTS)] as Point);
      pts = pick;
    }
    const segs = new Float32Array(MAX_POINTS * 4);
    const brush = new Float32Array(MAX_POINTS * 2);
    let length = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1] as Point;
      const b = pts[i] as Point;
      length += Math.hypot(b.x - a.x, b.y - a.y) / s;
    }
    const speed = length / Math.max(dt, 1e-4);
    const fast = Math.min(1, Math.max(0, (speed - 0.05) / 2.2));
    const ease = fast * fast * (3 - 2 * fast);
    const radius = patch.ink.size * (0.15 + 0.85 * ease) * (idlePrev ? patch.idle.size : 1);
    const strength = Math.min(1, speed / 0.35) * (0.55 + 0.45 * ease);
    let count = 0;
    for (let i = 1; i < pts.length && count < MAX_POINTS; i++) {
      const a = pts[i - 1] as Point;
      const b = pts[i] as Point;
      segs.set([a.x / s, (cssH - a.y) / s, b.x / s, (cssH - b.y) / s], count * 4);
      brush.set([radius, strength], count * 2);
      count++;
    }
    return { segs, brush, count };
  }

  function ready(): Gpu | undefined {
    if (!gpu || !gpu.targets || status.mode === 'fallback' || gpu.gl.isContextLost()) return undefined;
    return gpu;
  }

  function simulate(dt: number): void {
    const g = ready();
    if (!g || !g.targets) return;
    dt = Math.min(Math.max(dt, 0), MAX_DT);
    time += dt;
    frame++;
    const { segs, brush, count } = collectStroke(dt);
    runSim(g, g.targets[g.read], g.targets[(g.read ^ 1) as 0 | 1], dt, segs, brush, count);
    g.read = (g.read ^ 1) as 0 | 1;
  }

  function composite(): void {
    const g = ready();
    if (!g || !g.targets) return;
    const { gl } = g;
    const s = short();
    const bg = patch.background;
    const ink = patch.ink;
    const stops = new Float32Array(12);
    bg.colors.forEach((c, i) => stops.set(hexToOklab(c), i * 3));
    gl.bindVertexArray(g.vao);
    gl.useProgram(g.comp);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, g.targets[g.read].tex);
    const C = (n: string) => uniform(g.comp, n);
    gl.uniform1i(C('uInk'), 0);
    gl.uniform1i(C('uPacked'), g.packed ? 1 : 0);
    gl.uniform2f(C('uRes'), canvas.width, canvas.height);
    gl.uniform2f(C('uUnit'), s / cssW, s / cssH);
    gl.uniform1f(C('uTime'), time);
    gl.uniform3fv(C('uStops'), stops);
    gl.uniform1i(C('uStopCount'), bg.colors.length);
    gl.uniform1f(C('uAngle'), (bg.angle * Math.PI) / 180);
    gl.uniform1f(C('uMotion'), bg.motion);
    gl.uniform3fv(C('uAccent'), hexToOklab(ink.color));
    gl.uniform1f(C('uHueShift'), ink.hueShift);
    gl.uniform1f(C('uIntensity'), ink.intensity);
    gl.uniform1i(C('uBlend'), BLEND_MODES.indexOf(ink.blend));
    gl.uniform1f(C('uWarpAmount'), patch.warp.amount);
    gl.uniform1f(C('uWarpScale'), patch.warp.scale);
    gl.uniform1f(C('uWarpSpeed'), patch.warp.speed);
    gl.uniform1i(C('uOctaves'), patch.warp.detail);
    gl.uniform1f(C('uGrain'), patch.grain);
    gl.uniform1f(C('uFrame'), status.mode === 'still' ? 0 : frame);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function renderStill(): void {
    if (!ready()) return;
    allocTargets(false);
    const saved = { time, lastInput, idlePhase, idle: patch.idle };
    time = 0;
    lastInput = -Infinity;
    idlePhase = 0;
    stroke = undefined;
    idlePrev = undefined;
    pending = [];
    patch = { ...patch, idle: { mode: 'always', speed: 0.5, size: patch.idle.size } };
    for (let i = 0; i < STILL_STEPS; i++) simulate(1 / 60);
    composite();
    patch = { ...patch, idle: saved.idle };
    time = saved.time;
    lastInput = saved.lastInput;
    idlePhase = saved.idlePhase;
    idlePrev = undefined;
    pending = [];
  }

  /** Redraws the current state without advancing time, after a resize or a patch change. */
  function refresh(): void {
    if (status.mode === 'still') renderStill();
    else composite();
  }

  function loop(now: number): void {
    raf = 0;
    const dt = lastFrame ? (now - lastFrame) / 1000 : 1 / 60;
    lastFrame = now;
    simulate(dt);
    composite();
    schedule();
  }

  function shouldRun(): boolean {
    return !destroyed && !userPaused && onScreen && tabVisible && status.mode === 'webgl';
  }

  function schedule(): void {
    status.running = shouldRun();
    if (status.running && !raf) raf = requestAnimationFrame(loop);
  }

  function stop(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastFrame = 0;
    status.running = false;
  }

  function sync(): void {
    if (shouldRun()) schedule();
    else stop();
  }

  function addPoint(x: number, y: number): void {
    const p = { x, y };
    if (!stroke) pending = [];
    pending.push(p);
    stroke = p;
    lastInput = time;
  }

  function lift(): void {
    stroke = undefined;
    pending = [];
  }

  function onMove(clientX: number, clientY: number): void {
    if (!status.running) return;
    const r = canvas.getBoundingClientRect();
    const x = clientX - r.left;
    const y = clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) lift();
    else addPoint(x, y);
  }

  function safely(fn: () => void): void {
    try {
      fn();
    } catch (err) {
      console.warn('[flow-hero] GPU allocation failed, using CSS fallback.', err);
      gpu = undefined;
      enterFallback('allocation');
    }
  }

  function watchDpr(): void {
    dprQuery?.removeEventListener('change', onDprChange);
    dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    dprQuery.addEventListener('change', onDprChange);
  }

  const onDprChange = (): void => {
    watchDpr();
    safely(() => {
      resize();
      refresh();
    });
  };
  const onPointer = (e: PointerEvent): void => onMove(e.clientX, e.clientY);
  const onPointerEnd = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') lift();
  };
  const onTouch = (e: TouchEvent): void => {
    const t = e.touches[0];
    if (t) onMove(t.clientX, t.clientY);
  };
  const onVisibility = (): void => {
    tabVisible = document.visibilityState !== 'hidden';
    sync();
  };
  const onLost = (e: Event): void => {
    e.preventDefault();
    gpu = undefined;
    enterFallback('context-lost');
  };
  const onRestored = (): void => {
    if (destroyed) return;
    initGpu();
    refresh();
    sync();
  };
  const onMotionChange = (): void => {
    if (!gpu || status.mode === 'fallback') return;
    status.mode = reduced() ? 'still' : 'webgl';
    canvas.dataset.flowHero = status.mode;
    refresh();
    sync();
  };

  const resizeObserver = new ResizeObserver(() =>
    safely(() => {
      resize();
      refresh();
    }),
  );
  const intersection = new IntersectionObserver((entries) => {
    const last = entries[entries.length - 1];
    if (last) onScreen = last.isIntersecting;
    sync();
  });

  const listeners: [EventTarget, string, EventListener][] = [
    [window, 'pointermove', onPointer as EventListener],
    [window, 'pointerdown', onPointer as EventListener],
    [window, 'pointerup', onPointerEnd as EventListener],
    [window, 'pointercancel', onPointerEnd as EventListener],
    [window, 'touchmove', onTouch as EventListener],
    [window, 'touchend', lift],
    [window, 'touchcancel', lift],
    [window, 'scroll', lift],
    [window, 'blur', lift],
    [document.documentElement, 'pointerleave', lift],
    [document, 'visibilitychange', onVisibility],
    [canvas, 'webglcontextlost', onLost],
    [canvas, 'webglcontextrestored', onRestored],
    [motionQuery, 'change', onMotionChange],
  ];
  for (const [t, type, fn] of listeners) t.addEventListener(type, fn, { passive: type !== 'webglcontextlost' });
  resizeObserver.observe(target);
  intersection.observe(target);
  watchDpr();

  paintBackdrop();
  measure();
  initGpu();
  refresh();
  sync();

  return {
    canvas,
    get patch() {
      return patch;
    },
    get status() {
      return { ...status };
    },
    setPatch(next: unknown) {
      const prevQuality = patch.quality;
      patch = parsePatch(next, patch);
      paintBackdrop();
      safely(() => {
        if (patch.quality.resolution !== prevQuality.resolution || patch.quality.maxDpr !== prevQuality.maxDpr) resize();
        refresh();
      });
    },
    pause() {
      userPaused = true;
      sync();
    },
    resume() {
      userPaused = false;
      sync();
    },
    step(dt = 1 / 60) {
      simulate(dt);
      composite();
    },
    pointer(x: number, y: number) {
      addPoint(x, y);
    },
    lift,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      for (const [t, type, fn] of listeners) t.removeEventListener(type, fn);
      dprQuery?.removeEventListener('change', onDprChange);
      resizeObserver.disconnect();
      intersection.disconnect();
      if (gpu) {
        const { gl } = gpu;
        for (const t of gpu.targets ?? []) {
          gl.deleteTexture(t.tex);
          gl.deleteFramebuffer(t.fbo);
        }
        gl.deleteProgram(gpu.sim);
        gl.deleteProgram(gpu.comp);
        gl.deleteVertexArray(gpu.vao);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
      gpu = undefined;
      canvas.remove();
      backdrop.remove();
    },
  };
}
