import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../../fixtures/kit-standin/gate.js';
import { openStore } from '../../fixtures/kit-standin/store.js';
import { call } from '../../fixtures/kit-standin/uprompt.js';

const chores = { type: 'object', required: ['chores'], additionalProperties: false, properties: {
  chores: { type: 'array', items: { type: 'object', required: ['name', 'every'], additionalProperties: false, properties: {
    name: { type: 'string', maxLength: 40 }, every: { type: 'string', enum: ['daily', 'weekly', 'school-days'] },
    points: { type: 'integer', minimum: 1, maximum: 5 } } } } } };

test('validate names allowed values for enum errors', () => {
  const v = { chores: [{ name: 'a', every: 'daily' }, { name: 'b', every: 'weekly' }, { name: 'c', every: 'weekend' }] };
  assert.deepEqual(validate(chores, v), ['chores[2].every: "weekend" is not one of daily, weekly, school-days']);
});

test('validate refuses unknown fields when additionalProperties is false', () => {
  assert.deepEqual(validate(chores, { chores: [{ name: 'a', every: 'daily', colour: 'red' }] }), ['chores[0]: unknown field "colour"']);
});

test('validate checks ranges, types and required fields', () => {
  const errs = validate(chores, { chores: [{ name: 'a', every: 'daily', points: 9 }, { every: 'daily' }, { name: 3, every: 'daily' }] });
  assert.deepEqual(errs, ['chores[0].points: 9 is above the maximum 5', 'chores[1]: missing field "name"', 'chores[2].name: expected string']);
});

test('validate accepts a valid nested object', () => {
  assert.deepEqual(validate(chores, { chores: [{ name: 'dishes', every: 'daily', points: 2 }] }), []);
});

test('store round-trips in memory', async () => {
  const s = openStore('t');
  assert.equal(await s.get('k'), undefined);
  await s.set('k', { a: [1, 2] });
  assert.deepEqual(await s.get('k'), { a: [1, 2] });
  assert.deepEqual(await openStore('t').get('k'), { a: [1, 2] }, 'same name shares data');
  assert.equal(await openStore('other').get('k'), undefined);
});

test('uprompt throws without a fake', async () => {
  delete globalThis.UPROMPT_FAKE;
  await assert.rejects(call('points', [{ role: 'user', content: 'x' }]), /uprompt: no model bound \(stand-in\)/);
});

test("uprompt returns the fake's answer", async () => {
  globalThis.UPROMPT_FAKE = (need, messages) => ({ text: `${need}:${messages.length}`, toolCalls: [] });
  try { assert.deepEqual(await call('points', [{ role: 'user', content: 'x' }]), { text: 'points:1', toolCalls: [] }); }
  finally { delete globalThis.UPROMPT_FAKE; }
});

// Why: apps store dates as 'YYYY-MM-DD'. new Date(s).getDay() reads s as UTC midnight but returns the
// LOCAL weekday, so a Saturday reads as Friday west of UTC (a local model did this in cc-04, twice).
test('weekdayOf gives the calendar weekday in every time zone', async () => {
  const { weekdayOf } = await import('../../fixtures/kit-standin/dates.js');
  const was = process.env.TZ;
  try {
    for (const tz of ['UTC', 'America/Los_Angeles', 'Pacific/Pago_Pago', 'Pacific/Kiritimati']) {
      process.env.TZ = tz;
      assert.equal(weekdayOf('2026-11-14'), 6, `Saturday in ${tz}`);
      assert.equal(weekdayOf('2026-11-15'), 0, `Sunday in ${tz}`);
      assert.equal(weekdayOf('2026-11-16'), 1, `Monday in ${tz}`);
    }
  } finally { if (was === undefined) delete process.env.TZ; else process.env.TZ = was; }
});

test('weekdayOf refuses a value that is not a YYYY-MM-DD date', async () => {
  const { weekdayOf } = await import('../../fixtures/kit-standin/dates.js');
  for (const bad of ['2026-11-14T10:00', '14/11/2026', '2026-02-30', '', 20261114]) {
    assert.throws(() => weekdayOf(bad), /weekdayOf: expected a YYYY-MM-DD date/, String(bad));
  }
});

// Why: each app vendors the kit in kit/. A helper added to the stand-in but not copied is invisible to agents.
test("each app's kit/ is an exact copy of the stand-in", async () => {
  const fs = await import('node:fs');
  const dir = new URL('../../fixtures/kit-standin/', import.meta.url);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
  for (const app of ['chore-chart', 'letter-drop', 'reading-log']) {
    const kit = new URL(`../../fixtures/apps/${app}/kit/`, import.meta.url);
    assert.deepEqual(fs.readdirSync(kit).sort(), files, `${app}/kit file list`);
    for (const f of files) assert.equal(fs.readFileSync(new URL(f, kit), 'utf8'), fs.readFileSync(new URL(f, dir), 'utf8'), `${app}/kit/${f}`);
  }
});
