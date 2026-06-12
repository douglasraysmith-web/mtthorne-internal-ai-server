import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('deployable lockfile contains no internal registry references', async () => {
  const lock = await readFile(new URL('../package-lock.json', import.meta.url), 'utf8');
  assert.doesNotMatch(lock, /applied-caas-gateway|internal\.api\.openai\.org|artifactory\/api\/npm\/npm-public/i);
  assert.match(lock, /https:\/\/registry\.npmjs\.org\//);
});
