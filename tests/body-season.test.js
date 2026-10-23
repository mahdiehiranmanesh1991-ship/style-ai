import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bodyShape, heightAdvice, fitScore, bmi } from '../js/body.js';
import { analyzeSeason, paletteMatch, estimateUndertone, SEASONS } from '../js/season.js';
import { hexToLab } from '../js/color.js';

test('body shapes from measurements', () => {
  assert.equal(bodyShape({ bust: 92, waist: 66, hip: 94 }).shape, 'hourglass');
  assert.equal(bodyShape({ bust: 86, waist: 72, hip: 100 }).shape, 'pear');
  assert.equal(bodyShape({ bust: 100, waist: 96, hip: 98 }).shape, 'apple');
  assert.equal(bodyShape({ bust: 88, waist: 76, hip: 89 }).shape, 'rectangle');
  assert.equal(bodyShape({ bust: 102, waist: 76, hip: 90 }).shape, 'inverted-triangle');
  assert.equal(bodyShape({}).shape, null);
});
test('height advice and fit score', () => {
  assert.equal(heightAdvice(152).level, 'petite');
  assert.equal(heightAdvice(176).level, 'tall');
  assert.equal(heightAdvice(165).level, 'average');
  assert.ok(fitScore(['wrap', 'belted'], 'hourglass').score > fitScore(['boxy', 'oversized'], 'hourglass').score);
  assert.ok(fitScore(['skinny'], 'pear').score < 75);
  assert.equal(bmi(165, 60), 22);
});
test('12-season analysis is sensible', () => {
  const warmLight = analyzeSeason({ skinHex: '#f6e0d2', undertone: 'warm', hair: 'golden-blonde', eyes: 'green' });
  assert.equal(SEASONS[warmLight.id].family, 'spring');
  const coolDeep = analyzeSeason({ skinHex: '#c99a6e', undertone: 'cool', hair: 'black', eyes: 'black' });
  assert.equal(SEASONS[coolDeep.id].family, 'winter');
  const warmDeep = analyzeSeason({ skinHex: '#b07f56', undertone: 'warm', hair: 'dark-brown', eyes: 'dark-brown' });
  assert.equal(SEASONS[warmDeep.id].family, 'autumn');
  assert.equal(warmDeep.ranking.length, 3);
  assert.ok(warmDeep.why.length >= 3);
  assert.equal(Object.keys(SEASONS).length, 12);
});
test('palette match prefers in-palette colors', () => {
  const s = SEASONS['true-autumn'];
  const inPal = paletteMatch(hexToLab(s.best[0]), 'true-autumn').score;
  const avoid = paletteMatch(hexToLab(s.avoid[0]), 'true-autumn').score;
  assert.ok(inPal >= 80, 'in-palette ' + inPal);
  assert.ok(avoid < inPal - 20, 'avoid ' + avoid);
});
test('undertone estimate', () => {
  assert.ok(['warm', 'olive'].includes(estimateUndertone('#dcb08a')));
  assert.equal(estimateUndertone('#f2c9c9'), 'cool');
});
