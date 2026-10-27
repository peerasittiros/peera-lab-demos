// EAN-13 bars without a dependency, for the printable sample sheet (02 §3.1 item 3). Codes that aren't valid
// EAN-13 return null; the sheet then shows the code as text.

const L = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
];
const G = [
  '0100111',
  '0110011',
  '0011011',
  '0100001',
  '0011101',
  '0111001',
  '0000101',
  '0010001',
  '0001001',
  '0010111',
];
const R = [
  '1110010',
  '1100110',
  '1101100',
  '1000010',
  '1011100',
  '1001110',
  '1010000',
  '1000100',
  '1001000',
  '1110100',
];
/** Which of digits 2–7 use the G set, by the first digit. */
const PARITY = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLL',
  'LGLGLG',
  'LGLGGL',
  'LGGLGL',
];

export function isEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  const digits = [...code].map(Number);
  const sum = digits
    .slice(0, 12)
    .reduce((total, digit, index) => total + digit * (index % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}

/** The 95 modules of an EAN-13 symbol as a string of 1 (bar) and 0 (space), or null for an invalid code. */
export function ean13Modules(code: string): string | null {
  if (!isEan13(code)) return null;
  const digits = [...code].map(Number);
  const parity = PARITY[digits[0]!]!;
  let modules = '101';
  for (let index = 1; index <= 6; index += 1)
    modules += (parity[index - 1] === 'L' ? L : G)[digits[index]!]!;
  modules += '01010';
  for (let index = 7; index <= 12; index += 1) modules += R[digits[index]!]!;
  return `${modules}101`;
}

/** Bar rectangles in module units (x, width), merging runs of adjacent bars. */
export function ean13Bars(
  code: string,
): { x: number; width: number; guard: boolean }[] | null {
  const modules = ean13Modules(code);
  if (!modules) return null;
  const guards = new Set([0, 1, 2, 45, 46, 47, 48, 49, 92, 93, 94]);
  const bars: { x: number; width: number; guard: boolean }[] = [];
  for (let index = 0; index < modules.length; index += 1) {
    if (modules[index] !== '1') continue;
    const last = bars.at(-1);
    const guard = guards.has(index);
    if (last && last.x + last.width === index && last.guard === guard)
      last.width += 1;
    else bars.push({ x: index, width: 1, guard });
  }
  return bars;
}
