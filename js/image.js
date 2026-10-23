// In-browser image pipeline: decode -> downscale -> background removal (AI worker or quick flood-fill) -> crop -> colors.
import { rgbToLab, deltaE, extractColors } from './color.js';

export async function loadImage(src) {
  const blob = src instanceof Blob ? src : await (await fetch(src)).blob();
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image(); img.decoding = 'async'; img.src = url; await img.decode(); return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

export function toCanvas(img, maxSide = 1024) {
  const w = img.width, h = img.height, s = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/**
 * Quick, model-free background removal for garments shot on a plain background:
 * estimate the background color from the border, flood-fill from the edges with a LAB ΔE tolerance, feather the edge.
 * Returns true if a reasonable foreground (8–95% of pixels) was found.
 */
export function quickRemoveBackground(canvas, tolerance = 14) {
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, w, h); const d = img.data;
  const labAt = (i) => rgbToLab([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
  // border samples -> median-ish background colors (up to 3 clusters)
  const border = [];
  const stepX = Math.max(1, Math.floor(w / 60)), stepY = Math.max(1, Math.floor(h / 60));
  for (let x = 0; x < w; x += stepX) { border.push(labAt(x)); border.push(labAt((h - 1) * w + x)); }
  for (let y = 0; y < h; y += stepY) { border.push(labAt(y * w)); border.push(labAt(y * w + w - 1)); }
  const bgs = [];
  for (const b of border) { const m = bgs.find((g) => deltaE(g.lab, b) < 10); if (m) m.n++; else bgs.push({ lab: b, n: 1 }); }
  bgs.sort((a, b) => b.n - a.n);
  const refs = bgs.filter((g) => g.n >= border.length * 0.12).slice(0, 3).map((g) => g.lab);
  if (!refs.length) return false;
  const bgMask = new Uint8Array(w * h);
  const stack = [];
  const seen = new Uint8Array(w * h); // 0 unknown, 1 bg, 2 fg — each pixel's LAB is computed once
  const isBg = (i) => { if (!seen[i]) { const l = labAt(i); seen[i] = refs.some((r) => deltaE(l, r) < tolerance) ? 1 : 2; } return seen[i] === 1; };
  for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    if (bgMask[i]) continue;
    if (!isBg(i)) continue;
    bgMask[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1); if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w); if (y < h - 1) stack.push(i + w);
  }
  let fg = 0; for (let i = 0; i < w * h; i++) if (!bgMask[i]) fg++;
  const ratio = fg / (w * h);
  if (ratio < 0.08 || ratio > 0.95) return false;
  // 1px feather: background pixels next to foreground get half alpha
  for (let i = 0; i < w * h; i++) {
    if (!bgMask[i]) continue;
    const x = i % w;
    const nearFg = (x > 0 && !bgMask[i - 1]) || (x < w - 1 && !bgMask[i + 1]) || (i >= w && !bgMask[i - w]) || (i < w * (h - 1) && !bgMask[i + w]);
    d[i * 4 + 3] = nearFg ? 110 : 0;
  }
  ctx.putImageData(img, 0, 0);
  return true;
}

/** Apply an alpha mask (Float32Array or Uint8 0..255, maskW x maskH) to the canvas. */
export function applyMask(canvas, mask, mw, mh) {
  const { width: w, height: h } = canvas;
  const m = document.createElement('canvas'); m.width = mw; m.height = mh;
  const mctx = m.getContext('2d');
  const mi = mctx.createImageData(mw, mh);
  for (let i = 0; i < mw * mh; i++) { const v = mask[i]; mi.data[i * 4 + 3] = v; }
  mctx.putImageData(mi, 0, 0);
  const s = document.createElement('canvas'); s.width = w; s.height = h;
  const sctx = s.getContext('2d', { willReadFrequently: true });
  sctx.imageSmoothingEnabled = true; sctx.drawImage(m, 0, 0, w, h);
  const alpha = sctx.getImageData(0, 0, w, h).data;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, w, h);
  let fg = 0;
  for (let i = 0; i < w * h; i++) { img.data[i * 4 + 3] = alpha[i * 4 + 3]; if (alpha[i * 4 + 3] > 128) fg++; }
  ctx.putImageData(img, 0, 0);
  return fg / (w * h);
}

/** Crop to the bounding box of non-transparent pixels (+ padding). */
export function cropToContent(canvas, pad = 0.04) {
  const { width: w, height: h } = canvas;
  const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return canvas;
  const p = Math.round(Math.max(x1 - x0, y1 - y0) * pad);
  x0 = Math.max(0, x0 - p); y0 = Math.max(0, y0 - p); x1 = Math.min(w - 1, x1 + p); y1 = Math.min(h - 1, y1 + p);
  const c = document.createElement('canvas'); c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
  c.getContext('2d').drawImage(canvas, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

export function thumbnail(canvas, max = 360, type = 'image/webp') {
  const s = Math.min(1, max / Math.max(canvas.width, canvas.height));
  const c = document.createElement('canvas'); c.width = Math.round(canvas.width * s); c.height = Math.round(canvas.height * s);
  c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
  let url = c.toDataURL(type, 0.85);
  if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/png'); // Safari < 17 has no WebP encoder
  return url;
}

export function colorsFromCanvas(canvas) {
  const small = document.createElement('canvas');
  const s = Math.min(1, 200 / Math.max(canvas.width, canvas.height));
  small.width = Math.max(1, Math.round(canvas.width * s)); small.height = Math.max(1, Math.round(canvas.height * s));
  const ctx = small.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, small.width, small.height);
  return extractColors(ctx.getImageData(0, 0, small.width, small.height).data, { k: 5 });
}

/** Guess pattern: several distinct, sizable color clusters → patterned. */
export function guessPattern(colors) {
  const big = colors.filter((c) => c.share > 0.12);
  if (big.length >= 3) return 'print';
  if (big.length === 2 && Math.abs(big[0].L - big[1].L) > 25 && big[1].share > 0.25) return 'stripe';
  return 'solid';
}

/** Weak category guess from the cut-out's aspect ratio (user should confirm). */
export function guessCategory(canvas) {
  const r = canvas.height / canvas.width;
  if (r < 0.6) return 'shoes';
  if (r > 1.9) return 'bottom';
  if (r > 1.45) return 'dress';
  return 'top';
}

/** Average color in a small square around (x,y) — used for selfie skin sampling. */
export function sampleColor(canvas, x, y, r = 6) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const d = ctx.getImageData(Math.max(0, x - r), Math.max(0, y - r), r * 2, r * 2).data;
  let R = 0, G = 0, B = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; }
  return [R / n, G / n, B / n];
}
