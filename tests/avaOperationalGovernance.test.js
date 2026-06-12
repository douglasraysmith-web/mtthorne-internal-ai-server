import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildAvAiPlan } from '../src/servers/avaAvAiPlanner.js';
import { evaluateAvaAnswer } from '../src/servers/avaQuality.js';

test('AV.AI recognizes ambiguous driver troubleshooting', () => {
  const plan = buildAvAiPlan('I am having a driver issue.');

  assert.equal(plan.intent, 'troubleshooting');
  assert.ok(plan.domains.includes('driver_or_firmware'));
  assert.match(plan.first_question, /manufacturer and model/i);
});

test('generic passive answer fails dynamic AVA quality', () => {
  const plan = buildAvAiPlan('I am having a driver issue.');

  const quality = evaluateAvaAnswer({
    message: 'I am having a driver issue.',
    answer:
      'Certainly. Could you provide a bit more context about the issue?',
    plan,
    archeReviewed: false
  });

  assert.notEqual(quality.status, 'verified');
  assert.ok(quality.failures.includes('insufficient_av_specificity'));
  assert.ok(quality.failures.includes('arche_review_not_completed'));
});

test('specific reviewed troubleshooting answer can pass', () => {
  const plan = buildAvAiPlan('I am having a driver issue.');

  const quality = evaluateAvaAnswer({
    message: 'I am having a driver issue.',
    answer:
      'Before changing hardware, we should determine whether this is a software driver, firmware, control-driver, loudspeaker-driver, or signal-path failure. What is the exact manufacturer and model of the affected device, and what operating system, receiver, processor, or control platform is communicating with it?',
    plan,
    archeReviewed: true
  });

  assert.equal(quality.status, 'verified');
  assert.ok(quality.score >= 85);
});

test('AVA route contains operational AV.AI and ArchE stages', async () => {
  const source = await readFile(
    new URL('../src/servers/ava.js', import.meta.url),
    'utf8'
  );

  assert.match(source, /buildAvAiPlan/);
  assert.match(source, /requestArcheReview/);
  assert.match(source, /evaluateAvaAnswer/);
  assert.match(source, /draft_withheld/);
});

test('AVA scores provider and ArchE candidates instead of blindly preferring revision', async () => {
  const source = await readFile(
    new URL('../src/servers/ava.js', import.meta.url),
    'utf8'
  );

  assert.match(source, /provider_draft/);
  assert.match(source, /arche_revision/);
  assert.match(source, /candidates\.sort/);
  assert.match(source, /selected_source/);
});

test('AVA performs one automatic repair for rejected answers', async () => {
  const source = await readFile(
    new URL('../src/servers/ava.js', import.meta.url),
    'utf8'
  );

  assert.match(source, /automatic_repair/);
  assert.match(source, /repairFailures/);
  assert.match(source, /You are repairing a rejected AVA answer/);
});
