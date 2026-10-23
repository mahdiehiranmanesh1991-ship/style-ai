import { test } from 'node:test';
import assert from 'node:assert/strict';
import { d2j, j2d, g2d, keyFromJdn, jdnFromKey } from '../js/jalali.js';
test('Jalali conversion', () => {
  const j = d2j(g2d(2026, 10, 23)); assert.deepEqual([j.jy, j.jm, j.jd], [1405, 8, 1]);
  const k = keyFromJdn(j2d(1404, 12, 29)); assert.equal(k, '1404-12-29'); assert.equal(jdnFromKey(k), j2d(1404, 12, 29));
});
