// Garment categories, garment types (with formality 1–5 and fit tags used by the body-shape rules) and occasions.
export const CATEGORIES = [
  { id: 'top', fa: 'بالاتنه', icon: '👚' },
  { id: 'bottom', fa: 'پایین‌تنه', icon: '👖' },
  { id: 'outer', fa: 'مانتو / کت', icon: '🧥' },
  { id: 'dress', fa: 'پیراهن / لباس یکسره', icon: '👗' },
  { id: 'shoes', fa: 'کفش', icon: '👠' },
  { id: 'bag', fa: 'کیف', icon: '👜' },
  { id: 'accessory', fa: 'اکسسوری', icon: '💍' },
  { id: 'scarf', fa: 'روسری / شال', icon: '🧣' },
];
export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

// f: [min,max] formality the piece can carry; tags drive body-shape advice; warm: 0 light/summer … 2 heavy/winter
export const TYPES = [
  // tops
  { id: 'blouse', cat: 'top', fa: 'بلوز رسمی', f: [3, 5], tags: ['fitted'], warm: 1 },
  { id: 'shirt', cat: 'top', fa: 'شومیز / پیراهن یقه‌دار', f: [3, 5], tags: ['collar', 'straight'], warm: 1 },
  { id: 'vneck', cat: 'top', fa: 'تاپ یا بلوز یقه هفت', f: [2, 4], tags: ['v-neck'], warm: 1 },
  { id: 'wrap-top', cat: 'top', fa: 'بلوز جلوبسته (رپ)', f: [3, 4], tags: ['wrap', 'v-neck', 'belted'], warm: 1 },
  { id: 'tshirt', cat: 'top', fa: 'تی‌شرت', f: [1, 2], tags: ['straight', 'crew-neck'], warm: 0 },
  { id: 'sweater', cat: 'top', fa: 'بافت / پلیور', f: [2, 3], tags: ['crew-neck'], warm: 2 },
  { id: 'turtleneck', cat: 'top', fa: 'یقه‌اسکی', f: [2, 4], tags: ['high-neck', 'fitted'], warm: 2 },
  { id: 'peplum', cat: 'top', fa: 'بلوز پپلوم (دامن‌دار)', f: [3, 4], tags: ['peplum', 'fitted'], warm: 1 },
  { id: 'crop', cat: 'top', fa: 'کراپ', f: [1, 2], tags: ['cropped'], warm: 0 },
  { id: 'hoodie', cat: 'top', fa: 'هودی / سویشرت', f: [1, 1], tags: ['oversized', 'boxy'], warm: 2 },
  // bottoms
  { id: 'trousers', cat: 'bottom', fa: 'شلوار پارچه‌ای راسته', f: [3, 5], tags: ['straight', 'high-waist'], warm: 1 },
  { id: 'wide-leg', cat: 'bottom', fa: 'شلوار دمپا گشاد', f: [2, 4], tags: ['wide-leg', 'high-waist'], warm: 1 },
  { id: 'cigarette', cat: 'bottom', fa: 'شلوار سیگاری (مچی)', f: [3, 4], tags: ['slim', 'cropped-leg'], warm: 1 },
  { id: 'jeans', cat: 'bottom', fa: 'شلوار جین راسته', f: [1, 3], tags: ['straight'], warm: 1 },
  { id: 'skinny', cat: 'bottom', fa: 'جین جذب (اسکینی)', f: [1, 2], tags: ['skinny'], warm: 1 },
  { id: 'mom-jeans', cat: 'bottom', fa: 'جین مام / بگ', f: [1, 2], tags: ['high-waist', 'relaxed'], warm: 1 },
  { id: 'pencil', cat: 'bottom', fa: 'دامن مدادی', f: [3, 5], tags: ['pencil', 'fitted'], warm: 1 },
  { id: 'a-skirt', cat: 'bottom', fa: 'دامن کلوش (A)', f: [2, 4], tags: ['a-line', 'high-waist'], warm: 1 },
  { id: 'maxi-skirt', cat: 'bottom', fa: 'دامن بلند پلیسه', f: [2, 4], tags: ['maxi', 'flowy'], warm: 1 },
  { id: 'joggers', cat: 'bottom', fa: 'شلوار اسلش / ورزشی', f: [1, 1], tags: ['relaxed'], warm: 1 },
  // outerwear (Iranian manteau first)
  { id: 'manteau-formal', cat: 'outer', fa: 'مانتو رسمی بلند', f: [4, 5], tags: ['long-line', 'straight'], warm: 1 },
  { id: 'manteau-blazer', cat: 'outer', fa: 'مانتو کتی', f: [4, 5], tags: ['structured', 'belted'], warm: 1 },
  { id: 'manteau-open', cat: 'outer', fa: 'مانتو جلوباز / کیمونو', f: [2, 3], tags: ['flowy', 'long-line'], warm: 0 },
  { id: 'manteau-casual', cat: 'outer', fa: 'مانتو کوتاه اسپرت', f: [2, 3], tags: ['straight', 'cropped'], warm: 1 },
  { id: 'blazer', cat: 'outer', fa: 'کت تک (بلیزر)', f: [4, 5], tags: ['structured'], warm: 1 },
  { id: 'trench', cat: 'outer', fa: 'بارانی (ترنچ کت)', f: [3, 5], tags: ['belted', 'long-line'], warm: 1 },
  { id: 'coat', cat: 'outer', fa: 'پالتو', f: [3, 5], tags: ['long-line', 'structured'], warm: 2 },
  { id: 'cardigan', cat: 'outer', fa: 'ژاکت بافت (کاردیگان)', f: [2, 3], tags: ['relaxed', 'long-line'], warm: 2 },
  { id: 'leather', cat: 'outer', fa: 'کت چرم', f: [2, 3], tags: ['cropped', 'structured'], warm: 1 },
  { id: 'puffer', cat: 'outer', fa: 'کاپشن', f: [1, 2], tags: ['boxy', 'oversized'], warm: 2 },
  // dresses
  { id: 'evening', cat: 'dress', fa: 'لباس مجلسی', f: [4, 5], tags: ['fitted'], warm: 0 },
  { id: 'wrap-dress', cat: 'dress', fa: 'پیراهن جلوبسته (رپ)', f: [3, 4], tags: ['wrap', 'v-neck', 'belted'], warm: 0 },
  { id: 'a-dress', cat: 'dress', fa: 'پیراهن کلوش', f: [2, 4], tags: ['a-line'], warm: 0 },
  { id: 'maxi-dress', cat: 'dress', fa: 'پیراهن بلند (ماکسی)', f: [2, 4], tags: ['maxi', 'flowy'], warm: 0 },
  { id: 'shift', cat: 'dress', fa: 'پیراهن راسته (شیفت)', f: [3, 4], tags: ['straight', 'boxy'], warm: 0 },
  // shoes
  { id: 'heels', cat: 'shoes', fa: 'کفش پاشنه‌بلند (استیلتو)', f: [4, 5], tags: ['heel'], warm: 0 },
  { id: 'pumps', cat: 'shoes', fa: 'کفش رسمی پاشنه کوتاه', f: [4, 5], tags: ['heel', 'closed'], warm: 1 },
  { id: 'loafers', cat: 'shoes', fa: 'لوفر / کالج', f: [3, 4], tags: ['closed', 'flat'], warm: 1 },
  { id: 'ballet', cat: 'shoes', fa: 'کفش عروسکی (بالرین)', f: [2, 4], tags: ['flat'], warm: 0 },
  { id: 'ankle-boots', cat: 'shoes', fa: 'نیم‌بوت', f: [2, 4], tags: ['closed', 'heel'], warm: 2 },
  { id: 'boots', cat: 'shoes', fa: 'بوت ساق‌بلند', f: [2, 4], tags: ['closed'], warm: 2 },
  { id: 'sneakers', cat: 'shoes', fa: 'کتانی (اسنیکر)', f: [1, 2], tags: ['flat', 'closed'], warm: 1 },
  { id: 'sandals', cat: 'shoes', fa: 'صندل', f: [1, 3], tags: ['open', 'flat'], warm: 0 },
  // bags
  { id: 'tote-leather', cat: 'bag', fa: 'کیف دستی چرم (اداری)', f: [3, 5], tags: [], warm: 1 },
  { id: 'shoulder', cat: 'bag', fa: 'کیف دوشی', f: [2, 4], tags: [], warm: 1 },
  { id: 'clutch', cat: 'bag', fa: 'کیف مجلسی (کلاچ)', f: [4, 5], tags: [], warm: 1 },
  { id: 'crossbody', cat: 'bag', fa: 'کیف کراس‌بادی', f: [1, 3], tags: [], warm: 1 },
  { id: 'backpack', cat: 'bag', fa: 'کوله‌پشتی', f: [1, 2], tags: [], warm: 1 },
  // accessories
  { id: 'watch', cat: 'accessory', fa: 'ساعت مچی ظریف', f: [2, 5], tags: [], warm: 1 },
  { id: 'necklace', cat: 'accessory', fa: 'گردنبند ظریف', f: [2, 5], tags: [], warm: 1 },
  { id: 'statement', cat: 'accessory', fa: 'گردنبند/گوشواره درشت', f: [3, 5], tags: [], warm: 1 },
  { id: 'belt', cat: 'accessory', fa: 'کمربند چرم', f: [2, 5], tags: ['belted'], warm: 1 },
  { id: 'sunglasses', cat: 'accessory', fa: 'عینک آفتابی', f: [1, 3], tags: [], warm: 0 },
  { id: 'cap', cat: 'accessory', fa: 'کلاه کپ', f: [1, 1], tags: [], warm: 1 },
  // scarves / hijab
  { id: 'maghnaeh', cat: 'scarf', fa: 'مقنعه', f: [4, 5], tags: [], warm: 1 },
  { id: 'silk', cat: 'scarf', fa: 'روسری ابریشمی / ساتن', f: [3, 5], tags: [], warm: 0 },
  { id: 'cotton-shawl', cat: 'scarf', fa: 'شال نخی', f: [1, 3], tags: [], warm: 1 },
  { id: 'chiffon', cat: 'scarf', fa: 'شال حریر', f: [3, 4], tags: [], warm: 0 },
  { id: 'wool-shawl', cat: 'scarf', fa: 'شال بافت / پشمی', f: [1, 3], tags: [], warm: 2 },
];
export const TYPE = Object.fromEntries(TYPES.map((t) => [t.id, t]));
export const typesOf = (cat) => TYPES.filter((t) => t.cat === cat);

export const PATTERNS = [
  { id: 'solid', fa: 'ساده' }, { id: 'stripe', fa: 'راه‌راه' }, { id: 'check', fa: 'چهارخانه' },
  { id: 'floral', fa: 'گل‌دار' }, { id: 'print', fa: 'طرح‌دار / فانتزی' }, { id: 'texture', fa: 'بافت‌دار' },
];
export const PATTERN = Object.fromEntries(PATTERNS.map((p) => [p.id, p]));

// Occasions. f = target formality range. palette: 'dark' (dark neutrals only for big pieces), 'any', 'bright', 'fresh'.
// hijab: whether outdoor hijab pieces (outer + scarf) are required when the profile's hijab setting is on.
export const OCCASIONS = [
  { id: 'court', fa: 'رسمی / اداری – دادگاه', icon: '⚖️', f: [4, 5], palette: 'dark', hijab: true, maxAccents: 1, maxPatterns: 0,
    note: 'مطابق عرف دادگستری: پوشش پوشیده و تیره، مقنعه، کفش بسته و کمترین زیورآلات.', allowCats: { scarf: ['maghnaeh', 'silk'], shoes: ['pumps', 'loafers', 'ankle-boots'], bag: ['tote-leather', 'shoulder'], accessory: ['watch', 'necklace'] } },
  { id: 'office', fa: 'اداری / کاری شیک', icon: '💼', f: [3, 5], palette: 'any', hijab: true, maxAccents: 1, maxPatterns: 1,
    note: 'شیک و حرفه‌ای با یک رنگ تأکیدی.', allowCats: { bag: ['tote-leather', 'shoulder'] } },
  { id: 'casual', fa: 'روزمره', icon: '☕', f: [2, 3], palette: 'any', hijab: true, maxAccents: 2, maxPatterns: 1,
    note: 'راحت ولی مرتب؛ برای خرید، کافه و بیرون رفتن.' },
  { id: 'party', fa: 'مهمانی', icon: '✨', f: [4, 5], palette: 'bright', hijab: false, maxAccents: 2, maxPatterns: 1,
    note: 'جای رنگ‌های جواهری و اکسسوری درخشان.' },
  { id: 'sport', fa: 'اسپرت', icon: '👟', f: [1, 2], palette: 'any', hijab: true, maxAccents: 2, maxPatterns: 1,
    note: 'راحت و فعال، با کتانی.' },
  { id: 'manteau', fa: 'با حجاب / مانتو و شال', icon: '🧕', f: [2, 4], palette: 'any', hijab: true, forceHijab: true, maxAccents: 2, maxPatterns: 1,
    note: 'ست کامل بیرون: مانتو، شال یا روسری هماهنگ و کیف و کفش.' },
  { id: 'nowruz', fa: 'نوروز / دیدوبازدید', icon: '🌷', f: [3, 4], palette: 'fresh', hijab: true, maxAccents: 2, maxPatterns: 1,
    note: 'رنگ‌های شاد و تازه‌ی بهاری، مرتب و مجلسیِ سبک.' },
  { id: 'mourning', fa: 'مراسم ختم / عزا', icon: '🖤', f: [3, 5], palette: 'black', hijab: true, maxAccents: 0, maxPatterns: 0,
    note: 'مشکی یا خیلی تیره، ساده، بدون زیورآلات براق.', allowCats: { bag: ['tote-leather', 'shoulder'], shoes: ['pumps', 'loafers', 'ankle-boots', 'ballet'] } },
];
export const OCC = Object.fromEntries(OCCASIONS.map((o) => [o.id, o]));

export const WEATHERS = [
  { id: 'hot', fa: 'گرم ☀️', warmMax: 1 }, { id: 'mild', fa: 'معتدل 🌤', warmMax: 2 }, { id: 'cold', fa: 'سرد ❄️', warmMax: 2, warmMin: 0 },
];
/** Default weather from Jalali month (Kerman climate: hot summers, cold winters). */
export const weatherForMonth = (jm) => (jm >= 3 && jm <= 6 ? 'hot' : jm >= 9 && jm <= 12 ? (jm === 12 ? 'mild' : 'cold') : 'mild');
