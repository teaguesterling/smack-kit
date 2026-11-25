import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './_lib.mjs';

test('at 360x640 no name on the board is cut off, and the page does not scroll sideways', async () => {
  await withPage('today=2026-11-11&tab=board', { width: 360, height: 640 }, async page => {
    await page.waitForSelector('.name');
    const clipped = await page.$$eval('.name', ns => ns.filter(n => n.scrollWidth > n.clientWidth).map(n => n.textContent));
    assert.deepEqual(clipped, []);
    const names = await page.$$eval('.name', ns => ns.map(n => n.textContent));
    assert.ok(names.includes('Bartholomew'), 'the long name must still be shown');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 360), 'horizontal scroll');
  });
});
