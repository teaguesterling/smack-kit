import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson, need } from './_lib.mjs';

const { assignWeek } = await need('seams/rotation.js', 'assignWeek');
const chores = readJson('data/chores.json');
const people = readJson('data/people.json');
const WEEK = '2026-11-09';
const WEEKDAYS = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];
const WEEKEND = ['2026-11-14', '2026-11-15'];

// The original rotation, for how many times each chore happens. chores.json is not in scope, so the counts must not change.
const original = await import('../apps/chore-chart/seams/rotation.js');
const countBy = w => w.reduce((m, a) => (m[a.chore] = (m[a.chore] ?? 0) + 1, m), {});

function check(list, who) {
  const week = assignWeek(chores, list, WEEK);
  const his = week.filter(a => a.person === who);
  assert.deepEqual(his.filter(a => WEEKDAYS.includes(a.date)), [], `${who} has weekday chores`);
  assert.ok(his.some(a => WEEKEND.includes(a.date)), `${who} has no weekend chores (definitions.yaml: everyone gets work every day they are home)`);
  assert.deepEqual(countBy(week), countBy(original.assignWeek(chores, list, WEEK)), 'every chore still happens as often as before');
  for (const p of list.filter(p => p.name !== who)) assert.ok(week.some(a => a.person === p.name && WEEKDAYS.includes(a.date)), `${p.name} has no weekday chores`);
}

test('Bartholomew gets no chores Monday to Friday, and still gets some at the weekend', () => {
  check(people, 'Bartholomew');
});

// The fact belongs in the family's data, not in the code: renamed, the same person keeps the rule.
test('the rule follows the person in data/people.json, not the name in the code', () => {
  assert.ok(people.some(p => p.name === 'Bartholomew'), 'Bartholomew is missing from data/people.json');
  check(people.map(p => (p.name === 'Bartholomew' ? { ...p, name: 'Zed' } : p)), 'Zed');
});
