import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSourceAccess } from '../src/servers/sourceManifest.js';
import { assertRoomBoundary } from '../src/servers/projectRooms.js';

test('source access allows ArchE master source for ArchE room', () => {
  const result = validateSourceAccess({ aiId: 'arche', projectRoom: 'room_arche_site', sourceIds: ['arche_master_source_v1_3'] });
  assert.equal(result.ok, true);
});

test('room boundary blocks forbidden source', () => {
  const result = assertRoomBoundary('room_arche_site', ['customer_records']);
  assert.equal(result.ok, false);
});
