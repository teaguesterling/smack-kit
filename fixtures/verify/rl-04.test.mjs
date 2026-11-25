import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './_lib.mjs';

test('at 360x640 every day of the month is at least 44x44 px, and the page does not scroll sideways', async () => {
  await withPage('today=2026-11-11&tab=month', { width: 360, height: 640 }, async page => {
    const small = await page.$$eval('[data-date]', ds => ds.map(d => { const r = d.getBoundingClientRect(); return [d.dataset.date, Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => w < 44 || h < 44));
    assert.deepEqual(small, []);
    assert.equal(await page.$$eval('[data-date]', ds => ds.length), 30, 'all 30 days of November are shown');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 360), 'horizontal scroll');
  });
});
