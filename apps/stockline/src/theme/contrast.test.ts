import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Reads the hex tokens straight from theme.css, so the test checks the shipped values.
const css = readFileSync(
  fileURLToPath(new URL('./theme.css', import.meta.url)),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

function tokensFor(selector: (raw: string) => boolean) {
  const block = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].find(([, raw]) =>
    selector((raw ?? '').trim()),
  );
  if (!block) throw new Error('theme block not found');
  const tokens: Record<string, string> = {};
  for (const [, name, value] of (block[2] ?? '').matchAll(
    /--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g,
  )) {
    if (name && value) tokens[name] = value.toLowerCase();
  }
  return tokens;
}

const themes = {
  light: tokensFor((raw) => raw.startsWith(':root')),
  dark: tokensFor((raw) => raw === "[data-theme='dark']"),
};

function luminance(hex: string) {
  const [r = 0, g = 0, b = 0] = (hex.slice(1).match(/../g) ?? []).map(
    (channel) => {
      const c = Number.parseInt(channel, 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    },
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [light = 0, dark = 0] = [luminance(a), luminance(b)].sort(
    (x, y) => y - x,
  );
  return (light + 0.05) / (dark + 0.05);
}

// Pairs from DESIGN.md §2. Text pairs need 4.5:1 (WCAG AA); control and focus pairs need 3:1.
const pairs: Array<{ name: string; fg: string; bg: string; min: number }> = [
  { name: 'ink on surface', fg: 'ink', bg: 'surface', min: 4.5 },
  { name: 'ink on surface-raised', fg: 'ink', bg: 'surface-raised', min: 4.5 },
  { name: 'ink on surface-sunken', fg: 'ink', bg: 'surface-sunken', min: 4.5 },
  { name: 'ink on surface-tint', fg: 'ink', bg: 'surface-tint', min: 4.5 },
  { name: 'ink-muted on surface-tint', fg: 'ink-muted', bg: 'surface-tint', min: 4.5 },
  { name: 'primary on surface-tint', fg: 'primary', bg: 'surface-tint', min: 4.5 },
  { name: 'line-strong on surface-tint', fg: 'line-strong', bg: 'surface-tint', min: 3 },
  { name: 'ink-muted on surface', fg: 'ink-muted', bg: 'surface', min: 4.5 },
  {
    name: 'ink-muted on surface-raised',
    fg: 'ink-muted',
    bg: 'surface-raised',
    min: 4.5,
  },
  {
    name: 'ink-muted on surface-sunken',
    fg: 'ink-muted',
    bg: 'surface-sunken',
    min: 4.5,
  },
  { name: 'on-primary on primary', fg: 'on-primary', bg: 'primary', min: 4.5 },
  {
    name: 'on-primary on primary-hover',
    fg: 'on-primary',
    bg: 'primary-hover',
    min: 4.5,
  },
  { name: 'primary on surface', fg: 'primary', bg: 'surface', min: 4.5 },
  {
    name: 'primary on primary-soft',
    fg: 'primary',
    bg: 'primary-soft',
    min: 4.5,
  },
  { name: 'ink on primary-soft', fg: 'ink', bg: 'primary-soft', min: 4.5 },
  { name: 'success on surface', fg: 'success', bg: 'surface', min: 4.5 },
  {
    name: 'success on success-soft',
    fg: 'success',
    bg: 'success-soft',
    min: 4.5,
  },
  { name: 'warning on surface', fg: 'warning', bg: 'surface', min: 4.5 },
  {
    name: 'warning on warning-soft',
    fg: 'warning',
    bg: 'warning-soft',
    min: 4.5,
  },
  { name: 'danger on surface', fg: 'danger', bg: 'surface', min: 4.5 },
  { name: 'danger on danger-soft', fg: 'danger', bg: 'danger-soft', min: 4.5 },
  {
    name: 'line-strong (control border) on surface',
    fg: 'line-strong',
    bg: 'surface',
    min: 3,
  },
  // focus-ring is an alias of primary in theme.css (a var reference, so it is read as primary).
  {
    name: 'focus-ring (primary) on surface',
    fg: 'primary',
    bg: 'surface',
    min: 3,
  },
];

describe('Stockline theme contrast (DESIGN.md §2)', () => {
  for (const [themeName, tokens] of Object.entries(themes)) {
    describe(themeName, () => {
      for (const pair of pairs) {
        it(`${pair.name} ≥ ${pair.min}:1`, () => {
          const fg = tokens[pair.fg] ?? '';
          const bg = tokens[pair.bg] ?? '';
          expect(fg, `missing token ${pair.fg}`).toMatch(/^#/);
          expect(bg, `missing token ${pair.bg}`).toMatch(/^#/);
          expect(contrast(fg, bg)).toBeGreaterThanOrEqual(pair.min);
        });
      }
    });
  }
});
