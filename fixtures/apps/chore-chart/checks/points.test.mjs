import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointsFor } from '../seams/points.js';

const chores = [{ name: 'dishes', every: 'daily', points: 2 }, { name: 'bins', every: 'weekly', points: 1 }];

test('pointsFor sums the points of the chores a person did', () => {
  const done = [
    { date: '2026-11-09', person: 'Ari', chore: 'dishes' },
    { date: '2026-11-09', person: 'Ari', chore: 'bins' },
    { date: '2026-11-10', person: 'Bo', chore: 'dishes' },
  ];
  assert.equal(pointsFor('Ari', done, chores), 3);
  assert.equal(pointsFor('Bo', done, chores), 2);
  assert.equal(pointsFor('Cy', done, chores), 0);
});

test('a done entry for an unknown chore counts 0', () => {
  assert.equal(pointsFor('Ari', [{ date: '2026-11-09', person: 'Ari', chore: 'gone' }], chores), 0);
});
