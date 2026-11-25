import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson, need } from './_lib.mjs';

const { assignWeek } = await need('seams/rotation.js', 'assignWeek');
const chores = readJson('data/chores.json');
const everyone = readJson('data/people.json');

for (const n of [2, 3, everyone.length]) {
  test(`with ${n} people, nobody does dishes two days in a row`, () => {
    const week = assignWeek(chores, everyone.slice(0, n), '2026-11-09');
    const dishes = week.filter(a => a.chore === 'dishes').sort((a, b) => a.date.localeCompare(b.date));
    assert.equal(dishes.length, 7, 'dishes must still happen every day');
    for (let i = 1; i < dishes.length; i++) assert.notEqual(dishes[i].person, dishes[i - 1].person, `${dishes[i].date}: ${dishes[i].person} again`);
  });
}
