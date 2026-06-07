import test from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../src/orchestrator.js';
import { checkContamination } from '../src/servers/contamination.js';
import { enqueueJob, processJob, getJob } from '../src/servers/queue.js';
import { requestTransfer } from '../src/servers/transfers.js';
import { buildArcheBridgePayload } from '../src/servers/bridge.js';

test('request field routes by explicit project_id to Janitor', () => {
  const result = decide({
    request: 'A customer asks after hours about a publishing order problem and wants payment account help.',
    project_id: 'room_janitor_client_reply',
    record_history: false
  });
  assert.equal(result.route.selected_ai, 'janitor');
  assert.equal(result.route.room, 'room_janitor_client_reply');
  assert.ok(result.quality_report.score >= 60);
});

test('contamination check blocks forbidden source', () => {
  const result = checkContamination({
    project_id: 'room_vlock_images',
    sources: ['redrawn_brand_marks']
  });
  assert.equal(result.ok, false);
  assert.ok(result.blocks.some((b) => b.includes('forbidden_source')));
});

test('queue records and processes a job', () => {
  const job = enqueueJob({
    request: 'Prepare a deploy milestone without public activation.',
    project_id: 'room_arche_site',
    record_history: false
  });
  assert.equal(job.status, 'queued');
  const processed = processJob(job.queue_id);
  assert.equal(processed.ok, true);
  const saved = getJob(job.queue_id);
  assert.ok(['completed', 'blocked_or_needs_revision'].includes(saved.status));
});

test('transfer requests default to pending owner approval', () => {
  const transfer = requestTransfer({
    from_project_id: 'room_arche_site',
    to_project_id: 'room_av_ai',
    sources: ['arche_master_source_v1_3'],
    reason: 'test only'
  });
  assert.equal(transfer.status, 'pending_owner_approval');
});

test('bridge payload is owner-only and bridge-versioned', () => {
  const decision = decide({ request: 'Build AV proposal', project_id: 'room_av_ai', record_history: false });
  const payload = buildArcheBridgePayload(decision, {});
  assert.equal(payload.bridge_version, 'arche_bridge_payload_v0_4_0');
  assert.equal(payload.target, 'arche-backend');
  assert.equal(payload.selected_ai, 'av_ai');
});


test('contamination endpoint understands from-to transfer checks', () => {
  const result = checkContamination({
    from_project_id: 'room_vlock_images',
    to_project_id: 'room_janitor_client_reply',
    source_id: 'approved_brand_mark',
    reason: 'Use brand image rules inside client support replies'
  });
  assert.equal(result.ok, false);
  assert.equal(result.transfer_check, true);
  assert.ok(result.blocks.some((b) => b.includes('cross_room_transfer_requires_owner_approval')));
  assert.ok(result.blocks.some((b) => b.includes('unapproved_source_for_target')));
});
