import path from 'node:path';
import { resolveDataDir, readJson, writeJson, nowIso, id } from '../utils/store.js';

const file = () => path.join(resolveDataDir(), 'error_ledger.json');

export function listErrors(projectRoom = null) {
  const errors = readJson(file(), { errors: [] }).errors || [];
  return projectRoom ? errors.filter((error) => error.project_room === projectRoom) : errors;
}

export function recordError(error) {
  const db = readJson(file(), { errors: [] });
  const record = {
    error_id: error.error_id || id('err'),
    status: 'active',
    created_at: nowIso(),
    ...error
  };
  db.errors = [...(db.errors || []), record];
  writeJson(file(), db);
  return record;
}

export function findRepeatRisk(text, projectRoom = null) {
  const lower = String(text || '').toLowerCase();
  const matches = listErrors(projectRoom).filter((error) => {
    const combined = [error.visible_failure, error.do_not_repeat_rule, error.carryforward_rule]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return combined.split(/\W+/).filter((word) => word.length > 5).some((word) => lower.includes(word));
  });
  return { repeatRisk: matches.length > 0, matches };
}
