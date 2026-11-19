import type { FlowHero } from '../src/index';

const nextFrame = (): Promise<number> => new Promise((r) => requestAnimationFrame(r));

/**
 * Drives the engine deterministically from requestAnimationFrame: the live loop is
 * paused and each animation frame feeds pointer() and calls step(1/fps). Used for
 * screenshots, recordings and frame timing.
 */
export function makeScript(hero: FlowHero) {
  const size = () => hero.canvas.getBoundingClientRect();
  return {
    async stroke(frames = 42, fps = 60): Promise<void> {
      hero.pause();
      const { width: w, height: h } = size();
      for (let i = 0; i <= frames; i++) {
        const t = i / frames;
        const x = w * (0.56 + 0.3 * t + 0.06 * Math.sin(t * Math.PI * 2));
        const y = h * (0.82 - 0.62 * t + 0.08 * Math.sin(t * Math.PI * 3));
        hero.pointer(x, y);
        hero.step(1 / fps);
        await nextFrame();
      }
      hero.lift();
    },
    async advance(seconds: number, fps = 60): Promise<void> {
      hero.pause();
      const n = Math.round(seconds * fps);
      for (let i = 0; i < n; i++) {
        hero.step(1 / fps);
        await nextFrame();
      }
    },
    async time(frames = 300): Promise<{ stepMs: number; rafMs: number; frames: number }> {
      hero.pause();
      const gl = hero.canvas.getContext('webgl2') as WebGL2RenderingContext;
      const px = new Uint8Array(4);
      let work = 0;
      for (let i = 0; i < frames; i++) {
        const { width: w, height: h } = size();
        hero.pointer(w * (0.5 + 0.3 * Math.cos(i / 9)), h * (0.5 + 0.3 * Math.sin(i / 7)));
        const t0 = performance.now();
        hero.step(1 / 60);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        work += performance.now() - t0;
        await nextFrame();
      }
      hero.lift();
      hero.resume();
      await nextFrame();
      const start = await nextFrame();
      let end = start;
      for (let i = 0; i < frames; i++) end = await nextFrame();
      return { stepMs: work / frames, rafMs: (end - start) / frames, frames };
    },
  };
}
