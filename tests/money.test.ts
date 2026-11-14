import { describe, expect, it } from 'vitest';
import {
  applyKey,
  convert,
  convertForDisplay,
  divRound,
  formatInput,
  formatMinor,
  KGS_RATE,
  parseDecimal,
  SCALE,
  toInput,
  type Rate,
} from '../src/money';

const r = (value: string, nominal = 1): Rate => ({ value: parseDecimal(value)!, nominal: BigInt(nominal) });
const USD = r('87,4355');
const EUR = r('96,6905');
const RUB = r('1,0563');
const KZT = r('0,1972');
const JPY10 = r('5,6789', 10); // 10 JPY = 5.6789 KGS
const NBSP = /[\s  ]/g;
const plain = (s: string) => s.replace(NBSP, ' ');

describe('parseDecimal', () => {
  it('reads comma and dot, grouping spaces', () => {
    expect(parseDecimal('87,4355')).toBe(8743550000n);
    expect(parseDecimal('1 000.5')).toBe(100050000000n);
    expect(parseDecimal('0,1')).toBe(10000000n);
    expect(parseDecimal(',5')).toBe(50000000n);
    expect(parseDecimal('12,')).toBe(1200000000n);
  });
  it('rejects garbage', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal(',')).toBeNull();
    expect(parseDecimal('1,2,3')).toBeNull();
    expect(parseDecimal('-5')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
  });
  it('rounds digits beyond 8 places half-up', () => {
    expect(parseDecimal('0,000000015')).toBe(2n);
    expect(parseDecimal('0,000000014')).toBe(1n);
  });
});

describe('divRound', () => {
  it('rounds half up', () => {
    expect(divRound(5n, 2n)).toBe(3n);
    expect(divRound(4n, 3n)).toBe(1n);
    expect(divRound(5n, 3n)).toBe(2n);
  });
});

describe('convert (cross rate via KGS)', () => {
  it('USD -> KGS uses the official rate exactly', () => {
    expect(convert(100n * SCALE, USD, KGS_RATE, 2)).toBe(874355n); // 8 743,55
  });
  it('KGS -> USD', () => {
    expect(convert(1000n * SCALE, KGS_RATE, USD, 2)).toBe(1144n); // 1000/87.4355 = 11.4370…
  });
  it('USD -> EUR cross rate', () => {
    // 100 * 87.4355 / 96.6905 = 90.4282…
    expect(convert(100n * SCALE, USD, EUR, 2)).toBe(9043n);
  });
  it('respects nominal', () => {
    // 1000 JPY = 567.89 KGS
    expect(convert(1000n * SCALE, JPY10, KGS_RATE, 2)).toBe(56789n);
    expect(convert(56789n * (SCALE / 100n), KGS_RATE, JPY10, 0)).toBe(1000n);
  });
  it('has no float drift: 0.1 + 0.2 style sums stay exact', () => {
    const a = parseDecimal('0,1')!;
    const b = parseDecimal('0,2')!;
    expect(convert(a + b, KGS_RATE, KGS_RATE, 2)).toBe(30n);
    expect(convert(parseDecimal('1,005')!, KGS_RATE, KGS_RATE, 2)).toBe(101n); // float would give 1.00
  });
  it('round-trips within one minor unit', () => {
    const rub = convert(12345n * SCALE, USD, RUB, 2);
    const back = convert(rub * (SCALE / 100n), RUB, USD, 2);
    expect(back).toBe(1234500n);
  });
  it('identity conversion', () => {
    expect(convert(parseDecimal('123,45')!, KZT, KZT, 2)).toBe(12345n);
  });
  it('handles huge amounts without overflow', () => {
    expect(convert(999_999_999_999n * SCALE, USD, KGS_RATE, 2)).toBe(8743549999991256n);
  });
});

describe('convertForDisplay', () => {
  it('adds precision for tiny values instead of showing 0', () => {
    const c = convertForDisplay(1n * SCALE, KZT, USD, 2); // 0.1972/87.4355 = 0.002255…
    expect(c.digits).toBe(4);
    expect(c.minor).toBe(23n);
  });
  it('keeps normal precision for normal values', () => {
    expect(convertForDisplay(100n * SCALE, USD, EUR, 2)).toEqual({ minor: 9043n, digits: 2 });
  });
  it('zero stays zero at normal precision', () => {
    expect(convertForDisplay(0n, USD, EUR, 2)).toEqual({ minor: 0n, digits: 2 });
  });
});

describe('formatting', () => {
  it('groups thousands with ru-RU spacing', () => {
    expect(plain(formatMinor({ minor: 123456789n, digits: 2 }))).toBe('1 234 567,89');
    expect(plain(formatMinor({ minor: 100000n, digits: 2 }))).toBe('1 000');
    expect(plain(formatMinor({ minor: 50n, digits: 2 }))).toBe('0,50');
    expect(plain(formatMinor({ minor: 1500n, digits: 0 }))).toBe('1 500');
  });
  it('toInput strips grouping and trailing zeros', () => {
    expect(toInput({ minor: 123450n, digits: 2 })).toBe('1234,5');
    expect(toInput({ minor: 23n, digits: 4 })).toBe('0,0023');
  });
  it('formatInput keeps what was typed after the comma', () => {
    expect(plain(formatInput('12345,50'))).toBe('12 345,50');
    expect(plain(formatInput('1000,'))).toBe('1 000,');
    expect(formatInput('')).toBe('');
  });
});

describe('applyKey', () => {
  it('types digits and a comma', () => {
    let s = '';
    for (const k of ['1', '2', ',', '5']) s = applyKey(s, k, 2);
    expect(s).toBe('12,5');
  });
  it('limits fraction digits to the currency precision', () => {
    expect(applyKey('1,25', '9', 2)).toBe('1,25');
    expect(applyKey('1', ',', 0)).toBe('1');
  });
  it('replaces a leading zero and prefixes a lone comma', () => {
    expect(applyKey('0', '7', 2)).toBe('7');
    expect(applyKey('', ',', 2)).toBe('0,');
    expect(applyKey('', '00', 2)).toBe('0');
    expect(applyKey('5', '00', 2)).toBe('500');
  });
  it('backspace and clear', () => {
    expect(applyKey('123', '⌫', 2)).toBe('12');
    expect(applyKey('123', 'C', 2)).toBe('');
  });
  it('caps integer part at 12 digits', () => {
    expect(applyKey('999999999999', '1', 2)).toBe('999999999999');
  });
});
