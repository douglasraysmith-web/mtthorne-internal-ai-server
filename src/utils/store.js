import fs from 'node:fs';
import path from 'node:path';

export function resolveDataDir() {
  return path.resolve(process.env.AI_DATA_DIR || path.join(process.cwd(), 'data'));
}

export function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function storageDriver() {
  const requested = String(process.env.AI_STORAGE_DRIVER || 'json_file').toLowerCase();
  if (['json', 'json_file', 'file'].includes(requested)) return 'json_file';
  return requested;
}

export function supportedStorageDrivers() {
  return ['json_file'];
}

export function queueDriver() {
  const requested = String(process.env.AI_QUEUE_DRIVER || 'json_file').toLowerCase();
  if (['json', 'json_file', 'file', 'local'].includes(requested)) return 'json_file';
  if (['redis', 'redis_streams', 'redis-streams'].includes(requested)) return 'redis_streams';
  return requested;
}

export function supportedQueueDrivers() {
  return ['json_file'];
}

export function futureQueueDrivers() {
  return ['redis_streams'];
}

function assertSupportedDriver() {
  const driver = storageDriver();
  if (!supportedStorageDrivers().includes(driver)) {
    throw new Error(`Unsupported AI_STORAGE_DRIVER: ${driver}. Supported now: ${supportedStorageDrivers().join(', ')}. Database adapters are scaffolded but not active.`);
  }
}

export function readJson(filePath, fallback) {
  assertSupportedDriver();
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    return { ...fallback, _read_error: String(error?.message || error) };
  }
}

export function writeJson(filePath, value) {
  assertSupportedDriver();
  ensureDir(path.dirname(filePath));
  const temp = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2));
  fs.renameSync(temp, filePath);
}

export function nowIso() {
  return new Date().toISOString();
}

export function id(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
