import { describe, expect, it } from 'vitest';

describe('server-side import', () => {
  it('imports every entry without a DOM', async () => {
    expect(typeof window).toBe('undefined');
    const core = await import('../src/index');
    const element = await import('../src/element');
    const react = await import('../src/react');
    const iife = await import('../src/iife');
    expect(typeof core.createFlowHero).toBe('function');
    expect(typeof element.defineFlowHero).toBe('function');
    expect(() => element.defineFlowHero()).not.toThrow();
    expect(typeof react.FlowHero).toBe('function');
    expect(typeof iife.parsePatch).toBe('function');
  });
});
