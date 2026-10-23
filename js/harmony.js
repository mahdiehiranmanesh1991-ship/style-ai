// Color-harmony analysis for a set of garment colors. Returns a 0–100 score and a Persian explanation.
import { labToLch, hueDiff, deltaE, isNeutral, temperature, nearestNamed } from './color.js';

/**
 * @param {Array<[L,a,b]>} labs — the main color of each piece
 * @returns {{score:number, scheme:string, schemeFa:string, why:string, accents:number}}
 */
export function analyzeHarmony(labs) {
  const pts = labs.filter(Boolean);
  if (pts.length < 2) return { score: 80, scheme: 'single', schemeFa: 'تک‌تکه', why: 'برای ارزیابی هماهنگی حداقل دو تکه لازم است.', accents: 0 };
  const accents = pts.filter((l) => !isNeutral(l));
  const lchs = accents.map(labToLch);
  const name = (l) => nearestNamed(l).name;

  if (accents.length === 0) {
    const Ls = pts.map((l) => l[0]);
    const range = Math.max(...Ls) - Math.min(...Ls);
    return { score: range > 25 ? 86 : 78, scheme: 'neutral', schemeFa: 'پایه‌ی خنثی', accents: 0,
      why: range > 25 ? 'ترکیب کاملاً خنثی با تفاوت تیره و روشن؛ شیک، امن و همیشگی.' : 'ترکیب کاملاً خنثی؛ امن است، ولی یک تکه‌ی تیره‌تر/روشن‌تر یا یک رنگ تأکیدی جان بیشتری می‌دهد.' };
  }
  if (accents.length === 1) {
    return { score: 92, scheme: 'accent', schemeFa: 'پایه‌ی خنثی + یک رنگ تأکیدی', accents: 1,
      why: `رنگ «${name(accents[0])}» تنها رنگ تأکیدی است و بقیه‌ی تکه‌ها خنثی‌اند؛ این ساده‌ترین و مطمئن‌ترین فرمول ست کردن است.` };
  }
  // 2+ accent colors: look at hue relationships
  const hues = lchs.map((x) => x[2]);
  let maxD = 0, minD = 360;
  for (let i = 0; i < hues.length; i++) for (let j = i + 1; j < hues.length; j++) { const d = hueDiff(hues[i], hues[j]); maxD = Math.max(maxD, d); minD = Math.min(minD, d); }
  const Ls = lchs.map((x) => x[0]);
  const Lrange = Math.max(...Ls) - Math.min(...Ls);
  const avgC = lchs.reduce((a, x) => a + x[1], 0) / lchs.length;
  const names = accents.map(name).join(' و ');
  const tooMany = accents.length >= 4 ? 18 : accents.length === 3 ? 6 : 0;
  let r;
  if (maxD < 18) r = { score: Lrange > 15 ? 90 : 82, scheme: 'monochrome', schemeFa: 'تک‌رنگ (مونوکروم)', why: `${names} از یک خانواده‌اند${Lrange > 15 ? ' و تفاوت تیره و روشن دارند؛ ست تک‌رنگ قد را بلندتر نشان می‌دهد.' : '؛ برای جذاب‌تر شدن، تیرگی/روشنی تکه‌ها را کمی متفاوت کنید.'}` };
  else if (maxD <= 50) r = { score: 87, scheme: 'analogous', schemeFa: 'رنگ‌های همسایه (آنالوگ)', why: `${names} روی چرخه‌ی رنگ کنار هم‌اند؛ ترکیبی آرام و هماهنگ.` };
  else if (accents.length === 2 && maxD >= 150) {
    const balanced = Math.abs(lchs[0][1] - lchs[1][1]) > 15 || Lrange > 20;
    r = { score: balanced ? 86 : 72, scheme: 'complementary', schemeFa: 'مکمل', why: balanced ? `${names} مکمل‌اند و چون یکی ملایم‌تر/تیره‌تر است، کنتراستی جذاب و متعادل ساخته‌اند.` : `${names} مکمل‌اند و هر دو پررنگ؛ ترکیب جسورانه‌ای است — بهتر است یکی را در تکه‌ی کوچک‌تر (شال، کیف) بیاورید.` };
  } else if (accents.length === 3 && minD >= 90) r = { score: 74, scheme: 'triadic', schemeFa: 'سه‌گانه (تریادیک)', why: `${names} سه‌گانه‌ی متعادل روی چرخه‌ی رنگ‌اند؛ پرانرژی است، یک رنگ را غالب نگه دارید.` };
  else if (accents.length === 2 && maxD >= 100) r = { score: 76, scheme: 'split', schemeFa: 'نیمه‌مکمل', why: `${names} فاصله‌ی زیادی روی چرخه‌ی رنگ دارند؛ ترکیب متضاد ولی قابل قبول است.` };
  else {
    // muted colors clash less
    const s = avgC < 25 ? 70 : 55;
    r = { score: s, scheme: 'clash', schemeFa: 'ناهماهنگ', why: `${names} رابطه‌ی هماهنگ مشخصی روی چرخه‌ی رنگ ندارند${avgC < 25 ? '، ولی چون ملایم‌اند تضاد زیادی ایجاد نمی‌کنند.' : '؛ بهتر است یکی را با رنگی خنثی عوض کنید.'}` };
  }
  r.score = Math.max(30, r.score - tooMany);
  if (tooMany) r.why += ' تعداد رنگ‌های تأکیدی زیاد است؛ قانون کلی: حداکثر ۲ تا ۳ رنگ در یک ست.';
  r.accents = accents.length;
  return r;
}

/** Temperature consistency of a set of colors. */
export function temperatureMix(labs) {
  const t = labs.filter((l) => l && !isNeutral(l)).map(temperature).filter((x) => x !== 'neutral');
  const w = t.filter((x) => x === 'warm').length, c = t.length - w;
  if (!t.length) return { score: 85, why: 'همه‌ی رنگ‌ها خنثی‌اند؛ دمای رنگ مسئله‌ای ندارد.' };
  if (!w || !c) return { score: 92, why: `همه‌ی رنگ‌های غیرخنثی ${w ? 'گرم' : 'سرد'}‌اند؛ دمای رنگ یکدست است.` };
  return { score: 68, why: 'ترکیب رنگ‌های گرم و سرد کنار هم؛ اگر عمدی است، یک رنگ خنثی بینشان فاصله بیندازد.' };
}

/** Lightness contrast of the outfit vs the person's natural contrast level. */
export function contrastMatch(labs, level = 'medium') {
  const Ls = labs.filter(Boolean).map((l) => l[0]);
  if (Ls.length < 2) return { score: 80, why: '' };
  const range = Math.max(...Ls) - Math.min(...Ls);
  const outfit = range > 55 ? 'high' : range < 25 ? 'low' : 'medium';
  const fa = { high: 'بالا', medium: 'متوسط', low: 'کم' };
  const order = { low: 0, medium: 1, high: 2 };
  const diff = Math.abs(order[outfit] - order[level]);
  return { score: [94, 76, 58][diff], outfit, why: diff === 0 ? `کنتراست تیره-روشن ست (${fa[outfit]}) با کنتراست طبیعی چهره‌ی شما (${fa[level]}) هم‌خوان است.` : `کنتراست ست ${fa[outfit]} است ولی کنتراست چهره‌ی شما ${fa[level]}؛ ${order[outfit] > order[level] ? 'تکه‌ی خیلی تیره یا خیلی روشن را ملایم‌تر کنید.' : 'یک تکه‌ی تیره‌تر یا روشن‌تر اضافه کنید.'}` };
}
export { deltaE };
