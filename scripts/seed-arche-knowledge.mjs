import { initializeStorage } from '../src/servers/storage.js';
import { loadArcheSeed, seedArcheKnowledge, verifyArcheKnowledge } from '../src/servers/knowledge.js';
import { closePostgresStore } from '../src/utils/postgresStore.js';

const seed = loadArcheSeed();
const verification = verifyArcheKnowledge(seed);
if (!verification.ok) {
  console.error(JSON.stringify({ ok: false, stage: 'verification', ...verification }, null, 2));
  process.exit(1);
}
const storage = await initializeStorage();
if (!storage.ok || process.env.AI_STORAGE_DRIVER !== 'postgres') {
  console.error(JSON.stringify({ ok: false, stage: 'storage', storage, rule: 'Run with Railway service environment and AI_STORAGE_DRIVER=postgres.' }, null, 2));
  process.exit(1);
}
const result = await seedArcheKnowledge(seed, { overwrite: !process.argv.includes('--no-overwrite') });
console.log(JSON.stringify({ ...result, verification }, null, 2));
await closePostgresStore();
if (!result.ok) process.exit(1);
