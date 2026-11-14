import { KGS_RATE, type Rate } from './money';
import { fetchFeed, parseNbkrXml, type Feed } from './nbkr';
import { FALLBACK_DAILY, FALLBACK_WEEKLY } from './fallback';

export interface RatesCache {
  /** Merged rates against KGS (KGS itself included). */
  rates: Record<string, Rate>;
  dailyDate: string;
  weeklyDate: string;
  /** ms epoch of the last successful download; 0 for the bundled snapshot. */
  fetchedAt: number;
}

type Stored = Omit<RatesCache, 'rates'> & { rates: Record<string, [string, string]> };

const KEY = 'kurs.rates.v1';

export function serialize(c: RatesCache): string {
  const rates: Stored['rates'] = {};
  for (const [k, r] of Object.entries(c.rates)) rates[k] = [r.value.toString(), r.nominal.toString()];
  return JSON.stringify({ ...c, rates } satisfies Stored);
}

export function deserialize(s: string): RatesCache | null {
  try {
    const o = JSON.parse(s) as Stored;
    const rates: Record<string, Rate> = {};
    for (const [k, [v, n]] of Object.entries(o.rates)) rates[k] = { value: BigInt(v), nominal: BigInt(n) };
    if (!rates.USD) return null;
    return { rates, dailyDate: o.dailyDate, weeklyDate: o.weeklyDate, fetchedAt: o.fetchedAt };
  } catch {
    return null;
  }
}

export function loadCache(): RatesCache {
  try {
    const s = localStorage.getItem(KEY);
    const c = s ? deserialize(s) : null;
    if (c) return c;
  } catch {
    /* storage unavailable */
  }
  const empty: RatesCache = { rates: {}, dailyDate: '', weeklyDate: '', fetchedAt: 0 };
  return { ...merge(empty, parseNbkrXml(FALLBACK_DAILY), parseNbkrXml(FALLBACK_WEEKLY), 0), fetchedAt: 0 };
}

export function saveCache(c: RatesCache): void {
  try {
    localStorage.setItem(KEY, serialize(c));
  } catch {
    /* ignore */
  }
}

/** Merge fresh feeds onto the previous cache: daily wins over weekly, a failed feed keeps old values. */
export function merge(prev: RatesCache, daily: Feed | null, weekly: Feed | null, now: number): RatesCache {
  return {
    rates: { ...prev.rates, ...(weekly?.rates ?? {}), ...(daily?.rates ?? {}), KGS: KGS_RATE },
    dailyDate: daily?.date ?? prev.dailyDate,
    weeklyDate: weekly?.date ?? prev.weeklyDate,
    fetchedAt: daily ? now : prev.fetchedAt,
  };
}

/** Download both feeds. Resolves with the new cache and whether the (essential) daily feed succeeded. */
export async function refresh(prev: RatesCache): Promise<{ cache: RatesCache; ok: boolean }> {
  const [d, w] = await Promise.allSettled([fetchFeed('daily'), fetchFeed('weekly')]);
  const daily = d.status === 'fulfilled' ? d.value : null;
  const weekly = w.status === 'fulfilled' ? w.value : null;
  const cache = merge(prev, daily, weekly, Date.now());
  if (daily || weekly) saveCache(cache);
  return { cache, ok: daily !== null };
}

const DAY = 86_400_000;

/** Data is stale if never downloaded, last download is over 24 h old, or the rate date is 4+ days behind. */
export function isStale(c: RatesCache, now: number): boolean {
  if (c.fetchedAt === 0 || now - c.fetchedAt > DAY) return true;
  const rateDay = Date.parse(c.dailyDate + 'T00:00:00');
  return now - rateDay > 4 * DAY;
}
