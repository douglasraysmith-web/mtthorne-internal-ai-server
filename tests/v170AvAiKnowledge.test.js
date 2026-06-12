import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadAvAiSeed, verifyAvAiKnowledge } from '../src/servers/knowledge.js';

test('AV.AI owner knowledge seed is valid and isolated', () => {
  const seed = loadAvAiSeed();
  const result = verifyAvAiKnowledge(seed);
  assert.equal(result.ok, true);
  assert.equal(seed.ai_id, 'av_ai');
  assert.equal(seed.project_id, 'room_av_ai');
  assert.equal(seed.owner_package_version, '7.8.4');
  assert.equal(seed.safety.cross_room_entries, 0);
  assert.equal(seed.safety.executable_code_ingested, false);
  assert.equal(seed.safety.ava_separate_unrestricted_room, false);
  assert.ok(result.knowledge_documents >= 50);
  assert.ok(result.av_ai_technical_documents > 0);
  assert.ok(result.ava_public_behavior_documents > 0);
});

test('all AV.AI sources and documents stay inside room_av_ai', () => {
  const seed = loadAvAiSeed();
  for (const source of seed.sources) {
    assert.equal(source.project_room, 'room_av_ai');
    assert.ok(source.allowed_ai.includes('av_ai'));
    assert.equal(source.validated, true);
  }
  for (const entry of seed.knowledge_documents) {
    assert.equal(entry.ai_id, 'av_ai');
    assert.equal(entry.project_id, 'room_av_ai');
    assert.equal(entry.validated, true);
    assert.ok(entry.content_sha256);
  }
});

test('AVA behavior remains a governed layer under AV.AI', () => {
  const seed = loadAvAiSeed();
  const avaEntries = seed.knowledge_documents.filter((entry) => entry.knowledge_layer === 'ava_public_behavior');
  assert.ok(avaEntries.length > 0);
  assert.equal(seed.safety.ava_separate_unrestricted_room, false);
  assert.equal(seed.runtime_capability_manifest.ava_role, 'public-facing consultation and communication layer');
  assert.equal(seed.runtime_capability_manifest.av_ai_role, 'technical authority and planning intelligence');
});

test('server exposes owner-only AVAI seed route', async () => {
  const source = await readFile(new URL('../src/server.js', import.meta.url), 'utf8');
  assert.match(source, /\/knowledge\/seed\/avai/);
  assert.match(source, /ownerAuthorized/);
  assert.match(source, /loadAvAiSeed/);
  assert.match(source, /verifyAvAiKnowledge/);
  assert.match(source, /seedAvAiKnowledge/);
});
