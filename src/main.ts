import './style.css';
import { convertForDisplay, decimalSeparator, formatInput, formatMinor, KGS_RATE, SCALE, setNumberLocale, toInput } from './money';
import { applyExprKey, evaluate, hasOp, tokenize } from './expr';
import {
  currencyDigits,
  currencyFlag,
  currencyName,
  DEFAULT_CODES,
  HIDDEN,
  MAX_ROWS,
  MIN_ROWS,
  OLD_DEFAULT_CODES,
} from './currencies';
import { isStale, loadCache, refresh, type RatesCache } from './rates';
import { STRINGS, type Lang } from './i18n';

// ---------- persistent UI state ----------
interface UiState {
  codes: string[];
  active: string;
  /** Raw expression typed into the active row; comma decimal, ops + − × ÷. */
  input: string;
}
const STATE_KEY = 'kurs.state.v1';
const LANG_KEY = 'converter.lang';

function loadState(): UiState {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null') as UiState | null;
    if (s && Array.isArray(s.codes) && s.codes.length >= MIN_ROWS && typeof s.input === 'string') {
      let codes = s.codes.slice(0, MAX_ROWS);
      if (codes.join() === OLD_DEFAULT_CODES.join()) codes = [...DEFAULT_CODES];
      return { codes, active: codes.includes(s.active) ? s.active : codes[0], input: s.input };
    }
  } catch {
    /* fall through */
  }
  return { codes: [...DEFAULT_CODES], active: 'USD', input: '100' };
}
function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
function loadLang(): Lang {
  try {
    const l = localStorage.getItem(LANG_KEY);
    if (l === 'ru' || l === 'en') return l;
  } catch {
    /* ignore */
  }
  return /^(ru|ky|kk|be|uk)\b/i.test(navigator.language) ? 'ru' : 'en';
}

let state = loadState();
let lang: Lang = loadLang();
let t = STRINGS[lang];
let cache: RatesCache = loadCache();
let editing = false;
let loading = false;
let lastOk: boolean | null = null;
let lastAttempt = 0;

// ---------- DOM helpers ----------
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

const listEl = $('list');
const padEl = $('pad');
const statusEl = $<HTMLButtonElement>('status');
const editBtn = $<HTMLButtonElement>('edit');
const langBtn = $<HTMLButtonElement>('lang');
const sheetEl = $('sheet');
const searchEl = $<HTMLInputElement>('search');
const pickerEl = $('picker');

// ---------- values ----------
const sizeClass = (text: string) => (text.length > 16 ? ' xs' : text.length > 12 ? ' s' : '');

/** "250 + 1 000,5 ×" — the expression as typed, with grouping and the locale decimal separator. */
function formatExpr(raw: string): string {
  return tokenize(raw)
    .map((tok, i) => (i % 2 ? ` ${tok} ` : formatInput(tok)))
    .join('')
    .trim();
}

function result(code: string): { text: string; empty: boolean } {
  const amount = evaluate(state.input);
  const from = cache.rates[state.active];
  const to = cache.rates[code];
  if (!from || !to) return { text: '—', empty: true };
  if (amount === null) return { text: state.input && hasOp(state.input) ? t.error : '0', empty: true };
  return { text: formatMinor(convertForDisplay(amount, from, to, currencyDigits(code))), empty: false };
}

/** Collapse the active expression to its value in the target currency's raw input form. */
function collapsedInput(code: string): string {
  const amount = evaluate(state.input);
  const from = cache.rates[state.active];
  const to = cache.rates[code];
  if (amount === null || !from || !to) return '';
  const s = toInput(convertForDisplay(amount, from, to, currencyDigits(code)));
  return s === '0' ? '' : s;
}

function activate(code: string) {
  if (code === state.active) return;
  state.input = collapsedInput(code);
  state.active = code;
  saveState();
  renderList();
}

// ---------- rendering ----------
interface RowNodes {
  amount: HTMLElement;
  expr: HTMLElement | null;
}
const rowNodes = new Map<string, RowNodes>();

function updateAmounts() {
  for (const [code, n] of rowNodes) {
    if (code === state.active) {
      const isExpr = hasOp(state.input);
      if (isExpr) {
        n.expr!.firstElementChild!.textContent = formatExpr(state.input);
        const r = result(code);
        n.amount.textContent = '= ' + r.text;
        n.amount.className = 'amount result' + sizeClass(r.text);
      } else {
        const text = state.input === '' ? '0' : formatExpr(state.input);
        n.amount.textContent = text;
        n.amount.className = 'amount typing' + sizeClass(text) + (state.input === '' ? ' placeholder' : '');
      }
      n.expr!.hidden = !isExpr;
    } else {
      const r = result(code);
      n.amount.textContent = r.text;
      n.amount.className = 'amount' + sizeClass(r.text) + (r.empty ? ' placeholder' : '');
    }
  }
}

function renderList() {
  listEl.replaceChildren();
  rowNodes.clear();
  state.codes.forEach((code, i) => {
    const active = !editing && code === state.active;
    const row = el(editing ? 'div' : 'button', 'row' + (active ? ' active' : ''));
    if (row instanceof HTMLButtonElement) {
      row.type = 'button';
      row.addEventListener('click', () => activate(code));
    }
    row.append(el('span', 'flag', currencyFlag(code)));
    const cur = el('span', 'cur');
    cur.append(el('span', 'code', code), el('span', 'name', currencyName(code, lang)));
    row.append(cur);

    if (editing) {
      const tools = el('div', 'row-tools');
      const up = el('button', 'icon-btn', '↑');
      const down = el('button', 'icon-btn', '↓');
      const del = el('button', 'icon-btn del', '✕');
      up.setAttribute('aria-label', t.up(code));
      down.setAttribute('aria-label', t.down(code));
      del.setAttribute('aria-label', t.del(code));
      up.disabled = i === 0;
      down.disabled = i === state.codes.length - 1;
      del.disabled = state.codes.length <= MIN_ROWS;
      up.onclick = () => move(i, -1);
      down.onclick = () => move(i, 1);
      del.onclick = () => remove(code);
      tools.append(up, down, del);
      row.append(tools);
    } else {
      const box = el('span', 'amount-box');
      const expr = active ? el('span', 'expr') : null;
      const amount = el('span', 'amount');
      if (expr) {
        expr.append(el('span'));
        box.append(expr);
      }
      box.append(amount);
      row.append(box);
      rowNodes.set(code, { amount, expr });
    }
    listEl.append(row);
  });

  if (state.codes.length < MAX_ROWS) {
    const add = el('button', 'add', t.add);
    add.type = 'button';
    add.onclick = openSheet;
    listEl.append(add);
  }
  updateAmounts();
  if (!editing) listEl.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
}

function move(i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= state.codes.length) return;
  [state.codes[i], state.codes[j]] = [state.codes[j], state.codes[i]];
  saveState();
  renderList();
}

function remove(code: string) {
  if (state.codes.length <= MIN_ROWS) return;
  if (code === state.active) activate(state.codes.find((c) => c !== code)!);
  state.codes = state.codes.filter((c) => c !== code);
  saveState();
  renderList();
}

function setEditing(on: boolean) {
  editing = on;
  editBtn.textContent = on ? t.done : t.edit;
  padEl.hidden = on;
  renderList();
}

// ---------- status ----------
const dateFmt = (iso: string) => (iso ? iso.split('-').reverse().join('.') : '—');
const locale = () => (lang === 'ru' ? 'ru-RU' : 'en-GB');

function renderStatus() {
  const timeFmt = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' });
  const dayTimeFmt = new Intl.DateTimeFormat(locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const rate = t.rateOn(dateFmt(cache.dailyDate));
  let text: string;
  let warn = false;
  if (loading) text = t.updating(rate);
  else if (lastOk === false) {
    warn = true;
    text = cache.fetchedAt === 0 ? t.offlineBuiltIn(rate) : t.offline(rate, dayTimeFmt.format(cache.fetchedAt));
  } else if (isStale(cache, Date.now())) {
    warn = true;
    text = t.stale(rate);
  } else text = t.ok(rate, timeFmt.format(cache.fetchedAt));
  statusEl.className = 'status' + (warn ? ' warn' : '') + (loading ? ' loading' : '');
  statusEl.querySelector('.status-text')!.textContent = text;
  statusEl.title = t.tapToRefresh;
}

async function update() {
  if (loading) return;
  loading = true;
  lastAttempt = Date.now();
  renderStatus();
  try {
    const r = await refresh(cache);
    cache = r.cache;
    lastOk = r.ok;
  } catch {
    lastOk = false;
  } finally {
    loading = false;
    renderStatus();
    updateAmounts();
  }
}

// ---------- keypad ----------
const KEYS = ['C', '⌫', '÷', '×', '7', '8', '9', '−', '4', '5', '6', '+', '1', '2', '3', '=', ',', '0', '00', '⇅'];
const FN = new Set(['C', '⌫', '⇅']);
const OPK = new Set(['÷', '×', '−', '+']);
const keyBtns = new Map<string, HTMLButtonElement>();

for (const k of KEYS) {
  const b = el('button', 'key' + (FN.has(k) ? ' fn' : '') + (OPK.has(k) ? ' op' : '') + (k === '=' ? ' eq' : ''), k);
  b.type = 'button';
  b.addEventListener('click', () => press(k));
  keyBtns.set(k, b);
  padEl.append(b);
}

function press(k: string) {
  if (k === '⇅') {
    const i = state.codes.indexOf(state.active);
    activate(state.codes[(i + 1) % state.codes.length]);
    return;
  }
  const next = k === '=' ? collapsedInput(state.active) : applyExprKey(state.input, k, currencyDigits(state.active));
  if (next === state.input) return;
  state.input = next;
  saveState();
  updateAmounts();
}

// hardware / desktop keyboard
document.addEventListener('keydown', (e) => {
  if (!sheetEl.hidden || editing) return;
  const map: Record<string, string> = {
    Backspace: '⌫',
    Delete: 'C',
    Escape: 'C',
    '.': ',',
    '+': '+',
    '-': '−',
    '*': '×',
    '/': '÷',
    '=': '=',
    Enter: '=',
    Tab: '⇅',
  };
  const k = map[e.key] ?? (/^[\d,]$/.test(e.key) ? e.key : '');
  if (k) {
    e.preventDefault();
    press(k);
  }
});

// ---------- add-currency sheet ----------
function renderPicker() {
  const q = searchEl.value.trim().toLowerCase();
  const items = Object.keys(cache.rates)
    .filter((c) => !HIDDEN.has(c) && !state.codes.includes(c))
    .map((c) => ({ code: c, name: currencyName(c, lang), alt: currencyName(c, lang === 'ru' ? 'en' : 'ru') }))
    .filter((x) => !q || [x.code, x.name, x.alt].some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name, lang));

  pickerEl.replaceChildren();
  if (items.length === 0) {
    pickerEl.append(el('li', 'empty', t.nothing));
    return;
  }
  for (const { code, name } of items) {
    const li = el('li');
    const b = el('button');
    b.type = 'button';
    const cur = el('span', 'cur');
    cur.append(el('span', 'code', code), el('span', 'name', name));
    const perUnit = formatMinor(convertForDisplay(SCALE, cache.rates[code], KGS_RATE, 2));
    b.append(el('span', 'flag', currencyFlag(code)), cur, el('span', 'rate', `${perUnit} ${t.kgsUnit}`));
    b.onclick = () => {
      state.codes.push(code);
      saveState();
      closeSheet();
      renderList();
    };
    li.append(b);
    pickerEl.append(li);
  }
}

function openSheet() {
  if (state.codes.length >= MAX_ROWS) return;
  searchEl.value = '';
  renderPicker();
  sheetEl.hidden = false;
  history.pushState({ sheet: true }, ''); // Android back button closes the sheet
}
function closeSheet(fromPop = false) {
  if (sheetEl.hidden) return;
  sheetEl.hidden = true;
  searchEl.blur();
  if (!fromPop && history.state?.sheet) history.back();
}

// ---------- language ----------
function applyLang() {
  t = STRINGS[lang];
  setNumberLocale(lang);
  document.documentElement.lang = lang;
  langBtn.textContent = lang === 'ru' ? 'EN' : 'RU';
  langBtn.setAttribute('aria-label', t.langToggle);
  editBtn.textContent = editing ? t.done : t.edit;
  $('sheet-title').textContent = t.addTitle;
  $('sheet-close').setAttribute('aria-label', t.close);
  searchEl.placeholder = t.search;
  keyBtns.get(',')!.textContent = decimalSeparator();
  for (const [k, b] of keyBtns) {
    const label = (t.keys as Record<string, string>)[k];
    if (label) b.setAttribute('aria-label', label);
  }
  renderList();
  renderStatus();
  if (!sheetEl.hidden) renderPicker();
}

langBtn.addEventListener('click', () => {
  lang = lang === 'ru' ? 'en' : 'ru';
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* ignore */
  }
  applyLang();
});

searchEl.addEventListener('input', renderPicker);
$('sheet-close').addEventListener('click', () => closeSheet());
sheetEl.querySelector('.sheet-backdrop')!.addEventListener('click', () => closeSheet());
window.addEventListener('popstate', () => closeSheet(true));
editBtn.addEventListener('click', () => setEditing(!editing));
statusEl.addEventListener('click', () => void update());

// ---------- refresh schedule: on start, hourly while open, on resume/online ----------
const HOUR = 3_600_000;
setInterval(() => void update(), HOUR);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - lastAttempt > HOUR) void update();
});
window.addEventListener('online', () => {
  if (lastOk === false) void update();
});

applyLang();
void update();
