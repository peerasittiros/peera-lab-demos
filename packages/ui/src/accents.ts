export const accents = {
  rentroll: {
    light: { accent: '#5b3a96', soft: '#ece6f7', onAccent: '#ffffff' },
    dark: { accent: '#b9a2f0', soft: '#241a38', onAccent: '#141414' },
  },
  stockline: {
    light: { accent: '#0a6767', soft: '#d2eae8', onAccent: '#ffffff' },
    dark: { accent: '#5fd0c8', soft: '#0d2b2a', onAccent: '#141414' },
  },
  slotbook: {
    light: { accent: '#2443c4', soft: '#dfe4f7', onAccent: '#ffffff' },
    dark: { accent: '#93a6ff', soft: '#1b2248', onAccent: '#141414' },
  },
  tableside: {
    light: { accent: '#2e6420', soft: '#dbe9d1', onAccent: '#ffffff' },
    dark: { accent: '#8fd16f', soft: '#16290f', onAccent: '#141414' },
  },
} as const;

export type AccentSlug = keyof typeof accents;

/** CSS declarations for the product accent, scoped to light and dark theme roots. */
export function accentStyle(slug: AccentSlug): string {
  const accent = accents[slug];
  const declarations = (theme: 'light' | 'dark') => {
    const value = accent[theme];
    return `--product-accent: ${value.accent}; --product-on-accent: ${value.onAccent}; --product-accent-soft: ${value.soft};`;
  };

  return `:root, [data-theme='light'] { ${declarations('light')} }\n[data-theme='dark'] { ${declarations('dark')} }`;
}
