// Calculator expressions typed into the active row: "250+250", "1200×3−15,5", "100÷3".
// Evaluated exactly with BigInt fractions; rounded once to SCALE at the end.
import { divRound, parseDecimal, SCALE } from './money';

export const OPS = ['+', '−', '×', '÷'] as const;
export type Op = (typeof OPS)[number];
const isOp = (c: string): c is Op => (OPS as readonly string[]).includes(c);

/** Split "12,5+3×2" into ["12,5", "+", "3", "×", "2"]. */
export function tokenize(raw: string): string[] {
  const out: string[] = [];
  let num = '';
  for (const ch of raw) {
    if (isOp(ch)) {
      out.push(num, ch);
      num = '';
    } else num += ch;
  }
  out.push(num);
  return out;
}

export const hasOp = (raw: string) => [...raw].some(isOp);

interface Frac {
  n: bigint;
  d: bigint;
}

/**
 * Evaluate to a signed integer scaled by SCALE. × and ÷ bind tighter than + and −.
 * A trailing operator is ignored (so "250+" still shows 250 while typing).
 * Returns null for empty/invalid input or division by zero.
 */
export function evaluate(raw: string): bigint | null {
  let toks = tokenize(raw);
  if (toks.length > 1 && toks[toks.length - 1] === '') toks = toks.slice(0, -2);
  if (toks.length === 0 || toks.length % 2 === 0) return null;
  if (toks[0] === '' && toks[1] === '−') toks[0] = '0'; // leading minus

  const nums: Frac[] = [];
  for (let i = 0; i < toks.length; i += 2) {
    const v = parseDecimal(toks[i]);
    if (v === null) return null;
    nums.push({ n: v, d: SCALE });
  }

  // first pass: × ÷
  const terms: Frac[] = [nums[0]];
  const signs: bigint[] = [1n];
  for (let i = 1; i < nums.length; i++) {
    const op = toks[i * 2 - 1] as Op;
    const b = nums[i];
    if (op === '×' || op === '÷') {
      const a = terms[terms.length - 1];
      if (op === '÷' && b.n === 0n) return null;
      terms[terms.length - 1] = op === '×' ? { n: a.n * b.n, d: a.d * b.d } : { n: a.n * b.d, d: a.d * b.n };
    } else {
      terms.push(b);
      signs.push(op === '+' ? 1n : -1n);
    }
  }

  // second pass: + −
  let acc: Frac = { n: 0n, d: 1n };
  terms.forEach((t, i) => {
    acc = { n: acc.n * t.d + signs[i] * t.n * acc.d, d: acc.d * t.d };
  });
  const neg = acc.n < 0n;
  const scaled = divRound((neg ? -acc.n : acc.n) * SCALE, acc.d);
  return neg ? -scaled : scaled;
}

/**
 * Apply a keypad key to the expression string.
 * `maxFrac` limits decimals of plain amounts; operands after × or ÷ may have up to 4.
 */
export function applyExprKey(raw: string, key: string, maxFrac: number): string {
  if (key === 'C') return '';
  if (key === '⌫') return raw.slice(0, -1);
  const last = raw.slice(-1);

  if (isOp(key)) {
    if (raw === '') return key === '−' ? '−' : raw;
    if (raw === '−') return raw;
    if (isOp(last)) return raw.slice(0, -1) + key;
    if (last === ',') return raw.slice(0, -1) + key;
    if (tokenize(raw).length >= 41) return raw; // 20 operations is plenty
    return raw + key;
  }

  const toks = tokenize(raw);
  const cur = toks[toks.length - 1];
  const prevOp = toks.length > 1 ? toks[toks.length - 2] : '';
  const fracLimit = prevOp === '×' || prevOp === '÷' ? Math.max(maxFrac, 4) : maxFrac;
  const head = raw.slice(0, raw.length - cur.length);
  const f = cur.split(',')[1];

  if (key === ',') {
    if (fracLimit === 0 || f !== undefined) return raw;
    return head + (cur === '' ? '0' : cur) + ',';
  }
  if (!/^\d+$/.test(key)) return raw;

  let next = cur;
  for (const ch of key) {
    const [nw, nf] = next.split(',');
    if (nf !== undefined) {
      if (nf.length >= Math.max(fracLimit, f?.length ?? 0)) break;
      next += ch;
    } else if (nw === '0') next = ch;
    else if (nw.length >= 12) break;
    else next += ch;
  }
  return head + next;
}
