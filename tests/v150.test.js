import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { health } from '../src/orchestrator.js';
import { storageStatus, storageMigrationPlan } from '../src/servers/storage.js';
import { supportedStorageDrivers } from '../src/utils/store.js';

const postgresSource = await readFile(
  new URL('../src/utils/postgresStore.js', import.meta.url),
  'utf8'
);
const serverSource = await readFile(
  new URL('../src/server.js', import.meta.url),
  'utf8'
);

test('v1.5.0 exposes shared PostgreSQL storage capability', () => {
  const h = health();
  assert.ok(['1.6.0','1.7.0'].includes(h.version));
  assert.equal(h.storage_layer, 'storage_adapter_v1_5_0');
  assert.ok(supportedStorageDrivers().includes('postgres'));
});

test('v1.5.0 remains JSON backed by default for safe local tests', () => {
  const status = storageStatus();
  assert.equal(status.active_driver, 'json_file');
  assert.equal(status.database_connected, false);
  assert.deepEqual(status.shared_ai_scope, ['arche', 'av_ai', 'vlock_ai', 'janitor']);
});

test('PostgreSQL driver uses one JSONB document table with versioning', () => {
  assert.match(postgresSource, /CREATE TABLE IF NOT EXISTS ai_store_documents/);
  assert.match(postgresSource, /document JSONB NOT NULL/);
  assert.match(postgresSource, /version BIGINT/);
  assert.match(postgresSource, /ON CONFLICT \(collection_key\)/);
  assert.match(postgresSource, /seedDefaultCollectionsToPostgres/);
});

test('JSON migration is owner protected and available by CLI', () => {
  assert.match(serverSource, /ownerAuthorized/);
  assert.match(serverSource, /\/storage\/migrate-json/);
  const plan = storageMigrationPlan();
  assert.ok(plan.collections.includes('ai_registry'));
  assert.ok(plan.collections.includes('ava_sessions'));
  assert.equal(plan.postgres_table, 'ai_store_documents');
});
