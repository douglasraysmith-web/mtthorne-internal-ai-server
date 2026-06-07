import path from 'node:path';
import { resolveDataDir, readJson, writeJson, nowIso, id } from '../utils/store.js';
import { decide } from '../orchestrator.js';

const file = () => path.join(resolveDataDir(), 'work_queue.json');
const DEAD = new Set(['failed', 'dead_letter']);

function readQueue() {
  return readJson(file(), { jobs: [] });
}

function writeQueue(db) {
  writeJson(file(), db);
}

function updateJob(queueId, patch) {
  const db = readQueue();
  const jobs = db.jobs || [];
  const idx = jobs.findIndex((job) => job.queue_id === queueId);
  if (idx < 0) return null;
  jobs[idx] = { ...jobs[idx], ...patch, updated_at: nowIso() };
  writeQueue({ jobs });
  return jobs[idx];
}

function classifyResultStatus(result) {
  if (!result?.ok) return result?.handoff === 'needs_owner_review' ? 'needs_owner_review' : 'blocked';
  if (result?.release_ready === false || result?.warnings?.includes?.('owner_approval_required_before_public_or_runtime_release')) return 'needs_owner_review';
  return 'completed';
}

export function listJobs(limit = 50) {
  const db = readQueue();
  return (db.jobs || []).slice(-Number(limit || 50)).reverse();
}

export function listRecentJobs(limit = 10) {
  return listJobs(limit);
}

export function listDeadLetterJobs(limit = 50) {
  const db = readQueue();
  return (db.jobs || [])
    .filter((job) => job.status === 'dead_letter' || (job.dead_letter === true) || DEAD.has(job.status))
    .slice(-Number(limit || 50))
    .reverse();
}

export function getJob(queueId) {
  return (readQueue().jobs || []).find((job) => job.queue_id === queueId) || null;
}

export function enqueueJob(input = {}) {
  const db = readQueue();
  const jobs = db.jobs || [];
  const job = {
    queue_id: id('queue'),
    created_at: nowIso(),
    updated_at: nowIso(),
    status: 'queued',
    lifecycle: ['queued'],
    priority: input.priority || 'normal',
    attempts: 0,
    max_attempts: Number(input.max_attempts || 2),
    replay_of: input.replay_of || null,
    replay_safe: true,
    project_id: input.project_id || input.project_room || null,
    request: String(input.request || input.text || input.message || '').slice(0, 2000),
    input,
    result: null,
    failed_at: null,
    failure_reason: null,
    repair_hint: null,
    dead_letter: false
  };
  jobs.push(job);
  writeQueue({ jobs });
  return job;
}

export function processJob(queueId) {
  const current = getJob(queueId);
  if (!current) return { ok: false, error: 'queue_job_not_found' };
  if (['completed', 'dead_letter'].includes(current.status)) return { ok: true, job: current, skipped: 'terminal_job' };

  const running = updateJob(queueId, {
    status: 'running',
    started_at: current.started_at || nowIso(),
    attempts: Number(current.attempts || 0) + 1,
    lifecycle: [...(current.lifecycle || []), 'running']
  });

  try {
    const result = decide(running.input || {});
    const status = classifyResultStatus(result);
    const patch = {
      status,
      completed_at: status === 'completed' ? nowIso() : null,
      blocked_at: status === 'blocked' ? nowIso() : null,
      owner_review_at: status === 'needs_owner_review' ? nowIso() : null,
      result,
      failure_reason: status === 'blocked' ? 'decision_blocked_or_needs_revision' : null,
      repair_hint: status === 'blocked' ? 'Review result.blocks, quality_report, source boundary, and contamination report before replay.' : null,
      replay_safe: status !== 'completed',
      lifecycle: [...(running.lifecycle || []), status]
    };
    const job = updateJob(queueId, patch);
    return { ok: true, job };
  } catch (error) {
    const failedAt = nowIso();
    const failed = updateJob(queueId, {
      status: 'failed',
      failed_at: failedAt,
      failure_reason: String(error?.message || error),
      repair_hint: 'Check server logs and input contract. Replay only after the failure cause is understood.',
      replay_safe: true,
      lifecycle: [...(running.lifecycle || []), 'failed']
    });
    const shouldDeadLetter = Number(failed.attempts || 0) >= Number(failed.max_attempts || 2);
    if (shouldDeadLetter) {
      const dead = updateJob(queueId, {
        status: 'dead_letter',
        dead_letter: true,
        dead_letter_at: nowIso(),
        lifecycle: [...(failed.lifecycle || []), 'dead_letter']
      });
      return { ok: false, job: dead };
    }
    return { ok: false, job: failed };
  }
}

export function replayJob(queueId, overrides = {}) {
  const original = getJob(queueId);
  if (!original) return { ok: false, error: 'queue_job_not_found' };
  if (original.replay_safe === false && overrides.force !== true) {
    return { ok: false, error: 'replay_not_safe_without_force', job: original };
  }

  const input = { ...(original.input || {}), ...(overrides.input || {}), replay_of: queueId };
  const replay = enqueueJob({
    ...input,
    replay_of: queueId,
    priority: overrides.priority || original.priority || 'normal'
  });

  updateJob(queueId, {
    replay_requested_at: nowIso(),
    replay_job_id: replay.queue_id,
    lifecycle: [...(original.lifecycle || []), 'replay_requested']
  });

  if (overrides.auto_process === false) {
    return {
      ok: true,
      original_queue_id: queueId,
      replay_queue_id: replay.queue_id,
      auto_processed: false,
      job: replay
    };
  }

  const processed = processJob(replay.queue_id);
  return {
    ok: processed.ok,
    original_queue_id: queueId,
    replay_queue_id: replay.queue_id,
    auto_processed: true,
    job: processed.job || replay,
    error: processed.error || null
  };
}
