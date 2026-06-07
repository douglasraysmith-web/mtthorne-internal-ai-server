import path from 'node:path';
import { resolveDataDir, readJson, writeJson, nowIso, id } from '../utils/store.js';

const file = () => path.join(resolveDataDir(), 'decision_history.json');

export function listDecisionHistory(limit = 50) {
  const db = readJson(file(), { decisions: [] });
  return (db.decisions || []).slice(-Number(limit || 50)).reverse();
}

export function recordDecision(input, result) {
  const db = readJson(file(), { decisions: [] });
  const decisions = db.decisions || [];
  const record = {
    decision_id: id('decision'),
    created_at: nowIso(),
    request: String(input?.request || input?.text || input?.message || '').slice(0, 1000),
    project_id: input?.project_id || input?.project_room || result?.route?.room || null,
    selected_ai: result?.route?.selected_ai || null,
    mode: result?.route?.mode || null,
    lanes: result?.route?.lanes || [],
    ok: result?.ok === true,
    handoff: result?.handoff || null,
    quality_score: result?.quality_report?.score || null,
    blocks: result?.blocks || []
  };
  decisions.push(record);
  writeJson(file(), { decisions });
  return record;
}
