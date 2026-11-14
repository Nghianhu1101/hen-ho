import test from 'node:test';
import assert from 'node:assert/strict';
import { bangkokDateString } from '../date-utils.js';

test('calendar validation uses the Bangkok day across its midnight boundary', () => {
  assert.equal(bangkokDateString(new Date('2026-11-14T16:59:59Z')), '2026-11-14');
  assert.equal(bangkokDateString(new Date('2026-11-14T17:00:00Z')), '2026-11-15');
});

test('current date is recomputed instead of being frozen when the module loads', t => {
  t.mock.method(Date, 'now', () => Date.parse('2026-11-14T16:59:59Z'));
  assert.equal(bangkokDateString(), '2026-11-14');
  t.mock.method(Date, 'now', () => Date.parse('2026-11-14T17:00:00Z'));
  assert.equal(bangkokDateString(), '2026-11-15');
});
