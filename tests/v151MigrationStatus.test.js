import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const postgresSource = await readFile(new URL('../src/utils/postgresStore.js', import.meta.url), 'utf8');
const storageSource = await readFile(new URL('../src/servers/storage.js', import.meta.url), 'utf8');
const serverSource = await readFile(new URL('../src/server.js', import.meta.url), 'utf8');

test('migration metadata is persisted in PostgreSQL', () => {
  assert.match(postgresSource, /CREATE TABLE IF NOT EXISTS ai_store_metadata/);
  assert.match(postgresSource, /persistMigrationMetadata/);
  assert.match(postgresSource, /metadata_key = 'last_migration'/);
});

test('live storage status refreshes persisted migration metadata', () => {
  assert.match(storageSource, /storageStatusLive/);
  assert.match(storageSource, /refreshPostgresMetadata/);
  assert.match(serverSource, /await storageStatusLive\(\)/);
});

test('live manifest overrides stale legacy file values', () => {
  assert.match(storageSource, /\.\.\.stored/);
  assert.match(storageSource, /storage_version: 'storage_adapter_v1_5_0'/);
  assert.match(storageSource, /active_driver: storageDriver\(\)/);
});
