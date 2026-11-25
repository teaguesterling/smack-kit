import { test } from 'node:test';
import assert from 'node:assert/strict';
import { need } from './_lib.mjs';

const { scoreFor } = await need('seams/score.js', 'scoreFor');

test('the fifth hit in a row scores more than the fourth', () => {
  assert.ok(scoreFor(true, 4) > scoreFor(true, 3), `fifth ${scoreFor(true, 4)} vs fourth ${scoreFor(true, 3)}`);
});

test('a plain hit still scores 1 and a miss scores 0', () => {
  assert.equal(scoreFor(true, 0), 1);
  for (let n = 0; n <= 10; n++) assert.equal(scoreFor(false, n), 0);
});
