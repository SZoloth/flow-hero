export { createFlowHero } from './engine';
export type { FlowHero, FlowHeroOptions, FlowMode, FlowStatus } from './engine';
export {
  BLEND_MODES,
  DEFAULT_PATCH,
  SETTINGS,
  decodePatch,
  encodePatch,
  getSetting,
  normalizeHex,
  parsePatch,
  withSetting,
} from './patch';
export type { BlendMode, DeepPartial, FlowPatch, Hex, Octaves, PatchInput, Setting } from './patch';
export { PRESETS, PRESET_NAMES, isPresetName } from './presets';
export type { PresetName } from './presets';
export { cssGradient } from './color';
export { IDLE_MODES } from './idle';
export type { IdleMode } from './idle';
