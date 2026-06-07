import test from 'node:test';
import assert from 'node:assert/strict';
import { archeConnectorStatus, createBridgeOutboxItem, pushBridgePayload } from '../src/servers/archeConnector.js';
import { checkContamination } from '../src/servers/contamination.js';

test('v0.4.0 connector status is manual and safe by default', async () => {
  const status = await archeConnectorStatus();
  assert.equal(status.connector_version, 'arche_sidecar_connector_v0_4_0');
  assert.equal(status.push_enabled, false);
  assert.equal(status.default_behavior, 'manual_outbox_export_not_runtime_merge');
});

test('v0.4.0 bridge export creates manual outbox item', () => {
  const item = createBridgeOutboxItem({ request: 'Prepare safe bridge payload.', project_id: 'room_arche_site', record_history: false });
  assert.ok(item.bridge_id.startsWith('bridge_'));
  assert.equal(item.status, 'queued_for_manual_import');
  assert.equal(item.import_allowed, false);
  assert.equal(item.payload.bridge_version, 'arche_bridge_payload_v0_4_0');
});

test('v0.4.0 push is blocked by default and writes to outbox', async () => {
  const result = await pushBridgePayload({ request: 'Blocked push test.', project_id: 'room_arche_site', record_history: false });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked_owner_approval_required');
  assert.ok(result.bridge_id.startsWith('bridge_'));
});

test('v0.2.1 contamination transfer format remains fixed', () => {
  const result = checkContamination({
    from_project_id: 'room_vlock_images',
    to_project_id: 'room_janitor_client_reply',
    source_id: 'approved_brand_mark',
    reason: 'Use brand image rules inside client support replies'
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.ok(result.blocks.includes('cross_room_transfer_requires_owner_approval:room_vlock_images->room_janitor_client_reply'));
});
