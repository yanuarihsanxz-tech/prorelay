import test from 'node:test';
import assert from 'node:assert/strict';
import { clamp } from './range.js';

test('clamps finite numbers and preserves values in range', () => {
  assert.equal(clamp(-2, 0, 10), 0);
  assert.equal(clamp(12, 0, 10), 10);
  assert.equal(clamp(3, 0, 10), 3);
  assert.equal(clamp(3, 3, 3), 3);
});
test('rejects reversed bounds', () => assert.throws(() => clamp(2, 10, 0), RangeError));
test('rejects non-finite and non-number inputs', () => {
  for (const value of [NaN, Infinity, -Infinity, '3', null, undefined]) {
    assert.throws(() => clamp(value, 0, 10), TypeError);
    assert.throws(() => clamp(2, value, 10), TypeError);
    assert.throws(() => clamp(2, 0, value), TypeError);
  }
});
