import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../src/servers/ava.js', import.meta.url),
  'utf8'
);

test('AVA carries the premium AV identity', () => {
  assert.match(source, /premier public-facing Audio\/Video Intelligence/);
  assert.match(source, /quiet confidence/);
  assert.match(source, /AV\.AI technical authority and ArchĒ governance/);
  assert.match(source, /single most useful next question/);
  assert.match(source, /worthy of a premier Audio\/Video service/);
});

test('AVA rejects generic chatbot behavior', () => {
  assert.match(source, /not a generic chatbot/);
  assert.match(source, /Do not call yourself a go-to expert/);
  assert.match(source, /Do not respond to a broad request with a long intake checklist/);
});
