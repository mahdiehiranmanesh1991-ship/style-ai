// «استایلیست من» — UI layer. All logic is local; nothing leaves the device.
import * as db from './db.js';
import { describeHex, describeColor, hexToLab, rgbToHex, TEMP_FA } from './color.js';
import { CATEGORIES, CAT, TYPES, TYPE, typesOf, PATTERNS, PATTERN, OCCASIONS, OCC, WEATHERS, weatherForMonth } from './catalog.js';
import { SKIN_TONES, UNDERTONES, HAIR_COLORS, EYE_COLORS, SEASONS, analyzeSeason, estimateUndertone } from './season.js';
import { SHAPES, bodyShape, heightAdvice, bmi, tagFa } from './body.js';
import { suggestForAnchor, buildOutfit, combineItems, suitsMe, rankOccasions } from './engine.js';
import { loadImage, toCanvas, quickRemoveBackground, applyMask, cropToContent, thumbnail, colorsFromCanvas, guessPattern, guessCategory, sampleColor } from './image.js';
import { todayJdn, d2j, j2d, formatLong, formatShort, fa, toLatinDigits, keyFromJdn, jdnFromKey, MONTHS, monthLength, isValidJalali } from './jalali.js';
import { drawGarment, DEMO_ITEMS } from './demo.js';

export const VERSION = '1.0.0';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/** Tiny DOM builder: text children are always text nodes (safe for user input). */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v; // only used with static strings
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}
const toast = (msg, ms = 2600) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), ms); };
const num = (v) => { const n = parseFloat(toLatinDigits(String(v || '')).replace(/[٫,]/g, '.')); return Number.isFinite(n) ? n : null; };
const scoreColor = (s) => (s >= 80 ? 'var(--ok)' : s >= 62 ? 'var(--warn)' : 'var(--bad)');

// ------------------------------------------------------------------ state
const state = {
  items: [], outfits: [], profile: null, settings: { theme: 'auto', bg: 'ai' },
  tab: 'home', view: 'home', wardrobeFilter: 'all',
  anchor: null, anchorOcc: 'auto', combine: [], weather: weatherForMonth(d2j(todayJdn()).jm),
};

function profileCtx() {
  const p = state.profile;
  if (!p) return { hijab: true };
  const shape = p.shapeManual || bodyShape(p).shape || null;
  const season = p.skinHex ? analyzeSeason({ skinHex: p.skinHex, undertone: p.undertone, hair: p.hair, eyes: p.eyes }) : null;
  return { seasonId: season?.id, shape, height: num(p.height), contrastLevel: season?.contrastLevel, hijab: p.hijab !== false };
}

// ------------------------------------------------------------------ navigation
const TITLES = { home: ['استایلیست من', ''], anchor: ['ست با این لباس', 'یک لباس ← چند استایل'], combine: ['ست کردن چند لباس', 'بهترین ترکیب‌ها'], suits: ['این بهم میاد؟', 'رنگ و برش برای تو'], wardrobe: ['کمد من', ''], lookbook: ['لوک‌بوک', ''], me: ['من', 'بدن، رنگ و تنظیمات'] };
const SUB = new Set(['anchor', 'combine', 'suits']);
function show(view, { push = true } = {}) {
  state.view = view;
  $$('.view').forEach((v) => (v.hidden = v.dataset.view !== view));
  const tab = SUB.has(view) ? 'home' : view;
  state.tab = tab;
  $$('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $('#back-btn').hidden = !SUB.has(view);
  $('#title').textContent = TITLES[view][0];
  $('#subtitle').textContent = TITLES[view][1];
  if (push && location.hash.slice(1) !== view) history.pushState({ view }, '', view === 'home' ? location.pathname + location.search : '#' + view);
  window.scrollTo({ top: 0 });
  render(view);
}
window.addEventListener('popstate', () => show(location.hash.slice(1) || 'home', { push: false }));
function render(view) {
  ({ home: renderHome, wardrobe: renderWardrobe, lookbook: renderLookbook, me: renderMe, combine: renderCombineTray }[view] || (() => {}))();
}

// ------------------------------------------------------------------ theme
function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme;
  const dark = state.settings.theme === 'dark' || (state.settings.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $$('meta[name=theme-color]').forEach((m) => m.setAttribute('content', dark ? '#141215' : '#faf7f4'));
}
async function saveSettings() { await db.put('kv', state.settings, 'settings'); }

// ------------------------------------------------------------------ background removal (worker)
let worker = null, reqId = 0; const pending = new Map(); let progressCb = null;
function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./bg-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'progress') { progressCb && progressCb(m); return; }
    const p = pending.get(m.id); if (!p) return;
    pending.delete(m.id);
    m.type === 'error' ? p.reject(new Error(m.message)) : p.resolve(m);
  };
  worker.onerror = (e) => { for (const p of pending.values()) p.reject(new Error(e.message || 'worker failed')); pending.clear(); worker = null; };
  return worker;
}
function callWorker(msg, transfer = [], timeout = 240000) {
  return new Promise((resolve, reject) => {
    const id = ++reqId;
    const t = setTimeout(() => { pending.delete(id); reject(new Error('timeout')); try { worker.terminate(); } catch {} worker = null; }, timeout);
    pending.set(id, { resolve: (v) => { clearTimeout(t); resolve(v); }, reject: (e) => { clearTimeout(t); reject(e); } });
    getWorker().postMessage({ ...msg, id }, transfer);
  });
}
const MODEL_CACHE = 'style-ai-models-v1';
async function modelCached() {
  try { const c = await caches.open(MODEL_CACHE); return (await c.keys()).length > 0; } catch { return false; }
}
async function aiRemove(canvas, onProgress) {
  progressCb = onProgress;
  const S = 1024;
  const sq = document.createElement('canvas'); sq.width = S; sq.height = S;
  const sctx = sq.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(canvas, 0, 0, S, S);
  const rgba = sctx.getImageData(0, 0, S, S).data;
  const res = await callWorker({ type: 'remove', rgba }, [rgba.buffer]);
  progressCb = null;
  return applyMask(canvas, res.mask, res.w, res.h);
}

/** Decode a photo, remove the background (AI → quick → none), crop, extract colors. */
async function processPhoto(file, onStatus = () => {}) {
  onStatus('در حال خواندن عکس…', 5);
  const img = await loadImage(file);
  let canvas = toCanvas(img, 1024);
  const mode = state.settings.bg;
  let method = 'none';
  if (mode === 'ai') {
    try {
      onStatus((await modelCached()) ? 'حذف پس‌زمینه با هوش مصنوعی…' : 'دانلود مدل حذف پس‌زمینه (فقط بار اول)…', 10);
      const work = toCanvas(canvas, 1024);
      const ratio = await aiRemove(work, (p) => onStatus(p.phase === 'download' ? `دانلود مدل… ${fa(p.pct)}٪` : 'حذف پس‌زمینه با هوش مصنوعی…', p.phase === 'download' ? 10 + p.pct * 0.6 : 75));
      if (ratio > 0.02 && ratio < 0.985) { canvas = work; method = 'ai'; }
    } catch (e) { console.warn('AI background removal failed', e); }
  }
  if (method === 'none' && mode !== 'none') {
    onStatus('حذف سریع پس‌زمینه…', 80);
    const small = toCanvas(canvas, 640);
    if (quickRemoveBackground(small)) { canvas = small; method = 'quick'; }
  }
  onStatus('تشخیص رنگ‌ها…', 92);
  if (method !== 'none') canvas = cropToContent(canvas);
  const colors = colorsFromCanvas(canvas).map(slimColor);
  return { canvas, colors, method, thumb: thumbnail(canvas, 360), category: guessCategory(canvas), pattern: guessPattern(colors) };
}
const slimColor = (c) => ({ hex: c.hex, lab: c.lab.map((v) => Math.round(v * 10) / 10), share: Math.round((c.share ?? 1) * 100) / 100, name: c.name, temp: c.temp, neutral: c.neutral });

// ------------------------------------------------------------------ sheet (bottom dialog)
const sheet = $('#sheet');
function openSheet(...content) {
  const body = $('#sheet-body'); body.replaceChildren(h('div', { class: 'sheet-grip' }), ...content);
  if (!sheet.open) sheet.showModal();
  body.scrollTop = 0;
  return body;
}
function closeSheet() { if (sheet.open) sheet.close(); }
sheet.addEventListener('click', (e) => { if (e.target === sheet && !sheet.dataset.locked) closeSheet(); });
sheet.addEventListener('cancel', (e) => { if (sheet.dataset.locked) e.preventDefault(); });

/** Garment intake: photo → processing → editor. Resolves with the item (saved or not) or null. */
function intake(file, { save = true, title = 'لباس جدید', askSave = false } = {}) {
  return new Promise((resolve) => {
    const status = h('p', { class: 'muted small', id: 'proc-status' }, 'در حال آماده‌سازی…');
    const bar = h('div'); const prog = h('div', { class: 'progress' }, bar);
    sheet.dataset.locked = '1';
    openSheet(h('h3', { class: 'card-title' }, title), h('div', { class: 'preview' }, h('span', { class: 'spinner' })), status, prog);
    processPhoto(file, (msg, pct) => { status.textContent = msg; bar.style.width = pct + '%'; })
      .then((res) => { delete sheet.dataset.locked; editItem({ id: null, name: '', category: res.category, type: null, pattern: res.pattern, colors: res.colors, thumb: res.thumb, method: res.method }, { save, askSave, resolve, title }); })
      .catch((e) => { delete sheet.dataset.locked; console.error(e); openSheet(h('p', {}, 'خواندن این عکس ممکن نشد. لطفاً عکس دیگری انتخاب کنید (JPG/PNG/HEIC).'), h('button', { class: 'btn block', onclick: () => { closeSheet(); resolve(null); } }, 'باشه')); });
  });
}

function editItem(item, { save = true, askSave = false, resolve = () => {}, title = 'ویرایش لباس' } = {}) {
  const it = { ...item, colors: [...(item.colors || [])] };
  let done = false;
  const finish = (v) => { if (!done) { done = true; resolve(v); } };
  const methodNote = { ai: '✓ پس‌زمینه با هوش مصنوعی حذف شد.', quick: '✓ پس‌زمینه به روش سریع حذف شد.', none: 'پس‌زمینه حذف نشد؛ رنگ‌ها را بررسی کنید.' }[it.method] || '';
  const catChips = h('div', { class: 'chips' });
  const typeSel = h('select', { id: 'edit-type' });
  const patSel = h('select', { id: 'edit-pattern' }, PATTERNS.map((p) => h('option', { value: p.id }, p.fa)));
  const colorRow = h('div', { class: 'color-row' });
  const nameIn = h('input', { id: 'edit-name', placeholder: 'مثلاً مانتو سرمه‌ای', value: it.name || '' });
  const saveChk = h('input', { type: 'checkbox', id: 'edit-save' }); saveChk.checked = save;
  const drawCats = () => {
    catChips.replaceChildren(...CATEGORIES.map((c) => h('button', { type: 'button', class: 'chip' + (c.id === it.category ? ' sel' : ''), 'data-cat': c.id, onclick: () => { it.category = c.id; it.type = null; drawCats(); drawTypes(); } }, c.icon + ' ' + c.fa)));
  };
  const drawTypes = () => {
    const ts = typesOf(it.category);
    if (!it.type || TYPE[it.type]?.cat !== it.category) it.type = ts[0].id;
    typeSel.replaceChildren(...ts.map((t) => h('option', { value: t.id, selected: t.id === it.type }, t.fa)));
  };
  const drawColors = () => {
    colorRow.replaceChildren(
      ...it.colors.map((c, i) => h('button', { type: 'button', class: 'cpill', title: 'برای اصلی کردن بزنید', onclick: () => { it.colors.unshift(...it.colors.splice(i, 1)); drawColors(); } },
        h('i', { style: { background: c.hex } }), (i === 0 ? '★ ' : '') + c.name, h('span', { class: 'muted', onclick: (e) => { e.stopPropagation(); if (it.colors.length > 1) { it.colors.splice(i, 1); drawColors(); } } }, ' ✕'))),
      h('label', { class: 'cpill file-btn' }, '＋ رنگ', h('input', { type: 'color', onchange: (e) => { it.colors.unshift(slimColor(describeHex(e.target.value))); drawColors(); } })));
  };
  typeSel.addEventListener('change', () => (it.type = typeSel.value));
  patSel.value = it.pattern || 'solid';
  drawCats(); drawTypes(); drawColors();
  openSheet(
    h('h3', { class: 'card-title' }, title),
    h('div', { class: 'preview' }, h('img', { src: it.thumb, alt: '' })),
    h('p', { class: 'muted small' }, methodNote),
    h('span', { class: 'label' }, 'دسته (حدس خودکار؛ اگر اشتباه است عوض کنید)'), catChips,
    h('label', { class: 'field' }, h('span', {}, 'نوع'), typeSel),
    h('label', { class: 'field' }, h('span', {}, 'طرح'), patSel),
    h('span', { class: 'label' }, 'رنگ‌ها (★ = رنگ اصلی؛ برای اصلی کردن روی رنگ بزنید)'), colorRow,
    h('label', { class: 'field' }, h('span', {}, 'نام (اختیاری)'), nameIn),
    askSave ? h('label', { class: 'toggle' }, saveChk, h('span', {}, 'به کمدم هم اضافه شود')) : null,
    h('div', { class: 'row gap' },
      h('button', { class: 'btn primary', style: { flex: 1 }, id: 'edit-ok', onclick: async () => {
        it.type = typeSel.value; it.pattern = patSel.value; it.name = nameIn.value.trim();
        const out = { id: it.id, name: it.name, category: it.category, type: it.type, pattern: it.pattern, colors: it.colors, thumb: it.thumb, created: it.created || Date.now(), worn: it.worn || 0 };
        const doSave = askSave ? saveChk.checked : save;
        if (doSave) { out.id = out.id || db.uid(); await db.put('items', out); await loadItems(); toast('در کمد ذخیره شد ✓'); }
        closeSheet(); finish(out); if (state.view === 'wardrobe' || state.view === 'home') render(state.view);
      } }, askSave ? 'ادامه' : 'ذخیره'),
      h('button', { class: 'btn', onclick: () => { closeSheet(); finish(null); } }, 'انصراف')),
  );
  sheet.addEventListener('close', () => finish(null), { once: true });
}

async function loadItems() { state.items = (await db.all('items')).sort((a, b) => (b.created || 0) - (a.created || 0)); }
async function loadOutfits() { state.outfits = await db.all('outfits'); }

// ------------------------------------------------------------------ rendering helpers
function tile(item, { onclick, picked } = {}) {
  return h('div', { class: 'tile' + (picked ? ' picked' : ''), onclick, 'data-id': item.id },
    h('div', { class: 'ph' }, h('img', { src: item.thumb, alt: item.name || TYPE[item.type]?.fa || '', loading: 'lazy' })),
    h('div', { class: 'dots' }, (item.colors || []).slice(0, 4).map((c) => h('i', { style: { background: c.hex } }))),
    picked ? h('span', { class: 'tick' }, '✓') : null);
}
function pieceCard(item, extra) {
  const t = TYPE[item.type];
  return h('div', { class: 'card piece-card' },
    h('div', { class: 'ph' }, item.thumb ? h('img', { src: item.thumb, alt: '' }) : h('span', { style: { fontSize: '40px' } }, CAT[item.category]?.icon)),
    h('div', { class: 'piece-meta' },
      h('h3', {}, item.name || t?.fa || ''),
      h('p', { class: 'muted small', style: { margin: 0 } }, `${CAT[item.category]?.fa || ''} · ${t?.fa || ''} · ${PATTERN[item.pattern]?.fa || ''}`),
      h('div', { class: 'color-row' }, (item.colors || []).slice(0, 4).map((c) => h('span', { class: 'cpill' }, h('i', { style: { background: c.hex } }), `${c.name} · ${TEMP_FA[c.temp] || ''}`))),
      extra || null));
}
function ring(score) { return h('div', { class: 'ring', style: { '--v': score, '--c': scoreColor(score) } }, h('b', {}, fa(score))); }

function renderLook(look, { fixedCount = 1, saved = false } = {}) {
  const pcs = look.pieces;
  const el = h('article', { class: 'look' });
  el.append(h('div', { class: 'look-head' },
    h('div', { class: 'grow' },
      h('h3', {}, `${look.icon || '✨'} ${look.occasionFa}`),
      h('p', {}, look.strategyFa ? h('span', { class: 'tag' }, look.strategyFa) : null, ' ', look.note || '')),
    ring(look.total)));
  el.append(h('div', { class: 'palette-strip' }, pcs.filter((p) => p.cat !== 'accessory').map((p) => h('i', { style: { background: p.hex } }))));
  el.append(h('div', { class: 'pieces' }, pcs.map((p, i) => h('div', { class: 'pc' + (i < fixedCount ? ' anchor' : '') },
    h('div', { class: 'th', style: { background: p.thumb ? 'transparent' : p.hex } },
      p.thumb ? h('img', { src: p.thumb, alt: '' }) : h('span', { style: { filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.4))' } }, CAT[p.cat]?.icon),
      i < fixedCount ? h('em', {}, 'انتخاب تو') : !p.generic ? h('em', { style: { background: 'var(--ok)' } }, 'کمد') : null),
    h('div', { class: 'tx' }, h('b', {}, p.name || p.typeFa), h('span', {}, p.colorName))))));
  const reasons = pcs.filter((p, i) => i >= fixedCount && p.reason && p.generic).slice(0, 4);
  const whyList = [look.parts.find((x) => x.key === 'harmony')?.why, ...(look.tips || []).slice(0, 2)].filter(Boolean);
  el.append(h('ul', { class: 'why' }, whyList.map((w) => h('li', {}, w))));
  el.append(h('details', {}, h('summary', {}, `چرا امتیاز ${fa(look.total)}؟ (جزئیات)`),
    look.parts.map((p) => h('div', { class: 'bar' },
      h('div', { class: 'bar-top' }, h('span', {}, p.label), h('span', {}, fa(p.score))),
      h('div', { class: 'bar-track' }, h('i', { style: { width: p.score + '%', background: scoreColor(p.score) } })),
      h('p', {}, p.why))),
    reasons.length ? h('div', {}, h('b', { class: 'small' }, 'چرا این رنگ‌ها؟'), h('ul', { class: 'small' }, reasons.map((p) => h('li', {}, `${p.typeFa} ${p.colorName}: ${p.reason}`)))) : null));
  if (!saved) {
    el.append(h('div', { class: 'look-actions' },
      h('button', { class: 'btn small primary save-look', onclick: async (e) => { await saveLook(look, fixedCount); e.target.disabled = true; e.target.textContent = '✓ ذخیره شد'; } }, '♡ ذخیره در لوک‌بوک'),
      h('button', { class: 'btn small', onclick: () => planLook(look, fixedCount) }, '📅 برای یک روز')));
  }
  return el;
}
const lookToRecord = (look, fixedCount) => ({
  id: db.uid(), created: Date.now(), date: null, occasion: look.occasion, occasionFa: look.occasionFa, icon: look.icon, total: look.total, strategyFa: look.strategyFa || '', note: look.note || '',
  fixedCount, tips: look.tips || [],
  parts: look.parts.map((p) => ({ key: p.key, label: p.label, score: p.score, why: p.why })),
  pieces: look.pieces.map((p) => ({ cat: p.cat, type: p.type, typeFa: p.typeFa, hex: p.hex, colorName: p.colorName, thumb: p.thumb || null, id: p.id || null, name: p.name || null, generic: p.generic, reason: p.reason || null })),
});
async function saveLook(look, fixedCount, date = null) {
  const rec = lookToRecord(look, fixedCount); rec.date = date;
  await db.put('outfits', rec); await loadOutfits();
  toast(date ? `برای ${formatLong(jdnFromKey(date))} برنامه‌ریزی شد 📅` : 'در لوک‌بوک ذخیره شد ♡');
  return rec;
}
function planLook(look, fixedCount) {
  datePicker(keyFromJdn(todayJdn()), async (key) => { await saveLook(look, fixedCount, key); });
}
function datePicker(initialKey, onPick) {
  const j = d2j(jdnFromKey(initialKey) || todayJdn());
  const ySel = h('select', {}, [j.jy - 1, j.jy, j.jy + 1].map((y) => h('option', { value: y, selected: y === j.jy }, fa(y))));
  const mSel = h('select', {}, MONTHS.map((m, i) => h('option', { value: i + 1, selected: i + 1 === j.jm }, m)));
  const dSel = h('select', {});
  const fill = () => { const n = monthLength(+ySel.value, +mSel.value); const cur = Math.min(+dSel.value || j.jd, n); dSel.replaceChildren(...Array.from({ length: n }, (_, i) => h('option', { value: i + 1, selected: i + 1 === cur }, fa(i + 1)))); };
  ySel.onchange = fill; mSel.onchange = fill; fill();
  const quick = (off, label) => h('button', { class: 'chip', type: 'button', onclick: () => { const q = d2j(todayJdn() + off); ySel.value = q.jy; mSel.value = q.jm; fill(); dSel.value = q.jd; } }, label);
  openSheet(h('h3', { class: 'card-title' }, '📅 برای چه روزی؟'),
    h('div', { class: 'chips' }, quick(0, 'امروز'), quick(1, 'فردا'), quick(2, 'پس‌فردا'), quick(7, 'هفته بعد')),
    h('div', { class: 'grid2', style: { gridTemplateColumns: '1fr 1.4fr 1fr' } },
      h('label', { class: 'field' }, h('span', {}, 'روز'), dSel), h('label', { class: 'field' }, h('span', {}, 'ماه'), mSel), h('label', { class: 'field' }, h('span', {}, 'سال'), ySel)),
    h('button', { class: 'btn primary block', onclick: async () => {
      const y = +ySel.value, m = +mSel.value, d = +dSel.value;
      if (!isValidJalali(y, m, d)) return toast('تاریخ نامعتبر است');
      closeSheet(); await onPick(keyFromJdn(j2d(y, m, d)));
    } }, 'تأیید'));
}

// ------------------------------------------------------------------ HOME
function renderHome() {
  const prof = state.profile;
  const ctx = profileCtx();
  $('#profile-nudge').hidden = !!(prof && (ctx.seasonId || ctx.shape));
  const mini = $('#me-mini');
  if (prof && (ctx.seasonId || ctx.shape)) {
    const s = SEASONS[ctx.seasonId], sh = SHAPES[ctx.shape];
    mini.hidden = false;
    mini.replaceChildren(h('div', { class: 'pr-icon' }, sh ? sh.icon : '🎨'),
      h('div', { style: { flex: 1 } }, h('strong', {}, [s ? `فصل رنگی: ${s.fa}` : '', sh ? ` · فرم: ${sh.fa}` : ''].join('')),
        s ? h('div', { class: 'palette-strip', style: { margin: '6px 0 0' } }, s.best.slice(0, 8).map((c) => h('i', { style: { background: c } }))) : null));
  } else mini.hidden = true;
  const today = state.outfits.find((o) => o.date === keyFromJdn(todayJdn()));
  $('#hello').textContent = today ? `امروز (${formatLong(todayJdn())}): ${today.icon} ${today.occasionFa}` : `${formatLong(todayJdn())}`;
  const hs = $('#home-wardrobe');
  hs.replaceChildren(
    h('label', { class: 'tile file-btn', style: { justifyContent: 'center', alignItems: 'center', fontWeight: 700, color: 'var(--accent)' } }, h('span', { style: { fontSize: '28px' } }, '＋'), 'افزودن لباس',
      h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: (e) => addToWardrobe(e.target.files) })),
    ...state.items.slice(0, 12).map((it) => tile(it, { onclick: () => itemDetail(it) })));
}

// ------------------------------------------------------------------ ANCHOR («ست با این لباس»)
function weatherSelect(sel) {
  sel.replaceChildren(...WEATHERS.map((w) => h('option', { value: w.id, selected: w.id === state.weather }, w.fa)));
  sel.onchange = () => { state.weather = sel.value; if (state.view === 'anchor') runAnchor(); };
}
async function setAnchor(item) {
  state.anchor = item;
  state.anchorOcc = 'auto';
  runAnchor();
}
function runAnchor() {
  const item = state.anchor; if (!item) return;
  const box = $('#anchor-piece');
  box.replaceChildren(pieceCard(item));
  $('#anchor-filters').hidden = false;
  const ctx = profileCtx();
  const ranked = rankOccasions(item, ctx);
  const chips = h('div', { class: 'chips scroll', id: 'anchor-occ' },
    h('button', { class: 'chip' + (state.anchorOcc === 'auto' ? ' sel' : ''), onclick: () => { state.anchorOcc = 'auto'; runAnchor(); } }, '✨ بهترین موقعیت‌ها'),
    ranked.filter((r) => r.s > 0).map((r) => h('button', { class: 'chip' + (state.anchorOcc === r.id ? ' sel' : ''), 'data-occ': r.id, onclick: () => { state.anchorOcc = r.id; runAnchor(); } }, `${OCC[r.id].icon} ${OCC[r.id].fa}`)));
  const res = $('#anchor-results');
  res.replaceChildren(chips, h('p', { class: 'muted small' }, h('span', { class: 'spinner' }), ' در حال ساختن استایل‌ها…'));
  setTimeout(() => {
    const wardrobe = state.items.filter((i) => i.id !== item.id);
    let looks;
    const t0 = performance.now();
    if (state.anchorOcc === 'auto') looks = suggestForAnchor(item, { wardrobe, profile: ctx, weather: state.weather, count: 5 });
    else {
      const strategies = ['court', 'mourning'].includes(state.anchorOcc) ? ['neutral'] : ['neutral', 'accent', 'tonal', ...(ctx.seasonId ? ['palette'] : [])];
      looks = strategies.map((st) => buildOutfit([item], { occasion: state.anchorOcc, wardrobe, profile: ctx, weather: state.weather, strategy: st }));
      const seen = new Set();
      looks = looks.filter((l) => { const k = l.pieces.map((p) => p.colorName + p.type).join(); if (seen.has(k)) return false; seen.add(k); return true; });
    }
    const ms = Math.round(performance.now() - t0);
    res.replaceChildren(chips,
      h('p', { class: 'muted small' }, `${fa(looks.length)} استایل ساخته شد${state.items.length ? ' (تکه‌های «کمد» از لباس‌های خودت است)' : ' — با اضافه کردن لباس به کمد، پیشنهادها از لباس‌های خودت ساخته می‌شوند'}. ${ctx.seasonId || ctx.shape ? '' : 'برای پیشنهاد شخصی، پروفایل «من» را کامل کن.'}`),
      ...looks.map((l) => renderLook(l, { fixedCount: 1 })));
    console.debug('looks in', ms, 'ms');
  }, 30);
}
$('#anchor-file').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const item = await intake(f, { save: false, askSave: true, title: 'لباس اصلی' });
  if (item) setAnchor(item);
});
$('#anchor-from-wardrobe').addEventListener('click', () => pickFromWardrobe({ multi: false }, (items) => items[0] && setAnchor(items[0])));

function pickFromWardrobe({ multi = false, preselected = [] } = {}, onDone) {
  if (!state.items.length) { toast('کمدت هنوز خالی است؛ اول لباس اضافه کن.'); return; }
  const sel = new Set(preselected);
  const grid = h('div', { class: 'grid' });
  const draw = () => grid.replaceChildren(...state.items.map((it) => tile(it, { picked: sel.has(it.id), onclick: () => {
    if (!multi) { closeSheet(); onDone([it]); return; }
    sel.has(it.id) ? sel.delete(it.id) : sel.add(it.id); draw();
  } })));
  draw();
  openSheet(h('h3', { class: 'card-title' }, multi ? 'لباس‌ها را علامت بزن' : 'یک لباس انتخاب کن'), grid,
    multi ? h('button', { class: 'btn primary block', onclick: () => { closeSheet(); onDone(state.items.filter((i) => sel.has(i.id))); } }, 'تأیید') : null);
}

// ------------------------------------------------------------------ COMBINE
function renderCombineTray() {
  const tray = $('#combine-tray');
  tray.replaceChildren(...state.combine.map((it, i) => h('div', { class: 'tile' },
    h('div', { class: 'ph' }, h('img', { src: it.thumb, alt: '' })),
    h('select', { class: 'mini-cat', style: { fontSize: '12px', border: 0, background: 'none', width: '100%' }, onchange: (e) => { it.category = e.target.value; it.type = typesOf(it.category)[0].id; } },
      CATEGORIES.map((c) => h('option', { value: c.id, selected: c.id === it.category }, c.fa))),
    h('button', { class: 'tick', style: { background: 'var(--bad)', border: 0 }, 'aria-label': 'حذف', onclick: () => { state.combine.splice(i, 1); renderCombineTray(); } }, '✕'))));
  $('#combine-run').disabled = state.combine.length < 2;
  const occSel = $('#combine-occasion');
  if (occSel.options.length < 2) OCCASIONS.forEach((o) => occSel.append(h('option', { value: o.id }, `${o.icon} ${o.fa}`)));
}
$('#combine-file').addEventListener('change', async (e) => {
  const files = [...e.target.files]; e.target.value = '';
  for (const f of files) {
    const item = await intake(f, { save: false, askSave: true, title: `لباس ${fa(state.combine.length + 1)}` });
    if (item) { item.id = item.id || 'tmp-' + db.uid(); state.combine.push(item); renderCombineTray(); }
  }
});
$('#combine-from-wardrobe').addEventListener('click', () => pickFromWardrobe({ multi: true, preselected: state.combine.map((i) => i.id) }, (items) => {
  const tmp = state.combine.filter((i) => String(i.id).startsWith('tmp-'));
  state.combine = [...tmp, ...items]; renderCombineTray();
}));
$('#combine-run').addEventListener('click', () => {
  const res = $('#combine-results');
  res.replaceChildren(h('p', { class: 'muted small' }, h('span', { class: 'spinner' }), ' در حال بررسی همه‌ی ترکیب‌ها…'));
  setTimeout(() => {
    const looks = combineItems(state.combine, { profile: profileCtx(), weather: state.weather, occasion: $('#combine-occasion').value || undefined, limit: 6 });
    if (!looks.length) { res.replaceChildren(h('p', { class: 'empty' }, 'ترکیبی پیدا نشد. حداقل یک بالاتنه/پایین‌تنه یا پیراهن اضافه کن.')); return; }
    res.replaceChildren(h('h3', { class: 'section-title' }, `${fa(looks.length)} ترکیب برتر`),
      ...looks.map((l, i) => { const el = renderLook(l, { fixedCount: l.usedIds.length }); el.querySelector('h3').prepend(`#${fa(i + 1)} `); return el; }));
  }, 30);
});

// ------------------------------------------------------------------ SUITS ME
async function runSuits(item) {
  $('#suits-piece').replaceChildren(pieceCard(item));
  const ctx = profileCtx();
  const r = suitsMe(item, ctx);
  const box = $('#suits-result');
  const s = SEASONS[ctx.seasonId];
  box.replaceChildren(h('div', { class: 'card' },
    h('div', { class: 'row gap center' }, r.score != null ? ring(r.score) : null, h('h3', { class: 'card-title', style: { margin: 0, flex: 1 } }, r.verdict)),
    r.checks.map((c) => h('div', { class: 'bar' }, h('div', { class: 'bar-top' }, h('span', {}, c.label), h('span', {}, fa(c.score))),
      h('div', { class: 'bar-track' }, h('i', { style: { width: c.score + '%', background: scoreColor(c.score) } })), h('p', {}, c.why))),
    r.score == null ? h('button', { class: 'btn primary', 'data-tab': 'me', onclick: () => show('me') }, 'تکمیل پروفایل') : null,
    s && r.score != null && r.score < 80 ? h('div', {}, h('span', { class: 'label' }, `رنگ‌های بهتر برای تو (${s.fa}):`), h('div', { class: 'pal' }, s.best.map((c) => h('i', { style: { background: c } })))) : null,
    h('button', { class: 'btn small', style: { marginTop: '8px' }, onclick: () => { setAnchor(item); show('anchor'); } }, '📸 با همین لباس ست بساز')));
}
$('#suits-file').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const item = await intake(f, { save: false, askSave: true, title: 'این لباس' });
  if (item) runSuits(item);
});
$('#suits-color').addEventListener('change', (e) => {
  const c = slimColor(describeHex(e.target.value));
  runSuits({ id: null, category: 'top', type: 'blouse', pattern: 'solid', colors: [c], thumb: drawGarment('top', c.hex).toDataURL(), name: `بلوز ${c.name}` });
});

// ------------------------------------------------------------------ WARDROBE
async function addToWardrobe(files) {
  for (const f of [...files]) await intake(f, { save: true, title: 'افزودن به کمد' });
  render(state.view);
}
$('#wardrobe-file').addEventListener('change', (e) => { const fs = [...e.target.files]; e.target.value = ''; addToWardrobe(fs); });
function renderWardrobe() {
  const counts = {}; state.items.forEach((i) => (counts[i.category] = (counts[i.category] || 0) + 1));
  $('#wardrobe-count').textContent = state.items.length ? `(${fa(state.items.length)})` : '';
  $('#wardrobe-filter').replaceChildren(
    h('button', { class: 'chip' + (state.wardrobeFilter === 'all' ? ' sel' : ''), onclick: () => { state.wardrobeFilter = 'all'; renderWardrobe(); } }, 'همه'),
    ...CATEGORIES.filter((c) => counts[c.id]).map((c) => h('button', { class: 'chip' + (state.wardrobeFilter === c.id ? ' sel' : ''), onclick: () => { state.wardrobeFilter = c.id; renderWardrobe(); } }, `${c.icon} ${c.fa} ${fa(counts[c.id])}`)));
  const list = state.items.filter((i) => state.wardrobeFilter === 'all' || i.category === state.wardrobeFilter);
  $('#wardrobe-grid').replaceChildren(...list.map((it) => tile(it, { onclick: () => itemDetail(it) })));
  $('#wardrobe-empty').hidden = state.items.length > 0;
}
function itemDetail(it) {
  openSheet(h('div', { class: 'preview' }, h('img', { src: it.thumb, alt: '' })), pieceCard(it),
    h('div', { class: 'row gap wrap' },
      h('button', { class: 'btn primary', onclick: () => { closeSheet(); setAnchor(it); show('anchor'); } }, '📸 ست با این'),
      h('button', { class: 'btn', onclick: () => { closeSheet(); show('suits'); runSuits(it); } }, '🪞 بهم میاد؟'),
      h('button', { class: 'btn', onclick: () => editItem(it, { save: true, title: 'ویرایش لباس' }) }, '✎ ویرایش'),
      h('button', { class: 'btn danger', onclick: async () => { if (!confirm('این لباس از کمد حذف شود؟')) return; await db.del('items', it.id); await loadItems(); closeSheet(); render(state.view); toast('حذف شد'); } }, 'حذف')));
}
$('#demo-btn').addEventListener('click', async () => {
  for (const d of DEMO_ITEMS) {
    const c = drawGarment(d.category, d.hex);
    await db.put('items', { id: db.uid(), name: d.name, category: d.category, type: d.type, pattern: 'solid', colors: [slimColor(describeHex(d.hex))], thumb: thumbnail(c, 240), created: Date.now(), demo: true });
  }
  await loadItems(); renderWardrobe(); toast('۱۰ لباس نمونه اضافه شد');
});

// ------------------------------------------------------------------ LOOKBOOK
function renderLookbook() {
  const todayKey = keyFromJdn(todayJdn());
  const list = state.outfits.slice().sort((a, b) => (a.date && b.date ? a.date.localeCompare(b.date) : a.date ? -1 : b.date ? 1 : b.created - a.created));
  const upcoming = list.filter((o) => o.date && o.date >= todayKey);
  const today = list.find((o) => o.date === todayKey);
  $('#lookbook-today').textContent = `امروز ${formatLong(todayJdn())} · ${today ? `ست امروز: ${today.icon} ${today.occasionFa}` : 'برای امروز ستی برنامه‌ریزی نشده'}${upcoming.length ? ` · ${fa(upcoming.length)} ست برنامه‌ریزی‌شده` : ''}`;
  $('#lookbook-empty').hidden = list.length > 0;
  $('#lookbook-list').replaceChildren(...list.map((o) => {
    const past = o.date && o.date < todayKey;
    return h('div', { class: 'card lb-item', style: past ? { opacity: 0.7 } : {} },
      ring(o.total),
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('div', { class: 'lb-date' }, o.date ? (o.date === todayKey ? '⭐ امروز — ' : '') + formatLong(jdnFromKey(o.date)) : 'بدون تاریخ'),
        h('strong', {}, `${o.icon} ${o.occasionFa}`),
        h('div', { class: 'mini-pieces' }, o.pieces.map((p) => h('i', { style: { background: p.thumb ? 'transparent' : p.hex }, title: `${p.typeFa} ${p.colorName}` }, p.thumb ? h('img', { src: p.thumb, alt: '' }) : CAT[p.cat]?.icon)))),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        h('button', { class: 'btn small', onclick: () => openSheet(renderLook(o, { fixedCount: o.fixedCount, saved: true })) }, 'نمایش'),
        h('button', { class: 'btn small', onclick: () => datePicker(o.date || todayKey, async (key) => { o.date = key; await db.put('outfits', o); await loadOutfits(); renderLookbook(); toast('تاریخ ثبت شد'); }) }, '📅'),
        h('button', { class: 'btn small danger', onclick: async () => { if (!confirm('حذف شود؟')) return; await db.del('outfits', o.id); await loadOutfits(); renderLookbook(); } }, '🗑')));
  }));
}

// ------------------------------------------------------------------ ME (profile + settings)
let draft = {};
function swatchPicker(container, list, key, labelled = true) {
  container.replaceChildren(...list.map((x) => h('button', { type: 'button', class: 'sw-label', 'data-id': x.id, onclick: () => { draft[key] = key === 'skinHex' ? x.hex : x.id; if (key === 'skinHex') $('#skin-picked').textContent = x.fa; drawSwatches(); } },
    h('span', { class: 'sw' + ((key === 'skinHex' ? draft.skinHex === x.hex : draft[key] === x.id) ? ' sel' : ''), style: { background: x.hex } }), labelled ? x.fa : null)));
}
function drawSwatches() {
  swatchPicker($('#skin-swatches'), SKIN_TONES, 'skinHex');
  swatchPicker($('#hair-swatches'), HAIR_COLORS, 'hair');
  swatchPicker($('#eye-swatches'), EYE_COLORS, 'eyes');
  if (draft.skinHex && !SKIN_TONES.some((s) => s.hex === draft.skinHex)) {
    $('#skin-swatches').append(h('button', { type: 'button', class: 'sw-label' }, h('span', { class: 'sw sel', style: { background: draft.skinHex } }), 'از سلفی'));
  }
}
function renderMe() {
  const form = $('#profile-form');
  draft = { hijab: true, undertone: 'auto', ...(state.profile || {}) };
  const shapeSel = form.elements.shapeManual;
  if (shapeSel.options.length < 2) Object.entries(SHAPES).forEach(([id, s]) => shapeSel.append(h('option', { value: id }, `${s.icon} ${s.fa}`)));
  const ut = form.elements.undertone;
  if (ut.options.length < 2) UNDERTONES.forEach((u) => ut.append(h('option', { value: u.id }, u.fa)));
  for (const k of ['height', 'weight', 'bust', 'waist', 'hip']) form.elements[k].value = draft[k] ? fa(draft[k]) : '';
  shapeSel.value = draft.shapeManual || ''; ut.value = draft.undertone || 'auto'; form.elements.hijab.checked = draft.hijab !== false;
  drawSwatches();
  renderProfileResult();
  $('#set-theme').value = state.settings.theme; $('#set-bg').value = state.settings.bg;
  refreshModelStatus();
  $('#ver').textContent = fa(VERSION);
}
function renderProfileResult() {
  const box = $('#profile-result');
  const p = state.profile;
  if (!p) { box.replaceChildren(h('h3', { class: 'card-title' }, 'پروفایل استایل تو'), h('p', { class: 'muted small' }, 'فرم زیر را پر کن تا فرم بدن، فصل رنگی (۱۲ فصلی) و پالت رنگ‌های مناسبت را ببینی. همه‌چیز فقط روی همین گوشی ذخیره می‌شود.')); return; }
  const shapeR = p.shapeManual ? { shape: p.shapeManual, why: 'به‌صورت دستی انتخاب شده.' } : bodyShape(p);
  const sh = SHAPES[shapeR.shape];
  const ha = heightAdvice(num(p.height));
  const b = bmi(num(p.height), num(p.weight));
  const se = p.skinHex ? analyzeSeason({ skinHex: p.skinHex, undertone: p.undertone, hair: p.hair, eyes: p.eyes }) : null;
  const s = se?.season;
  box.replaceChildren(
    h('h3', { class: 'card-title' }, 'پروفایل استایل تو'),
    sh ? h('div', {}, h('div', { class: 'pr-head' }, h('span', { class: 'pr-icon' }, sh.icon), h('div', {}, h('strong', {}, `فرم بدن: ${sh.fa}`), h('p', { class: 'muted small', style: { margin: 0 } }, shapeR.why))),
      h('dl', { class: 'adv' }, h('dt', {}, 'هدف'), h('dd', {}, sh.goal), h('dt', {}, 'یقه'), h('dd', {}, sh.necklines), h('dt', {}, 'قد و طول'), h('dd', {}, sh.lengths), h('dt', {}, 'برش'), h('dd', {}, sh.fits),
        h('dt', {}, 'پیشنهاد'), h('dd', {}, sh.recommend.map(tagFa).join('، ')), h('dt', {}, 'کمتر'), h('dd', {}, sh.avoid.map(tagFa).join('، '))))
      : h('p', { class: 'muted small' }, shapeR.why),
    ha ? h('p', { class: 'small' }, h('b', {}, `قد: ${ha.fa}. `), ha.tips.join('؛ ') + '.') : null,
    b ? h('p', { class: 'muted small' }, `شاخص توده‌ی بدنی (فقط اطلاع): ${fa(b)} — در پیشنهادها استفاده نمی‌شود.`) : null,
    s ? h('div', { style: { marginTop: '10px' } },
      h('div', { class: 'pr-head' }, h('span', { class: 'pr-icon' }, '🎨'), h('div', {}, h('strong', {}, `فصل رنگی: ${s.fa}`), h('p', { class: 'muted small', style: { margin: 0 } }, `${s.en} · زیرپوست: ${UNDERTONES.find((u) => u.id === se.undertone)?.fa.split(' (')[0]}${p.undertone === 'auto' ? ' (تخمینی)' : ''} · کنتراست: ${{ high: 'بالا', medium: 'متوسط', low: 'ملایم' }[se.contrastLevel]}`))),
      h('p', { class: 'small' }, s.desc),
      h('span', { class: 'label' }, 'بهترین رنگ‌ها'), h('div', { class: 'pal', id: 'season-palette' }, s.best.map((c) => h('i', { style: { background: c }, title: describeHex(c).name }))),
      h('span', { class: 'label' }, 'رنگ‌های پایه'), h('div', { class: 'pal' }, s.neutrals.map((c) => h('i', { style: { background: c } }))),
      h('span', { class: 'label' }, 'کمتر نزدیک صورت'), h('div', { class: 'pal' }, s.avoid.map((c) => h('i', { style: { background: c, opacity: 0.8 } }))),
      h('ul', { class: 'small' }, se.why.map((w) => h('li', {}, w))),
      h('p', { class: 'muted small' }, 'فصل‌های نزدیک بعدی: ' + se.ranking.slice(1).map((r) => SEASONS[r.id].fa).join('، ')))
      : h('p', { class: 'muted small' }, 'برای فصل رنگی، رنگ پوست، مو و چشم را انتخاب کن.'),
    h('p', { class: 'muted small disclaimer' }, '⚠️ راهنمای کلی است، نه تشخیص قطعی؛ نور و دوربین روی نتیجه اثر دارند.'));
}
$('#profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  const p = { ...draft };
  for (const k of ['height', 'weight', 'bust', 'waist', 'hip']) p[k] = num(f[k].value);
  p.shapeManual = f.shapeManual.value; p.undertone = f.undertone.value; p.hijab = f.hijab.checked;
  state.profile = p;
  await db.put('kv', p, 'profile');
  renderProfileResult();
  toast('پروفایل ذخیره شد ✓');
  $('#profile-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#selfie-file').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const img = await loadImage(f);
  const c = $('#selfie-canvas'); const s = Math.min(1, 700 / img.width);
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, c.width, c.height);
  $('#selfie-box').hidden = false;
  c.onclick = (ev) => {
    const r = c.getBoundingClientRect();
    const x = Math.round(((ev.clientX - r.left) / r.width) * c.width), y = Math.round(((ev.clientY - r.top) / r.height) * c.height);
    const hex = rgbToHex(sampleColor(c, x, y, 8));
    draft.skinHex = hex;
    $('#skin-picked').textContent = `نمونه‌برداری شد · زیرپوست تخمینی: ${UNDERTONES.find((u) => u.id === estimateUndertone(hex))?.fa.split(' (')[0]}`;
    drawSwatches();
  };
});

// settings
$('#set-theme').addEventListener('change', async (e) => { state.settings.theme = e.target.value; applyTheme(); await saveSettings(); });
$('#theme-btn').addEventListener('click', async () => {
  const order = ['auto', 'light', 'dark']; state.settings.theme = order[(order.indexOf(state.settings.theme) + 1) % 3];
  applyTheme(); await saveSettings(); toast({ auto: 'تم خودکار', light: 'تم روشن', dark: 'تم تیره' }[state.settings.theme]);
  if ($('#set-theme')) $('#set-theme').value = state.settings.theme;
});
$('#set-bg').addEventListener('change', async (e) => { state.settings.bg = e.target.value; await saveSettings(); refreshModelStatus(); });
async function refreshModelStatus() {
  const cached = await modelCached();
  $('#model-status').textContent = state.settings.bg !== 'ai' ? 'حذف پس‌زمینه با هوش مصنوعی خاموش است.' : cached ? '✓ مدل حذف پس‌زمینه روی گوشی آماده است (آفلاین).' : 'مدل حذف پس‌زمینه هنوز دانلود نشده (۴۴ مگابایت، فقط یک‌بار؛ ترجیحاً با وای‌فای).';
  $('#model-dl').hidden = cached || state.settings.bg !== 'ai';
}
$('#model-dl').addEventListener('click', async () => {
  const box = $('#model-box'), pr = box.querySelector('.progress'), bar = pr.firstElementChild;
  pr.hidden = false; $('#model-dl').disabled = true;
  progressCb = (p) => { bar.style.width = (p.phase === 'download' ? p.pct : 100) + '%'; $('#model-status').textContent = p.phase === 'download' ? `در حال دانلود… ${fa(p.pct)}٪` : 'آماده‌سازی مدل…'; };
  try { await callWorker({ type: 'warmup' }, [], 600000); toast('مدل آماده شد ✓'); }
  catch (e) { toast('دانلود مدل ناموفق بود؛ حذف سریع استفاده می‌شود.'); console.warn(e); }
  progressCb = null; pr.hidden = true; $('#model-dl').disabled = false; refreshModelStatus();
});
$('#export-btn').addEventListener('click', async () => {
  const data = await db.exportAll();
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const j = d2j(todayJdn());
  const name = `style-ai-backup-${j.jy}-${String(j.jm).padStart(2, '0')}-${String(j.jd).padStart(2, '0')}.json`;
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'پشتیبان استایلیست من' }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove();
});
$('#import-file').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const replace = confirm('داده‌های فعلی جایگزین شوند؟ (لغو = ادغام با داده‌های فعلی)');
    await db.importAll(data, { replace });
    await boot(true); toast('بازیابی انجام شد ✓');
  } catch (err) { toast('فایل پشتیبان معتبر نیست'); console.error(err); }
});
$('#wipe-btn').addEventListener('click', async () => {
  if (!confirm('همه‌ی لباس‌ها، ست‌ها و پروفایل پاک شوند؟ این کار برگشت‌پذیر نیست.')) return;
  await Promise.all(['items', 'outfits', 'kv'].map((s) => db.clear(s)));
  await boot(true); toast('همه‌چیز پاک شد');
});

// ------------------------------------------------------------------ global wiring
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab]'); if (t) { show(t.dataset.tab); return; }
  const g = e.target.closest('[data-go]'); if (g) show(g.dataset.go);
});
$('#back-btn').addEventListener('click', () => (history.state?.view && history.length > 1 ? history.back() : show('home')));
weatherSelect($('#anchor-weather')); weatherSelect($('#combine-weather'));
$('#combine-weather').onchange = (e) => { state.weather = e.target.value; };

async function boot(rerender = false) {
  await loadItems(); await loadOutfits();
  state.profile = (await db.get('kv', 'profile')) || null;
  state.settings = { theme: 'auto', bg: 'ai', ...((await db.get('kv', 'settings')) || {}) };
  applyTheme();
  const start = rerender ? state.view : (location.hash.slice(1) || 'home');
  show(TITLES[start] ? start : 'home', { push: false });
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
boot().then(() => { document.body.dataset.ready = '1'; });
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !new URLSearchParams(location.search).has('nosw')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e)));
}
// test hook (read-only access for e2e)
window.__style = { state, profileCtx, VERSION };
