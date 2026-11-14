// Exact decimal math on BigInt. No float ever touches a money value.

/** Fixed scale for rates and amounts: 8 decimal places. */
export const SCALE_DIGITS = 8;
export const SCALE = 10n ** BigInt(SCALE_DIGITS);

/** Rate of one currency against KGS: `nominal` units cost `value / SCALE` KGS. */
export interface Rate {
  value: bigint;
  nominal: bigint;
}

export const KGS_RATE: Rate = { value: SCALE, nominal: 1n };

/**
 * Parse a decimal string ("87,4355", "1 000.5") into an integer scaled by SCALE.
 * Returns null for empty or invalid input. Digits beyond SCALE_DIGITS are rounded half-up.
 */
export function parseDecimal(input: string): bigint | null {
  const s = input.replace(/[\s  ]/g, '').replace(',', '.');
  const m = /^(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m || (m[1] === '' && (m[2] ?? '') === '')) return null;
  const whole = m[1] === '' ? 0n : BigInt(m[1]);
  let frac = m[2] ?? '';
  let roundUp = false;
  if (frac.length > SCALE_DIGITS) {
    roundUp = frac.charCodeAt(SCALE_DIGITS) >= 53; // '5'
    frac = frac.slice(0, SCALE_DIGITS);
  }
  const fracInt = BigInt(frac.padEnd(SCALE_DIGITS, '0') || '0');
  return whole * SCALE + fracInt + (roundUp ? 1n : 0n);
}

/** Integer division rounded half-up (both operands non-negative, den > 0). */
export function divRound(num: bigint, den: bigint): bigint {
  return (num * 2n + den) / (den * 2n);
}

/**
 * Convert `amount` (scaled by SCALE) from one currency to another through KGS.
 * Result is in minor units with `digits` decimal places, rounded once, half-up.
 */
export function convert(amount: bigint, from: Rate, to: Rate, digits: number): bigint {
  const num = amount * from.value * to.nominal * 10n ** BigInt(digits);
  const den = SCALE * from.nominal * to.value;
  return divRound(num, den);
}

export interface Converted {
  minor: bigint;
  digits: number;
}

/**
 * Convert and, if the result is tiny (fewer than 2 significant digits at the
 * currency's own precision), add decimal places up to 8 so it does not show as 0.
 */
export function convertForDisplay(amount: bigint, from: Rate, to: Rate, digits: number): Converted {
  let d = digits;
  let minor = convert(amount, from, to, d);
  while (amount > 0n && minor < 10n && d < SCALE_DIGITS) {
    d++;
    minor = convert(amount, from, to, d);
  }
  return { minor, digits: d };
}

const groupFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

/** "1 234 567,89". Trailing zero fraction is dropped entirely; otherwise the fraction is kept at its precision. */
export function formatMinor({ minor, digits }: Converted, keepZeros = true): string {
  const p = 10n ** BigInt(digits);
  const whole = minor / p;
  let frac = digits > 0 ? (minor % p).toString().padStart(digits, '0') : '';
  if (!keepZeros) frac = frac.replace(/0+$/, '');
  if (/^0*$/.test(frac)) frac = '';
  return groupFmt.format(whole) + (frac ? ',' + frac : '');
}

/** Plain editable form of a value, e.g. "1234,5" (no grouping, no trailing zeros). */
export function toInput(c: Converted): string {
  return formatMinor(c, false).replace(/[\s  ]/g, '');
}

/** Group the integer part of a raw input string while keeping what the user typed after the comma. */
export function formatInput(raw: string): string {
  if (raw === '') return '';
  const [w, f] = raw.split(',');
  const whole = groupFmt.format(BigInt(w === '' ? '0' : w));
  return f === undefined ? whole : `${whole},${f}`;
}

/** Apply a keypad key to the raw input string. */
export function applyKey(raw: string, key: string, maxFrac: number): string {
  const f = raw.split(',')[1];
  if (key === 'C') return '';
  if (key === '⌫') return raw.slice(0, -1);
  if (key === ',') {
    if (maxFrac === 0 || f !== undefined) return raw;
    return (raw === '' ? '0' : raw) + ',';
  }
  if (!/^\d+$/.test(key)) return raw;
  let next = raw;
  for (const ch of key) {
    const [nw, nf] = next.split(',');
    if (nf !== undefined) {
      if (nf.length >= Math.max(maxFrac, f?.length ?? 0)) break;
      next += ch;
    } else {
      if (nw === '0') next = ch;
      else if (nw.length >= 12) break;
      else next += ch;
    }
  }
  return next;
}
