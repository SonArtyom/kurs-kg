import { describe, expect, it } from 'vitest';
import { applyExprKey, evaluate, hasOp, tokenize } from '../src/expr';
import { SCALE } from '../src/money';

const v = (s: string) => evaluate(s);
const n = (x: number | string) => BigInt(Math.round(Number(x) * 1e8)) * (SCALE / SCALE);

describe('evaluate', () => {
  it('adds: 250 + 250 = 500', () => {
    expect(v('250+250')).toBe(500n * SCALE);
  });
  it('subtracts, multiplies, divides', () => {
    expect(v('1000−250,5')).toBe(n('749.5'));
    expect(v('12,5×4')).toBe(50n * SCALE);
    expect(v('100÷4')).toBe(25n * SCALE);
  });
  it('× and ÷ bind tighter than + and −', () => {
    expect(v('2+3×4')).toBe(14n * SCALE);
    expect(v('100−10÷4')).toBe(n('97.5'));
    expect(v('10÷4×2')).toBe(5n * SCALE);
  });
  it('is exact: 0,1+0,2 = 0,3 and (1÷3)×3 = 1', () => {
    expect(v('0,1+0,2')).toBe(n('0.3'));
    expect(v('1÷3×3')).toBe(SCALE);
  });
  it('rounds non-terminating results half-up at 8 places', () => {
    expect(v('2÷3')).toBe(66666667n);
  });
  it('allows negative results and a leading minus', () => {
    expect(v('100−250')).toBe(-150n * SCALE);
    expect(v('−5+2')).toBe(-3n * SCALE);
  });
  it('ignores a trailing operator while typing', () => {
    expect(v('250+')).toBe(250n * SCALE);
    expect(v('250×')).toBe(250n * SCALE);
  });
  it('rejects division by zero and garbage', () => {
    expect(v('5÷0')).toBeNull();
    expect(v('')).toBeNull();
    expect(v('−')).toBeNull();
    expect(v('1,2,3+1')).toBeNull();
  });
});

describe('tokenize / hasOp', () => {
  it('splits numbers and operators', () => {
    expect(tokenize('12,5+3×2')).toEqual(['12,5', '+', '3', '×', '2']);
    expect(hasOp('250')).toBe(false);
    expect(hasOp('250+1')).toBe(true);
  });
});

describe('applyExprKey', () => {
  const type = (keys: string[], maxFrac = 2, start = '') => keys.reduce((s, k) => applyExprKey(s, k, maxFrac), start);

  it('types 250 + 250', () => {
    expect(type(['2', '5', '0', '+', '2', '5', '0'])).toBe('250+250');
  });
  it('replaces an operator typed twice', () => {
    expect(type(['5', '+', '×'])).toBe('5×');
  });
  it('limits decimals per number, not per expression', () => {
    expect(type(['1', ',', '2', '5', '9', '+', '3', ',', '4', '4', '4'])).toBe('1,25+3,44');
  });
  it('multiplier may have 4 decimals even for 0-digit currencies', () => {
    expect(type(['1', '0', '0', '0', '×', '1', ',', '2', '3', '4', '5', '6'], 0)).toBe('1000×1,2345');
    expect(type(['1', ','], 0)).toBe('1');
  });
  it('operator right after a comma replaces the comma', () => {
    expect(type(['5', ',', '+'])).toBe('5+');
  });
  it('leading minus only, no other leading operator', () => {
    expect(type(['+'])).toBe('');
    expect(type(['−', '5'])).toBe('−5');
  });
  it('leading zero is replaced within each number', () => {
    expect(type(['0', '7', '+', '0', '5'])).toBe('7+5');
    expect(type([',', '5'])).toBe('0,5');
    expect(type(['+', ','], 2, '3')).toBe('3+0,');
  });
  it('backspace and clear', () => {
    expect(applyExprKey('250+2', '⌫', 2)).toBe('250+');
    expect(applyExprKey('250+2', 'C', 2)).toBe('');
  });
  it('caps a number at 12 integer digits', () => {
    expect(applyExprKey('999999999999', '1', 2)).toBe('999999999999');
  });
});
