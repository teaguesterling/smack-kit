import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson, contrast, luminance, rgbOf } from './_lib.mjs';

test('the background is dark and the text is readable on it', async () => {
  const t = readJson('theme.json');
  const [bg, text] = await rgbOf(t.bg, t.text);
  assert.ok(luminance(bg) < 0.2, `bg luminance ${luminance(bg).toFixed(2)}`);
  assert.ok(contrast(text, bg) >= 4.5, `contrast ${contrast(text, bg).toFixed(2)}`);
});
