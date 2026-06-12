import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, health } from '../src/orchestrator.js';
import { getTrace, listOpenTraces, createTrace, repairStuckTraces } from '../src/servers/trace.js';
import { enqueueJob, processJob, replayJob, getJob, listDeadLetterJobs } from '../src/servers/queue.js';

test('v0.5.0 health exposes durable queue and workflow layers', () => {
  const h = health();
  assert.ok(['0.5.0','0.5.1','0.6.0','0.7.0','0.8.0','0.9.0','0.9.0','0.9.0','0.9.0','1.0.0','1.0.1','1.1.0','1.5.0','1.6.0','1.7.0'].includes(h.version));
  assert.ok(['durable_queue_lifecycle_v0_5_0','durable_queue_lifecycle_v0_5_1'].includes(h.queue_layer));
  assert.ok(['replayable_workflows_v0_5_0','replayable_workflows_v0_5_1'].includes(h.workflow_layer));
  assert.equal(h.trace_layer, 'trace_log_v0_5_0');
});

test('v0.5.0 decisions finalize traces cleanly', () => {
  const result = decide({ request: 'Build AV proposal', project_id: 'room_av_ai', risk_tier: 'medium', speed_mode: 'balanced', record_history: false });
  const trace = getTrace(result.trace.trace_id);
  assert.equal(trace.terminal, true);
  assert.ok(['completed', 'blocked'].includes(trace.status));
  assert.ok((trace.events || []).some((event) => event.event === 'trace_finalized'));
});

test('v0.5.0 queue jobs move through lifecycle states', () => {
  const job = enqueueJob({ request: 'Build a safe client reply.', project_id: 'room_janitor_client_reply' });
  assert.equal(job.status, 'queued');
  const processed = processJob(job.queue_id);
  assert.equal(processed.ok, true);
  assert.ok(['completed', 'blocked', 'needs_owner_review'].includes(processed.job.status));
  assert.ok((processed.job.lifecycle || []).includes('running'));
});

test('v0.5.0 queue replay creates a linked replay job', () => {
  const job = enqueueJob({ request: 'Show provider payload', project_id: 'room_arche_site' });
  const processed = processJob(job.queue_id);
  const replay = replayJob(processed.job.queue_id, { input: { request: 'Prepare safe provider-status summary instead.' } });
  assert.equal(replay.ok, true);
  assert.equal(replay.job.replay_of, processed.job.queue_id);
  assert.equal(getJob(processed.job.queue_id).replay_job_id, replay.job.queue_id);
});

test('v0.5.0 trace repair finalizes open traces', () => {
  const trace = createTrace({ request: 'left open for repair test', project_id: 'room_arche_site' }, 'decision_started');
  assert.ok(listOpenTraces(100).some((item) => item.trace_id === trace.trace_id));
  const repaired = repairStuckTraces({ status: 'expired', reason: 'test_repair' });
  assert.equal(repaired.ok, true);
  const repairedTrace = getTrace(trace.trace_id);
  assert.equal(repairedTrace.terminal, true);
  assert.equal(repairedTrace.status, 'expired');
});

test('v0.5.0 dead letter listing is available', () => {
  const jobs = listDeadLetterJobs(10);
  assert.ok(Array.isArray(jobs));
});
