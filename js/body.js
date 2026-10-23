// Rule-based body-shape estimation and fit advice. General guidance only — every body is different.
export const SHAPES = {
  hourglass: { fa: 'ساعت شنی', icon: '⏳', desc: 'شانه/سینه و باسن هم‌اندازه با کمر باریک‌تر.',
    goal: 'نشان دادن خط کمر و حفظ تعادل بالا و پایین.',
    recommend: ['wrap', 'belted', 'fitted', 'pencil', 'high-waist', 'v-neck', 'a-line', 'peplum', 'structured'], avoid: ['boxy', 'oversized'],
    necklines: 'یقه هفت، یقه قایقی و جلوبسته (رپ)', lengths: 'دامن تا زانو یا میدی، مانتوی کمردار', fits: 'جذب ملایم یا کمردار؛ کمربند روی باریک‌ترین نقطه‌ی کمر' },
  pear: { fa: 'گلابی (مثلثی)', icon: '🍐', desc: 'باسن پهن‌تر از شانه/سینه.',
    goal: 'جلب توجه به بالاتنه و ایجاد تعادل با شانه‌ها.',
    recommend: ['a-line', 'wide-leg', 'v-neck', 'structured', 'high-waist', 'peplum', 'straight', 'collar', 'flowy', 'boat-neck'], avoid: ['skinny', 'pencil', 'cropped'],
    necklines: 'یقه قایقی، یقه هفت باز، یقه‌های دارای جزئیات', lengths: 'مانتوی بلندتر از باسن، دامن کلوش', fits: 'بالاتنه‌ی ساختاردار یا روشن‌تر، پایین‌تنه‌ی تیره و راسته یا گشاد' },
  apple: { fa: 'سیبی (بیضی)', icon: '🍎', desc: 'کمر هم‌اندازه یا پهن‌تر از سینه و باسن.',
    goal: 'ایجاد خط عمودی و کشیدگی بدن، بدون تأکید روی کمر.',
    recommend: ['v-neck', 'long-line', 'straight', 'flowy', 'wide-leg', 'a-line', 'structured', 'maxi'], avoid: ['belted', 'cropped', 'fitted', 'peplum', 'skinny'],
    necklines: 'یقه هفت و یقه‌های عمیق‌تر برای کشیدگی', lengths: 'مانتو و کت بلند و جلوباز، پیراهن امپایر', fits: 'راسته و روان؛ پارچه‌ی خوش‌افت، کمربند ضخیم روی شکم نه' },
  rectangle: { fa: 'مستطیلی', icon: '▭', desc: 'شانه، کمر و باسن تقریباً هم‌اندازه.',
    goal: 'ساختن انحنا و تعریف کمر.',
    recommend: ['belted', 'peplum', 'wrap', 'a-line', 'structured', 'high-waist', 'cropped', 'wide-leg'], avoid: ['boxy'],
    necklines: 'یقه گرد، قایقی و یقه‌های پف‌دار', lengths: 'کت کوتاه، دامن کلوش', fits: 'کمربند، لایه‌بندی و بلوز پپلوم برای ایجاد انحنا' },
  'inverted-triangle': { fa: 'مثلث وارونه', icon: '🔻', desc: 'شانه/سینه پهن‌تر از باسن.',
    goal: 'متعادل کردن شانه‌ها و حجم دادن به پایین‌تنه.',
    recommend: ['v-neck', 'a-line', 'wide-leg', 'flowy', 'maxi', 'wrap', 'relaxed'], avoid: ['structured', 'boat-neck', 'skinny', 'high-neck'],
    necklines: 'یقه هفت و یقه‌ی U شکل', lengths: 'دامن کلوش یا پلیسه، شلوار دمپا گشاد', fits: 'بالاتنه‌ی ساده و تیره، پایین‌تنه‌ی پرحجم یا روشن‌تر؛ سرشانه‌ی پددار نه' },
};

/**
 * @param {{bust?:number, waist?:number, hip?:number}} m — circumferences in cm (bust may be shoulder/bust circumference)
 * @returns {{shape:string|null, confidence:'measured'|'none', why:string}}
 */
export function bodyShape({ bust, waist, hip } = {}) {
  bust = +bust; waist = +waist; hip = +hip;
  if (!(bust > 40 && waist > 30 && hip > 40)) return { shape: null, confidence: 'none', why: 'برای تشخیص فرم بدن، دور سینه/شانه، کمر و باسن را وارد کنید یا فرم بدن را دستی انتخاب کنید.' };
  const bh = bust / hip;
  const smaller = Math.min(bust, hip);
  let shape, why;
  if (waist >= 0.92 * smaller) {
    shape = 'apple'; why = `دور کمر (${waist}) نزدیک یا بیشتر از دور سینه/باسن است.`;
  } else if (bh >= 0.95 && bh <= 1.05) {
    if (waist <= 0.77 * (bust + hip) / 2) { shape = 'hourglass'; why = `سینه (${bust}) و باسن (${hip}) هم‌اندازه‌اند و کمر (${waist}) به‌وضوح باریک‌تر است.`; }
    else { shape = 'rectangle'; why = `سینه، کمر و باسن تفاوت کمی با هم دارند.`; }
  } else if (bh < 0.95) {
    shape = 'pear'; why = `باسن (${hip}) بیش از ۵٪ پهن‌تر از سینه/شانه (${bust}) است.`;
  } else {
    shape = 'inverted-triangle'; why = `سینه/شانه (${bust}) بیش از ۵٪ پهن‌تر از باسن (${hip}) است.`;
  }
  return { shape, confidence: 'measured', why };
}

/** Height-based proportion advice (cm). */
export function heightAdvice(height) {
  height = +height;
  if (!height) return null;
  if (height < 158) return { level: 'petite', fa: 'قد کوتاه‌تر از میانگین', tips: ['ست تک‌رنگ یا هم‌خانواده برای کشیده‌تر دیده شدن', 'شلوار و دامن فاق‌بلند', 'مانتو تا بالای زانو یا کوتاه‌تر؛ مانتوی خیلی بلند فقط با کفش پاشنه‌دار', 'کفش هم‌رنگ شلوار یا پوست'], penalize: ['maxi', 'long-line'], favor: ['high-waist', 'cropped', 'v-neck'] };
  if (height > 172) return { level: 'tall', fa: 'قد بلندتر از میانگین', tips: ['مانتو و پالتوی بلند و دامن ماکسی عالی می‌نشیند', 'ترکیب دو رنگ متضاد بالا و پایین قد را متعادل می‌کند', 'کمربند و کت کوتاه برای تقسیم تناسب'], penalize: [], favor: ['maxi', 'long-line', 'wide-leg'] };
  return { level: 'average', fa: 'قد متوسط', tips: ['بیشتر طول‌ها مناسب‌اند؛ تناسب را با فرم بدن تنظیم کنید'], penalize: [], favor: [] };
}

/** BMI is shown only as neutral information, never used to judge. */
export const bmi = (h, w) => (h > 0 && w > 0 ? Math.round((w / ((h / 100) ** 2)) * 10) / 10 : null);

/**
 * Fit score (0–100) of a garment's tags for a body shape + height, with Persian reason.
 */
export function fitScore(tags = [], shapeId, height) {
  const s = SHAPES[shapeId];
  const h = heightAdvice(height);
  if (!s && !h) return { score: 75, why: '' };
  let score = 75; const good = [], bad = [];
  if (s) {
    for (const t of tags) { if (s.recommend.includes(t)) { score += 10; good.push(t); } if (s.avoid.includes(t)) { score -= 18; bad.push(t); } }
  }
  if (h) { for (const t of tags) { if (h.favor.includes(t)) score += 5; if (h.penalize.includes(t)) { score -= 8; bad.push(t); } } }
  score = Math.max(0, Math.min(100, score));
  let why = '';
  if (s && good.length) why = `برای فرم «${s.fa}» مناسب است (${good.map(tagFa).join('، ')}).`;
  if (bad.length) why += (why ? ' ' : '') + `ویژگی ${[...new Set(bad)].map(tagFa).join('، ')} برای فرم/قد شما کمتر توصیه می‌شود.`;
  return { score, why };
}

export const TAG_FA = { wrap: 'جلوبسته', belted: 'کمردار', fitted: 'جذب', pencil: 'مدادی', 'high-waist': 'فاق‌بلند', 'v-neck': 'یقه هفت', 'a-line': 'کلوش', peplum: 'پپلوم', structured: 'ساختاردار', boxy: 'جعبه‌ای', oversized: 'گشاد (اورسایز)', 'wide-leg': 'دمپا گشاد', straight: 'راسته', collar: 'یقه‌دار', flowy: 'روان', 'boat-neck': 'یقه قایقی', skinny: 'اسکینی', cropped: 'کوتاه (کراپ)', 'long-line': 'بلند', maxi: 'ماکسی', relaxed: 'آزاد', 'high-neck': 'یقه بسته', slim: 'باریک', 'crew-neck': 'یقه گرد', 'cropped-leg': 'مچی' };
export const tagFa = (t) => TAG_FA[t] || t;
