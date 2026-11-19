import { createFlowHero, type FlowHero } from './engine';
import { DEFAULT_PATCH, parsePatch, type FlowPatch } from './patch';
import { PRESETS, isPresetName } from './presets';

export const TAG_NAME = 'flow-hero';

export interface FlowHeroElement extends HTMLElement {
  /** The running engine, once the element is connected. */
  readonly hero: FlowHero | undefined;
}

/**
 * Registers `<flow-hero>`. Settings layer as preset, then the JSON at `src`, then
 * the inline `patch` attribute. Safe to call more than once and on the server.
 */
export function defineFlowHero(tagName: string = TAG_NAME): void {
  if (typeof customElements === 'undefined' || customElements.get(tagName)) return;

  class Element extends HTMLElement implements FlowHeroElement {
    static observedAttributes = ['preset', 'patch', 'src'];
    #hero: FlowHero | undefined;
    #fromSrc: unknown;
    #request = 0;

    get hero(): FlowHero | undefined {
      return this.#hero;
    }

    connectedCallback(): void {
      if (!this.style.display && getComputedStyle(this).display === 'inline') this.style.display = 'block';
      this.#hero ??= createFlowHero(this, this.#resolve());
      void this.#load();
    }

    disconnectedCallback(): void {
      this.#hero?.destroy();
      this.#hero = undefined;
    }

    attributeChangedCallback(name: string): void {
      if (!this.#hero) return;
      if (name === 'src') void this.#load();
      else this.#hero.setPatch(this.#resolve());
    }

    #resolve(): FlowPatch {
      const preset = this.getAttribute('preset');
      const base = isPresetName(preset) ? PRESETS[preset] : DEFAULT_PATCH;
      return parsePatch(this.getAttribute('patch'), parsePatch(this.#fromSrc, base));
    }

    async #load(): Promise<void> {
      const src = this.getAttribute('src');
      const id = ++this.#request;
      this.#fromSrc = undefined;
      if (src) {
        try {
          const res = await fetch(src);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json: unknown = await res.json();
          if (id !== this.#request) return;
          this.#fromSrc = json;
        } catch (err) {
          console.warn(`[flow-hero] could not load patch from ${src}`, err);
        }
      }
      if (id === this.#request) this.#hero?.setPatch(this.#resolve());
    }
  }

  customElements.define(tagName, Element);
}

defineFlowHero();
