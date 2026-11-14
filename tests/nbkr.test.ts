import { describe, expect, it, vi } from 'vitest';
import { parseNbkrXml } from '../src/nbkr';
import { deserialize, isStale, merge, serialize, type RatesCache } from '../src/rates';
import { KGS_RATE } from '../src/money';

vi.mock('../src/fallback', () => ({ FALLBACK_DAILY: '', FALLBACK_WEEKLY: '' }));

const DAILY = `<?xml version="1.0" encoding="windows-1251" ?>
<CurrencyRates Name="Daily Exchange Rates" Date="14.11.2026">
<Currency ISOCode="USD">
<Nominal>1</Nominal>
<Value>87,4355</Value>
</Currency>
<Currency ISOCode="EUR">
<Nominal>1</Nominal>
<Value>96,6905</Value>
</Currency>
<Currency ISOCode="KZT">
<Nominal>1</Nominal>
<Value>0,1972</Value>
</Currency>
</CurrencyRates>`;

const WEEKLY = `<?xml version="1.0" encoding="windows-1251" ?>
<CurrencyRates Name="Weekly Exchange Rates" Date="13.11.2026">
<Currency ISOCode="TRY">
<Nominal>1</Nominal>
<ValidFor>7</ValidFor>
<Value>2,1290</Value>
</Currency>
<Currency ISOCode="JPY">
<Nominal>10</Nominal>
<ValidFor>7</ValidFor>
<Value>5,6789</Value>
</Currency>
<Currency ISOCode="USD">
<Nominal>1</Nominal>
<ValidFor>7</ValidFor>
<Value>80,0000</Value>
</Currency>
</CurrencyRates>`;

describe('parseNbkrXml', () => {
  it('parses daily feed', () => {
    const f = parseNbkrXml(DAILY);
    expect(f.date).toBe('2026-11-14');
    expect(Object.keys(f.rates)).toEqual(['USD', 'EUR', 'KZT']);
    expect(f.rates.USD).toEqual({ value: 8743550000n, nominal: 1n });
    expect(f.rates.KZT).toEqual({ value: 19720000n, nominal: 1n });
  });
  it('parses weekly feed with ValidFor and nominal', () => {
    const f = parseNbkrXml(WEEKLY);
    expect(f.date).toBe('2026-11-13');
    expect(f.rates.JPY).toEqual({ value: 567890000n, nominal: 10n });
  });
  it('skips broken entries but keeps good ones', () => {
    const xml = `<CurrencyRates Date="01.02.2026">
      <Currency ISOCode="AAA"><Nominal>1</Nominal><Value>abc</Value></Currency>
      <Currency ISOCode="BBB"><Nominal>0</Nominal><Value>1,0</Value></Currency>
      <Currency ISOCode="CCC"><Nominal>1</Nominal><Value>2,5</Value></Currency>
    </CurrencyRates>`;
    expect(Object.keys(parseNbkrXml(xml).rates)).toEqual(['CCC']);
  });
  it('throws on html error pages and empty feeds', () => {
    expect(() => parseNbkrXml('<html><body>502 Bad Gateway</body></html>')).toThrow();
    expect(() => parseNbkrXml('<CurrencyRates Date="14.11.2026"></CurrencyRates>')).toThrow();
    expect(() => parseNbkrXml('<CurrencyRates Date="2026-11-14"><Currency ISOCode="USD"><Nominal>1</Nominal><Value>1</Value></Currency></CurrencyRates>')).toThrow();
  });
});

describe('rates cache', () => {
  const empty: RatesCache = { rates: {}, dailyDate: '', weeklyDate: '', fetchedAt: 0 };
  const daily = parseNbkrXml(DAILY);
  const weekly = parseNbkrXml(WEEKLY);

  it('daily overrides weekly, KGS always present', () => {
    const c = merge(empty, daily, weekly, 1000);
    expect(c.rates.USD.value).toBe(8743550000n);
    expect(c.rates.TRY).toBeDefined();
    expect(c.rates.KGS).toEqual(KGS_RATE);
    expect(c.fetchedAt).toBe(1000);
    expect(c.dailyDate).toBe('2026-11-14');
  });
  it('failed feeds keep the previous data', () => {
    const prev = merge(empty, daily, weekly, 1000);
    const c = merge(prev, null, null, 5000);
    expect(c).toEqual(prev);
  });
  it('serializes bigint rates round-trip', () => {
    const c = merge(empty, daily, weekly, 1000);
    expect(deserialize(serialize(c))).toEqual(c);
    expect(deserialize('{bad')).toBeNull();
  });
  it('stale detection', () => {
    const c = merge(empty, daily, weekly, Date.parse('2026-11-14T10:00:00'));
    expect(isStale(c, Date.parse('2026-11-14T12:00:00'))).toBe(false);
    expect(isStale(c, Date.parse('2026-11-15T12:00:00'))).toBe(true);
    expect(isStale({ ...c, fetchedAt: 0 }, Date.parse('2026-11-14T12:00:00'))).toBe(true);
  });
});
