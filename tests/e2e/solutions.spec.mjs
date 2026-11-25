// Each task's reference solution, laid over its app the way `fixture.mjs validate` does, still opens every
// screen with no page errors and still fits the screen. The verifiers check the change; this checks that
// the change did not break the rest of the app in a real browser, at every project width.
import { test, expect, ROOT, appJson, layoutFaults, solvedCopy } from './_app.mjs';
import fs from 'node:fs';
import path from 'node:path';

const ids = fs.readdirSync(path.join(ROOT, 'fixtures', 'solutions')).sort();

for (const id of ids) {
  test(`solution ${id} keeps every screen working`, async ({ page, openApp }) => {
    const { dir } = solvedCopy(id);
    try {
      for (const query of appJson(dir).screens ?? ['']) {
        await openApp(dir, query);
        expect(await page.evaluate(layoutFaults), `${id} ${query}`).toEqual([]);
      }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
}
