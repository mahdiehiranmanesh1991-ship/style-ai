// Simple vector garment silhouettes: used for demo wardrobe items and as placeholders.
// Paths are drawn on a 100x120 grid.
const PATHS = {
  top: 'M30 10 L42 6 Q50 14 58 6 L70 10 L92 30 L80 42 L72 34 L72 112 L28 112 L28 34 L20 42 L8 30 Z',
  bottom: 'M26 6 L74 6 L80 114 L58 114 L50 40 L42 114 L20 114 Z',
  outer: 'M32 6 L44 4 L50 30 L56 4 L68 6 L90 28 L84 116 L60 116 L58 50 L50 34 L42 50 L40 116 L16 116 L10 28 Z',
  dress: 'M36 6 L44 4 Q50 12 56 4 L64 6 L66 36 Q64 44 60 46 L90 116 L10 116 L40 46 Q36 44 34 36 Z',
  shoes: 'M8 70 Q10 56 22 58 L46 66 Q62 70 80 64 Q94 62 94 76 L94 86 L8 86 Z',
  bag: 'M18 44 L82 44 L88 108 L12 108 Z M34 44 Q34 18 50 18 Q66 18 66 44 L60 44 Q60 26 50 26 Q40 26 40 44 Z',
  scarf: 'M20 8 Q50 0 80 8 L84 60 Q70 70 60 112 L44 112 Q46 72 34 62 Q16 56 20 8 Z',
  accessory: 'M50 30 A26 26 0 1 0 50.1 30 Z M50 40 A16 16 0 1 1 49.9 40 Z',
};

export function drawGarment(cat, hex, { size = 320, pattern = 'solid', second = '#ffffff', background = null } = {}) {
  const c = document.createElement('canvas');
  c.width = Math.round(size * 100 / 120); c.height = size;
  const ctx = c.getContext('2d');
  if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.scale(c.width / 100, c.height / 120);
  const path = new Path2D(PATHS[cat] || PATHS.top);
  ctx.fillStyle = hex;
  ctx.fill(path, 'evenodd');
  if (pattern !== 'solid') {
    ctx.save(); ctx.clip(path, 'evenodd'); ctx.fillStyle = second;
    if (pattern === 'stripe') for (let y = 0; y < 120; y += 12) ctx.fillRect(0, y, 100, 5);
    else if (pattern === 'check') { ctx.globalAlpha = 0.5; for (let x = 0; x < 100; x += 14) ctx.fillRect(x, 0, 5, 120); for (let y = 0; y < 120; y += 14) ctx.fillRect(0, y, 100, 5); }
    else for (let y = 6; y < 120; y += 14) for (let x = (y / 14) % 2 ? 4 : 11; x < 100; x += 14) { ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.stroke(path);
  return c;
}

// A small starter wardrobe so the app can be tried before photographing real clothes.
export const DEMO_ITEMS = [
  { name: 'مانتو سرمه‌ای', category: 'outer', type: 'manteau-formal', hex: '#1f2a44' },
  { name: 'شومیز شیری', category: 'top', type: 'shirt', hex: '#f3ede1' },
  { name: 'شلوار مشکی', category: 'bottom', type: 'trousers', hex: '#151515' },
  { name: 'جین آبی', category: 'bottom', type: 'jeans', hex: '#4a6f96' },
  { name: 'بلوز زرشکی', category: 'top', type: 'blouse', hex: '#7a1f2b' },
  { name: 'شال کرم', category: 'scarf', type: 'chiffon', hex: '#e6d3b3' },
  { name: 'مقنعه مشکی', category: 'scarf', type: 'maghnaeh', hex: '#111111' },
  { name: 'کفش چرم مشکی', category: 'shoes', type: 'loafers', hex: '#1b1b1b' },
  { name: 'کتانی سفید', category: 'shoes', type: 'sneakers', hex: '#f5f5f2' },
  { name: 'کیف شتری', category: 'bag', type: 'tote-leather', hex: '#b5824f' },
];
