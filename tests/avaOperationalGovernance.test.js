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

test('HDMI dropout is classified as troubleshooting and signal-path work', async () => {
  const { buildAvAiPlan } = await import('../src/servers/avaAvAiPlanner.js');
  const plan = buildAvAiPlan('The screen drops when switching into HDR.', {
    turns: [{ role: 'visitor', text: 'EDID and HDCP black screen through an AV receiver' }],
    facts: {}
  });
  assert.equal(plan.intent, 'troubleshooting');
  assert.ok(plan.domains.includes('hdmi_signal_path'));
});

test('AVA extracts full source receiver display chain and HDR trigger', async () => {
  const { extractAvFacts, buildDiagnosticState } = await import('../src/servers/avaDiagnostic.js');
  const { buildAvAiPlan } = await import('../src/servers/avaAvAiPlanner.js');
  const message = 'The receiver is a Denon AVR-X3800H, the television is an LG C3, and the source is a PlayStation 5. The screen drops when switching into HDR.';
  const facts = extractAvFacts(message, {});
  assert.equal(facts.equipment.receiver, 'Denon AVR-X3800H');
  assert.equal(facts.equipment.display, 'LG C3');
  assert.equal(facts.equipment.source, 'PlayStation 5');
  assert.equal(facts.signal_mode, 'HDR');
  const plan = buildAvAiPlan(message, {});
  const state = buildDiagnosticState(plan, facts);
  assert.equal(state.stage, 'direct_path_isolation');
  assert.equal(state.branch, 'hdmi_signal_path');
});

test('AVA live route retrieves room-scoped AVAI knowledge', async () => {
  const source = await readFile(new URL('../src/servers/ava.js', import.meta.url), 'utf8');
  assert.match(source, /searchKnowledge/);
  assert.match(source, /aiId: 'av_ai'/);
  assert.match(source, /projectId: 'room_av_ai'/);
  assert.match(source, /knowledge_hits/);
});
