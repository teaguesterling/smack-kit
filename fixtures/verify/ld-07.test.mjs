import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage, readJson } from './_lib.mjs';

// Play level 0, end the game at once, and read the game-over screen. The fake model records each `need` it is asked for.
async function gameOver(fakeBody) {
  const init = `window.__needs = []; window.UPROMPT_FAKE = (need, messages) => { window.__needs.push(need); ${fakeBody} };`;
  return withPage('level=0', { width: 390, height: 844 }, async page => {
    await page.waitForFunction(() => window.__game);
    await page.evaluate(() => window.__game.end());
    await page.waitForTimeout(700);
    return page.evaluate(() => ({ text: document.querySelector('main').innerText, needs: window.__needs }));
  }, init);
}

// The fake answers in the format the app asked for: plain text, or JSON when a prompt asks for JSON and
// shows its key, as in {"message": "..."}. A real model follows the format it is given.
const answer = line => `const ask = messages.map(m => String(m.content)).join('\\n');
  const key = /json/i.test(ask) && (ask.match(/\\{\\s*"(\\w+)"\\s*:/) || [])[1];
  return { text: key ? JSON.stringify({ [key]: ${JSON.stringify(line)} }) : ${JSON.stringify(line)}, toolCalls: [] };`;

// Two different answers, so a fixed message cannot pass.
for (const line of ['Great catching, keep going!', 'Wow, your fingers are fast today.']) {
  test(`the model's words "${line}" show after the game, with the score`, async () => {
    const r = await gameOver(answer(line));
    assert.ok(r.text.includes(line), r.text);
    assert.match(r.text, /\b0\b/, 'the score is still shown');
  });
}

test('each model call names a model listed in app.json', async () => {
  const r = await gameOver(`return { text: 'Nice!', toolCalls: [] };`);
  const models = Object.keys(readJson('app.json').models ?? {});
  assert.ok(r.needs.length > 0, 'the game never called the model');
  for (const n of r.needs) assert.ok(models.includes(n), `call("${n}") is not in app.json models (${models.join(', ') || 'none'})`);
});

test('when the model fails, the game over screen still shows the score', async () => {
  const r = await gameOver(`throw new Error('device busy');`);
  assert.match(r.text, /scored\s+0|score\D{0,12}\b0\b/i, r.text);
});
