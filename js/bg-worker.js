// Background-removal worker: BRIA RMBG-1.4 (quantized ONNX, 44 MB) on onnxruntime-web (WASM, single thread).
// Model source order: same-origin ./models/ (shipped with the app) -> Hugging Face (fallback). Cached in Cache Storage.
import * as ort from '../vendor/ort.wasm.bundle.min.mjs';

const VENDOR = new URL('../vendor/', import.meta.url).href;
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;
ort.env.wasm.wasmPaths = VENDOR;

const CACHE = 'style-ai-models-v1';
const SOURCES = [
  new URL('../models/rmbg-1.4-quantized.onnx', import.meta.url).href,
  'https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model_quantized.onnx',
];
const SIZE = 1024;
let session = null;

async function fetchModel() {
  const cache = await caches.open(CACHE);
  for (const url of SOURCES) {
    const hit = await cache.match(url);
    if (hit) { postMessage({ type: 'progress', phase: 'cache', pct: 100 }); return new Uint8Array(await hit.arrayBuffer()); }
  }
  let lastErr;
  for (const url of SOURCES) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const total = +res.headers.get('content-length') || 44403226;
      const reader = res.body.getReader();
      const chunks = []; let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); got += value.length;
        postMessage({ type: 'progress', phase: 'download', pct: Math.min(99, Math.round((got / total) * 100)), source: url.startsWith('http') && !url.startsWith(self.location.origin) ? 'hf' : 'local' });
      }
      const buf = new Uint8Array(got); let o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
      if (buf.length < 1e6) throw new Error('model too small');
      try { await cache.put(url, new Response(buf, { headers: { 'content-type': 'application/octet-stream' } })); } catch { /* quota */ }
      return buf;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('model unavailable');
}

async function init() {
  if (session) return session;
  const buf = await fetchModel();
  postMessage({ type: 'progress', phase: 'init', pct: 100 });
  session = await ort.InferenceSession.create(buf, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  return session;
}

self.onmessage = async (e) => {
  const { id, type } = e.data;
  try {
    if (type === 'warmup') { await init(); postMessage({ id, type: 'ready' }); return; }
    if (type === 'remove') {
      const s = await init();
      const { rgba } = e.data; // Uint8ClampedArray SIZE*SIZE*4 (already resized by the page)
      const n = SIZE * SIZE;
      const input = new Float32Array(3 * n);
      for (let i = 0; i < n; i++) {
        input[i] = rgba[i * 4] / 255 - 0.5;
        input[n + i] = rgba[i * 4 + 1] / 255 - 0.5;
        input[2 * n + i] = rgba[i * 4 + 2] / 255 - 0.5;
      }
      const t0 = performance.now();
      const out = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) });
      const m = out[s.outputNames[0]].data;
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < m.length; i++) { if (m[i] < lo) lo = m[i]; if (m[i] > hi) hi = m[i]; }
      const mask = new Uint8ClampedArray(m.length);
      const r = hi - lo || 1;
      for (let i = 0; i < m.length; i++) mask[i] = ((m[i] - lo) / r) * 255;
      postMessage({ id, type: 'mask', mask, w: SIZE, h: SIZE, ms: Math.round(performance.now() - t0) }, [mask.buffer]);
    }
  } catch (err) {
    postMessage({ id, type: 'error', message: String(err && err.message || err) });
  }
};
