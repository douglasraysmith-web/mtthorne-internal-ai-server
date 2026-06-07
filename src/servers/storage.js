import fs from 'node:fs';
import path from 'node:path';
import { resolveDataDir, readJson, writeJson, nowIso, id, storageDriver, supportedStorageDrivers } from '../utils/store.js';

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
  'verified_sources.json'
]);

export function storageManifest() {
  const fallback = {
    storage_version: 'storage_adapter_v0_6_0',
    active_driver: 'json_file',
    available_drivers: ['json_file'],
    future_drivers: ['sqlite', 'postgres', 'redis_streams', 'qdrant_manifest'],
    migration_rule: 'All server modules must use the storage adapter boundary; do not hard-code database calls inside AI, lane, or route modules.',
    public_activation: 'inactive',
    provider_dispatch: 'inactive'
  };
  return readJson(manifestFile(), fallback);
}

export function storageStatus() {
  const dataDir = resolveDataDir();
  const driver = storageDriver();
  const files = STORE_FILES.map((name) => {
    const full = path.join(dataDir, name);
    return {
      name,
      exists: fs.existsSync(full),
      bytes: fs.existsSync(full) ? fs.statSync(full).size : 0
    };
  });
  return {
    ok: supportedStorageDrivers().includes(driver),
    storage_version: 'storage_adapter_v0_6_0',
    active_driver: driver,
    supported_drivers: supportedStorageDrivers(),
    data_dir: dataDir,
    database_ready: true,
    database_connected: false,
    write_mode: 'atomic_json_file_writes',
    manifest: storageManifest(),
    files,
    safety: {
      public_chat: 'inactive_until_explicit_approval',
      provider_dispatch: process.env.AI_ALLOW_PROVIDER_DISPATCH === 'true' ? 'enabled' : 'inactive',
      customer_data: 'inactive',
      payment_account_access: 'inactive',
      automatic_arche_import: 'inactive'
    },
    rule: 'JSON file storage remains the default. Database adapters may be connected later without rewriting AI routes, lanes, queue, memory, or trace logic.'
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
    storage_version: 'storage_adapter_v0_6_0',
    driver: storageDriver(),
    data_dir: resolveDataDir(),
    check_id: checkId,
    read_write_round_trip: ok ? 'passed' : 'failed',
    file: checkFile()
  };
}

export function storageMigrationPlan() {
  return {
    ok: true,
    storage_version: 'storage_adapter_v0_6_0',
    current_driver: storageDriver(),
    current_state: 'file_backed_default',
    next_database_step: 'Create a database driver that implements readJson/writeJson-compatible collection operations, then switch using AI_STORAGE_DRIVER only after tests pass.',
    collections: STORE_FILES.map((name) => name.replace(/\.json$/, '')),
    gates_before_switch: [
      'backup current data folder',
      'run npm test',
      'run /storage/check',
      'verify queue/replay still passes',
      'verify release gate still blocks unsafe release',
      'confirm owner approval before persistent production data switch'
    ]
  };
}
