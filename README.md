# استایلیست من — Style AI (PWA)

<div dir="rtl">

## فارسی

**استایلیست من** یک وب‌اپ آفلاین و فارسی برای پیشنهاد استایل لباس است که روی گوشی (به‌خصوص آیفون با «افزودن به صفحهٔ اصلی») مثل یک اپ واقعی کار می‌کند. همهٔ پردازش‌ها **روی خود گوشی** انجام می‌شود: سرور، حساب کاربری و کلید API ندارد و هیچ عکسی جایی ارسال نمی‌شود.

### امکانات
- **ست با این لباس**: عکس یک لباس می‌دهی (یا از کمد انتخاب می‌کنی) و ۳ تا ۵ استایل کامل برای موقعیت‌های مختلف (رسمی/دادگاه، اداری، روزمره، مهمانی، باحجاب، عزا، ورزشی و…) می‌گیری. می‌توانی یک موقعیت مشخص را هم انتخاب کنی تا چند استایل متفاوت برای همان موقعیت بسازد.
- **ست کردن چند لباس**: چند عکس لباس (از گالری یا کمد) بده تا بهترین ترکیب‌ها را رتبه‌بندی کند و تکه‌های جاافتاده را از کمد یا به‌صورت پیشنهاد کامل کند.
- **این بهم میاد؟**: عکس یک لباس در مغازه یا فقط یک رنگ را بده؛ از نظر رنگ (پالت فصلی تو) و فرم (فرم بدنت) نمره و توضیح می‌گیری.
- **کمد مجازی**: حذف خودکار پس‌زمینه (مدل هوش مصنوعی RMBG-1.4 داخل مرورگر یا روش سریع)، تشخیص رنگ‌های غالب با نام فارسی، حدس خودکار دسته و طرح، قابل ویرایش.
- **پروفایل استایل**: با قد، وزن، دور سینه/کمر/باسن، رنگ پوست/مو/چشم (یا نمونه‌برداری از سلفی) و زیرتون، **فرم بدن** و **فصل رنگی از ۱۲ فصل** را تخمین می‌زند و توصیه‌های برش و رنگ می‌دهد.
- **موتور قواعد قابل توضیح**: هر استایل نمره‌ای از ۱۰۰ دارد و دلیلش به تفکیک ۹ معیار نشان داده می‌شود (هارمونی رنگ، پالت شخصی، رسمی بودن، مناسب موقعیت، طرح، تناسب با فرم بدن، دمای رنگ، کنتراست، آب‌وهوا).
- **لوک‌بوک و تقویم شمسی**: ذخیرهٔ ست‌ها و برنامه‌ریزی برای روزهای مشخص.
- تم روشن/تیره، فونت وزیرمتن داخلی، پشتیبان‌گیری JSON و بازیابی، کاملاً آفلاین پس از اولین باز شدن.
- **پرو مجازی** فعلاً غیرفعال است (نیاز به مدل‌های سنگین/سرور دارد).

### حریم خصوصی
همهٔ داده‌ها (عکس‌ها، پروفایل، کمد) فقط در IndexedDB همین مرورگر ذخیره می‌شوند. تنها درخواست شبکه، دانلود فایل مدل از همین سایت است (و فقط اگر آن در دسترس نباشد، از Hugging Face).

### محدودیت‌ها
- پیشنهادها بر پایهٔ قواعد کلی استایلینگ و تئوری رنگ است، **راهنمای کلی** است و جای نظر استایلیست حرفه‌ای را نمی‌گیرد.
- نور عکس روی تشخیص رنگ پوست و لباس اثر دارد؛ عکس در نور روز و پس‌زمینهٔ ساده بهترین نتیجه را می‌دهد.
- مدل هوش مصنوعی حذف پس‌زمینه ۴۴ مگابایت است و بار اول باید دانلود شود؛ روی آیفون‌های قدیمی ممکن است کند باشد یا به‌خاطر حافظه شکست بخورد (در این صورت خودکار از روش سریع استفاده می‌شود).

### نصب روی آیفون
سایت را در Safari باز کن ← دکمهٔ Share ← **Add to Home Screen**. در تنظیمات اپ می‌توانی مدل هوش مصنوعی را یک‌بار برای استفادهٔ آفلاین دانلود کنی.

</div>

---

## English

**Style AI («استایلیست من»)** is an offline, Persian (RTL), mobile-first PWA that suggests outfits. Everything runs on-device — no server, no accounts, no API keys, no photo uploads.

### Features
- **Style this piece** – one garment photo (or a wardrobe item) → 3–5 complete looks for different occasions (court/formal, office, casual, party, hijab/manteau, mourning, sport…), or several distinct looks (strategies: monochrome, analogous, complementary accent, neutral base, triadic…) for one chosen occasion.
- **Combine several pieces** – multiple photos/wardrobe items → ranked combinations, missing slots filled from the wardrobe or suggested.
- **Does it suit me?** – photo of a garment or just a colour → colour (personal season palette) and fit (body shape) verdict with reasons.
- **Wardrobe** – background removal with **RMBG‑1.4 in the browser** (onnxruntime-web WASM in a Web Worker) with an automatic fallback to a fast flood-fill method; CIELAB k‑means dominant colours with Persian names; auto-guessed category/pattern (editable).
- **Body profile** – body shape from measurements (Persian digits accepted) and a **12‑season colour analysis** from skin/hair/eye swatches or selfie sampling + undertone.
- **Explainable rule engine** – 0–100 score broken down into 9 weighted criteria, with human-readable reasons.
- **Lookbook + Jalali calendar**, dark/light themes, bundled Vazirmatn font, JSON export/import, full offline support via a service worker.
- Virtual try-on is a disabled placeholder.

### Project layout
```
index.html, css/app.css, manifest.webmanifest, sw.js, .nojekyll
js/app.js        UI, routing, intake, rendering
js/engine.js     outfit generation & scoring (pure, unit-tested)
js/color.js harmony.js season.js body.js catalog.js jalali.js db.js image.js demo.js
js/bg-worker.js  RMBG-1.4 inference worker
vendor/          onnxruntime-web 1.22 (WASM, single-threaded)
models/          rmbg-1.4-quantized.onnx (44 MB)
fonts/ icons/ tests/ screenshots/
```

### Model hosting decision
The quantised RMBG‑1.4 model (44,403,226 bytes, below GitHub's 100 MB file limit, no LFS needed) is **shipped in the repo and served same-origin** from `./models/`. If that fails, the worker falls back to `huggingface.co/briaai/RMBG-1.4`. The model is downloaded **lazily** (only when the AI method is used or "download model" is tapped in settings) and kept in Cache Storage (`style-ai-models-v1`), so it survives app updates and works offline. The service worker deliberately does not precache it, so the app shell stays small (~0.5 MB + 11 MB WASM runtime cached on first AI use).

> ⚠️ **Licence:** RMBG‑1.4 by BRIA AI is released under the *bria-rmbg-1.4* licence — **free for non-commercial use only**. Commercial use requires a licence from BRIA (https://bria.ai). If you need commercial use, switch the default to the "quick" method or replace the model. onnxruntime-web is MIT; Vazirmatn is OFL.

### Develop & test
```bash
npm test                                   # unit tests (node --test, Node ≥ 20)
python3 -m http.server 8765                # serve locally
PW_DIR=/path/to/playwright-core-parent node tests/e2e.mjs http://127.0.0.1:8765/
#   headless Chrome at 390x844 with synthetic photos in tests/fixtures; writes screenshots/
#   SKIP_AI=1 skips the RMBG model test
```
Append `?nosw` to the URL to disable the service worker while developing.

### Deploy to GitHub Pages
1. Push this folder to a repository (branch `main`).
2. Settings → Pages → Source: **GitHub Actions**.
3. `.github/workflows/pages.yml` runs the unit tests and deploys (`configure-pages` → `upload-pages-artifact` with `include-hidden-files: true` → `deploy-pages`). All paths are relative, so it works under `/<repo>/`.

Bump `VERSION` in `js/app.js` and the cache name in `sw.js` when releasing.

### Limitations
Rule-based heuristics (general guidance, not professional advice); lighting affects colour detection; body-shape and season are estimates; the 44 MB model download and iOS memory limits may make AI background removal slow/unavailable on older devices (auto fallback); try-on not implemented.
