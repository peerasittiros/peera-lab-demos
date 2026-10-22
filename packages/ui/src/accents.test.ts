import { describe, expect, it } from 'vitest';
import { accentStyle, accents } from './accents';

describe('accentStyle', () => {
  it('returns light and dark CSS variables for each supported product', () => {
    for (const [slug, accent] of Object.entries(accents)) {
      const css = accentStyle(slug as keyof typeof accents);
      expect(css).toContain(`--product-accent: ${accent.light.accent}`);
      expect(css).toContain(`--product-on-accent: ${accent.light.onAccent}`);
      expect(css).toContain(`--product-accent-soft: ${accent.light.soft}`);
      expect(css).toContain(`--product-accent: ${accent.dark.accent}`);
      expect(css).toContain(`--product-on-accent: ${accent.dark.onAccent}`);
      expect(css).toContain(`--product-accent-soft: ${accent.dark.soft}`);
    }
  });
});
