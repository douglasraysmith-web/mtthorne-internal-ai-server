import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

process.env.AI_STORAGE_DRIVER = 'json_file';
process.env.AI_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'arche-knowledge-test-'));

const { loadArcheSeed, verifyArcheKnowledge, seedArcheKnowledge, searchKnowledge, knowledgeStatus } = await import('../src/servers/knowledge.js');

const seed = loadArcheSeed();

test('v1.6 ArchE seed matches the verified owner package commit', () => {
  const result = verifyArcheKnowledge(seed);
  assert.equal(result.ok, true);
  assert.equal(seed.owner_package_commit, '10413707310d46417654f22ebb770fb307c9176b');
  assert.equal(seed.project_id, 'room_arche_site');
  assert.equal(seed.ai_id, 'arche');
  assert.ok(result.sources >= 40);
  assert.ok(result.runtime_modules_indexed >= 20);
});

test('v1.6 ArchE seed is room-isolated and excludes executable source text', () => {
  assert.equal(seed.safety.cross_room_entries, 0);
  assert.equal(seed.safety.executable_code_ingested, false);
  for (const source of seed.sources) {
    assert.equal(source.project_room, 'room_arche_site');
    assert.deepEqual(source.allowed_ai, ['arche']);
  }
  for (const entry of seed.knowledge_documents) {
    assert.equal(entry.project_id, 'room_arche_site');
    assert.equal(entry.ai_id, 'arche');
    assert.equal(entry.validated, true);
  }
});

test('v1.6 ArchE seed is idempotent and searchable', async () => {
  const first = await seedArcheKnowledge(seed, { overwrite: true });
  const second = await seedArcheKnowledge(seed, { overwrite: false });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.knowledge.total, seed.knowledge_count);
  assert.equal(second.knowledge.skipped, seed.knowledge_count);
  const found = searchKnowledge({ query: 'ArchEAngel queue owner authentication', aiId: 'arche', projectId: 'room_arche_site', limit: 10 });
  assert.equal(found.ok, true);
  assert.ok(found.results.length > 0);
  assert.ok(found.results.some((item) => /1 13 6|queue auth/i.test(item.title + ' ' + item.content)));
  const blockedByScope = searchKnowledge({ query: 'ArchEAngel', aiId: 'av_ai', projectId: 'room_av_ai', limit: 10 });
  assert.equal(blockedByScope.results.length, 0);
  const status = knowledgeStatus();
  assert.equal(status.by_ai.arche, seed.knowledge_count);
});
