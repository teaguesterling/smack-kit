import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './_lib.mjs';

const textOf = tab => withPage(`today=2026-11-11&tab=${tab}`, { width: 390, height: 844 },
  page => page.evaluate(() => document.body.innerText + ' ' + document.title));
// The request renames what the items are called. The app's own name may stay (maintainer's ruling, 2026-11-11).
const withoutAppName = text => text.replace(/chore chart/gi, '');

for (const tab of ['today', 'week', 'board']) {
  test(`the ${tab} screen says jobs, never chores, and shows no broken values`, async () => {
    const text = await textOf(tab);
    assert.doesNotMatch(withoutAppName(text), /chore/i);
    // The board shows no item labels, only the app name, so only today and week must say jobs.
    if (tab !== 'board') assert.match(text, /job/i);
    assert.doesNotMatch(text, /undefined|NaN|\[object/);
  });
}

test("today's list still names the people and their jobs", async () => {
  assert.match(await textOf('today'), /Ari: dishes|Bo: dishes|Cy: dishes|Bartholomew: dishes/);
});

test('adding a job from the week screen still works', async () => {
  await withPage('today=2026-11-11&tab=week', { width: 390, height: 844 }, async page => {
    const form = page.locator('form');
    await form.locator('input[name=name]').fill('water the plants');
    await form.locator('[type=submit]').click();
    await page.waitForFunction(() => document.body.innerText.includes('water the plants'), null, { timeout: 3000 });
  });
});
