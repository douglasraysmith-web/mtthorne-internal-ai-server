import test from 'node:test';
import assert from 'node:assert/strict';
import { health } from '../src/orchestrator.js';
import { queueAdapterStatus, queueAdapterCheck, queueAdapterMigrationPlan } from '../src/servers/queueAdapter.js';

test('v0.7.0 health exposes queue adapter layer', () => {
  const h = health();
  assert.ok(['0.7.0','0.8.0','0.9.0','1.0.0','1.0.1','1.1.0','1.5.0','1.6.0'].includes(h.version));
  assert.equal(h.queue_adapter_layer, 'queue_adapter_v0_7_0');
  assert.equal(h.queue_driver, 'json_file');
});

test('v0.7.0 queue adapter status is redis-ready but file backed by default', () => {
  const s = queueAdapterStatus();
  assert.equal(s.ok, true);
  assert.equal(s.active_driver, 'json_file');
  assert.equal(s.redis_ready_boundary, true);
  assert.equal(s.redis_connected, false);
  assert.equal(s.replay_auto_process_default, true);
});

test('v0.7.0 queue adapter check enqueue/process/replay works', () => {
  const check = queueAdapterCheck();
  assert.equal(check.ok, true);
  assert.equal(check.read_write_round_trip, 'passed');
  assert.equal(check.enqueue_process_round_trip, 'passed');
  assert.equal(check.replay_auto_process_round_trip, 'passed');
  assert.ok(check.original_queue_id.startsWith('queue_'));
  assert.ok(check.replay_queue_id.startsWith('queue_'));
});

test('v0.7.0 queue adapter migration plan defines redis stream gates', () => {
  const plan = queueAdapterMigrationPlan();
  assert.equal(plan.ok, true);
  assert.equal(plan.target_future_driver, 'redis_streams');
  assert.ok(plan.redis_stream_design.stream_names.includes('mtthorne:queue:jobs'));
  assert.ok(plan.gates_before_switch.includes('run /queue/adapter/check'));
});
