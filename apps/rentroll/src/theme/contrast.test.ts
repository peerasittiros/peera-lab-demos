import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Reads `theme.css` and checks every text and control pair from DESIGN.md §2 in both themes.
 * Text pairs need 4.5:1 (WCAG AA); controls, graphics and focus rings need 3:1.
 */
const css = readFileSync(
  new URL('./theme.css', import.meta.url),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

type Tokens = Record<string, string>;

function themeBlock(selectorMatches: (selector: string) => boolean): Tokens {
  for (const [, selector = '', body = ''] of css.matchAll(
    /([^{}]+)\{([^{}]*)\}/g,
  )) {
    if (!selectorMatches(selector.trim())) continue;
    const tokens: Tokens = {};
    for (const [, name = '', value = ''] of body.matchAll(
      /--([\w-]+)\s*:\s*([^;]+);/g,
    )) {
      tokens[name] = value.trim();
    }
    return tokens;
  }
  throw new Error('theme block not found in theme.css');
}

const themes = {
  light: themeBlock(
    (selector) =>
      selector.includes(':root') && selector.includes("[data-theme='light']"),
  ),
  dark: themeBlock((selector) => selector === "[data-theme='dark']"),
};

/** Resolves a token to a hex color, following `var(--other)` references inside the same theme. */
function color(tokens: Tokens, name: string): string {
  const value = tokens[name];
  if (!value) throw new Error(`token --${name} is not defined`);
  const reference = /^var\(--([\w-]+)\)$/.exec(value);
  if (reference?.[1]) return color(tokens, reference[1]);
  if (!/^#[0-9a-f]{6}$/i.test(value))
    throw new Error(`--${name} is not a hex color: ${value}`);
  return value;
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/** [foreground, background, minimum ratio, what the pair is for]. */
const pairs: Array<[string, string, number, string]> = [
  ['ink', 'surface', 4.5, 'body text'],
  ['ink', 'surface-raised', 4.5, 'body text on cards'],
  ['ink', 'surface-sunken', 4.5, 'body text on stripes and bars'],
  ['ink', 'product-accent-soft', 4.5, 'selected row and chip text'],
  ['ink-muted', 'surface', 4.5, 'metadata'],
  ['ink-muted', 'surface-raised', 4.5, 'metadata on cards'],
  ['ink-muted', 'surface-sunken', 4.5, 'metadata on stripes'],
  ['product-accent', 'surface', 4.5, 'links and active nav text'],
  ['product-accent', 'surface-raised', 4.5, 'links on cards'],
  ['product-accent', 'product-accent-soft', 4.5, 'active nav item text'],
  ['primary-hover', 'product-accent-soft', 4.5, 'primary text on primary-soft'],
  ['product-on-accent', 'product-accent', 4.5, 'button label'],
  ['product-on-accent', 'primary-hover', 4.5, 'button label while hovered'],
  ['success', 'surface', 4.5, 'paid and available text'],
  ['success', 'success-soft', 4.5, 'paid chip'],
  ['success-fill', 'surface', 3, 'success dots and bars (graphic)'],
  ['warning', 'surface', 4.5, 'due-soon text'],
  ['warning', 'warning-soft', 4.5, 'warning chip'],
  ['danger', 'surface', 4.5, 'error text'],
  ['danger-ink', 'danger-soft', 4.5, 'overdue chip'],
  ['info', 'info-soft', 4.5, 'new and featured chip'],
  ['line-strong', 'surface', 3, 'input border (control)'],
  ['line-strong', 'surface-raised', 3, 'input border on cards (control)'],
  ['product-accent', 'surface', 3, 'primary control'],
  ['focus-ring', 'surface', 3, 'focus ring'],
];

describe.each(Object.keys(themes) as Array<keyof typeof themes>)(
  '%s theme contrast',
  (name) => {
    const tokens = themes[name];

    it.each(pairs)(
      '--%s on --%s ≥ %s (%s)',
      (foreground, background, minimum) => {
        const ratio = contrast(
          color(tokens, foreground),
          color(tokens, background),
        );
        expect(ratio, `${foreground} on ${background}`).toBeGreaterThanOrEqual(
          minimum,
        );
      },
    );
  },
);
