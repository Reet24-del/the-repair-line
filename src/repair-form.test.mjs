import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRepairCost, repairTitle, validatePhoto, MAX_PHOTO_BYTES} from './repair-form.mjs';

test('INR cost ranges use their upper end without concatenating amounts', () => {
  assert.equal(parseRepairCost('₹6,500–8,000'), 8000);
  assert.equal(parseRepairCost('INR 2,000 to ₹4,000'), 4000);
  assert.equal(parseRepairCost('Rs. 3200'), 3200);
  assert.equal(parseRepairCost('Up to ₹10,000'), 10000);
});

test('cost validation refuses malformed, reversed, and out-of-scope estimates', () => {
  for (const invalid of ['₹8,000–12,000', '₹9000–2000', '₹0', '-500', '₹5,00', '2k–4k', 'Unknown', '100000', '₹2,000 + labour']) {
    assert.throws(() => parseRepairCost(invalid));
  }
});

test('submission title is meaningful and normalized', () => {
  assert.equal(repairTitle('  Shared pump\n needs a new handle  '), 'Shared pump needs a new handle');
  for (const invalid of ['', 'fix', '1234567890123', 'abcdefghijk']) assert.throws(() => repairTitle(invalid));
});

test('photos are limited by type and actual file size', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) assert.doesNotThrow(() => validatePhoto({type, size: MAX_PHOTO_BYTES}));
  assert.throws(() => validatePhoto({type: 'image/svg+xml', size: 100}));
  assert.throws(() => validatePhoto({type: 'image/png', size: MAX_PHOTO_BYTES + 1}));
  assert.throws(() => validatePhoto({type: 'image/jpeg', size: 0}));
});
