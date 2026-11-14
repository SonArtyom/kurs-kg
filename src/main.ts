import './style.css';
import {
  applyKey,
  convertForDisplay,
  formatInput,
  formatMinor,
  KGS_RATE,
  parseDecimal,
  SCALE,
  toInput,
} from './money';
import { currencyDigits, currencyFlag, currencyName, DEFAULT_CODES, HIDDEN, MAX_ROWS, MIN_ROWS } from './currencies';
import { isStale, loadCache, refresh, type RatesCache } from './rates';

// ---------- persistent UI state ----------
interface UiState {
  codes: string[];
  active: string;
  input: string;
}
const STATE_KEY = 'kurs.state.v1';

function loadState(): UiState {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null') as UiState | null;
    if (s && Array.isArray(s.codes) && s.codes.length >= MIN_ROWS && typeof s.input === 'string') {
      const codes = s.codes.slice(0, MAX_ROWS);
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

let state = loadState();
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
const sheetEl = $('sheet');
const searchEl = $<HTMLInputElement>('search');
const pickerEl = $('picker');

// ---------- values ----------
function valueFor(code: string): { text: string; empty: boolean } {
  if (code === state.active) {
    return state.input === '' ? { text: '0', empty: true } : { text: formatInput(state.input), empty: false };
  }
  const amount = parseDecimal(state.input);
  const from = cache.rates[state.active];
  const to = cache.rates[code];
  if (!from || !to) return { text: '—', empty: true };
  if (amount === null) return { text: '0', empty: true };
  return { text: formatMinor(convertForDisplay(amount, from, to, currencyDigits(code))), empty: false };
}

function activate(code: string) {
  if (code === state.active) return;
  const amount = parseDecimal(state.input);
  const from = cache.rates[state.active];
  const to = cache.rates[code];
  state.input = amount === null || !from || !to ? '' : toInput(convertForDisplay(amount, from, to, currencyDigits(code)));
  if (state.input === '0') state.input = '';
  state.active = code;
  saveState();
  renderList();
}

// ---------- rendering ----------
const amountEls = new Map<string, HTMLElement>();

function sizeClass(text: string) {
  return text.length > 16 ? ' xs' : text.length > 12 ? ' s' : '';
}

function updateAmounts() {
  for (const [code, node] of amountEls) {
    const v = valueFor(code);
    node.textContent = v.text;
    node.className = 'amount' + sizeClass(v.text) + (v.empty ? ' placeholder' : '');
  }
}

function renderList() {
  listEl.replaceChildren();
  amountEls.clear();
  state.codes.forEach((code, i) => {
    const row = el(editing ? 'div' : 'button', 'row' + (!editing && code === state.active ? ' active' : ''));
    if (row instanceof HTMLButtonElement) {
      row.type = 'button';
      row.addEventListener('click', () => activate(code));
    }
    row.append(el('span', 'flag', currencyFlag(code)));
    const cur = el('span', 'cur');
    cur.append(el('span', 'code', code), el('span', 'name', currencyName(code)));
    row.append(cur);

    if (editing) {
      const tools = el('div', 'row-tools');
      const up = el('button', 'icon-btn', '↑');
      const down = el('button', 'icon-btn', '↓');
      const del = el('button', 'icon-btn del', '✕');
      up.setAttribute('aria-label', `Поднять ${code}`);
      down.setAttribute('aria-label', `Опустить ${code}`);
      del.setAttribute('aria-label', `Удалить ${code}`);
      up.disabled = i === 0;
      down.disabled = i === state.codes.length - 1;
      del.disabled = state.codes.length <= MIN_ROWS;
      up.onclick = () => move(i, -1);
      down.onclick = () => move(i, 1);
      del.onclick = () => remove(code);
      tools.append(up, down, del);
      row.append(tools);
    } else {
      const amt = el('span', 'amount');
      amountEls.set(code, amt);
      row.append(amt);
    }
    listEl.append(row);
  });

  if (state.codes.length < MAX_ROWS) {
    const add = el('button', 'add', '+ Добавить валюту');
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
  if (code === state.active) {
    const next = state.codes.find((c) => c !== code)!;
    activate(next);
  }
  state.codes = state.codes.filter((c) => c !== code);
  saveState();
  renderList();
}

function setEditing(on: boolean) {
  editing = on;
  editBtn.textContent = on ? 'Готово' : 'Изменить';
  padEl.hidden = on;
  renderList();
}

// ---------- status ----------
const dateFmt = (iso: string) => (iso ? iso.split('-').reverse().join('.') : '—');
const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dayTimeFmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function renderStatus() {
  const now = Date.now();
  const stale = isStale(cache, now);
  const rateDate = `курс на ${dateFmt(cache.dailyDate)}`;
  let text: string;
  let warn = false;
  if (loading) {
    text = `Обновление… · ${rateDate}`;
  } else if (lastOk === false) {
    warn = true;
    text =
      cache.fetchedAt === 0
        ? `Нет связи · встроенные данные, ${rateDate}`
        : `Нет связи · ${rateDate}, загружен ${dayTimeFmt.format(cache.fetchedAt)}`;
  } else if (stale) {
    warn = true;
    text = `Данные устарели · ${rateDate}`;
  } else {
    text = `${rateDate[0].toUpperCase()}${rateDate.slice(1)} · обновлено ${timeFmt.format(cache.fetchedAt)}`;
  }
  statusEl.className = 'status' + (warn ? ' warn' : '') + (loading ? ' loading' : '');
  statusEl.querySelector('.status-text')!.textContent = text;
  statusEl.title = 'Нажмите, чтобы обновить';
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
const KEYS = ['7', '8', '9', '⌫', '4', '5', '6', 'C', '1', '2', '3', '↑', ',', '0', '00', '↓'];
const FN = new Set(['⌫', 'C', '↑', '↓']);
const LABELS: Record<string, string> = { '⌫': 'Стереть', C: 'Очистить', '↑': 'Валюта выше', '↓': 'Валюта ниже' };

for (const k of KEYS) {
  const b = el('button', 'key' + (FN.has(k) ? ' fn' : ''), k);
  b.type = 'button';
  if (LABELS[k]) b.setAttribute('aria-label', LABELS[k]);
  b.addEventListener('click', () => press(k));
  padEl.append(b);
}

function press(k: string) {
  if (k === '↑' || k === '↓') {
    const i = state.codes.indexOf(state.active);
    const j = (i + (k === '↑' ? -1 : 1) + state.codes.length) % state.codes.length;
    activate(state.codes[j]);
    return;
  }
  const next = applyKey(state.input, k, currencyDigits(state.active));
  if (next === state.input) return;
  state.input = next;
  saveState();
  updateAmounts();
}

// hardware / desktop keyboard
document.addEventListener('keydown', (e) => {
  if (!sheetEl.hidden || editing) return;
  const map: Record<string, string> = { Backspace: '⌫', Delete: 'C', Escape: 'C', '.': ',', ArrowUp: '↑', ArrowDown: '↓' };
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
    .map((c) => ({ code: c, name: currencyName(c) }))
    .filter((x) => !q || x.code.toLowerCase().includes(q) || x.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  pickerEl.replaceChildren();
  if (items.length === 0) {
    pickerEl.append(el('li', 'empty', 'Ничего не найдено'));
    return;
  }
  for (const { code, name } of items) {
    const li = el('li');
    const b = el('button');
    b.type = 'button';
    const cur = el('span', 'cur');
    cur.append(el('span', 'code', code), el('span', 'name', name));
    const perUnit = formatMinor(convertForDisplay(SCALE, cache.rates[code], KGS_RATE, 2));
    b.append(el('span', 'flag', currencyFlag(code)), cur, el('span', 'rate', `${perUnit} сом`));
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

renderList();
renderStatus();
void update();
