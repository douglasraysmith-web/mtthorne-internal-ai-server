import test from 'node:test';
import assert from 'node:assert/strict';
import { health } from '../src/orchestrator.js';
import { enqueueJob, processJob, replayJob, getJob, listRecentJobs } from '../src/servers/queue.js';

test('v0.5.1 health exposes updated queue and workflow layers', () => {
  const h = health();
  assert.ok(['0.5.1','0.6.0','0.7.0','0.8.0','0.9.0','0.9.0','0.9.0','1.0.0','1.0.1','1.1.0','1.5.0'].includes(h.version));
  assert.equal(h.queue_layer, 'durable_queue_lifecycle_v0_5_1');
  assert.equal(h.workflow_layer, 'replayable_workflows_v0_5_1');
});

test('v0.5.1 queue recent exposes copyable job ids', () => {
  const job = enqueueJob({ request: 'Recent queue lookup test.', project_id: 'room_janitor_client_reply', auto_process: false });
  const recent = listRecentJobs(5);
  assert.ok(recent.some((item) => item.queue_id === job.queue_id));
});

test('v0.5.1 replay force auto-processes by default', () => {
  const job = enqueueJob({ request: 'Replay auto process test.', project_id: 'room_janitor_client_reply' });
  const processed = processJob(job.queue_id);
  assert.equal(processed.ok, true);
  const replay = replayJob(processed.job.queue_id, { force: true });
  assert.equal(replay.ok, true);
  assert.equal(replay.auto_processed, true);
  assert.equal(replay.job.replay_of, processed.job.queue_id);
  assert.notEqual(replay.job.status, 'queued');
  assert.ok(['completed', 'blocked', 'needs_owner_review', 'failed', 'dead_letter'].includes(replay.job.status));
});

test('v0.5.1 replay can still be queued manually when requested', () => {
  const job = enqueueJob({ request: 'Manual replay queue test.', project_id: 'room_janitor_client_reply' });
  const processed = processJob(job.queue_id);
  const replay = replayJob(processed.job.queue_id, { force: true, auto_process: false });
  assert.equal(replay.ok, true);
  assert.equal(replay.auto_processed, false);
  assert.equal(getJob(replay.replay_queue_id).status, 'queued');
});
