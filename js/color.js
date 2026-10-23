// Color science helpers: sRGB <-> CIELAB (D65), CIEDE2000-lite (CIE76/94 hybrid), k-means in LAB,
// Persian color naming and warm/cool/neutral classification. Pure functions — usable in browser & Node.

export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

const srgbToLinear = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const linearToSrgb = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const XN = 0.95047, YN = 1, ZN = 1.08883;
const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
const fi = (t) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));

export function rgbToLab([r, g, b]) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / XN;
  const Y = (R * 0.2126729 + G * 0.7151522 + B * 0.0721750) / YN;
  const Z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / ZN;
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function labToRgb([L, a, b]) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const X = fi(fx) * XN, Y = (L > 8 ? fy ** 3 : L / (24389 / 27)) * YN, Z = fi(fz) * ZN;
  const R = X * 3.2404542 - Y * 1.5371385 - Z * 0.4985314;
  const G = -X * 0.9692660 + Y * 1.8760108 + Z * 0.0415560;
  const B = X * 0.0556434 - Y * 0.2040259 + Z * 1.0572252;
  return [linearToSrgb(R), linearToSrgb(G), linearToSrgb(B)].map((v) => clamp(v, 0, 255));
}
export const hexToLab = (hex) => rgbToLab(hexToRgb(hex));
export const labToHex = (lab) => rgbToHex(labToRgb(lab));

/** LCh: lightness, chroma, hue angle in degrees [0,360). */
export function labToLch([L, a, b]) {
  const C = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI; if (h < 0) h += 360;
  return [L, C, h];
}
export const lchToLab = ([L, C, h]) => [L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)];
export const hueDiff = (h1, h2) => { const d = Math.abs(h1 - h2) % 360; return d > 180 ? 360 - d : d; };

/** CIE94 (graphic arts) — perceptual distance, cheap and good enough for clothing. */
export function deltaE(l1, l2) {
  const [L1, a1, b1] = l1, [L2, a2, b2] = l2;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const dL = L1 - L2, dC = C1 - C2, da = a1 - a2, db = b1 - b2;
  const dH2 = Math.max(0, da * da + db * db - dC * dC);
  const sC = 1 + 0.045 * C1, sH = 1 + 0.015 * C1;
  return Math.sqrt(dL * dL + (dC / sC) ** 2 + dH2 / (sH * sH));
}

// ---------------------------------------------------------------- k-means in LAB
/** Deterministic PRNG so tests and UI are reproducible. */
export function mulberry32(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * k-means++ on LAB points. points: Array<[L,a,b]>. Returns clusters sorted by share: [{lab, share, count}].
 */
export function kmeansLab(points, k = 4, { iterations = 12, seed = 7 } = {}) {
  if (!points.length) return [];
  k = Math.min(k, points.length);
  const rnd = mulberry32(seed);
  const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  const centers = [points[Math.floor(rnd() * points.length)].slice()];
  const dist = new Float64Array(points.length);
  while (centers.length < k) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) { let m = Infinity; for (const c of centers) m = Math.min(m, d2(points[i], c)); dist[i] = m; sum += m; }
    if (sum === 0) break;
    let r = rnd() * sum, idx = 0;
    for (; idx < points.length - 1; idx++) { r -= dist[idx]; if (r <= 0) break; }
    centers.push(points[idx].slice());
  }
  const assign = new Int32Array(points.length);
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < points.length; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < centers.length; c++) { const d = d2(points[i], centers[c]); if (d < bd) { bd = d; best = c; } }
      if (assign[i] !== best) { assign[i] = best; moved = true; }
    }
    const acc = centers.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < points.length; i++) { const a = acc[assign[i]]; a[0] += points[i][0]; a[1] += points[i][1]; a[2] += points[i][2]; a[3]++; }
    acc.forEach((a, c) => { if (a[3]) centers[c] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; });
    if (!moved && it > 0) break;
  }
  const counts = new Array(centers.length).fill(0);
  for (let i = 0; i < points.length; i++) counts[assign[i]]++;
  return centers.map((lab, c) => ({ lab, count: counts[c], share: counts[c] / points.length }))
    .filter((c) => c.count > 0).sort((a, b) => b.share - a.share);
}

/** Merge clusters closer than `threshold` ΔE (weighted by share). */
export function mergeClusters(clusters, threshold = 9) {
  const out = [];
  for (const c of clusters) {
    const near = out.find((o) => deltaE(o.lab, c.lab) < threshold);
    if (near) {
      const t = near.share + c.share;
      near.lab = near.lab.map((v, i) => (v * near.share + c.lab[i] * c.share) / t);
      near.share = t; near.count += c.count;
    } else out.push({ ...c, lab: c.lab.slice() });
  }
  return out.sort((a, b) => b.share - a.share);
}

/**
 * Extract dominant colors from RGBA pixel data (Uint8ClampedArray, as from canvas getImageData).
 * Transparent pixels (alpha < 128) are ignored, so it works on background-removed cut-outs.
 */
export function extractColors(rgba, { k = 5, maxSamples = 6000, minShare = 0.04 } = {}) {
  const total = rgba.length / 4;
  const step = Math.max(1, Math.floor(total / maxSamples));
  const pts = [];
  for (let i = 0; i < total; i += step) {
    const o = i * 4;
    if (rgba[o + 3] < 128) continue;
    pts.push(rgbToLab([rgba[o], rgba[o + 1], rgba[o + 2]]));
  }
  if (!pts.length) return [];
  const clusters = mergeClusters(kmeansLab(pts, k)).filter((c) => c.share >= minShare);
  const s = clusters.reduce((a, c) => a + c.share, 0) || 1;
  return clusters.map((c) => describeColor(c.lab, c.share / s));
}

// ---------------------------------------------------------------- Persian naming
// neutral: works as a neutral base in outfits (true neutrals + "fashion neutrals" like navy, camel, denim).
export const NAMED_COLORS = [
  ['مشکی', '#111111', 1], ['ذغالی', '#36454f', 1], ['خاکستری', '#808080', 1], ['طوسی روشن', '#c4c4c4', 1],
  ['سفید', '#fafafa', 1], ['شیری', '#f5f0e1', 1], ['کرم', '#efe2c4', 1], ['بژ', '#d8c3a5', 1],
  ['شتری', '#c19a6b', 1], ['کاراملی', '#a9672f', 0], ['قهوه‌ای', '#6f4e37', 1], ['قهوه‌ای سوخته', '#3d2b1f', 1],
  ['تُپی (توپ)', '#8b8589', 1], ['سرمه‌ای', '#1f2a44', 1], ['آبی نفتی', '#1d4e5f', 0], ['جین آبی', '#4a6a8f', 1],
  ['آبی آسمانی', '#87bfe6', 0], ['آبی پودری', '#b9d3e8', 0], ['آبی کاربنی', '#1f4fbf', 0], ['آبی روشن', '#5aa0e0', 0],
  ['فیروزه‌ای', '#2fb5b0', 0], ['سبز آبی (تیل)', '#167c80', 0], ['سبز نعنایی', '#a8dcc2', 0], ['سبز یشمی', '#3c8d6e', 0],
  ['سبز زمردی', '#0b7a4b', 0], ['سبز زیتونی', '#6b6b2f', 1], ['سبز ارتشی', '#4b5320', 1], ['سبز چمنی', '#4caf50', 0],
  ['سبز پسته‌ای', '#b5c97a', 0], ['زرد لیمویی', '#f2e14b', 0], ['زرد خردلی', '#c9a227', 0], ['طلایی', '#c8a24a', 0],
  ['نارنجی', '#f07c24', 0], ['هلویی', '#f6b89a', 0], ['مرجانی', '#f2766b', 0], ['آجری', '#a4472d', 0],
  ['مسی', '#b06a3c', 0], ['قرمز', '#d0222f', 0], ['زرشکی', '#8a1c2b', 0], ['شرابی', '#5e1a2a', 0],
  ['عنابی', '#6e2232', 0], ['صورتی چرک (رز دودی)', '#c99a9a', 0], ['صورتی ملایم', '#f4c2cc', 0], ['صورتی', '#ec7fa3', 0],
  ['سرخابی', '#d6237a', 0], ['یاسی', '#c3a8d8', 0], ['بنفش', '#6a3d9a', 0], ['بادمجانی', '#3f1d3b', 0],
  ['ارغوانی', '#8e3a6e', 0], ['نقره‌ای', '#b8bcc2', 1], ['خاکی', '#b8a07e', 1], ['زغال‌اخته‌ای', '#4a2236', 0],
].map(([name, hex, neutral]) => ({ name, hex, neutral: !!neutral, lab: hexToLab(hex) }));

export function nearestNamed(lab) {
  let best = NAMED_COLORS[0], bd = Infinity;
  for (const c of NAMED_COLORS) { const d = deltaE(lab, c.lab); if (d < bd) { bd = d; best = c; } }
  return { ...best, distance: bd };
}

/** Warm / cool / neutral temperature of a color. */
export function temperature(lab) {
  const [L, C, h] = labToLch(lab);
  if (C < 10) return 'neutral';
  // LAB hue: ~20°–140° = reds-oranges-yellows-yellow-greens (warm); 140°–330° = greens-blues-violets (cool);
  // >330° or <20° = pinks / magentas / blue-reds (cool side).
  if (h >= 20 && h < 140) return 'warm';
  return 'cool';
}
export const TEMP_FA = { warm: 'گرم', cool: 'سرد', neutral: 'خنثی' };

/** Is a color a "neutral base" (true neutral by chroma, or a fashion neutral like navy/camel/denim)? */
export function isNeutral(lab) {
  const [, C] = labToLch(lab);
  if (C < 9) return true;
  const n = nearestNamed(lab);
  return n.neutral && n.distance < 14;
}

export function describeColor(lab, share = 1) {
  const named = nearestNamed(lab);
  const [L, C, h] = labToLch(lab);
  return { hex: labToHex(lab), lab: lab.map((v) => Math.round(v * 10) / 10), share: Math.round(share * 1000) / 1000, name: named.name, temp: temperature(lab), neutral: isNeutral(lab), L, C, h };
}
export const describeHex = (hex) => describeColor(hexToLab(hex));
