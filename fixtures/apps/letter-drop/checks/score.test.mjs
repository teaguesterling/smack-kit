import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreFor } from '../seams/score.js';

test('a hit scores 1', () => { assert.equal(scoreFor(true, 0), 1); });
test('a miss scores 0, whatever the streak', () => { assert.equal(scoreFor(false, 0), 0); assert.equal(scoreFor(false, 9), 0); });
