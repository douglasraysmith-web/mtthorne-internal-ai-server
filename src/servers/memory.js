import path from 'node:path';
import { resolveDataDir, readJson, writeJson, nowIso, id } from '../utils/store.js';

const fileFor = (layer) => path.join(resolveDataDir(), `${layer}.json`);
const layers = new Set(['working_memory', 'episodic_memory', 'semantic_memory_manifest', 'verified_sources']);

function safeLayer(layer) {
  if (!layers.has(layer)) throw new Error(`invalid_memory_layer:${layer}`);
  return layer;
}

function readLayer(layer) {
  return readJson(fileFor(safeLayer(layer)), { entries: [] });
}

function writeLayer(layer, db) {
  writeJson(fileFor(safeLayer(layer)), db);
}

export function listMemory(layer = 'working_memory', limit = 50) {
  return (readLayer(layer).entries || []).slice(-Number(limit || 50)).reverse();
}

export function addMemory(layer = 'working_memory', entry = {}) {
  const l = safeLayer(layer);
  const blocks = [];
  if ((l === 'semantic_memory_manifest' || l === 'verified_sources') && entry.validated !== true) {
    blocks.push('long_term_memory_requires_validation');
  }
  if (!entry.project_id) blocks.push('missing_project_id');
  if (!entry.summary && !entry.title && !entry.source_id) blocks.push('missing_memory_summary_or_source_id');
  if (blocks.length) {
    return { ok: false, status: 'blocked', layer: l, blocks, rule: 'Agents may not write long-term memory without validation and source attribution.' };
  }
  const db = readLayer(l);
  const entries = db.entries || [];
  const item = {
    memory_id: id('mem'),
    layer: l,
    created_at: nowIso(),
    updated_at: nowIso(),
    ttl_seconds: l === 'working_memory' ? Number(entry.ttl_seconds || 3600) : null,
    ...entry
  };
  entries.push(item);
  writeLayer(l, { entries });
  return { ok: true, entry: item };
}

export function memoryStatus() {
  return {
    ok: true,
    memory_version: 'memory_layers_v0_4_0',
    layers: {
      working_memory: { purpose: 'ephemeral task state with TTL', entries: listMemory('working_memory', 999999).length },
      episodic_memory: { purpose: 'validated summaries of completed jobs', entries: listMemory('episodic_memory', 999999).length },
      semantic_memory_manifest: { purpose: 'metadata for retrievable long-term knowledge, not raw source authority', entries: listMemory('semantic_memory_manifest', 999999).length },
      verified_sources: { purpose: 'canonical source pointers that outrank vector recall', entries: listMemory('verified_sources', 999999).length }
    },
    write_rule: 'Long-term memory writes require validation before acceptance.'
  };
}
