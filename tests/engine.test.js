import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeHarmony } from '../js/harmony.js';
import { scoreOutfit, buildOutfit, suggestForAnchor, combineItems, suitsMe, rankOccasions, toPiece } from '../js/engine.js';
import { hexToLab, isNeutral } from '../js/color.js';
import { OCCASIONS, TYPE, CAT } from '../js/catalog.js';

const item = (id, category, type, hex) => ({ id, category, type, pattern: 'solid', colors: [{ hex, lab: hexToLab(hex), name: '', share: 1 }] });
const L = (h) => hexToLab(h);
const profile = { seasonId: 'true-autumn', shape: 'pear', height: 160, contrastLevel: 'medium', hijab: true };

test('harmony schemes', () => {
  assert.equal(analyzeHarmony([L('#151515'), L('#f3ede1'), L('#1f2a44')]).scheme, 'neutral');
  assert.equal(analyzeHarmony([L('#151515'), L('#f3ede1'), L('#b4475f')]).scheme, 'accent');
  assert.ok(['complementary', 'split'].includes(analyzeHarmony([L('#2a5db0'), L('#e07b39')]).scheme));
  assert.equal(analyzeHarmony([[45, 50, 30], [65, -30, -18]]).scheme, 'complementary');
  const many = analyzeHarmony([L('#d62828'), L('#2a9d3f'), L('#2a5db0'), L('#f2c14e')]);
  assert.ok(many.score < 70);
});
test('scoreOutfit returns explainable parts in 0..100', () => {
  const r = scoreOutfit([item('a', 'top', 'blouse', '#f3ede1'), item('b', 'bottom', 'trousers', '#151515'), item('c', 'outer', 'manteau-formal', '#1f2a44')], { occasion: 'office', profile });
  assert.ok(r.total >= 0 && r.total <= 100);
  for (const p of r.parts) { assert.ok(p.label && typeof p.why === 'string' && p.why.length > 5, p.key); assert.ok(p.score >= 0 && p.score <= 100); }
  assert.ok(r.parts.some((p) => p.key === 'palette') && r.parts.some((p) => p.key === 'body'));
});
test('court outfit stays dark, closed shoes, formal bag', () => {
  const look = buildOutfit([item('m', 'outer', 'manteau-formal', '#1f2a44')], { occasion: 'court', profile, weather: 'mild' });
  const cats = look.pieces.map((p) => p.cat);
  for (const c of ['top', 'bottom', 'scarf', 'shoes', 'bag']) assert.ok(cats.includes(c), 'missing ' + c);
  for (const p of look.pieces.filter((p) => ['bottom', 'scarf', 'shoes', 'bag'].includes(p.cat))) assert.ok(p.lab[0] <= 45, `${p.cat} too light: ${p.colorName}`);
  assert.ok(['pumps', 'loafers', 'ankle-boots'].includes(look.pieces.find((p) => p.cat === 'shoes').type));
  assert.ok(['tote-leather', 'shoulder'].includes(look.pieces.find((p) => p.cat === 'bag').type));
  assert.ok(look.total >= 70, 'score ' + look.total);
});
test('suggestForAnchor: 3-5 distinct looks with reasons, wardrobe used', () => {
  const wardrobe = [item('w1', 'bottom', 'trousers', '#151515'), item('w2', 'shoes', 'loafers', '#1b1b1b'), item('w3', 'scarf', 'chiffon', '#e6d3b3')];
  const looks = suggestForAnchor(item('x', 'top', 'blouse', '#7a1f2b'), { wardrobe, profile, weather: 'mild', count: 5 });
  assert.ok(looks.length >= 3 && looks.length <= 5);
  assert.equal(new Set(looks.map((l) => l.occasion)).size, looks.length, 'occasions should differ');
  for (const l of looks) { assert.equal(l.pieces[0].id, 'x'); assert.ok(l.parts.length >= 5); assert.ok(l.total > 50); }
  assert.ok(looks.some((l) => l.pieces.some((p) => p.id && p.id.startsWith('w'))), 'wardrobe items should be used');
  const palettes = looks.map((l) => l.pieces.map((p) => p.colorName).sort().join());
  assert.ok(new Set(palettes).size >= 3, 'looks should not all be the same colours');
});
test('neutral anchor gets at least one accent look', () => {
  const looks = suggestForAnchor(item('n', 'outer', 'manteau-formal', '#151515'), { profile: { hijab: true }, weather: 'mild' });
  assert.ok(looks.some((l) => l.pieces.some((p) => !isNeutral(p.lab) && p.cat !== 'accessory')));
});
test('mourning only for dark anchors', () => {
  assert.ok(rankOccasions(item('r', 'top', 'blouse', '#d62828')).find((r) => r.id === 'mourning').s <= 0);
});
test('combineItems ranks combinations and completes the look', () => {
  const items = [item('t1', 'top', 'blouse', '#f3ede1'), item('t2', 'top', 'tshirt', '#d62828'), item('b1', 'bottom', 'trousers', '#151515'), item('b2', 'bottom', 'jeans', '#4a6f96'), item('s1', 'scarf', 'chiffon', '#e6d3b3')];
  const res = combineItems(items, { profile, weather: 'mild' });
  assert.ok(res.length >= 3);
  for (let i = 1; i < res.length; i++) assert.ok(res[i - 1].total >= res[i].total);
  for (const r of res) { assert.ok(r.usedIds.length >= 2); assert.ok(r.pieces.some((p) => p.cat === 'shoes')); }
  const keys = res.map((r) => r.usedIds.slice().sort().join());
  assert.equal(new Set(keys).size, keys.length);
});
test('suitsMe needs a profile and judges colour', () => {
  assert.equal(suitsMe(item('q', 'top', 'blouse', '#c8a24a'), {}).score, null);
  const good = suitsMe(item('q', 'top', 'wrap-top', '#b5651d'), profile).score;
  const bad = suitsMe(item('q', 'top', 'crop', '#f2c6d0'), profile).score;
  assert.ok(good > bad, `${good} > ${bad}`);
});
test('catalog integrity', () => {
  for (const t of Object.values(TYPE)) { assert.ok(CAT[t.cat], t.id); assert.ok(t.f[0] <= t.f[1]); }
  assert.ok(OCCASIONS.length >= 7);
  assert.equal(toPiece({ category: 'top', hex: '#000000' }).cat, 'top');
});
