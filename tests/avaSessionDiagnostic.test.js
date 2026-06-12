import test from 'node:test';
import assert from 'node:assert/strict';
import { clearAvaSession, getAvaSession, updateAvaSession } from '../src/servers/avaSessionMemory.js';
import { buildAvAiPlan } from '../src/servers/avaAvAiPlanner.js';
import { extractAvFacts, buildDiagnosticState, buildDeterministicAvCandidate } from '../src/servers/avaDiagnostic.js';
import { evaluateAvaAnswer } from '../src/servers/avaQuality.js';

test('AVA session memory retains bounded facts and turns', () => {
  const key = 'test-session-memory';
  clearAvaSession(key);
  updateAvaSession(key, {
    facts: { manufacturer: 'Denon', model: 'AVR-X3800H' },
    turns: [{ role: 'visitor', text: 'My receiver is a Denon AVR-X3800H.' }]
  });
  const session = getAvaSession(key);
  assert.equal(session.facts.manufacturer, 'Denon');
  assert.equal(session.facts.model, 'AVR-X3800H');
  assert.equal(session.turns.length, 1);
});

test('diagnostic branching advances when equipment facts are known', () => {
  const plan = buildAvAiPlan('I am having a driver issue.');
  const facts = { manufacturer: 'Denon', model: 'AVR-X3800H', operating_system: 'Windows 11' };
  const state = buildDiagnosticState(plan, facts);
  assert.equal(state.stage, 'identify_symptom');
  assert.match(state.next_question, /what exactly happens/i);
});

test('diagnostic branching advances to recent-change isolation after symptom', () => {
  const plan = buildAvAiPlan('The device is not detected.');
  plan.intent = 'troubleshooting';
  plan.domains = ['driver_or_firmware'];
  const facts = {
    manufacturer: 'Denon',
    model: 'AVR-X3800H',
    operating_system: 'Windows 11',
    symptoms: ['not_detected']
  };
  const state = buildDiagnosticState(plan, facts);
  assert.equal(state.stage, 'identify_recent_change');
});

test('deterministic AV candidate is specific and can pass quality', () => {
  const plan = buildAvAiPlan('I am having a driver issue.');
  const facts = {};
  const state = buildDiagnosticState(plan, facts);
  const answer = buildDeterministicAvCandidate({ plan, diagnosticState: state, facts });
  const quality = evaluateAvaAnswer({
    message: 'I am having a driver issue.',
    answer,
    plan,
    archeReviewed: true
  });
  assert.match(answer, /software driver/);
  assert.equal(quality.status, 'verified');
  assert.ok(quality.score >= 85);
});

test('fact extraction recognizes model, OS, and symptom', () => {
  const facts = extractAvFacts('The model is AVR-X3800H on Windows 11 and it is not detected.');
  assert.equal(facts.model, 'AVR-X3800H');
  assert.equal(facts.operating_system, 'Windows 11');
  assert.ok(facts.symptoms.includes('not_detected'));
});
