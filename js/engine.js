// Explainable, rule-based outfit engine. Every number comes with a Persian reason.
import { hexToLab, labToLch, lchToLab, nearestNamed, NAMED_COLORS, isNeutral, deltaE, labToHex, clamp, temperature } from './color.js';
import { analyzeHarmony, temperatureMix, contrastMatch } from './harmony.js';
import { paletteMatch, SEASONS } from './season.js';
import { fitScore, SHAPES, heightAdvice } from './body.js';
import { TYPE, typesOf, OCC, OCCASIONS, CAT, PATTERN } from './catalog.js';

const FACE = new Set(['top', 'dress', 'scarf', 'outer']);
const BODY = new Set(['top', 'bottom', 'outer', 'dress']);
const LARGE = new Set(['outer', 'bottom', 'dress', 'scarf']);

/** Normalize a wardrobe item or generic piece into the shape the engine uses. */
export function toPiece(x) {
  if (x.__piece) return x;
  const type = TYPE[x.type] || typesOf(x.category || x.cat)[0];
  const main = (x.colors && x.colors[0]) || null;
  const lab = x.lab || (main && main.lab) || (x.hex ? hexToLab(x.hex) : [50, 0, 0]);
  const hex = x.hex || (main && main.hex) || labToHex(lab);
  const f = x.formality ? [x.formality, x.formality] : type.f;
  return { __piece: true, id: x.id || null, cat: x.category || x.cat || type.cat, type: type.id, typeFa: type.fa, lab, hex,
    colorName: x.colorName || (main && main.name) || nearestNamed(lab).name, pattern: x.pattern || 'solid', f, tags: type.tags, warm: type.warm,
    generic: !x.id, thumb: x.thumb || null, name: x.name || null, reason: x.reason || null, second: x.colors && x.colors[1] ? x.colors[1].lab : null };
}

function formalityPart(pieces, occ) {
  let s = 100; const off = [];
  for (const p of pieces) {
    const gap = p.f[1] < occ.f[0] ? occ.f[0] - p.f[1] : p.f[0] > occ.f[1] ? p.f[0] - occ.f[1] : 0;
    if (gap) { s -= 22 * gap; off.push(`${p.typeFa} ${p.f[1] < occ.f[0] ? 'برای این موقعیت زیادی ساده' : 'برای این موقعیت زیادی رسمی'} است`); }
  }
  const lo = Math.max(...pieces.map((p) => p.f[0])), hi = Math.min(...pieces.map((p) => p.f[1]));
  if (lo - hi >= 2) { s -= 10; off.push('سطح رسمی بودن تکه‌ها با هم فاصله دارد'); }
  s = clamp(s, 0, 100);
  return { key: 'formality', label: 'رسمی بودن', score: s, weight: 0.16, why: off.length ? off.join('؛ ') + '.' : `سطح رسمی بودن همه‌ی تکه‌ها با «${occ.fa}» هم‌خوان است.` };
}

function occasionColorPart(pieces, occ) {
  let s = 90; const notes = [];
  const accents = pieces.filter((p) => p.cat !== 'accessory' && !isNeutral(p.lab));
  if (occ.palette === 'dark' || occ.palette === 'black') {
    const limit = occ.palette === 'black' ? 28 : 42;
    for (const p of pieces.filter((x) => LARGE.has(x.cat) || x.cat === 'shoes')) {
      if (p.lab[0] > limit || (!isNeutral(p.lab) && occ.palette === 'black')) { s -= 22; notes.push(`«${p.colorName}» برای ${p.typeFa} در این موقعیت روشن/شاد است`); }
    }
    if (!notes.length) notes.push(occ.palette === 'black' ? 'همه‌ی تکه‌های اصلی مشکی یا بسیار تیره‌اند؛ مناسب مراسم.' : 'تکه‌های اصلی تیره و خنثی‌اند؛ مطابق عرف رسمی و دادگاه.');
  } else if (occ.palette === 'bright') {
    if (accents.some((p) => labToLch(p.lab)[1] > 32)) { s = 96; notes.push('یک رنگ پرانرژی یا جواهری دارد که حال‌وهوای مهمانی می‌دهد.'); }
    else { s = 74; notes.push('برای مهمانی کمی ساده است؛ یک تکه‌ی رنگی یا براق (کیف، اکسسوری) اضافه کنید.'); }
  } else if (occ.palette === 'fresh') {
    if (accents.some((p) => p.lab[0] > 55 && labToLch(p.lab)[1] > 22)) { s = 96; notes.push('رنگ روشن و تازه‌ای دارد که حس بهار و نوروز می‌دهد.'); }
    else { s = 72; notes.push('برای نوروز رنگ شاد و بهاری (مثل نعنایی، صورتی ملایم، زرد لیمویی) جان بیشتری می‌دهد.'); }
  } else notes.push('محدودیت رنگی خاصی برای این موقعیت ندارد.');
  if (accents.length > occ.maxAccents + 1) { s -= 12 * (accents.length - occ.maxAccents - 1); notes.push(`برای این موقعیت حداکثر ${occ.maxAccents || 'هیچ'} رنگ تأکیدی پیشنهاد می‌شود`); }
  return { key: 'occasion', label: 'رنگ مناسب موقعیت', score: clamp(s, 0, 100), weight: 0.1, why: notes.join(' ') };
}

function patternPart(pieces, occ) {
  const pat = pieces.filter((p) => p.pattern && p.pattern !== 'solid' && p.pattern !== 'texture');
  let s, why;
  if (!pat.length) { s = 88; why = 'همه‌ی تکه‌ها ساده‌اند؛ ست تمیز و آرام است.'; }
  else if (pat.length === 1) { s = occ.maxPatterns >= 1 ? 95 : 70; why = occ.maxPatterns >= 1 ? `فقط ${pat[0].typeFa} طرح‌دار (${PATTERN[pat[0].pattern]?.fa}) است و بقیه ساده‌اند؛ قانون طلایی «یک طرح، بقیه ساده» رعایت شده.` : 'برای این موقعیت بهتر است همه‌ی تکه‌ها ساده باشند.'; }
  else { s = 55 - 10 * (pat.length - 2); why = `${pat.length} تکه‌ی طرح‌دار کنار هم شلوغ می‌شود؛ یکی را ساده کنید (یا طرح‌ها در اندازه و رنگ هماهنگ باشند).`; }
  return { key: 'pattern', label: 'طرح و نقش', score: clamp(s, 0, 100), weight: 0.08, why };
}

function weatherPart(pieces, weather) {
  if (!weather) return null;
  let s = 92; const notes = [];
  for (const p of pieces) {
    if (weather === 'hot' && p.warm === 2) { s -= 20; notes.push(`${p.typeFa} برای هوای گرم سنگین است`); }
    if (weather === 'cold' && p.cat === 'outer' && p.warm === 0) { s -= 15; notes.push(`${p.typeFa} برای هوای سرد نازک است`); }
    if (weather === 'cold' && p.type === 'sandals') { s -= 25; notes.push('صندل برای هوای سرد مناسب نیست'); }
  }
  return { key: 'weather', label: 'آب‌وهوا', score: clamp(s, 0, 100), weight: 0.05, why: notes.length ? notes.join('؛ ') + '.' : 'جنس و نوع تکه‌ها با آب‌وهوای انتخابی هم‌خوان است.' };
}

function completenessPart(pieces, needs) {
  const has = (c) => pieces.some((p) => p.cat === c);
  const missing = [];
  if (!has('dress') && !(has('top') && has('bottom'))) missing.push(has('top') ? 'پایین‌تنه' : has('bottom') ? 'بالاتنه' : 'بالاتنه و پایین‌تنه (یا پیراهن)');
  if (needs.shoes && !has('shoes')) missing.push('کفش');
  if (needs.outer && !has('outer')) missing.push('مانتو/پوشش بیرونی');
  if (needs.scarf && !has('scarf')) missing.push('روسری/شال');
  return { key: 'complete', label: 'کامل بودن ست', score: Math.max(20, 100 - 25 * missing.length), weight: 0.08, why: missing.length ? `کم دارد: ${missing.join('، ')}.` : 'ست کامل است.' };
}

/**
 * Score an outfit.
 * @param pieces Array of wardrobe items / generic pieces
 * @param ctx {occasion, profile:{seasonId, shape, height, contrastLevel, hijab}, weather, partial, needs}
 */
export function scoreOutfit(rawPieces, ctx = {}) {
  const pieces = rawPieces.map(toPiece);
  const occ = OCC[ctx.occasion] || OCC.casual;
  const prof = ctx.profile || {};
  const parts = [];
  const colorPieces = pieces.filter((p) => p.cat !== 'accessory');
  const h = analyzeHarmony(colorPieces.map((p) => p.lab));
  parts.push({ key: 'harmony', label: 'هماهنگی رنگ', score: h.score, weight: 0.26, why: `${h.schemeFa}: ${h.why}`, scheme: h.scheme });
  if (prof.seasonId && SEASONS[prof.seasonId]) {
    const face = pieces.filter((p) => FACE.has(p.cat));
    if (face.length) {
      const ms = face.map((p) => ({ p, m: paletteMatch(p.lab, prof.seasonId) }));
      const avg = ms.reduce((a, x) => a + x.m.score, 0) / ms.length;
      const worst = ms.slice().sort((a, b) => a.m.score - b.m.score)[0];
      const best = ms.slice().sort((a, b) => b.m.score - a.m.score)[0];
      const why = avg >= 75 ? `رنگ‌های نزدیک صورت (${ms.map((x) => x.p.colorName).join('، ')}) در پالت «${SEASONS[prof.seasonId].fa}» شما هستند.`
        : `${best.m.score >= 75 ? `«${best.p.colorName}» در پالت شماست، ولی ` : ''}«${worst.p.colorName}» (${worst.p.typeFa}) از پالت «${SEASONS[prof.seasonId].fa}» دور است${worst.p.cat === 'scarf' || worst.p.cat === 'top' || worst.p.cat === 'dress' ? '؛ چون نزدیک صورت است، تأثیرش بیشتر است.' : '.'}`;
      parts.push({ key: 'palette', label: 'پالت رنگ شخصی', score: Math.round(avg), weight: 0.18, why });
    }
  }
  parts.push(formalityPart(pieces, occ));
  parts.push(occasionColorPart(pieces, occ));
  parts.push(patternPart(pieces, occ));
  if (prof.shape || prof.height) {
    const body = pieces.filter((p) => BODY.has(p.cat));
    if (body.length) {
      const fs = body.map((p) => ({ p, r: fitScore(p.tags, prof.shape, prof.height) }));
      const avg = fs.reduce((a, x) => a + x.r.score, 0) / fs.length;
      const notes = fs.filter((x) => x.r.why).map((x) => `${x.p.typeFa}: ${x.r.why}`);
      parts.push({ key: 'body', label: 'تناسب با فرم بدن', score: Math.round(avg), weight: 0.1, why: notes.join(' ') || 'نکته‌ی خاصی درباره‌ی فرم بدن ندارد.' });
    }
  }
  const t = temperatureMix(colorPieces.map((p) => p.lab));
  parts.push({ key: 'temp', label: 'دمای رنگ (گرم/سرد)', score: t.score, weight: 0.05, why: t.why });
  if (prof.contrastLevel) { const c = contrastMatch(colorPieces.map((p) => p.lab), prof.contrastLevel); parts.push({ key: 'contrast', label: 'کنتراست', score: c.score, weight: 0.05, why: c.why }); }
  const w = weatherPart(pieces, ctx.weather); if (w) parts.push(w);
  if (!ctx.partial) parts.push(completenessPart(pieces, ctx.needs || needsFor(occ, prof, ctx.weather)));
  const wsum = parts.reduce((a, p) => a + p.weight, 0);
  const total = Math.round(parts.reduce((a, p) => a + p.score * p.weight, 0) / wsum);
  return { total, parts, scheme: h.scheme, occasion: occ.id };
}

export function needsFor(occ, prof = {}, weather) {
  const hijab = prof.hijab !== false && (occ.hijab || occ.forceHijab);
  return { shoes: true, outer: hijab || weather === 'cold', scarf: hijab, bag: true };
}

// ------------------------------------------------------------------ generic candidates
const NEUTRAL_POOL = NAMED_COLORS.filter((c) => c.neutral && !['تُپی (توپ)', 'نقره‌ای', 'خاکی'].includes(c.name));
const named = (lab, reason, kind) => { const n = nearestNamed(lab); return { hex: n.hex, lab: n.lab, name: n.name, reason, kind }; };

/** Candidate colors for a slot, each with the reason it was proposed. */
export function colorCandidates(anchorLabs, occ, seasonId, cat) {
  const out = [];
  const push = (c) => { if (!out.some((o) => o.name === c.name)) out.push(c); };
  if (occ.palette === 'black') { ['مشکی', 'ذغالی', 'سرمه‌ای', 'قهوه‌ای سوخته'].forEach((n) => { const c = NAMED_COLORS.find((x) => x.name === n); push({ ...c, reason: 'رنگ تیره و ساده مناسب مراسم' }); }); return out; }
  const darkOnly = occ.palette === 'dark' && (LARGE.has(cat) || cat === 'shoes' || cat === 'bag');
  for (const c of NEUTRAL_POOL) {
    if (darkOnly && c.lab[0] > 42) continue;
    push({ hex: c.hex, lab: c.lab, name: c.name, kind: 'neutral', reason: darkOnly ? 'رنگ تیره و خنثی مطابق عرف رسمی' : 'رنگ خنثی و پایه که با همه‌چیز ست می‌شود' });
  }
  if (darkOnly) return out;
  for (const a of anchorLabs) {
    if (isNeutral(a)) continue;
    const [L, C, h] = labToLch(a);
    push(named(lchToLab([L, C * 0.85, (h + 180) % 360]), `رنگ مکملِ «${nearestNamed(a).name}» که کنتراست متعادلی می‌سازد`, 'accent'));
    push(named(lchToLab([L, C * 0.9, (h + 30) % 360]), `رنگ همسایه‌ی «${nearestNamed(a).name}» روی چرخه‌ی رنگ`, 'tonal'));
    push(named(lchToLab([L, C * 0.9, (h + 330) % 360]), `رنگ همسایه‌ی «${nearestNamed(a).name}» روی چرخه‌ی رنگ`, 'tonal'));
    push(named(lchToLab([clamp(L + (L > 55 ? -28 : 28), 5, 95), C * 0.7, h]), `تیره/روشن‌ترِ همان «${nearestNamed(a).name}» برای ست تک‌رنگ`, 'tonal'));
  }
  if (seasonId && SEASONS[seasonId]) {
    for (const hex of SEASONS[seasonId].best) { const lab = hexToLab(hex); push({ hex, lab, name: nearestNamed(lab).name, kind: 'palette', reason: `از پالت فصلی شما («${SEASONS[seasonId].fa}»)` }); }
  } else if (anchorLabs.every((a) => isNeutral(a))) {
    ['زرشکی', 'سبز زمردی', 'زرد خردلی', 'صورتی چرک (رز دودی)', 'آبی کاربنی', 'شتری', 'سبز زیتونی'].forEach((n) => { const c = NAMED_COLORS.find((x) => x.name === n); push({ ...c, kind: 'accent', reason: 'یک رنگ تأکیدی کلاسیک کنار لباس خنثی' }); });
  }
  if (occ.palette === 'fresh') ['سبز نعنایی', 'صورتی ملایم', 'زرد لیمویی', 'آبی پودری', 'یاسی', 'هلویی'].forEach((n) => { const c = NAMED_COLORS.find((x) => x.name === n); push({ ...c, kind: 'accent', reason: 'رنگ تازه و بهاری برای نوروز' }); });
  if (occ.palette === 'bright') ['زرشکی', 'سبز زمردی', 'آبی کاربنی', 'طلایی', 'سرخابی'].forEach((n) => { const c = NAMED_COLORS.find((x) => x.name === n); push({ ...c, kind: 'accent', reason: 'رنگ جواهری مناسب مهمانی' }); });
  return out;
}

function typeCandidates(cat, occ, prof, weather) {
  let ts = typesOf(cat).filter((t) => !(t.f[1] < occ.f[0] || t.f[0] > occ.f[1]));
  if (occ.allowCats && occ.allowCats[cat]) ts = ts.filter((t) => occ.allowCats[cat].includes(t.id));
  if (weather === 'hot') ts = ts.filter((t) => t.warm < 2);
  if (weather === 'cold' && cat === 'outer') ts = ts.filter((t) => t.warm > 0);
  if (weather === 'cold') ts = ts.filter((t) => t.id !== 'sandals');
  if (!prof.hijab && cat === 'scarf') ts = ts.filter((t) => t.id !== 'maghnaeh');
  if (!ts.length) ts = typesOf(cat).slice(0, 2);
  const scored = ts.map((t) => {
    const fitR = fitScore(t.tags, prof.shape, prof.height).score;
    const mid = (occ.f[0] + occ.f[1]) / 2, tm = (t.f[0] + t.f[1]) / 2;
    return { t, s: fitR - 12 * Math.abs(mid - tm) };
  }).sort((a, b) => b.s - a.s);
  return scored.slice(0, 2).map((x) => x.t);
}

function slotsFor(anchorCats, occ, prof, weather) {
  const needs = needsFor(occ, prof, weather);
  const has = (c) => anchorCats.includes(c);
  const slots = [];
  if (!has('dress')) { if (!has('top')) slots.push('top'); if (!has('bottom')) slots.push('bottom'); }
  if (needs.outer && !has('outer')) slots.push('outer');
  else if (!has('outer') && ['court', 'office'].includes(occ.id) && !has('dress')) slots.push('outer');
  if (needs.scarf && !has('scarf')) slots.push('scarf');
  if (!has('shoes')) slots.push('shoes');
  if (!has('bag')) slots.push('bag');
  if (!has('accessory') && occ.id !== 'mourning') slots.push('accessory');
  return { slots, needs };
}

const ACCESSORY_COLORS = [{ name: 'طلایی', hex: '#c8a24a' }, { name: 'نقره‌ای', hex: '#b8bcc2' }].map((c) => ({ ...c, lab: hexToLab(c.hex) }));

/**
 * Build one complete outfit around fixed anchor pieces for an occasion (greedy, explainable).
 */
// Strategy = which color story this look tells. Bonus is applied to candidates of the matching kind.
export const STRATEGIES = {
  neutral: { fa: 'پایه‌ی خنثی', kinds: ['neutral'], cats: null },
  accent: { fa: 'رنگ تأکیدی', kinds: ['accent', 'palette'], cats: ['scarf', 'bag', 'shoes', 'top', 'bottom'] },
  tonal: { fa: 'تک‌رنگ / همسایه', kinds: ['tonal'], cats: null },
  palette: { fa: 'از پالت شخصی', kinds: ['palette'], cats: ['scarf', 'top', 'outer', 'bottom', 'bag'] },
};
export function buildOutfit(anchors, { occasion, wardrobe = [], profile = {}, weather, avoid = {}, strategy = 'neutral' } = {}) {
  const occ = OCC[occasion];
  const prof = { hijab: true, ...profile };
  const fixed = anchors.map(toPiece);
  const { slots, needs } = slotsFor(fixed.map((p) => p.cat), occ, prof, weather);
  const chosen = [...fixed];
  const usedIds = new Set(fixed.map((p) => p.id).filter(Boolean));
  for (const cat of slots) {
    const cands = [];
    for (const it of wardrobe) {
      if ((it.category || it.cat) !== cat || usedIds.has(it.id)) continue;
      const wp = toPiece(it);
      const st = STRATEGIES[strategy];
      const kind = isNeutral(wp.lab) ? 'neutral' : 'wardrobe';
      cands.push({ piece: wp, bonus: 6 + (st && st.kinds.includes(kind) ? 9 : 0), kind });
    }
    const types = typeCandidates(cat, occ, prof, weather);
    const colors = cat === 'accessory' ? (warmish(chosen) ? ACCESSORY_COLORS : ACCESSORY_COLORS.slice().reverse())
      : colorCandidates(fixed.map((p) => p.lab), occ, prof.seasonId, cat);
    for (const t of types) for (const c of colors) {
      const st = STRATEGIES[strategy];
      const want = st && st.kinds.includes(c.kind) && (!st.cats || st.cats.includes(cat)) && !strategyUsed(chosen, strategy, fixed);
      cands.push({ piece: toPiece({ type: t.id, cat, hex: c.hex, lab: c.lab, colorName: c.name, reason: c.reason || (cat === 'accessory' ? 'فلز هم‌دمای رنگ‌های ست' : '') }), bonus: want ? 9 : 0, kind: c.kind });
    }
    let best = null;
    for (const c of cands) {
      let s = scoreOutfit([...chosen, c.piece], { occasion, profile: prof, weather, partial: true }).total + c.bonus;
      if (avoid[cat] && avoid[cat].has(c.piece.colorName)) s -= 6;
      if (cat !== 'accessory') s -= 4 * chosen.filter((p) => p.colorName === c.piece.colorName).length;
      if (cat === 'accessory') s += c.piece.type === (occ.id === 'party' ? 'statement' : 'watch') ? 2 : 0;
      if (!best || s > best.s) best = { s, piece: c.piece, kind: c.kind };
    }
    if (best) { best.piece.kind = best.kind; chosen.push(best.piece); if (best.piece.id) usedIds.add(best.piece.id); }
  }
  const result = scoreOutfit(chosen, { occasion, profile: prof, weather, needs });
  return { occasion: occ.id, occasionFa: occ.fa, icon: occ.icon, note: occ.note, strategy, strategyFa: STRATEGIES[strategy]?.fa, pieces: chosen, anchors: fixed.map((p) => p.id || p.type), ...result, tips: outfitTips(chosen, prof, occ) };
}
// For 'accent' one accent piece is enough; for others keep applying.
const STRATEGY_LIMIT = { accent: 1, tonal: 2, palette: 2, neutral: 99 };
function strategyUsed(chosen, strategy, fixed) {
  const kinds = STRATEGIES[strategy]?.kinds || [];
  return chosen.filter((p) => !fixed.includes(p) && kinds.includes(p.kind)).length >= (STRATEGY_LIMIT[strategy] ?? 99);
}
const warmish = (pieces) => pieces.filter((p) => temperature(p.lab) === 'warm').length >= pieces.filter((p) => temperature(p.lab) === 'cool').length;

function outfitTips(pieces, prof, occ) {
  const tips = [];
  const s = SHAPES[prof.shape];
  if (s) tips.push(`فرم ${s.fa}: ${s.goal} یقه‌ی پیشنهادی: ${s.necklines}.`);
  const h = heightAdvice(prof.height);
  if (h && h.level !== 'average') tips.push(h.tips[0] + '.');
  const shoes = pieces.find((p) => p.cat === 'shoes'), bottom = pieces.find((p) => p.cat === 'bottom');
  if (shoes && bottom && deltaE(shoes.lab, bottom.lab) < 15) tips.push('کفش هم‌رنگ شلوار/دامن است؛ پاها کشیده‌تر دیده می‌شوند.');
  const bag = pieces.find((p) => p.cat === 'bag');
  if (shoes && bag && deltaE(shoes.lab, bag.lab) < 15) tips.push('کیف و کفش هم‌رنگ‌اند؛ ست مرتب و کلاسیک می‌شود.');
  return tips;
}

/** Rank occasions by how well the anchor garment can serve them. */
export function rankOccasions(anchor, profile = {}) {
  const p = toPiece(anchor);
  return OCCASIONS.map((o) => {
    const gap = p.f[1] < o.f[0] ? o.f[0] - p.f[1] : p.f[0] > o.f[1] ? p.f[0] - o.f[1] : 0;
    let s = 100 - gap * 35;
    if (o.palette === 'black' && !(isNeutral(p.lab) && p.lab[0] < 30)) s -= 100;
    if (o.palette === 'dark' && LARGE.has(p.cat) && p.lab[0] > 45) s -= 45;
    if (o.palette === 'dark' && p.pattern !== 'solid') s -= 30;
    if (o.palette === 'fresh' && p.lab[0] < 35 && isNeutral(p.lab)) s -= 15;
    if (o.id === 'manteau' && profile.hijab === false) s -= 40;
    if (o.id === 'party' && p.cat === 'dress') s += 5;
    return { id: o.id, s };
  }).sort((a, b) => b.s - a.s);
}

/**
 * «ست با این لباس»: 3–5 complete looks around one garment.
 */
export function suggestForAnchor(anchor, { wardrobe = [], profile = {}, weather, count = 4 } = {}) {
  const ranked = rankOccasions(anchor, profile);
  let picks = ranked.filter((r) => r.s >= 60).slice(0, Math.min(5, Math.max(3, count)));
  if (picks.length < 3) picks = ranked.slice(0, 3);
  const avoid = {};
  const looks = [];
  const anchorNeutral = isNeutral(toPiece(anchor).lab);
  const order = anchorNeutral ? ['accent', 'neutral', 'palette', 'accent', 'tonal'] : ['neutral', 'tonal', 'accent', 'palette', 'neutral'];
  let k = 0;
  for (const r of picks) {
    const strategy = ['court', 'mourning'].includes(r.id) ? 'neutral' : order[k++ % order.length];
    const look = buildOutfit([anchor], { occasion: r.id, wardrobe, profile, weather, avoid, strategy });
    look.occasionFit = r.s;
    for (const p of look.pieces) { if (p.generic) { (avoid[p.cat] ||= new Set()).add(p.colorName); } }
    looks.push(look);
  }
  return looks;
}

/**
 * «ست کردن چند لباس»: rank combinations of the given garments (completing missing core pieces generically).
 */
export function combineItems(items, { profile = {}, weather, occasion, limit = 6, maxCombos = 4000 } = {}) {
  const by = {};
  for (const it of items) (by[it.category || it.cat] ||= []).push(it);
  const bases = [];
  for (const d of by.dress || []) bases.push([d]);
  for (const t of by.top || []) for (const b of by.bottom || []) bases.push([t, b]);
  if (!bases.length) { for (const t of by.top || []) bases.push([t]); for (const b of by.bottom || []) bases.push([b]); }
  if (!bases.length) bases.push([]);
  const optional = ['outer', 'scarf', 'shoes', 'bag', 'accessory'].filter((c) => by[c]?.length);
  let combos = bases.map((b) => b);
  for (const c of optional) {
    const next = [];
    for (const combo of combos) for (const it of by[c]) { next.push([...combo, it]); if (next.length > maxCombos) break; }
    combos = next.length ? next : combos;
  }
  const occs = occasion ? [occasion] : OCCASIONS.filter((o) => o.id !== 'mourning' || items.every((i) => toPiece(i).lab[0] < 30)).map((o) => o.id);
  const scored = [];
  for (const combo of combos) {
    if (!combo.length) continue;
    let best = null;
    for (const o of occs) {
      const r = scoreOutfit(combo, { occasion: o, profile: { hijab: true, ...profile }, weather, partial: true });
      if (!best || r.total > best.total) best = { ...r, occasion: o };
    }
    scored.push({ items: combo, ...best });
  }
  scored.sort((a, b) => b.total - a.total);
  const out = [];
  const seen = new Set();
  for (const s of scored) {
    const key = s.items.map((i) => i.id).sort().join('|');
    if (seen.has(key)) continue; seen.add(key);
    // complete missing core/hijab pieces generically so the look is wearable
    const look = buildOutfit(s.items, { occasion: s.occasion, wardrobe: [], profile, weather });
    out.push({ ...look, uploadedScore: s.total, usedIds: s.items.map((i) => i.id) });
    if (out.length >= limit) break;
  }
  return out.sort((a, b) => b.total - a.total);
}

/**
 * «این لباس بهم میاد؟» — check a single garment or color against the profile.
 */
export function suitsMe(item, profile = {}) {
  const p = toPiece(item);
  const res = { checks: [], verdict: '', score: 0 };
  let sum = 0, n = 0;
  if (profile.seasonId) {
    const m = paletteMatch(p.lab, profile.seasonId);
    const nearFace = FACE.has(p.cat);
    res.checks.push({ label: 'رنگ', score: m.score, why: m.why + (nearFace ? '' : ' (چون این تکه دور از صورت است، اهمیت رنگ کمتر است.)') });
    sum += m.score * (nearFace ? 1.4 : 0.7); n += nearFace ? 1.4 : 0.7;
  }
  if ((profile.shape || profile.height) && BODY.has(p.cat)) {
    const f = fitScore(p.tags, profile.shape, profile.height);
    res.checks.push({ label: 'فرم و برش', score: f.score, why: f.why || 'برش این لباس برای فرم بدن شما خنثی است.' });
    sum += f.score; n += 1;
  }
  if (!n) { res.verdict = 'برای جواب دقیق، اول پروفایل بدن و رنگ چهره را در بخش «من» کامل کنید.'; res.score = null; return res; }
  res.score = Math.round(sum / n);
  res.verdict = res.score >= 80 ? 'بله! این لباس به شما خیلی می‌آید. 💚' : res.score >= 62 ? 'می‌آید، با کمی دقت در ست کردن. 👍' : 'احتمالاً انتخاب اولتان نیست؛ اگر دوستش دارید، دور از صورت و با رنگ‌های پالت خودتان ست کنید. 🤔';
  return res;
}
