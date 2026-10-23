// Headless end-to-end test at iPhone size (390x844) with synthetic garment photos (tests/fixtures/*.jpg).
// Run: python3 -m http.server 8765 &  then  PW_DIR=/tmp/pw node tests/e2e.mjs http://127.0.0.1:8765/
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire((process.env.PW_DIR || '/tmp/pw') + '/');
const { chromium } = require('playwright-core');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const FIX = new URL('./fixtures/', import.meta.url).pathname;
const SHOTS = new URL('../screenshots/', import.meta.url).pathname;
const SKIP_AI = process.env.SKIP_AI === '1';
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); };

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fa-IR', timezoneId: 'Asia/Tehran',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  acceptDownloads: true,
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const external = [];
page.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
const shot = async (name, full = false) => {
  await page.evaluate(() => { const t = document.getElementById('toast'); t.className = t.className.replace(/\bshow\b/, ''); t.style.opacity = '0'; });
  await page.waitForTimeout(450); // let view fade-in finish
  await page.screenshot({ path: SHOTS + name + '.png', fullPage: full });
  await page.evaluate(() => { document.getElementById('toast').style.opacity = ''; });
};
const tab = (t) => page.click(`.tabbar [data-tab="${t}"]`);

/** Upload one garment photo through a file input and confirm the editor. */
async function intake(input, file, { cat, keepSave } = {}) {
  await page.setInputFiles(input, FIX + file);
  await page.waitForSelector('#edit-ok', { timeout: 240000 });
  const note = await page.textContent('#sheet-body');
  if (cat) await page.click(`#sheet-body .chip[data-cat="${cat}"]`);
  if (keepSave === false && await page.$('#edit-save')) await page.uncheck('#edit-save');
  await page.click('#edit-ok');
  await page.waitForFunction(() => !document.querySelector('#sheet').open);
  return note;
}

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('body[data-ready="1"]');
check('page loads with Persian title', (await page.title()) === 'استایلیست من');
check('html is RTL Persian', await page.evaluate(() => document.documentElement.dir === 'rtl' && document.documentElement.lang === 'fa'));
check('Vazirmatn font loaded locally', await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px Vazirmatn'); }));
await page.waitForTimeout(400);
await shot('01-home');

// ---- profile
await tab('me');
await page.fill('[name=height]', '۱۶۲');
await page.fill('[name=weight]', '60');
await page.fill('[name=bust]', '88');
await page.fill('[name=waist]', '72');
await page.fill('[name=hip]', '100');
await page.click('#skin-swatches [data-id="s4"]');
await page.click('#hair-swatches [data-id="dark-brown"]');
await page.click('#eye-swatches [data-id="brown"]');
await page.selectOption('[name=undertone]', 'warm');
await page.click('#profile-form button[type=submit]');
await page.waitForSelector('#season-palette');
const prof = await page.textContent('#profile-result');
check('profile → pear body shape (Persian digits accepted)', prof.includes('گلابی'), prof.slice(0, 60));
check('profile → 12-season result with palette', /فصل رنگی: (پاییز|بهار)/.test(prof) && (await page.$$('#season-palette i')).length === 12, (prof.match(/فصل رنگی: [^\s]+ [^\s]+/) || [''])[0]);
await page.evaluate(() => window.scrollTo(0, 0));
await shot('05-profile');
await page.selectOption('#set-bg', 'quick');

// ---- wardrobe (quick background removal)
await tab('wardrobe');
await shot('03-wardrobe-empty');
const wardrobePhotos = [['manteau-navy.jpg', 'outer'], ['trousers-black.jpg', 'bottom'], ['scarf-cream.jpg', 'scarf'], ['jeans-blue.jpg', 'bottom'], ['shirt-white-stripe.jpg', 'top']];
let note = '';
for (const [f, cat] of wardrobePhotos) note = await intake('#wardrobe-file', f, { cat });
check('quick background removal reported', note.includes('سریع'), note.match(/✓[^.]*/)?.[0]);
const items = await page.evaluate(() => window.__style.state.items.map((i) => ({ cat: i.category, color: i.colors[0].name, hex: i.colors[0].hex, n: i.colors.length, pattern: i.pattern })));
check('5 items saved to IndexedDB', items.length === 5);
const manteau = items.find((i) => i.cat === 'outer');
check('navy manteau colour detected (not background)', /سرمه|کاربنی|نفتی|آبی/.test(manteau.color), `${manteau.color} ${manteau.hex}`);
const scarf = items.find((i) => i.cat === 'scarf');
check('cream scarf colour detected on grey background', /کرم|بژ|شیری|نخودی|استخوانی|شنی|عاجی/.test(scarf.color), `${scarf.color} ${scarf.hex}`);
const corner = await page.evaluate(async () => {
  const it = window.__style.state.items.find((i) => i.category === 'outer');
  const img = new Image(); img.src = it.thumb; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  return [x.getImageData(1, 1, 1, 1).data[3], x.getImageData(Math.round(img.width * 0.3), Math.round(img.height * 0.4), 1, 1).data[3]];
});
check('cut-out thumbnail: transparent corner, opaque centre', corner[0] < 30 && corner[1] > 200, corner.join('/'));
await shot('04-wardrobe');

// ---- «ست با این لباس»
await tab('home');
await page.click('#go-anchor');
const t0 = Date.now();
await intake('#anchor-file', 'blouse-burgundy.jpg', { cat: 'top', keepSave: false });
await page.waitForSelector('#anchor-results .look');
const looks = await page.$$eval('#anchor-results .look', (els) => els.map((e) => ({ title: e.querySelector('h3').textContent, score: +e.querySelector('.ring b').textContent.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)), wardrobe: e.querySelectorAll('.pc em').length, pieces: e.querySelectorAll('.pc').length })));
check('anchor → 3–5 looks', looks.length >= 3 && looks.length <= 5, looks.map((l) => `${l.title.trim()} ${l.score}`).join(' | '));
check('looks are complete (≥5 pieces) and scored', looks.every((l) => l.pieces >= 5 && l.score > 50), looks.map((l) => l.pieces).join(','));
check('wardrobe items used in looks', (await page.$$('#anchor-results .pc em')).length > looks.length, `${Date.now() - t0}ms`);
check('every look has explanation bars', (await page.$$eval('#anchor-results .look', (els) => els.every((e) => e.querySelectorAll('.bar').length >= 5))));
await page.evaluate(() => window.scrollTo(0, 0));
await shot('02-anchor-looks');
await page.evaluate(() => document.querySelector('#anchor-results .look').scrollIntoView());
await page.evaluate(() => window.scrollBy(0, -70));
await shot('02b-anchor-look-card');
await page.click('#anchor-results .look details summary');
await page.evaluate(() => document.querySelector('#anchor-results .look details').scrollIntoView());
await shot('02c-why-breakdown');
await page.click('#anchor-occ [data-occ="office"]');
await page.waitForSelector('#anchor-results .look');
check('specific occasion (office) → looks', (await page.$$eval('#anchor-results .look h3', (e) => e.every((h) => h.textContent.includes('اداری')))));
await page.click('#anchor-results .save-look');
await page.click('#anchor-results .look:nth-of-type(2) .look-actions .btn:not(.primary), #anchor-results .look .look-actions .btn:not(.primary)');
await page.waitForSelector('#sheet[open]');
await page.click('#sheet-body .chip'); // امروز
await page.click('#sheet-body .btn.primary');
await page.waitForTimeout(300);
const outfits = await page.evaluate(() => window.__style.state.outfits.length);
check('looks saved to lookbook (one dated today)', outfits === 2);

// ---- lookbook
await tab('lookbook');
const lb = await page.textContent('#lookbook-list');
check('lookbook shows Jalali date for today', lb.includes('امروز') && /آبان|مهر|آذر|[۰-۹]/.test(lb));
await shot('06-lookbook');

// ---- combine
await tab('home');
await page.click('#go-combine');
await page.click('#combine-from-wardrobe');
for (const id of await page.$$eval('#sheet-body .tile', (t) => t.map((x) => x.dataset.id))) await page.click(`#sheet-body .tile[data-id="${id}"]`);
await page.click('#sheet-body .btn.primary');
await page.click('#combine-run');
await page.waitForSelector('#combine-results .look');
const combos = await page.$$eval('#combine-results .look', (els) => els.map((e) => e.querySelector('h3').textContent.trim() + ' ' + e.querySelector('.ring b').textContent));
check('combine → ranked combinations', combos.length >= 2, combos.join(' | '));
await page.evaluate(() => document.querySelector('#combine-results').scrollIntoView());
await page.evaluate(() => window.scrollBy(0, -70));
await shot('07-combine');

// ---- suits me
await tab('home');
await page.click('#go-suits');
await page.$eval('#suits-color', (el) => { el.value = '#b5651d'; el.dispatchEvent(new Event('change', { bubbles: true })); });
await page.waitForSelector('#suits-result .bar');
const verdict = await page.textContent('#suits-result');
check('«این بهم میاد؟» gives verdict with colour + fit checks', (await page.$$('#suits-result .bar')).length === 2, verdict.slice(0, 50));
await shot('08-suits-me');

// ---- dark theme
await page.click('#theme-btn'); await page.click('#theme-btn'); // auto -> light -> dark
await tab('home');
await page.waitForTimeout(300);
check('dark theme applied', await page.evaluate(() => document.documentElement.dataset.theme === 'dark'));
await shot('09-home-dark');
await tab('me'); await page.evaluate(() => document.querySelector('#settings').scrollIntoView()); await page.waitForTimeout(200);
await shot('10-settings-dark');
await page.click('#theme-btn');

// ---- export
await tab('me');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
const backup = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
check('JSON export contains items/outfits/profile', backup.items?.length === 5 && backup.outfits?.length === 2 && !!backup.profile, dl.suggestedFilename());

// ---- AI background removal (RMBG-1.4 from ./models/)
if (!SKIP_AI) {
  await page.selectOption('#set-bg', 'ai');
  await tab('home'); await page.click('#go-anchor');
  const a0 = Date.now();
  const aiNote = await intake('#anchor-file', 'manteau-navy.jpg', { cat: 'outer', keepSave: false });
  check('AI background removal (RMBG-1.4, in-browser) worked', aiNote.includes('هوش مصنوعی حذف شد'), `${((Date.now() - a0) / 1000).toFixed(1)}s incl. model load`);
  const anchorColor = await page.evaluate(() => window.__style.state.anchor.colors[0].name);
  check('AI cut-out colour = navy', /سرمه|کاربنی|نفتی|آبی/.test(anchorColor), anchorColor);
  check('model cached for offline use', await page.evaluate(async () => (await (await caches.open('style-ai-models-v1')).keys()).length > 0));
}

// ---- offline
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload({ waitUntil: 'networkidle' });
await ctx.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('body[data-ready="1"]', { timeout: 10000 }).catch(() => {});
check('works offline after first visit (service worker)', await page.evaluate(() => document.body.dataset.ready === '1' && window.__style.state.items.length === 5));
await ctx.setOffline(false);

check('no third-party network requests', external.length === 0, external.slice(0, 3).join(', '));
check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
