import path from 'node:path';
import { resolveDataDir, readJson, writeJson, nowIso, id } from '../utils/store.js';
import { getProjectRoom } from './projectRooms.js';

const file = () => path.join(resolveDataDir(), 'transfer_requests.json');

export function listTransferRequests() {
  return readJson(file(), { transfers: [] }).transfers || [];
}

export function requestTransfer(input = {}) {
  const fromRoom = getProjectRoom(input.from_project_id || input.from_room);
  const toRoom = getProjectRoom(input.to_project_id || input.to_room);
  const blocks = [];
  if (!fromRoom) blocks.push('unknown_from_room');
  if (!toRoom) blocks.push('unknown_to_room');
  if (fromRoom && toRoom && fromRoom.project_id === toRoom.project_id) blocks.push('same_room_transfer_not_needed');

  const record = {
    transfer_id: id('transfer'),
    created_at: nowIso(),
    from_project_id: fromRoom?.project_id || input.from_project_id || input.from_room || null,
    to_project_id: toRoom?.project_id || input.to_project_id || input.to_room || null,
    requested_sources: Array.isArray(input.sources) ? input.sources : [],
    reason: String(input.reason || '').slice(0, 1000),
    status: blocks.length ? 'blocked' : 'pending_owner_approval',
    blocks,
    rule: 'Transfer is metadata-only and inactive until owner approval is explicitly recorded.'
  };

  const db = readJson(file(), { transfers: [] });
  const transfers = db.transfers || [];
  transfers.push(record);
  writeJson(file(), { transfers });
  return record;
}

export function approveTransfer(input = {}) {
  const db = readJson(file(), { transfers: [] });
  const transfers = db.transfers || [];
  const idx = transfers.findIndex((t) => t.transfer_id === input.transfer_id);
  if (idx < 0) return { ok: false, error: 'transfer_not_found' };
  transfers[idx] = {
    ...transfers[idx],
    status: input.approved === true ? 'approved_metadata_only' : 'rejected',
    owner_approval_note: String(input.note || '').slice(0, 1000),
    updated_at: nowIso()
  };
  writeJson(file(), { transfers });
  return { ok: true, transfer: transfers[idx] };
}
