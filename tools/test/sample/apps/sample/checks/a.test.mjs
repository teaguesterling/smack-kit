import { test } from 'node:test';
import assert from 'node:assert/strict';
import { double } from '../seams/double.js';
test('double returns a number', () => { assert.equal(typeof double(1), 'number'); });
