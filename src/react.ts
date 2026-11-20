import { createElement, useEffect, useRef, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { createFlowHero, type FlowHero as FlowHeroInstance, type FlowHeroOptions } from './engine';
import { DEFAULT_PATCH, parsePatch } from './patch';
import { PRESETS, isPresetName, type PresetName } from './presets';

export interface FlowHeroProps {
  /** Start from a named preset. Defaults to ember. */
  preset?: PresetName;
  /** A full or partial patch layered over the preset. Untrusted input is fine. */
  patch?: unknown;
  options?: FlowHeroOptions;
  /** The element to render, so the hero can stay a `section` or `header`. Defaults to `div`. */
  as?: 'div' | 'section' | 'header' | 'main' | 'article' | 'aside' | 'footer';
  id?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** Called once with the engine, for pause/resume or scripted pointer input. */
  onReady?: (hero: FlowHeroInstance) => void;
}

/** A positioned container with the hero behind its children. Give it a height. */
export function FlowHero({ preset, patch, options, as = 'div', id, className, style, children, onReady }: FlowHeroProps): ReactElement {
  const host = useRef<HTMLElement>(null);
  const hero = useRef<FlowHeroInstance | undefined>(undefined);
  const resolved = parsePatch(patch, isPresetName(preset) ? PRESETS[preset] : DEFAULT_PATCH);
  const key = JSON.stringify(resolved);
  const latest = useRef(resolved);
  latest.current = resolved;

  useEffect(() => {
    if (!host.current) return;
    const el = host.current as HTMLElement & { hero?: FlowHeroInstance };
    const instance = createFlowHero(el, latest.current, options);
    hero.current = instance;
    el.hero = instance;
    onReady?.(instance);
    return () => {
      instance.destroy();
      hero.current = undefined;
      delete el.hero;
    };
  }, [as]);

  useEffect(() => {
    hero.current?.setPatch(latest.current);
  }, [key]);

  // The engine prepends its layers into the host; keeping children in their own node stops React from replacing them.
  return createElement(as, { ref: host, id, className, style }, createElement('div', { style: { display: 'contents' } }, children));
}

export type { FlowHeroInstance, FlowHeroOptions };
