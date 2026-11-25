import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './_lib.mjs';

test('after a game scoring 7, a reload shows a high score of 7', async () => {
  await withPage('level=0', { width: 390, height: 844 }, async (page, srv) => {
    await page.waitForFunction(() => window.__game);
    await page.evaluate(async () => {
      const g = window.__game;
      for (let i = 0; i < 200 && g.score() < 7; i++) {
        const f = g.falling();
        if (f.length) g.press(f[0]);
        await new Promise(r => requestAnimationFrame(r));
      }
      if (g.score() !== 7) throw new Error(`score reached ${g.score()}`);
      g.end();
    });
    await page.waitForTimeout(300);
    await page.goto(srv.url);
    await page.waitForFunction(() => document.querySelector('#app')?.textContent.trim().length > 0);
    await page.waitForTimeout(300);
    const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(text, /\b(high|best|top|record)\b[^0-9]{0,24}\b7\b/i);
  });
});
