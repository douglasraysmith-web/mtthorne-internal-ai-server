import { resolveDataDir } from '../src/utils/store.js';
import { initializePostgresStore, migrateJsonDirectoryToPostgres, closePostgresStore } from '../src/utils/postgresStore.js';

if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
  console.error('DATABASE_URL or POSTGRES_URL is required.');
  process.exit(1);
}

const initialized = await initializePostgresStore();
if (!initialized.connected) {
  console.error(JSON.stringify({ ok: false, stage: 'initialize', ...initialized }, null, 2));
  process.exit(1);
}

const overwrite = process.argv.includes('--overwrite');
const result = await migrateJsonDirectoryToPostgres(resolveDataDir(), { overwrite });
console.log(JSON.stringify(result, null, 2));
await closePostgresStore();
process.exit(result.ok ? 0 : 1);
