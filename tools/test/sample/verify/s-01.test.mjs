import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { double } = await import(pathToFileURL(path.join(process.env.APP_DIR, 'seams/double.js')));
test('double(2) is 5', () => { assert.equal(double(2), 5); });
