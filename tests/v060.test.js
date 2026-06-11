import test from 'node:test';
import assert from 'node:assert/strict';
import { health } from '../src/orchestrator.js';
import { storageStatus, storageSelfCheck, storageMigrationPlan } from '../src/servers/storage.js';
import { enqueueJob, processJob, replayJob } from '../src/servers/queue.js';

test('v0.6.0 health exposes storage adapter layer', () => {
  const h = health();
  assert.ok(['0.6.0','0.7.0','0.8.0','0.9.0','0.9.0','1.0.0','1.0.1','1.1.0'].includes(h.version));
  assert.equal(h.storage_layer, 'storage_adapter_v0_6_0');
  assert.equal(h.storage_driver, 'json_file');
});

test('v0.6.0 storage status is database ready but file backed by default', () => {
  const s = storageStatus();
  assert.equal(s.ok, true);
  assert.equal(s.active_driver, 'json_file');
  assert.equal(s.database_ready, true);
  assert.equal(s.database_connected, false);
  assert.ok(s.files.some((file) => file.name === 'work_queue.json'));
});

test('v0.6.0 storage check round trips through adapter', () => {
  const check = storageSelfCheck();
  assert.equal(check.ok, true);
  assert.equal(check.read_write_round_trip, 'passed');
});

test('v0.6.0 migration plan lists collections and gates', () => {
  const plan = storageMigrationPlan();
  assert.equal(plan.ok, true);
  assert.ok(plan.collections.includes('work_queue'));
  assert.ok(plan.gates_before_switch.includes('run npm test'));
});

test('v0.6.0 queue/replay still works through storage adapter', () => {
  const job = enqueueJob({ request: 'Storage adapter queue replay test.', project_id: 'room_janitor_client_reply', risk_tier: 'medium', speed_mode: 'balanced' });
  const processed = processJob(job.queue_id);
  assert.equal(processed.ok, true);
  const replay = replayJob(processed.job.queue_id, { force: true });
  assert.equal(replay.ok, true);
  assert.equal(replay.auto_processed, true);
  assert.equal(replay.job.status, 'completed');
});
