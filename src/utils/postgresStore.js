import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { allDefaultCollections } from '../dataDefaults.js';

const { Pool } = pg;

const state = {
  initialized: false,
  connected: false,
  pool: null,
  cache: new Map(),
  pendingWrites: 0,
  lastError: null,
  lastConnectedAt: null,
  lastMigration: null,
  writeChain: Promise.resolve()
};

function safeKey(filePath) {
  return path.basename(String(filePath || '')).replace(/\.json$/i, '');
}

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

function sslConfig() {
  const mode = String(process.env.PGSSLMODE || '').toLowerCase();
  if (mode === 'disable') return false;
  if (process.env.RAILWAY_ENVIRONMENT || mode === 'require' || mode === 'no-verify') {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

export function postgresConfigured() {
  return Boolean(connectionString());
}

export function postgresState() {
  return {
    initialized: state.initialized,
    connected: state.connected,
    cached_collections: state.cache.size,
    pending_writes: state.pendingWrites,
    last_error: state.lastError,
    last_connected_at: state.lastConnectedAt,
    last_migration: state.lastMigration
  };
}

async function ensureSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_store_documents (
      collection_key TEXT PRIMARY KEY,
      document JSONB NOT NULL,
      version BIGINT NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS ai_store_documents_updated_at_idx
    ON ai_store_documents (updated_at DESC)
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_store_metadata (
      metadata_key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function loadCache(pool) {
  const result = await pool.query(
    'SELECT collection_key, document FROM ai_store_documents ORDER BY collection_key'
  );
  state.cache.clear();
  for (const row of result.rows) {
    state.cache.set(row.collection_key, row.document);
  }
}

async function loadMigrationMetadata(pool) {
  const result = await pool.query(
    "SELECT value FROM ai_store_metadata WHERE metadata_key = 'last_migration'"
  );
  state.lastMigration = result.rows[0]?.value || null;
  return state.lastMigration;
}

async function persistMigrationMetadata(pool, value) {
  await pool.query(
    `INSERT INTO ai_store_metadata (metadata_key, value, updated_at)
     VALUES ('last_migration', $1::jsonb, NOW())
     ON CONFLICT (metadata_key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(value)]
  );
  state.lastMigration = value;
}

export async function initializePostgresStore() {
  if (state.initialized) return postgresState();
  state.initialized = true;

  if (!postgresConfigured()) {
    state.lastError = 'DATABASE_URL_not_configured';
    return postgresState();
  }

  try {
    state.pool = new Pool({
      connectionString: connectionString(),
      ssl: sslConfig(),
      max: Number(process.env.AI_POSTGRES_POOL_MAX || 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000
    });
    state.pool.on('error', (error) => {
      state.connected = false;
      state.lastError = String(error?.message || error);
    });
    await ensureSchema(state.pool);
    await loadCache(state.pool);
    await loadMigrationMetadata(state.pool);
    state.connected = true;
    state.lastError = null;
    state.lastConnectedAt = new Date().toISOString();
    return postgresState();
  } catch (error) {
    state.connected = false;
    state.lastError = String(error?.message || error);
    return postgresState();
  }
}

export function readPostgresDocument(filePath, fallback) {
  const key = safeKey(filePath);
  return state.cache.has(key) ? structuredClone(state.cache.get(key)) : fallback;
}

function enqueueWrite(key, value) {
  if (!state.pool || !state.connected) return;
  state.pendingWrites += 1;
  state.writeChain = state.writeChain
    .then(async () => {
      await state.pool.query(
        `INSERT INTO ai_store_documents (collection_key, document, version, updated_at)
         VALUES ($1, $2::jsonb, 1, NOW())
         ON CONFLICT (collection_key)
         DO UPDATE SET document = EXCLUDED.document,
                       version = ai_store_documents.version + 1,
                       updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );
    })
    .catch((error) => {
      state.lastError = String(error?.message || error);
      state.connected = false;
    })
    .finally(() => {
      state.pendingWrites = Math.max(0, state.pendingWrites - 1);
    });
}

export function writePostgresDocument(filePath, value) {
  const key = safeKey(filePath);
  state.cache.set(key, structuredClone(value));
  enqueueWrite(key, value);
}

export async function flushPostgresWrites() {
  await state.writeChain;
  return postgresState();
}

export async function refreshPostgresMetadata() {
  if (!state.pool || !state.connected) return postgresState();
  try {
    await loadMigrationMetadata(state.pool);
    state.lastError = null;
  } catch (error) {
    state.lastError = String(error?.message || error);
  }
  return postgresState();
}

export async function pingPostgres() {
  if (!state.pool) return { ok: false, error: state.lastError || 'postgres_not_initialized' };
  try {
    const result = await state.pool.query('SELECT NOW() AS now, COUNT(*)::int AS collections FROM ai_store_documents');
    state.connected = true;
    state.lastError = null;
    return {
      ok: true,
      connected: true,
      server_time: result.rows[0]?.now || null,
      collections: result.rows[0]?.collections || 0,
      pending_writes: state.pendingWrites
    };
  } catch (error) {
    state.connected = false;
    state.lastError = String(error?.message || error);
    return { ok: false, connected: false, error: state.lastError };
  }
}


export async function seedDefaultCollectionsToPostgres() {
  if (!state.pool || !state.connected) {
    return { ok: false, error: 'postgres_not_connected' };
  }
  const defaults = allDefaultCollections();
  const inserted = [];
  const existing = [];
  for (const [key, value] of Object.entries(defaults)) {
    const result = await state.pool.query(
      `INSERT INTO ai_store_documents (collection_key, document, version, updated_at)
       VALUES ($1, $2::jsonb, 1, NOW())
       ON CONFLICT (collection_key) DO NOTHING
       RETURNING collection_key`,
      [key, JSON.stringify(value)]
    );
    if (result.rowCount) inserted.push(key);
    else existing.push(key);
    if (!state.cache.has(key)) state.cache.set(key, value);
  }
  return { ok: true, inserted, existing };
}

export async function migrateJsonDirectoryToPostgres(dataDir, options = {}) {
  if (!state.pool || !state.connected) {
    return { ok: false, error: 'postgres_not_connected' };
  }
  const overwrite = options.overwrite === true;
  const names = fs.existsSync(dataDir)
    ? fs.readdirSync(dataDir).filter((name) => name.endsWith('.json') && !name.startsWith('.'))
    : [];
  const imported = [];
  const skipped = [];
  const failed = [];

  for (const name of names) {
    const full = path.join(dataDir, name);
    const key = safeKey(name);
    try {
      const value = JSON.parse(fs.readFileSync(full, 'utf8'));
      if (!overwrite) {
        const exists = await state.pool.query(
          'SELECT 1 FROM ai_store_documents WHERE collection_key = $1',
          [key]
        );
        if (exists.rowCount) {
          skipped.push(key);
          continue;
        }
      }
      await state.pool.query(
        `INSERT INTO ai_store_documents (collection_key, document, version, updated_at)
         VALUES ($1, $2::jsonb, 1, NOW())
         ON CONFLICT (collection_key)
         DO UPDATE SET document = EXCLUDED.document,
                       version = ai_store_documents.version + 1,
                       updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );
      state.cache.set(key, value);
      imported.push(key);
    } catch (error) {
      failed.push({ collection: key, error: String(error?.message || error) });
    }
  }

  const migrationRecord = {
    at: new Date().toISOString(),
    imported: imported.length,
    skipped: skipped.length,
    failed: failed.length,
    overwrite
  };
  await persistMigrationMetadata(state.pool, migrationRecord);
  return {
    ok: failed.length === 0,
    migration_version: 'postgres_json_migration_v1_0_0',
    overwrite,
    imported,
    skipped,
    failed
  };
}

export async function closePostgresStore() {
  await flushPostgresWrites();
  if (state.pool) await state.pool.end();
  state.pool = null;
  state.connected = false;
}
