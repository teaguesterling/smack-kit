import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './_lib.mjs';

// The fake model answers every points request with `answer`.
async function suggestionFor(answer) {
  const init = `window.UPROMPT_FAKE = () => ({ text: ${JSON.stringify(JSON.stringify(answer))}, toolCalls: [] });`;
  return withPage('today=2026-11-11&tab=week', { width: 390, height: 844 }, async page => {
    const form = page.locator('form');
    await form.locator('input[name=name]').fill('water the plants');
    await form.locator('input[name=name]').press('Tab');
    await page.waitForTimeout(1500);
    const ask = form.getByRole('button', { name: /suggest|ask|\bai\b|points/i });
    if (await ask.count()) { await ask.first().click(); await page.waitForTimeout(1500); }
    return form.evaluate(f => ({ select: f.querySelector('select[name=points]')?.value, text: f.innerText }));
  }, init);
}

// Two different answers, so a hard-coded value cannot pass.
for (const n of [2, 4]) {
  test(`a model answer of ${n} points is shown as the suggestion`, async () => {
    const s = await suggestionFor({ points: n });
    assert.ok(s.select === String(n) || new RegExp(`suggest[^\\n]*\\b${n}\\b`, 'i').test(s.text), JSON.stringify(s));
  });
}

test('a model answer of 9 points is refused, because points run 1 to 5', async () => {
  const s = await suggestionFor({ points: 9 });
  assert.ok(['1', '2', '3', '4', '5'].includes(s.select), `points select holds ${JSON.stringify(s.select)}`);
  assert.doesNotMatch(s.text, /suggest[^\n]*\b9\b/i);
});
