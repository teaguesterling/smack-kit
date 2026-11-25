import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson, readYaml, need } from './_lib.mjs';

// Any one new value of the every term counts ("weekends", "weekend", ...).
function newValue() {
  const fresh = readYaml('definitions.yaml').terms.every.values.filter(v => !['daily', 'weekly', 'school-days'].includes(v));
  assert.equal(fresh.length, 1, `new every values: ${JSON.stringify(fresh)}`);
  return fresh[0];
}

test('the every term has one new value for weekend chores', () => { newValue(); });

test('a chore with the new value lands on Saturday and Sunday only', async () => {
  const v = newValue();
  const { assignWeek } = await need('seams/rotation.js', 'assignWeek');
  const chores = [...readJson('data/chores.json'), { name: 'wash the car', every: v, points: 2 }];
  const got = assignWeek(chores, readJson('data/people.json'), '2026-11-09').filter(a => a.chore === 'wash the car').map(a => a.date);
  assert.deepEqual(got, ['2026-11-14', '2026-11-15']);
});

test('daily chores still come every day', async () => {
  const { assignWeek } = await need('seams/rotation.js', 'assignWeek');
  const week = assignWeek(readJson('data/chores.json'), readJson('data/people.json'), '2026-11-09');
  assert.equal(week.filter(a => a.chore === 'dishes').length, 7);
});
