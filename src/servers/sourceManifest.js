import path from 'node:path';
import { resolveDataDir, readJson, writeJson, nowIso } from '../utils/store.js';

const file = () => path.join(resolveDataDir(), 'source_manifest.json');

export function listSources() {
  return readJson(file(), { sources: [] }).sources || [];
}

export function getSource(sourceId) {
  return listSources().find((source) => source.source_id === sourceId) || null;
}

export function sourcesForRoom(projectRoom) {
  return listSources().filter((source) => source.project_room === projectRoom);
}

export function upsertSource(source) {
  const db = readJson(file(), { sources: [] });
  const sources = db.sources || [];
  const idx = sources.findIndex((existing) => existing.source_id === source.source_id);
  const record = { ...source, updated_at: nowIso() };
  if (idx >= 0) sources[idx] = { ...sources[idx], ...record };
  else sources.push({ ...record, created_at: nowIso() });
  writeJson(file(), { sources });
  return record;
}

export function validateSourceAccess({ aiId, projectRoom, sourceIds = [] }) {
  const sources = listSources();
  const report = [];
  for (const sourceId of sourceIds) {
    const source = sources.find((s) => s.source_id === sourceId);
    if (!source) report.push({ sourceId, ok: false, reason: 'unknown_source' });
    else if (source.project_room !== projectRoom) report.push({ sourceId, ok: false, reason: 'wrong_project_room' });
    else if (!(source.allowed_ai || []).includes(aiId)) report.push({ sourceId, ok: false, reason: 'ai_not_allowed' });
    else if (source.status !== 'active' && source.status !== 'approved') report.push({ sourceId, ok: false, reason: `source_status_${source.status}` });
    else report.push({ sourceId, ok: true });
  }
  return { ok: report.every((r) => r.ok), report };
}
