import path from 'node:path';
import { resolveDataDir, readJson, writeJson, nowIso } from '../utils/store.js';

const file = () => path.join(resolveDataDir(), 'project_rooms.json');

export function listProjectRooms() {
  return readJson(file(), { rooms: [] }).rooms || [];
}

export function getProjectRoom(projectId) {
  return listProjectRooms().find((room) => room.project_id === projectId) || null;
}

export function upsertProjectRoom(room) {
  const db = readJson(file(), { rooms: [] });
  const rooms = db.rooms || [];
  const idx = rooms.findIndex((existing) => existing.project_id === room.project_id);
  const record = { ...room, updated_at: nowIso() };
  if (idx >= 0) rooms[idx] = { ...rooms[idx], ...record };
  else rooms.push({ ...record, created_at: nowIso() });
  writeJson(file(), { rooms });
  return record;
}

export function assertRoomBoundary(projectId, requestedSourceIds = []) {
  const room = getProjectRoom(projectId);
  if (!room) return { ok: false, reason: `Unknown project room: ${projectId}` };
  const allowed = new Set(room.allowed_sources || []);
  const forbidden = new Set(room.forbidden_sources || []);
  const forbiddenHit = requestedSourceIds.find((source) => forbidden.has(source));
  if (forbiddenHit) return { ok: false, reason: `Forbidden source requested: ${forbiddenHit}` };
  const unapproved = requestedSourceIds.find((source) => !allowed.has(source));
  if (unapproved) return { ok: false, reason: `Source not approved for room ${projectId}: ${unapproved}` };
  return { ok: true, room };
}
