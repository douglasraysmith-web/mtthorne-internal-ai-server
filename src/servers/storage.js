import fs from 'node:fs';
import path from 'node:path';
import {
  resolveDataDir,
  readJson,
  writeJson,
  nowIso,
  id,
  storageDriver,
  supportedStorageDrivers
} from '../utils/store.js';
import {
  initializePostgresStore,
  postgresConfigured,
  postgresState,
  pingPostgres,
  flushPostgresWrites,
  migrateJsonDirectoryToPostgres,
  seedDefaultCollectionsToPostgres
} from '../utils/postgresStore.js';

const manifestFile = () => path.join(resolveDataDir(), 'storage_manifest.json');
const checkFile = () => path.join(resolveDataDir(), '.storage_check.json');

export const STORE_FILES = Object.freeze([
  'ai_registry.json',
  'project_rooms.json',
  'source_manifest.json',
  'error_ledger.json',
  'decision_rules.json',
  'decision_history.json',
  'work_queue.json',
  'trace_log.json',
  'transfer_requests.json',
  'bridge_outbox.json',
  'working_memory.json',
  'episodic_memory.json',
  'semantic_memory_manifest.json',
  'verified_sources.json',
  'provider_dispatch_log.json',
  'owner_approval_log.json',
  'cost_ledger.json',
  'ava_sessions.json'
]);

export async function initializeStorage() {
  if (storageDriver() !== 'postgres') {
    return { ok: true, driver: 'json_file', connected: false };
  }

  const initialized = await initializePostgresStore();
  if (!initialized.connected) {
    if (process.env.AI_POSTGRES_REQUIRE_CONNECTION === 'true') {
      throw new Error(`Postgres initialization failed: ${initialized.last_error || 'unknown_error'}`);
    }
    return { ok: false, driver: 'postgres', connected: false, fallback: 'json_file', ...initialized };
  }

  let migration = null;
  if (process.env.AI_POSTGRES_BOOTSTRAP_FROM_JSON === 'true' && initialized.cached_collections === 0) {
    migration = await migrateJsonDirectoryToPostgres(resolveDataDir(), { overwrite: false });
  }

  const seed = process.env.AI_POSTGRES_SEED_DEFAULTS === 'false'
    ? { ok: true, skipped: true }
    : await seedDefaultCollectionsToPostgres();

  return {
    ok: (migration?.ok ?? true) && seed.ok,
    driver: 'postgres',
    connected: true,
    migration,
    default_seed: seed,
    ...initialized
  };
}

export function storageManifest() {
  const fallback = {
    storage_version: 'storage_adapter_v1_5_0',
    active_driver: storageDriver(),
    available_drivers: ['json_file', 'postgres'],
    future_drivers: ['sqlite', 'redis_streams', 'qdrant_manifest'],
    migration_rule: 'All server modules use the storage adapter boundary. PostgreSQL stores shared JSONB collections for all four AIs; local JSON remains the recovery copy unless disabled.',
    public_activation: 'inactive',
    provider_dispatch: 'inactive'
  };
  return readJson(manifestFile(), fallback);
}

export function storageStatus() {
  const dataDir = resolveDataDir();
  const driver = storageDriver();
  const pg = postgresState();
  const files = STORE_FILES.map((name) => {
    const full = path.join(dataDir, name);
    return {
      name,
      exists: fs.existsSync(full),
      bytes: fs.existsSync(full) ? fs.statSync(full).size : 0
    };
  });

  return {
    ok: supportedStorageDrivers().includes(driver) && (driver !== 'postgres' || pg.connected || process.env.AI_POSTGRES_REQUIRE_CONNECTION !== 'true'),
    storage_version: 'storage_adapter_v1_5_0',
    active_driver: driver,
    supported_drivers: supportedStorageDrivers(),
    data_dir: dataDir,
    database_ready: true,
    database_configured: postgresConfigured(),
    database_connected: driver === 'postgres' && pg.connected,
    database_state: pg,
    write_mode: driver === 'postgres'
      ? 'postgres_jsonb_with_atomic_local_recovery_copy'
      : 'atomic_json_file_writes',
    manifest: storageManifest(),
    files,
    shared_ai_scope: ['arche', 'av_ai', 'vlock_ai', 'janitor'],
    safety: {
      public_chat: process.env.AI_PUBLIC_MODE === 'true' ? 'enabled' : 'inactive_until_explicit_approval',
      provider_dispatch: process.env.AI_ALLOW_PROVIDER_DISPATCH === 'true' ? 'enabled' : 'inactive',
      customer_data: 'inactive',
      payment_account_access: 'inactive',
      automatic_arche_import: 'inactive'
    },
    rule: 'PostgreSQL is the shared persistent store when AI_STORAGE_DRIVER=postgres. Local JSON remains an atomic recovery and migration copy unless AI_DISABLE_LOCAL_STORAGE_BACKUP=true.'
  };
}

export function storageSelfCheck() {
  const checkId = id('storage_check');
  const payload = {
    check_id: checkId,
    created_at: nowIso(),
    driver: storageDriver(),
    data_dir: resolveDataDir(),
    purpose: 'Verify adapter read/write round trip without touching business records.'
  };
  writeJson(checkFile(), payload);
  const readBack = readJson(checkFile(), null);
  const ok = readBack?.check_id === checkId;
  return {
    ok,
    storage_version: 'storage_adapter_v1_5_0',
    driver: storageDriver(),
    data_dir: resolveDataDir(),
    check_id: checkId,
    read_write_round_trip: ok ? 'passed' : 'failed',
    database_connected: storageDriver() === 'postgres' ? postgresState().connected : false,
    pending_writes: postgresState().pending_writes,
    file: checkFile()
  };
}

export async function storageConnectionCheck() {
  if (storageDriver() !== 'postgres') {
    return { ok: true, driver: 'json_file', database_connected: false, note: 'Postgres check skipped because JSON storage is active.' };
  }
  await flushPostgresWrites();
  const ping = await pingPostgres();
  return {
    ...ping,
    storage_version: 'storage_adapter_v1_5_0',
    driver: 'postgres',
    shared_ai_scope: ['arche', 'av_ai', 'vlock_ai', 'janitor']
  };
}

export async function migrateStorageFromJson(input = {}) {
  if (storageDriver() !== 'postgres') {
    return { ok: false, error: 'AI_STORAGE_DRIVER_must_be_postgres' };
  }
  return migrateJsonDirectoryToPostgres(resolveDataDir(), {
    overwrite: input.overwrite === true
  });
}

export function storageMigrationPlan() {
  return {
    ok: true,
    storage_version: 'storage_adapter_v1_5_0',
    current_driver: storageDriver(),
    current_state: storageDriver() === 'postgres' ? 'postgres_shared_store' : 'file_backed_default',
    target_driver: 'postgres',
    postgres_table: 'ai_store_documents',
    postgres_document_model: {
      collection_key: 'JSON filename without extension',
      document: 'JSONB collection document',
      version: 'monotonic update counter',
      updated_at: 'database timestamp'
    },
    collections: STORE_FILES.map((name) => name.replace(/\.json$/, '')),
    shared_ai_scope: ['arche', 'av_ai', 'vlock_ai', 'janitor'],
    activation_environment: [
      'DATABASE_URL=<Railway private Postgres connection string>',
      'AI_STORAGE_DRIVER=postgres',
      'AI_POSTGRES_BOOTSTRAP_FROM_JSON=true for the first empty-database deployment only',
      'AI_POSTGRES_REQUIRE_CONNECTION=true after successful verification',
      'AI_POSTGRES_SEED_DEFAULTS=true to guarantee the four core AI records and room/routing defaults exist'
    ],
    gates_before_switch: [
      'backup current data folder',
      'run npm test',
      'deploy with DATABASE_URL and AI_STORAGE_DRIVER=postgres',
      'run GET /storage/database-check',
      'run POST /storage/migrate-json once when legacy JSON records must be imported',
      'verify queue/replay still passes',
      'verify release gate still blocks unsafe release',
      'set AI_POSTGRES_REQUIRE_CONNECTION=true only after migration and checks pass'
    ]
  };
}
