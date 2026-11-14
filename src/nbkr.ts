// National Bank of the Kyrgyz Republic official rates (KGS per `Nominal` units).
// https://www.nbkr.kg/XML/daily.xml  — USD, EUR, CNY, KZT, RUB (daily)
// https://www.nbkr.kg/XML/weekly.xml — ~44 other currencies (weekly)
import { parseDecimal, type Rate } from './money';

export interface Feed {
  /** Date the rates apply to, ISO "YYYY-MM-DD". */
  date: string;
  rates: Record<string, Rate>;
}

/** "14.11.2026" -> "2026-11-14" */
function toIsoDate(d: string): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(d.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** Parse an NBKR CurrencyRates XML document. Throws on malformed input. */
export function parseNbkrXml(xml: string): Feed {
  const root = /<CurrencyRates\b[^>]*\bDate="([^"]+)"/.exec(xml);
  if (!root) throw new Error('NBKR: no CurrencyRates element');
  const date = toIsoDate(root[1]);
  if (!date) throw new Error(`NBKR: invalid date "${root[1]}"`);

  const rates: Record<string, Rate> = {};
  const re = /<Currency\b[^>]*\bISOCode="([A-Z]{3})"[^>]*>([\s\S]*?)<\/Currency>/g;
  for (let m; (m = re.exec(xml)); ) {
    const body = m[2];
    const nominal = /<Nominal>\s*(\d+)\s*<\/Nominal>/.exec(body);
    const value = /<Value>\s*([\d\s,.]+?)\s*<\/Value>/.exec(body);
    if (!nominal || !value) continue;
    const v = parseDecimal(value[1]);
    const n = BigInt(nominal[1]);
    if (v === null || v <= 0n || n <= 0n) continue;
    rates[m[1]] = { value: v, nominal: n };
  }
  if (Object.keys(rates).length === 0) throw new Error('NBKR: no rates in response');
  return { date, rates };
}

interface CapWindow {
  Capacitor?: { isNativePlatform?: () => boolean };
}

/** In the APK, fetch is routed through native HTTP (CapacitorHttp), so NBKR's missing CORS is no problem.
 *  In the browser dev server, requests go through the Vite proxy at /nbkr. */
function baseUrl(): string {
  const native = (globalThis as CapWindow).Capacitor?.isNativePlatform?.() ?? false;
  return native ? 'https://www.nbkr.kg' : '/nbkr';
}

async function fetchText(url: string, timeoutMs = 15000): Promise<string> {
  const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs));
  const res = await Promise.race([fetch(url, { cache: 'no-store' }), timeout]);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Promise.race([res.text(), timeout]);
}

export async function fetchFeed(kind: 'daily' | 'weekly'): Promise<Feed> {
  return parseNbkrXml(await fetchText(`${baseUrl()}/XML/${kind}.xml`));
}
