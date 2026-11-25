import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './_lib.mjs';

const e = (date, minutes) => ({ date, reader: 'Dee', kind: 'book', title: 'Moon Kites', minutes });
const init = `localStorage.setItem('kit:reading-log:entries', ${JSON.stringify(JSON.stringify([e('2026-11-07', 15), e('2026-11-08', 30)]))});`;

test('the calendar starts its weeks on Sunday: 1 November 2026, a Sunday, is in the first column', async () => {
  await withPage('today=2026-11-11&tab=month', { width: 390, height: 844 }, async page => {
    const first = await page.evaluate(() => {
      const heads = [...document.querySelectorAll('main *')].filter(el => /^sun(day)?$/i.test(el.textContent.trim()) && !el.children.length);
      const day1 = [...document.querySelectorAll('main *')].find(el => el.textContent.trim().startsWith('1') && /^1\D*$/.test(el.textContent.trim().split(/\s/)[0]) && el.matches('button, [data-date]'));
      const dowRow = [...document.querySelectorAll('main *')].filter(el => /^(mon|tue|wed|thu|fri|sat|sun)/i.test(el.textContent.trim()) && !el.children.length);
      return { sunLeft: heads[0]?.getBoundingClientRect().left, firstHeadLeft: Math.min(...dowRow.map(d => d.getBoundingClientRect().left)), day1Left: day1?.getBoundingClientRect().left, firstHead: dowRow.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)[0]?.textContent.trim() };
    });
    assert.match(first.firstHead ?? '', /^sun/i, JSON.stringify(first));
    assert.ok(Math.abs(first.day1Left - first.firstHeadLeft) < 30, `day 1 is not in the first column: ${JSON.stringify(first)}`);
  });
});

test('this week runs Sunday to Saturday: Sunday 8 November counts on Wednesday 11 November, Saturday 7 does not', async () => {
  const text = await withPage('today=2026-11-11&tab=month', { width: 390, height: 844 }, page => page.locator('main').innerText(), init);
  assert.match(text, /Dee\D*30 of 60/, text);
});
