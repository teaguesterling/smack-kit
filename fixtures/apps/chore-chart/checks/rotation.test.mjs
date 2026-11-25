import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assignWeek } from '../seams/rotation.js';

const read = p => JSON.parse(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const chores = read('data/chores.json');
const people = read('data/people.json');
const week = assignWeek(chores, people, '2026-11-09');

test('every assignment names a known person and chore on a date in the week', () => {
  const names = new Set(people.map(p => p.name));
  const dates = new Set(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
  assert.ok(week.length > 0);
  for (const a of week) {
    assert.ok(names.has(a.person), a.person);
    assert.ok(chores.some(c => c.name === a.chore), a.chore);
    assert.ok(dates.has(a.date), a.date);
  }
});

test('a daily chore is assigned on all 7 days', () => {
  for (const c of chores.filter(c => c.every === 'daily')) {
    assert.equal(week.filter(a => a.chore === c.name).length, 7, c.name);
  }
});

test('a weekly chore appears once, on the week start', () => {
  for (const c of chores.filter(c => c.every === 'weekly')) {
    const got = week.filter(a => a.chore === c.name);
    assert.equal(got.length, 1, c.name);
    assert.equal(got[0].date, '2026-11-09');
  }
});

test('a school-days chore appears Monday to Friday only', () => {
  for (const c of chores.filter(c => c.every === 'school-days')) {
    assert.deepEqual(week.filter(a => a.chore === c.name).map(a => a.date), ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
  }
});
