import { DEFAULT_PATCH, PRESETS, PRESET_NAMES, type FlowPatch } from '../src/index';

const CDN = 'https://unpkg.com/flow-hero@0.1.0/dist/flow-hero.iife.js';

const textColor = (patch: FlowPatch): string => {
  const avg = patch.background.colors.reduce((sum, c) => sum + parseInt(c.slice(1, 3), 16) + parseInt(c.slice(3, 5), 16) + parseInt(c.slice(5, 7), 16), 0) / (patch.background.colors.length * 765);
  return avg > 0.55 ? '#1c1917' : 'white';
};

const escapeAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/'/g, '&#39;');

function presetOf(patch: FlowPatch): string | undefined {
  const json = JSON.stringify(patch);
  return PRESET_NAMES.find((n) => JSON.stringify(PRESETS[n]) === json);
}

export function htmlSnippet(patch: FlowPatch): string {
  const preset = presetOf(patch);
  const attr = preset ? `preset="${preset}"` : `patch='${escapeAttr(JSON.stringify(patch))}'`;
  return `<script src="${CDN}"></script>\n\n<flow-hero ${attr} style="height: 100vh; color: ${textColor(patch)}">\n  <h1>Your headline</h1>\n</flow-hero>\n`;
}

export function reactSnippet(patch: FlowPatch): string {
  const preset = presetOf(patch);
  const head = `'use client';\nimport { FlowHero } from 'flow-hero/react';\n\n`;
  if (preset) {
    const prop = preset === DEFAULT_PATCH.name ? '' : ` preset="${preset}"`;
    return `${head}export function Hero() {\n  return (\n    <FlowHero${prop} style={{ height: '100vh', color: '${textColor(patch)}' }}>\n      <h1>Your headline</h1>\n    </FlowHero>\n  );\n}\n`;
  }
  const body = JSON.stringify(patch, null, 2);
  return `${head}const patch = ${body};\n\nexport function Hero() {\n  return (\n    <FlowHero patch={patch} style={{ height: '100vh', color: '${textColor(patch)}' }}>\n      <h1>Your headline</h1>\n    </FlowHero>\n  );\n}\n`;
}
