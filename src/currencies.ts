// Currency metadata derived from Intl (no bundled tables needed).

export const DEFAULT_CODES = ['KGS', 'USD', 'EUR', 'RUB', 'KZT', 'KRW', 'JPY'];
/** Default set of v1.0.0; saved states equal to it are moved to the new default. */
export const OLD_DEFAULT_CODES = ['KGS', 'USD', 'EUR', 'RUB', 'KZT', 'CNY', 'TRY'];
export const MAX_ROWS = 7;
export const MIN_ROWS = 2;

/** Obsolete codes NBKR still lists; hidden from the picker. */
export const HIDDEN = new Set(['BYR']);

const names: Partial<Record<string, Intl.DisplayNames | null>> = {};
function displayNames(lang: string) {
  if (!(lang in names)) {
    try {
      names[lang] = new Intl.DisplayNames([lang], { type: 'currency' });
    } catch {
      names[lang] = null;
    }
  }
  return names[lang];
}

const OWN: Record<string, Record<string, string>> = {
  ru: { XDR: 'СДР (МВФ)', KGS: 'Кыргызский сом' },
  en: { XDR: 'SDR (IMF)', KGS: 'Kyrgyz som' },
};

export function currencyName(code: string, lang = 'ru'): string {
  const own = OWN[lang]?.[code];
  if (own) return own;
  const n = displayNames(lang)?.of(code);
  if (!n || n === code) return code;
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** Emoji flag from the first two letters of the ISO code (works for all NBKR codes except XDR). */
export function currencyFlag(code: string): string {
  if (code === 'XDR') return '🌐';
  const a = 0x1f1e6 - 65;
  return String.fromCodePoint(a + code.charCodeAt(0), a + code.charCodeAt(1));
}

/** Practical decimal places for display. */
const OVERRIDE: Record<string, number> = { IRR: 0, IDR: 0, UZS: 0, VND: 0, KRW: 0, MNT: 0, AFN: 0, PKR: 0 };

export function currencyDigits(code: string): number {
  if (code in OVERRIDE) return OVERRIDE[code];
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}
