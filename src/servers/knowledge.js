import fs from 'node:fs';
import path from 'node:path';
import { resolveDataDir, readJson, writeJson, nowIso } from '../utils/store.js';
import { upsertSource } from './sourceManifest.js';
import { flushPostgresWrites } from '../utils/postgresStore.js';

const knowledgeFile = () => path.join(resolveDataDir(), 'knowledge_documents.json');
const verifiedFile = () => path.join(resolveDataDir(), 'verified_sources.json');
const semanticFile = () => path.join(resolveDataDir(), 'semantic_memory_manifest.json');
const registryFile = () => path.join(resolveDataDir(), 'ai_knowledge_registry.json');

function mergeBy(items = [], incoming = [], key, overwrite = true) {
  const map = new Map(items.map((item) => [item[key], item]));
  const inserted = [];
  const updated = [];
  const skipped = [];
  for (const item of incoming) {
    const id = item?.[key];
    if (!id) continue;
    if (!map.has(id)) {
      map.set(id, item);
      inserted.push(id);
    } else if (overwrite) {
      map.set(id, { ...map.get(id), ...item, updated_at: nowIso() });
      updated.push(id);
    } else {
      skipped.push(id);
    }
  }
  return { items: [...map.values()], inserted, updated, skipped };
}

function normalizeTokens(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s.-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

export function knowledgeStatus() {
  const knowledge = readJson(knowledgeFile(), { entries: [] }).entries || [];
  const registry = readJson(registryFile(), { ais: {} });
  const byAi = {};
  for (const item of knowledge) {
    const key = item.ai_id || 'unknown';
    byAi[key] = (byAi[key] || 0) + 1;
  }
  return {
    ok: true,
    knowledge_version: 'shared_ai_knowledge_v1_6_0',
    entries: knowledge.length,
    by_ai: byAi,
    registry: registry.ais || {},
    boundary_rule: 'Knowledge is retrievable only inside its project_id and allowed AI scope.'
  };
}

export function searchKnowledge({ query = '', aiId, projectId, limit = 10 } = {}) {
  if (!aiId || !projectId) return { ok: false, error: 'ai_id_and_project_id_required', results: [] };
  const tokens = normalizeTokens(query);
  const entries = readJson(knowledgeFile(), { entries: [] }).entries || [];
  const scoped = entries.filter((entry) => entry.ai_id === aiId && entry.project_id === projectId && entry.validated === true);
  const results = scoped.map((entry) => {
    const haystack = normalizeTokens([
      entry.title,
      entry.summary,
      entry.content,
      ...(entry.keywords || [])
    ].join(' '));
    const set = new Set(haystack);
    const matched = tokens.filter((token) => set.has(token));
    const phraseBoost = query && String(entry.content || '').toLowerCase().includes(String(query).toLowerCase()) ? 5 : 0;
    return { ...entry, score: matched.length + phraseBoost, matched_terms: [...new Set(matched)] };
  }).filter((entry) => entry.score > 0 || tokens.length === 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(50, Number(limit || 10))));
  return { ok: true, query, ai_id: aiId, project_id: projectId, results };
}

export async function seedArcheKnowledge(seed, options = {}) {
  if (!seed || seed.ai_id !== 'arche' || seed.project_id !== 'room_arche_site') {
    return { ok: false, error: 'invalid_arche_seed_boundary' };
  }
  if (seed.safety?.cross_room_entries !== 0 || seed.safety?.executable_code_ingested !== false) {
    return { ok: false, error: 'unsafe_arche_seed' };
  }
  const overwrite = options.overwrite !== false;
  const sourceResults = [];
  for (const source of seed.sources || []) {
    if (source.project_room !== 'room_arche_site' || !(source.allowed_ai || []).includes('arche')) {
      return { ok: false, error: 'cross_room_source_detected', source_id: source.source_id };
    }
    sourceResults.push(upsertSource(source));
  }

  const currentKnowledge = readJson(knowledgeFile(), { entries: [] });
  const knowledgeMerge = mergeBy(currentKnowledge.entries || [], seed.knowledge_documents || [], 'knowledge_id', overwrite);
  writeJson(knowledgeFile(), { entries: knowledgeMerge.items });

  const currentVerified = readJson(verifiedFile(), { entries: [] });
  const verifiedMerge = mergeBy(currentVerified.entries || [], seed.verified_sources || [], 'memory_id', overwrite);
  writeJson(verifiedFile(), { entries: verifiedMerge.items });

  const currentSemantic = readJson(semanticFile(), { entries: [] });
  const semanticMerge = mergeBy(currentSemantic.entries || [], seed.semantic_memory_manifest || [], 'memory_id', overwrite);
  writeJson(semanticFile(), { entries: semanticMerge.items });

  const registry = readJson(registryFile(), { ais: {} });
  registry.ais = registry.ais || {};
  registry.ais.arche = {
    ai_id: 'arche',
    project_id: 'room_arche_site',
    seed_version: seed.seed_version,
    repository_commit: seed.owner_package_commit,
    owner_package_created_at: seed.owner_package_created_at,
    source_count: seed.sources?.length || 0,
    knowledge_count: seed.knowledge_documents?.length || 0,
    runtime_capability_manifest: seed.runtime_capability_manifest,
    seeded_at: nowIso(),
    status: 'active'
  };
  writeJson(registryFile(), registry);
  await flushPostgresWrites();

  return {
    ok: true,
    seed_version: seed.seed_version,
    ai_id: 'arche',
    project_id: 'room_arche_site',
    repository_commit: seed.owner_package_commit,
    sources: sourceResults.length,
    knowledge: {
      inserted: knowledgeMerge.inserted.length,
      updated: knowledgeMerge.updated.length,
      skipped: knowledgeMerge.skipped.length,
      total: knowledgeMerge.items.length
    },
    verified_sources: {
      inserted: verifiedMerge.inserted.length,
      updated: verifiedMerge.updated.length,
      skipped: verifiedMerge.skipped.length,
      total: verifiedMerge.items.length
    },
    semantic_memory: {
      inserted: semanticMerge.inserted.length,
      updated: semanticMerge.updated.length,
      skipped: semanticMerge.skipped.length,
      total: semanticMerge.items.length
    }
  };
}

export function loadArcheSeed(seedPath = path.join(process.cwd(), 'seeds', 'arche', 'arche_knowledge_seed.json')) {
  return JSON.parse(fs.readFileSync(seedPath, 'utf8'));
}

export function verifyArcheKnowledge(seed) {
  const problems = [];
  if (seed.ai_id !== 'arche') problems.push('wrong_ai_id');
  if (seed.project_id !== 'room_arche_site') problems.push('wrong_project_id');
  if (seed.owner_package_commit !== '10413707310d46417654f22ebb770fb307c9176b') problems.push('unexpected_repository_commit');
  for (const source of seed.sources || []) {
    if (source.project_room !== 'room_arche_site') problems.push(`wrong_room:${source.source_id}`);
    if (!(source.allowed_ai || []).includes('arche')) problems.push(`arche_not_allowed:${source.source_id}`);
    if (source.validated !== true) problems.push(`unvalidated_source:${source.source_id}`);
  }
  for (const entry of seed.knowledge_documents || []) {
    if (entry.project_id !== 'room_arche_site' || entry.ai_id !== 'arche') problems.push(`knowledge_boundary:${entry.knowledge_id}`);
    if (entry.validated !== true || !entry.source_id || !entry.content_sha256) problems.push(`knowledge_validation:${entry.knowledge_id}`);
  }
  if (seed.safety?.executable_code_ingested !== false) problems.push('executable_code_ingested');
  return {
    ok: problems.length === 0,
    seed_version: seed.seed_version,
    sources: seed.sources?.length || 0,
    knowledge_documents: seed.knowledge_documents?.length || 0,
    runtime_modules_indexed: seed.runtime_capability_manifest?.modules?.length || 0,
    problems
  };
}
