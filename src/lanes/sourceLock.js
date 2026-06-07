import { validateSourceAccess } from '../servers/sourceManifest.js';
import { assertRoomBoundary } from '../servers/projectRooms.js';

export function sourceLockLane(input, route) {
  const sourceIds = input.source_ids || [];
  const boundary = assertRoomBoundary(route.project_room, sourceIds);
  if (!boundary.ok) return { lane: 'source_lock', ok: false, reason: boundary.reason };
  const access = validateSourceAccess({ aiId: route.primary_ai, projectRoom: route.project_room, sourceIds });
  return { lane: 'source_lock', ok: access.ok, source_access: access };
}
