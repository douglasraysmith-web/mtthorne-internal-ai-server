import path from 'node:path';
import { resolveDataDir, readJson, writeJson, nowIso, id } from '../utils/store.js';

const file = () => path.join(resolveDataDir(), 'trace_log.json');
const TERMINAL = new Set(['completed', 'failed', 'blocked', 'needs_owner_review', 'abandoned', 'expired']);

function readDb() {
  return readJson(file(), { traces: [] });
}

function writeDb(db) {
  writeJson(file(), db);
}

export function createTrace(input = {}, event = 'request_received') {
  const trace = {
    trace_id: input.trace_id || id('trace'),
    request_id: input.request_id || id('req'),
    created_at: nowIso(),
    updated_at: nowIso(),
    finalized_at: null,
    status: 'running',
    terminal: false,
    project_id: input.project_id || input.project_room || null,
    risk_tier: input.risk_tier || null,
    speed_mode: input.speed_mode || null,
    events: [
      {
        at: nowIso(),
        event,
        project_id: input.project_id || input.project_room || null,
        request_preview: String(input.request || input.text || input.message || '').slice(0, 180)
      }
    ]
  };
  const db = readDb();
  const traces = db.traces || [];
  traces.push(trace);
  writeDb({ traces });
  return trace;
}

export function appendTraceEvent(traceId, event, detail = {}) {
  if (!traceId) return null;
  const db = readDb();
  const traces = db.traces || [];
  const idx = traces.findIndex((trace) => trace.trace_id === traceId);
  if (idx < 0) return null;
  traces[idx] = {
    ...traces[idx],
    updated_at: nowIso(),
    events: [
      ...(traces[idx].events || []),
      { at: nowIso(), event, ...detail }
    ]
  };
  writeDb({ traces });
  return traces[idx];
}

export function finalizeTrace(traceId, status = 'completed', detail = {}) {
  if (!traceId) return null;
  const normalized = TERMINAL.has(status) ? status : 'failed';
  const db = readDb();
  const traces = db.traces || [];
  const idx = traces.findIndex((trace) => trace.trace_id === traceId);
  if (idx < 0) return null;
  const finishedAt = nowIso();
  traces[idx] = {
    ...traces[idx],
    updated_at: finishedAt,
    finalized_at: finishedAt,
    status: normalized,
    terminal: true,
    events: [
      ...(traces[idx].events || []),
      { at: finishedAt, event: 'trace_finalized', status: normalized, ...detail }
    ]
  };
  writeDb({ traces });
  return traces[idx];
}

export function getTrace(traceId) {
  return (readDb().traces || []).find((trace) => trace.trace_id === traceId) || null;
}

export function listTraces(limit = 50) {
  return (readDb().traces || []).slice(-Number(limit || 50)).reverse();
}

export function listOpenTraces(limit = 50) {
  return (readDb().traces || [])
    .filter((trace) => !trace.terminal && !TERMINAL.has(trace.status))
    .slice(-Number(limit || 50))
    .reverse();
}

export function repairStuckTraces({ status = 'expired', limit = 100, reason = 'manual_trace_repair' } = {}) {
  const normalized = TERMINAL.has(status) ? status : 'expired';
  const db = readDb();
  const traces = db.traces || [];
  const repaired = [];
  const finishedAt = nowIso();
  for (let i = 0; i < traces.length && repaired.length < Number(limit || 100); i += 1) {
    const trace = traces[i];
    if (trace.terminal || TERMINAL.has(trace.status)) continue;
    traces[i] = {
      ...trace,
      updated_at: finishedAt,
      finalized_at: finishedAt,
      status: normalized,
      terminal: true,
      events: [
        ...(trace.events || []),
        { at: finishedAt, event: 'trace_repaired', status: normalized, reason },
        { at: finishedAt, event: 'trace_finalized', status: normalized, reason }
      ]
    };
    repaired.push({ trace_id: trace.trace_id, previous_status: trace.status || 'running', status: normalized });
  }
  writeDb({ traces });
  return { ok: true, repaired_count: repaired.length, repaired, status: normalized, reason };
}
