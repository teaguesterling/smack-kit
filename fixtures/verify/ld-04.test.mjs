import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './_lib.mjs';

test('at 360x640 the score is below the top bar and on screen', async () => {
  await withPage('level=0', { width: 360, height: 640 }, async page => {
    await page.waitForSelector('#score');
    const box = sel => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; });
    const h = await box('.kit-header'), s = await box('#score');
    const shown = await page.$eval('.kit-header', e => getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.innerText.includes('Letter drop'));
    assert.ok(shown && h.bottom - h.top >= 40 && h.top <= 0, `the top bar must stay visible: ${JSON.stringify(h)}`);
    const overlap = !(s.bottom <= h.top || s.top >= h.bottom || s.right <= h.left || s.left >= h.right);
    assert.ok(!overlap, `score ${JSON.stringify(s)} overlaps header ${JSON.stringify(h)}`);
    assert.ok(s.top >= 0 && s.bottom <= 640 && s.left >= 0 && s.right <= 360, `score off screen: ${JSON.stringify(s)}`);
  });
});
