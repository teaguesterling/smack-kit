import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson, need } from './_lib.mjs';

const { pointsFor } = await need('seams/points.js', 'pointsFor');
const chores = readJson('data/chores.json');
const dishes = chores.find(c => c.name === 'dishes').points;

test('a chore done on a Saturday counts double', () => {
  assert.equal(pointsFor('Ari', [{ date: '2026-11-14', person: 'Ari', chore: 'dishes' }], chores), 2 * dishes);
});

test('a chore done on a Friday or Sunday counts once', () => {
  assert.equal(pointsFor('Ari', [{ date: '2026-11-13', person: 'Ari', chore: 'dishes' }], chores), dishes);
  assert.equal(pointsFor('Ari', [{ date: '2026-11-15', person: 'Ari', chore: 'dishes' }], chores), dishes);
});
