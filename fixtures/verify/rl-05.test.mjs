import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage, readJson, fakeModelInit } from './_lib.mjs';

const read = [{ date: '2026-11-10', reader: 'Dee', kind: 'book', title: 'Moon Kites', minutes: 20 }, { date: '2026-11-11', reader: 'Eli', kind: 'comic', title: 'Captain Spoon', minutes: 30 }];
const init = line => `localStorage.setItem('kit:reading-log:entries', ${JSON.stringify(JSON.stringify(read))});\n` + fakeModelInit(line, { readers: ['Dee', 'Eli'] });

// Look on the month screen; if nothing shows, press a button that mentions suggesting, then each tab.
async function run(line) {
  return withPage('today=2026-11-11&tab=month', { width: 390, height: 844 }, async page => {
    await page.waitForTimeout(1200);
    const seen = () => page.evaluate(l => document.body.innerText.includes(l), line);
    if (!(await seen())) for (const b of await page.getByRole('button', { name: /suggest|next book|recommend/i }).all()) { await b.click(); await page.waitForTimeout(1200); }
    if (!(await seen())) for (const t of await page.locator('[role=tab]').all()) { await t.click(); await page.waitForTimeout(1000); for (const b of await page.getByRole('button', { name: /suggest|next book|recommend/i }).all()) { await b.click(); await page.waitForTimeout(1200); } if (await seen()) break; }
    return { shown: await seen(), calls: await page.evaluate(() => window.__calls) };
  }, init(line));
}

for (const line of ['The Snail Who Flew', 'Seven Lanterns Home']) {
  test(`the model's suggestion "${line}" is shown`, async () => {
    const r = await run(line);
    assert.ok(r.shown, `not shown; ${r.calls.length} model call(s)`);
  });
}

test('the model is asked with what the children read, and the call names a model in app.json', async () => {
  const r = await run('The Snail Who Flew');
  const models = Object.keys(readJson('app.json').models ?? {});
  assert.ok(r.calls.length > 0, 'no model call');
  for (const c of r.calls) assert.ok(models.includes(c.need), `call("${c.need}") is not in app.json models (${models.join(', ') || 'none'})`);
  const all = r.calls.map(c => c.text).join('\n');
  assert.ok(all.includes('Moon Kites') || all.includes('Captain Spoon'), 'the prompt does not include any title the children read');
});
