export type IdleMode = 'off' | 'attract' | 'always';

export const IDLE_MODES: readonly IdleMode[] = ['off', 'attract', 'always'];

export const IDLE_AFTER = 2.5;

export function wandererActive(mode: IdleMode, now: number, lastInput: number, finePointer: boolean): boolean {
  const paused = now - lastInput > IDLE_AFTER;
  if (mode === 'always') return paused;
  if (mode === 'attract') return lastInput === -Infinity || (!finePointer && paused);
  return false;
}
