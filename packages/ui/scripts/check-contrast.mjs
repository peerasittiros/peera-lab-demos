const themes = {
  light: {
    surface: '#f1efea',
    raised: '#fbfaf7',
    accentOn: '#ffffff',
    success: '#2e6420',
    successSoft: '#dbe9d1',
    warning: '#7f5200',
    warningSoft: '#f3e4c2',
    danger: '#b3261e',
    dangerSoft: '#f9e5dd',
    info: '#2443c4',
    infoSoft: '#dfe4f7',
  },
  dark: {
    surface: '#121211',
    raised: '#1c1c1a',
    accentOn: '#141414',
    success: '#8fd16f',
    successSoft: '#16290f',
    warning: '#f0b54a',
    warningSoft: '#33240a',
    danger: '#ff8a80',
    dangerSoft: '#3b1910',
    info: '#93a6ff',
    infoSoft: '#1b2248',
  },
};

const accents = {
  rentroll: {
    light: { accent: '#5b3a96', soft: '#ece6f7', on: '#ffffff' },
    dark: { accent: '#b9a2f0', soft: '#241a38', on: '#141414' },
  },
  stockline: {
    light: { accent: '#0a6767', soft: '#d2eae8', on: '#ffffff' },
    dark: { accent: '#5fd0c8', soft: '#0d2b2a', on: '#141414' },
  },
  slotbook: {
    light: { accent: '#2443c4', soft: '#dfe4f7', on: '#ffffff' },
    dark: { accent: '#93a6ff', soft: '#1b2248', on: '#141414' },
  },
  tableside: {
    light: { accent: '#2e6420', soft: '#dbe9d1', on: '#ffffff' },
    dark: { accent: '#8fd16f', soft: '#16290f', on: '#141414' },
  },
};

function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const failures = [];
function check(name, foreground, background, minimum) {
  const ratio = contrast(foreground, background);
  const result = `${ratio.toFixed(2)}:1`;
  if (ratio < minimum)
    failures.push(`${name}: ${result} (requires ${minimum}:1)`);
  console.log(
    `${ratio >= minimum ? 'PASS' : 'FAIL'} ${name}: ${result} (minimum ${minimum}:1)`,
  );
}

for (const [themeName, theme] of Object.entries(themes)) {
  check(
    `${themeName} ink on surface`,
    themeName === 'light' ? '#141414' : '#f0eee8',
    theme.surface,
    4.5,
  );
  check(
    `${themeName} muted ink on raised surface`,
    themeName === 'light' ? '#57534c' : '#ada89e',
    theme.raised,
    4.5,
  );

  for (const [semantic, text, soft] of [
    ['success', theme.success, theme.successSoft],
    ['warning', theme.warning, theme.warningSoft],
    ['danger', theme.danger, theme.dangerSoft],
    ['info', theme.info, theme.infoSoft],
  ]) {
    check(`${themeName} ${semantic} on soft`, text, soft, 4.5);
  }

  for (const [slug, pair] of Object.entries(accents)) {
    const product = pair[themeName];
    check(
      `${themeName} ${slug} accent on surface`,
      product.accent,
      theme.surface,
      4.5,
    );
    check(
      `${themeName} ${slug} on-accent on accent`,
      product.on,
      product.accent,
      4.5,
    );
    check(
      `${themeName} ${slug} accent control`,
      product.accent,
      theme.surface,
      3,
    );
    check(
      `${themeName} ${slug} accent soft boundary`,
      product.accent,
      product.soft,
      3,
    );
  }
}

if (failures.length) {
  console.error(
    '\nContrast failures:\n' +
      failures.map((failure) => `- ${failure}`).join('\n'),
  );
  process.exitCode = 1;
}
