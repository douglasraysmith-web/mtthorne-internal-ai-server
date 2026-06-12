import path from 'node:path';
import { resolveDataDir, readJson, writeJson } from '../utils/store.js';

const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 500;
const MAX_TURNS = 8;
const file = () => path.join(resolveDataDir(), 'ava_sessions.json');

function loadSessions() {
  const db = readJson(file(), { sessions: [] });
  return Array.isArray(db.sessions) ? db.sessions : [];
}

function saveSessions(items) {
  writeJson(file(), { sessions: items });
}

function cleanExpired(items, now = Date.now()) {
  const active = items.filter((value) => now - Number(value.updated_at_ms || 0) <= SESSION_TTL_MS);
  if (active.length <= MAX_SESSIONS) return active;
  return active
    .sort((a, b) => Number(a.updated_at_ms || 0) - Number(b.updated_at_ms || 0))
    .slice(active.length - MAX_SESSIONS);
}

function normalizeKey(value) {
  const text = String(value || '').trim();
  return text ? text.slice(0, 160) : 'anonymous';
}

function mergeFacts(existing = {}, incoming = {}) {
  const next = { ...existing };
  for (const [key, value] of Object.entries(incoming || {})) {
    if (value === undefined || value === null || value === '') continue;
    next[key] = Array.isArray(value)
      ? [...new Set(value.map(String))].slice(0, 12)
      : String(value).slice(0, 300);
  }
  return next;
}

function publicSession(current, key) {
  if (!current) return { session_key: key, turns: [], facts: {}, diagnostic_state: null };
  return {
    session_key: key,
    turns: [...(current.turns || [])],
    facts: { ...(current.facts || {}) },
    diagnostic_state: current.diagnostic_state ? { ...current.diagnostic_state } : null
  };
}

export function getAvaSession(sessionKey) {
  const key = normalizeKey(sessionKey);
  const sessions = cleanExpired(loadSessions());
  const current = sessions.find((item) => item.session_key === key);
  return publicSession(current, key);
}

export function updateAvaSession(sessionKey, patch = {}) {
  const key = normalizeKey(sessionKey);
  const sessions = cleanExpired(loadSessions());
  const idx = sessions.findIndex((item) => item.session_key === key);
  const current = idx >= 0 ? sessions[idx] : {
    session_key: key,
    turns: [],
    facts: {},
    diagnostic_state: null,
    created_at_ms: Date.now(),
    updated_at_ms: Date.now()
  };
  const turns = [...(current.turns || []), ...(patch.turns || [])].slice(-MAX_TURNS);
  const next = {
    ...current,
    turns,
    facts: mergeFacts(current.facts, patch.facts),
    diagnostic_state: patch.diagnostic_state ?? current.diagnostic_state,
    updated_at_ms: Date.now()
  };
  if (idx >= 0) sessions[idx] = next;
  else sessions.push(next);
  saveSessions(cleanExpired(sessions));
  return publicSession(next, key);
}

export function clearAvaSession(sessionKey) {
  const key = normalizeKey(sessionKey);
  const sessions = cleanExpired(loadSessions());
  const next = sessions.filter((item) => item.session_key !== key);
  const removed = next.length !== sessions.length;
  if (removed) saveSessions(next);
  return removed;
}

export function avaSessionStatus() {
  const sessions = cleanExpired(loadSessions());
  return {
    ok: true,
    memory_version: 'ava_session_memory_v1_1_0',
    active_sessions: sessions.length,
    ttl_minutes: SESSION_TTL_MS / 60000,
    max_turns: MAX_TURNS,
    persistence: 'shared_storage_adapter',
    active_storage_driver: process.env.AI_STORAGE_DRIVER || 'json_file',
    private_data_rule: 'Do not store payment, account, secret, credential, or full customer-record content.'
  };
}
