import { getProjectRoom, listProjectRooms } from './projectRooms.js';

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

function firstPresent(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value);
  }
  return null;
}

function normalizeTransferSources(input = {}) {
  const values = [
    ...normalizeList(input.sources),
    ...normalizeList(input.source_ids),
    ...normalizeList(input.requested_sources),
    ...normalizeList(input.source_id)
  ];
  return [...new Set(values)];
}

export function checkContamination(input = {}) {
  const fromProjectId = firstPresent(input.from_project_id, input.from_room);
  const toProjectId = firstPresent(input.to_project_id, input.to_room);

  if (fromProjectId || toProjectId) {
    const fromRoom = getProjectRoom(fromProjectId);
    const toRoom = getProjectRoom(toProjectId);
    const requestedSources = normalizeTransferSources(input);
    const blocks = [];
    const warnings = [];

    if (!fromRoom) blocks.push(`unknown_from_room:${fromProjectId || 'missing'}`);
    if (!toRoom) blocks.push(`unknown_to_room:${toProjectId || 'missing'}`);
    if (fromRoom && toRoom && fromRoom.project_id === toRoom.project_id) blocks.push('same_room_transfer_not_needed');

    if (fromRoom && toRoom && fromRoom.project_id !== toRoom.project_id) {
      blocks.push(`cross_room_transfer_requires_owner_approval:${fromRoom.project_id}->${toRoom.project_id}`);
    }

    if (toRoom) {
      const toAllowed = new Set(toRoom.allowed_sources || []);
      const toForbidden = new Set(toRoom.forbidden_sources || []);
      for (const source of requestedSources) {
        if (toForbidden.has(source)) blocks.push(`forbidden_source_for_target:${source}`);
        else if (!toAllowed.has(source)) blocks.push(`unapproved_source_for_target:${source}`);
      }
    }

    const reason = String(input.reason || input.request || input.text || input.message || '').toLowerCase();
    const privateTerms = ['api key', 'secret', 'owner token', 'payment record', 'customer record', 'private project room', 'raw prompt'];
    for (const term of privateTerms) {
      if (reason.includes(term)) warnings.push(`private_boundary_term:${term}`);
    }

    return {
      ok: false,
      status: blocks.length ? 'blocked' : 'pending_owner_approval',
      transfer_check: true,
      from_project_id: fromProjectId,
      to_project_id: toProjectId,
      requested_sources: requestedSources,
      blocks: blocks.length ? blocks : ['cross_room_transfer_requires_owner_approval'],
      warnings,
      rule: 'Room-to-room source transfer is never automatic. It must be requested, reviewed, and explicitly owner-approved before use.'
    };
  }

  const projectId = input.project_id || input.project_room;
  const room = getProjectRoom(projectId);
  const requestedSources = normalizeTransferSources(input);
  const requestedRooms = normalizeList(input.requested_rooms || input.room_refs || input.rooms);
  const text = String(input.request || input.text || input.message || '').toLowerCase();

  if (!room) {
    return { ok: false, status: 'blocked', reason: `Unknown project room: ${projectId || 'missing'}`, blocks: ['unknown_project_room'] };
  }

  const allowed = new Set(room.allowed_sources || []);
  const forbidden = new Set(room.forbidden_sources || []);
  const blocks = [];
  const warnings = [];

  for (const source of requestedSources) {
    if (forbidden.has(source)) blocks.push(`forbidden_source:${source}`);
    else if (!allowed.has(source)) blocks.push(`unapproved_source:${source}`);
  }

  for (const otherRoom of requestedRooms) {
    if (otherRoom !== projectId) blocks.push(`cross_room_reference_requires_approval:${otherRoom}`);
  }

  for (const other of listProjectRooms()) {
    if (other.project_id !== projectId) {
      const name = String(other.project_name || '').toLowerCase();
      if (name && text.includes(name)) warnings.push(`mentions_other_room:${other.project_id}`);
    }
  }

  const privateTerms = ['api key', 'secret', 'owner token', 'payment record', 'customer record', 'private project room', 'raw prompt'];
  for (const term of privateTerms) {
    if (text.includes(term)) warnings.push(`private_boundary_term:${term}`);
  }

  return {
    ok: blocks.length === 0,
    status: blocks.length ? 'blocked' : warnings.length ? 'warn' : 'clean',
    project_id: projectId,
    active_ai: room.active_ai,
    blocks,
    warnings,
    rule: 'No room-to-room transfer or unapproved source use without explicit owner approval.'
  };
}
