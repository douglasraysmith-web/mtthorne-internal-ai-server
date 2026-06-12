import { initializeStorage } from '../src/servers/storage.js';
import { loadArcheSeed, verifyArcheKnowledge, knowledgeStatus, searchKnowledge } from '../src/servers/knowledge.js';
import { closePostgresStore } from '../src/utils/postgresStore.js';

const seed = loadArcheSeed();
const packageVerification = verifyArcheKnowledge(seed);
const storage = await initializeStorage();
const status = knowledgeStatus();
const search = searchKnowledge({ query: 'ArchEAngel queue owner authentication', aiId: 'arche', projectId: 'room_arche_site', limit: 5 });
const registry = status.registry?.arche;
const liveOk = storage.ok && registry?.repository_commit === seed.owner_package_commit && status.by_ai?.arche >= seed.knowledge_count && search.results.length > 0;
console.log(JSON.stringify({ ok: packageVerification.ok && liveOk, package_verification: packageVerification, storage, status, retrieval_probe: { count: search.results.length, top: search.results.map((r) => ({ title: r.title, score: r.score, source_id: r.source_id })) } }, null, 2));
await closePostgresStore();
if (!(packageVerification.ok && liveOk)) process.exit(1);
