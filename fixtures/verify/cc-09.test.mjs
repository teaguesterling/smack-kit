import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson } from './_lib.mjs';
import { validate } from '../kit-standin/gate.js';

test('the local profile hosts elsewhere and runs inference on the Tiiny', () => {
  const p = readJson('.kit/profile.json');
  assert.equal(p.hosting, 'static');
  assert.equal(p.inference?.on, 'tiiny');
});

test('the local profile uses only values its schema allows', () => {
  assert.deepEqual(validate(readJson('.kit/profile.schema.json'), readJson('.kit/profile.json')), []);
});
