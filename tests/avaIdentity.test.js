import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../src/servers/ava.js', import.meta.url),
  'utf8'
);

test('AVA carries the premium AV identity', () => {
  assert.match(
    source,
    /premier public-facing Audio\/Video Intelligence/
  );

  assert.match(source, /quiet confidence/);
  assert.match(source, /technical mastery/);
  assert.match(source, /premium judgment/);
  assert.match(source, /one precise next question/);
});

test('AVA rejects generic chatbot behavior', () => {
  assert.match(source, /not a generic chatbot/);
  assert.match(source, /passive intake form/);
  assert.match(source, /Do not dump a numbered questionnaire/);
  assert.match(source, /Avoid filler such as certainly/);
});

test('AVA uses operational AVAI planning and ArchE review', () => {
  assert.match(source, /buildAvAiPlan/);
  assert.match(source, /requestArcheReview/);
  assert.match(source, /evaluateAvaAnswer/);
  assert.match(source, /draft_withheld/);
});
