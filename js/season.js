// 12-season personal color analysis (rule-based) and personal palettes.
// General guidance only — lighting, makeup and camera white-balance strongly affect results.
import { hexToLab, labToLch, deltaE, clamp, temperature, isNeutral } from './color.js';

export const SKIN_TONES = [
  { id: 's1', hex: '#f6e0d2', fa: 'خیلی روشن' }, { id: 's2', hex: '#efd0b8', fa: 'روشن' },
  { id: 's3', hex: '#e8c4a0', fa: 'روشن گندمی' }, { id: 's4', hex: '#dcb08a', fa: 'گندمی' },
  { id: 's5', hex: '#c99a6e', fa: 'گندمی تیره' }, { id: 's6', hex: '#b07f56', fa: 'سبزه' },
  { id: 's7', hex: '#8d5e3b', fa: 'سبزه تیره' }, { id: 's8', hex: '#5f3d26', fa: 'تیره' },
];
export const UNDERTONES = [
  { id: 'warm', fa: 'گرم (زیرپوست زرد/طلایی، رگ‌ها سبز)' },
  { id: 'cool', fa: 'سرد (زیرپوست صورتی/قرمز، رگ‌ها آبی/بنفش)' },
  { id: 'neutral', fa: 'خنثی (هر دو)' },
  { id: 'olive', fa: 'زیتونی (ته‌رنگ سبز-خاکستری)' },
];
// warm: -1 (ashy/cool) … +1 (golden/red)
export const HAIR_COLORS = [
  { id: 'black', fa: 'مشکی', hex: '#151515', warm: -0.3 },
  { id: 'dark-brown', fa: 'قهوه‌ای تیره', hex: '#3b2a20', warm: 0 },
  { id: 'brown', fa: 'قهوه‌ای', hex: '#5e4030', warm: 0.2 },
  { id: 'light-brown', fa: 'قهوه‌ای روشن / فندقی', hex: '#8a6448', warm: 0.3 },
  { id: 'ash-blonde', fa: 'بلوند دودی (زیتونی)', hex: '#a8987e', warm: -0.6 },
  { id: 'golden-blonde', fa: 'بلوند طلایی / عسلی', hex: '#c9a061', warm: 0.8 },
  { id: 'red', fa: 'حنایی / مسی', hex: '#8f3f22', warm: 1 },
  { id: 'burgundy', fa: 'شرابی / بادمجانی', hex: '#4c1e2a', warm: -0.5 },
  { id: 'grey', fa: 'جوگندمی / نقره‌ای', hex: '#a9a9a9', warm: -0.8 },
];
// clarity: +1 sparkling/clear … -1 soft/muted
export const EYE_COLORS = [
  { id: 'black', fa: 'مشکی', hex: '#1a1210', warm: 0, clarity: 0.3 },
  { id: 'dark-brown', fa: 'قهوه‌ای تیره', hex: '#3d2516', warm: 0.1, clarity: 0.1 },
  { id: 'brown', fa: 'قهوه‌ای روشن / عسلی', hex: '#7a4f25', warm: 0.5, clarity: -0.2 },
  { id: 'hazel', fa: 'فندقی (سبز-قهوه‌ای)', hex: '#7d6a3a', warm: 0.4, clarity: -0.4 },
  { id: 'green', fa: 'سبز', hex: '#4f7a4a', warm: 0.2, clarity: 0.3 },
  { id: 'blue', fa: 'آبی', hex: '#5b86b5', warm: -0.5, clarity: 0.6 },
  { id: 'grey', fa: 'طوسی', hex: '#8a949c', warm: -0.4, clarity: -0.3 },
];
const byId = (arr, id) => arr.find((x) => x.id === id);

export const SEASONS = {
  'light-spring': { fa: 'بهار روشن', en: 'Light Spring', family: 'spring', desc: 'رنگ‌های روشن، گرم و شفاف مثل هلویی، صورتی گرم و فیروزه‌ای روشن.',
    best: ['#f6b89a', '#f9d48b', '#a8dcc2', '#87d3cf', '#f4a7a0', '#f7e3a1', '#b7d98b', '#9fc6ea', '#f2c6d0', '#e9a96e', '#c7b3e6', '#7fc8b8'],
    neutrals: ['#f5f0e1', '#efe2c4', '#d8c3a5', '#b9a58a', '#9aa6b5'], avoid: ['#111111', '#5e1a2a', '#3f1d3b', '#36454f'] },
  'true-spring': { fa: 'بهار گرم', en: 'True (Warm) Spring', family: 'spring', desc: 'رنگ‌های گرم، شاد و زنده مثل مرجانی، سبز چمنی، زرد طلایی و فیروزه‌ای.',
    best: ['#f2766b', '#f07c24', '#f2c14e', '#7cbf4f', '#2fb5b0', '#f9a37a', '#e04f3a', '#c8a24a', '#4bb5d1', '#a3c94f', '#ff9c6e', '#d9533b'],
    neutrals: ['#f5f0e1', '#efe2c4', '#c19a6b', '#a9672f', '#4a6a8f'], avoid: ['#111111', '#808080', '#d6237a', '#3f1d3b'] },
  'bright-spring': { fa: 'بهار درخشان', en: 'Bright (Clear) Spring', family: 'spring', desc: 'رنگ‌های خالص و پرانرژی با کنتراست بالا مثل قرمز گوجه‌ای، سبز زمردی روشن و آبی فیروزه‌ای.',
    best: ['#e8352e', '#ff6f61', '#00a99d', '#1fa5e0', '#f9d423', '#2fbf71', '#ff4f8b', '#7a3cff', '#ff8c1a', '#00c2c7', '#e6007e', '#1f4fbf'],
    neutrals: ['#fafafa', '#efe2c4', '#1f2a44', '#36454f', '#c19a6b'], avoid: ['#c99a9a', '#b8a07e', '#8b8589', '#6b6b2f'] },
  'light-summer': { fa: 'تابستان روشن', en: 'Light Summer', family: 'summer', desc: 'رنگ‌های روشن، سرد و ملایم مثل آبی پودری، یاسی، صورتی ملایم و نعنایی.',
    best: ['#b9d3e8', '#c3a8d8', '#f4c2cc', '#a8dcc2', '#9fb7d9', '#e6a7c0', '#b5c7e3', '#d9b8e0', '#8fc1c7', '#c8d9ef', '#e8b4b8', '#a1b4d4'],
    neutrals: ['#fafafa', '#c4c4c4', '#8b8589', '#4a6a8f', '#d9d2c5'], avoid: ['#f07c24', '#c9a227', '#111111', '#a4472d'] },
  'true-summer': { fa: 'تابستان سرد', en: 'True (Cool) Summer', family: 'summer', desc: 'رنگ‌های سرد و نرم مثل آبی آسمانی، رز دودی، توت‌فرنگی ملایم و سبزآبی.',
    best: ['#87a9d6', '#c76b8f', '#5b7db1', '#9a6fae', '#6fa8a6', '#d98fa8', '#4a6a8f', '#b0a3d4', '#7aa6c2', '#a0577a', '#5f9ea0', '#e0a3b7'],
    neutrals: ['#f2f2f2', '#c4c4c4', '#808080', '#1f2a44', '#8b8589'], avoid: ['#f07c24', '#c9a227', '#a9672f', '#6b6b2f'] },
  'soft-summer': { fa: 'تابستان ملایم', en: 'Soft Summer', family: 'summer', desc: 'رنگ‌های غبارآلود و کم‌کنتراست مثل رز دودی، آبی خاکستری، یشمی ملایم و توپی.',
    best: ['#c99a9a', '#8fa3b8', '#8fb3a3', '#a68aa6', '#b48a8f', '#7b8fa6', '#9cae9c', '#c2a7b6', '#6e8a99', '#a3909e', '#b7a7c9', '#8a7f9e'],
    neutrals: ['#e8e2d8', '#b8b2aa', '#8b8589', '#5f6670', '#4a5568'], avoid: ['#111111', '#fafafa', '#f07c24', '#e8352e'] },
  'soft-autumn': { fa: 'پاییز ملایم', en: 'Soft Autumn', family: 'autumn', desc: 'رنگ‌های گرم و خاکی ملایم مثل شتری، سبز مریمی، صورتی چرک و هلویی دودی.',
    best: ['#c19a6b', '#9caf88', '#c99a9a', '#d8a47f', '#8f9779', '#b07d62', '#a3a07a', '#c4a484', '#7d8f7a', '#d2a679', '#8a9a8b', '#b5838d'],
    neutrals: ['#efe2c4', '#d8c3a5', '#b8a07e', '#8b7d6b', '#6f5e4f'], avoid: ['#111111', '#fafafa', '#1f4fbf', '#d6237a'] },
  'true-autumn': { fa: 'پاییز گرم', en: 'True (Warm) Autumn', family: 'autumn', desc: 'رنگ‌های گرم و غنی مثل خردلی، آجری، سبز زیتونی، کاراملی و نارنجی سوخته.',
    best: ['#c9a227', '#a4472d', '#6b6b2f', '#a9672f', '#cc5500', '#8a9a5b', '#b06a3c', '#d4a017', '#7b3f00', '#167c80', '#9b2d20', '#e0a458'],
    neutrals: ['#efe2c4', '#c19a6b', '#6f4e37', '#3d2b1f', '#4b5320'], avoid: ['#f4c2cc', '#d6237a', '#b9d3e8', '#808080'] },
  'deep-autumn': { fa: 'پاییز عمیق', en: 'Deep Autumn', family: 'autumn', desc: 'رنگ‌های تیره، گرم و پرمایه مثل قهوه‌ای سوخته، سبز ارتشی، زرشکی، کدویی و سبز آبی تیره.',
    best: ['#8a1c2b', '#4b5320', '#a4472d', '#7b3f00', '#c9a227', '#1d4e5f', '#5e1a2a', '#b06a3c', '#3c5a3c', '#cc5500', '#6e2232', '#0b5345'],
    neutrals: ['#3d2b1f', '#6f4e37', '#111111', '#efe2c4', '#4b5320'], avoid: ['#f4c2cc', '#b9d3e8', '#c3a8d8', '#c4c4c4'] },
  'deep-winter': { fa: 'زمستان عمیق', en: 'Deep Winter', family: 'winter', desc: 'رنگ‌های تیره و سرد با کنتراست بالا مثل مشکی، شرابی، سبز زمردی تیره و آبی کاربنی.',
    best: ['#5e1a2a', '#0b5345', '#1f2a44', '#8e3a6e', '#1f4fbf', '#c8102e', '#3f1d3b', '#006a4e', '#4a2236', '#2e3b8f', '#b0004f', '#14505c'],
    neutrals: ['#111111', '#36454f', '#fafafa', '#1f2a44', '#808080'], avoid: ['#f6b89a', '#c19a6b', '#c9a227', '#b8a07e'] },
  'true-winter': { fa: 'زمستان سرد', en: 'True (Cool) Winter', family: 'winter', desc: 'رنگ‌های سرد و خالص مثل قرمز سرد، سرخابی، آبی رویال، سبز زمردی و سفید برفی.',
    best: ['#c8102e', '#d6237a', '#1f4fbf', '#0b7a4b', '#6a3d9a', '#00838f', '#e0115f', '#2e3b8f', '#008b8b', '#9b1b5a', '#3a5fcd', '#7b1fa2'],
    neutrals: ['#fafafa', '#111111', '#808080', '#1f2a44', '#c4c4c4'], avoid: ['#f07c24', '#c9a227', '#c19a6b', '#6b6b2f'] },
  'bright-winter': { fa: 'زمستان درخشان', en: 'Bright (Clear) Winter', family: 'winter', desc: 'رنگ‌های بسیار خالص و یخی با کنتراست شدید مثل سرخابی، فیروزه‌ای، آبی برقی و مشکی-سفید.',
    best: ['#e6007e', '#00a3ad', '#0047ab', '#d0222f', '#00a86b', '#8a2be2', '#ff1493', '#00bfff', '#c71585', '#1e90ff', '#ffef00', '#b9f2ff'],
    neutrals: ['#fafafa', '#111111', '#36454f', '#1f2a44', '#c4c4c4'], avoid: ['#c99a9a', '#b8a07e', '#c19a6b', '#8b8589'] },
};
Object.values(SEASONS).forEach((s) => {
  s.temp = s.family === 'spring' || s.family === 'autumn' ? 'warm' : 'cool';
  s.bestLab = s.best.map(hexToLab); s.neutralLab = s.neutrals.map(hexToLab); s.avoidLab = s.avoid.map(hexToLab);
});

/** Estimate undertone from a sampled skin color (LAB hue angle: yellow-ish skin → warm, pink-ish → cool). */
export function estimateUndertone(skinHex) {
  const [L, C, h] = labToLch(hexToLab(skinHex));
  if (C < 8) return 'neutral';
  if (h >= 62) return C < 22 && L < 70 ? 'olive' : 'warm';
  if (h <= 48) return 'cool';
  return 'neutral';
}

/**
 * Determine one of 12 seasons.
 * @param {{skinHex:string, undertone:'warm'|'cool'|'neutral'|'olive'|'auto', hair:string, eyes:string}} p
 * @returns {{id, season, axes:{warmth,value,clarity}, contrast, ranking:Array<{id,score}>, why:string[]}}
 */
export function analyzeSeason(p) {
  const skinHex = p.skinHex || '#dcb08a';
  const hair = byId(HAIR_COLORS, p.hair) || HAIR_COLORS[1];
  const eyes = byId(EYE_COLORS, p.eyes) || EYE_COLORS[1];
  const undertone = !p.undertone || p.undertone === 'auto' ? estimateUndertone(skinHex) : p.undertone;
  const skinL = hexToLab(skinHex)[0];
  const hairL = hexToLab(hair.hex)[0];
  const eyeL = hexToLab(eyes.hex)[0];
  const ut = { warm: 0.8, cool: -0.8, neutral: 0, olive: 0.15 }[undertone] ?? 0;
  const warmth = clamp(ut + hair.warm * 0.3 + eyes.warm * 0.15, -1, 1);
  const value = clamp((0.55 * skinL + 0.35 * hairL + 0.1 * eyeL - 47) / 22, -1, 1);
  const contrast = Math.abs(skinL - Math.min(hairL, eyeL + 10));
  const clarity = clamp((contrast - 38) / 22 + eyes.clarity * 0.4 - (undertone === 'olive' ? 0.25 : 0), -1, 1);

  // Score each season by how well it matches the three axes (dominant + secondary characteristic).
  const target = {
    'light-spring': { value: 1, warmth: 0.4, clarity: 0.1 }, 'true-spring': { warmth: 1, value: 0.3, clarity: 0.4 }, 'bright-spring': { clarity: 1, warmth: 0.4, value: 0.1 },
    'light-summer': { value: 1, warmth: -0.4, clarity: -0.1 }, 'true-summer': { warmth: -1, value: 0.3, clarity: -0.3 }, 'soft-summer': { clarity: -1, warmth: -0.4, value: 0.1 },
    'soft-autumn': { clarity: -1, warmth: 0.4, value: -0.1 }, 'true-autumn': { warmth: 1, value: -0.3, clarity: -0.3 }, 'deep-autumn': { value: -1, warmth: 0.4, clarity: 0 },
    'deep-winter': { value: -1, warmth: -0.4, clarity: 0.2 }, 'true-winter': { warmth: -1, value: -0.3, clarity: 0.4 }, 'bright-winter': { clarity: 1, warmth: -0.4, value: -0.1 },
  };
  const me = { warmth, value, clarity };
  const ranking = Object.entries(target).map(([id, t]) => {
    let d = 0;
    for (const k of ['warmth', 'value', 'clarity']) d += (Math.abs(t[k]) + 0.35) * (me[k] - t[k]) ** 2;
    return { id, score: Math.round(100 * Math.exp(-d / 1.6)) };
  }).sort((a, b) => b.score - a.score);
  const id = ranking[0].id, season = SEASONS[id];
  const why = [];
  why.push(warmth > 0.2 ? 'ته‌رنگ کلی شما گرم است (زیرپوست و موی گرم‌تر).' : warmth < -0.2 ? 'ته‌رنگ کلی شما سرد است.' : 'ته‌رنگ شما نزدیک به خنثی است؛ رنگ‌های بینابین هم به شما می‌آیند.');
  why.push(value > 0.3 ? 'رنگ پوست و موی شما روی‌هم روشن است.' : value < -0.3 ? 'رنگ‌های طبیعی شما (مو/پوست) عمیق و تیره است.' : 'روشنایی رنگ‌های طبیعی شما متوسط است.');
  why.push(contrast > 45 ? 'کنتراست بین مو و پوست شما بالاست؛ رنگ‌های خالص و ترکیب‌های پرکنتراست به شما می‌آیند.' : contrast < 28 ? 'کنتراست چهره‌ی شما ملایم است؛ رنگ‌های نرم و غبارآلود هماهنگ‌ترند.' : 'کنتراست چهره‌ی شما متوسط است.');
  return { id, season, undertone, axes: { warmth: round2(warmth), value: round2(value), clarity: round2(clarity) }, contrast: Math.round(contrast), contrastLevel: contrast > 45 ? 'high' : contrast < 28 ? 'low' : 'medium', ranking: ranking.slice(0, 3), why };
}
const round2 = (v) => Math.round(v * 100) / 100;

/**
 * How well a color suits a season (0–100) + Persian reason.
 */
export function paletteMatch(lab, seasonId) {
  const s = SEASONS[seasonId];
  if (!s) return { score: 70, why: 'فصل رنگی شما هنوز مشخص نشده است.' };
  const dBest = Math.min(...s.bestLab.map((c) => deltaE(lab, c)));
  const dNeu = Math.min(...s.neutralLab.map((c) => deltaE(lab, c)));
  const dAvoid = Math.min(...s.avoidLab.map((c) => deltaE(lab, c)));
  const near = Math.min(dBest, dNeu);
  let score = clamp(1 - (near - 6) / 34, 0, 1) * 70;
  // property match
  const [L, C] = labToLch(lab);
  const t = temperature(lab);
  let prop = 30;
  if (t !== 'neutral' && t !== s.temp) prop -= 14;
  if (['light-spring', 'light-summer'].includes(seasonId) && L < 35) prop -= 10;
  if (['deep-autumn', 'deep-winter'].includes(seasonId) && L > 85 && C > 15) prop -= 6;
  if (['soft-summer', 'soft-autumn'].includes(seasonId) && C > 55) prop -= 12;
  if (['bright-spring', 'bright-winter'].includes(seasonId) && C < 15 && !isNeutral(lab)) prop -= 10;
  score += Math.max(0, prop);
  if (dAvoid < 9) score -= 25;
  score = Math.round(clamp(score, 0, 100));
  let why;
  if (dAvoid < 9) why = `این رنگ جزو رنگ‌هایی است که برای «${s.fa}» معمولاً توصیه نمی‌شود.`;
  else if (score >= 80) why = `این رنگ در پالت «${s.fa}» شماست و چهره را روشن‌تر نشان می‌دهد.`;
  else if (score >= 60) why = `این رنگ به پالت «${s.fa}» نزدیک است؛ قابل استفاده است.`;
  else why = `این رنگ از پالت «${s.fa}» دور است؛ بهتر است دور از صورت (مثلاً شلوار یا کفش) استفاده شود.`;
  return { score, why, dBest: Math.round(dBest), dAvoid: Math.round(dAvoid) };
}
