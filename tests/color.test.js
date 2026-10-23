import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToLab, labToHex, deltaE, kmeansLab, extractColors, nearestNamed, temperature, isNeutral, describeHex } from '../js/color.js';

test('hex <-> LAB round-trips', () => {
  for (const hex of ['#000000', '#ffffff', '#b4475f', '#1f2a44', '#c8a24a']) assert.equal(labToHex(hexToLab(hex)), hex);
  const [L] = hexToLab('#ffffff'); assert.ok(Math.abs(L - 100) < 0.5);
});
test('deltaE is 0 for identical and large for black/white', () => {
  assert.equal(deltaE([50, 10, 10], [50, 10, 10]), 0);
  assert.ok(deltaE(hexToLab('#000000'), hexToLab('#ffffff')) > 90);
});
test('k-means separates two obvious clusters', () => {
  const pts = []; for (let i = 0; i < 200; i++) pts.push(i % 2 ? [20, 0, 0] : [80, 40, 40]);
  const cl = kmeansLab(pts, 2).sort((a, b) => a.lab[0] - b.lab[0]);
  assert.ok(Math.abs(cl[0].lab[0] - 20) < 1 && Math.abs(cl[1].lab[0] - 80) < 1);
});
test('extractColors ignores transparent pixels and orders by share', () => {
  const w = 40, h = 40, d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const navy = i < 1000, transparent = i >= 1400;
    d.set(navy ? [31, 42, 68, 255] : transparent ? [255, 0, 0, 0] : [240, 235, 225, 255], i * 4);
  }
  const cs = extractColors(d);
  assert.ok(cs.length >= 2);
  assert.equal(cs[0].name, nearestNamed(hexToLab('#1f2a44')).name);
  assert.ok(!cs.some((c) => c.name.includes('قرمز')), 'transparent red must be ignored');
});
test('Persian color names and temperature', () => {
  assert.equal(nearestNamed(hexToLab('#000000')).name, 'مشکی');
  assert.equal(temperature(hexToLab('#e07b39')), 'warm');
  assert.equal(temperature(hexToLab('#2a5db0')), 'cool');
  assert.equal(temperature(hexToLab('#808080')), 'neutral');
  assert.ok(isNeutral(hexToLab('#1f2a44')), 'navy counts as fashion neutral');
  assert.ok(!isNeutral(hexToLab('#d62828')));
  const d = describeHex('#b4475f'); assert.ok(d.name && d.temp && typeof d.neutral === 'boolean');
});
