import type { MessageTree } from './messages';

function collect(tree: MessageTree, prefix = ''): Map<string, string> {
  const values = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      values.set(path, value);
    } else if (
      'one' in value &&
      typeof value.one === 'string' &&
      typeof value.other === 'string'
    ) {
      values.set(`${path}.one`, value.one);
      values.set(`${path}.other`, value.other);
    } else {
      for (const [nestedKey, nestedValue] of collect(value, path))
        values.set(nestedKey, nestedValue);
    }
  }
  return values;
}

/** Throw with a useful diff when locale keys diverge or a value is blank. */
export function expectParity(en: MessageTree, th: MessageTree): void {
  const english = collect(en);
  const thai = collect(th);
  const missing = [...english.keys()].filter((key) => !thai.has(key));
  const extra = [...thai.keys()].filter((key) => !english.has(key));
  const empty = [...english, ...thai]
    .filter(([, value]) => !value.trim())
    .map(([key]) => key);
  if (missing.length || extra.length || empty.length) {
    const details = [
      missing.length ? `missing in th: ${missing.join(', ')}` : '',
      extra.length ? `extra in th: ${extra.join(', ')}` : '',
      empty.length ? `empty values: ${[...new Set(empty)].join(', ')}` : '',
    ].filter(Boolean);
    throw new Error(`Locale message parity failed (${details.join('; ')})`);
  }
}
