import path from 'node:path';
import { resolveDataDir, readJson, writeJson, nowIso, id, queueDriver, supportedQueueDrivers, futureQueueDrivers } from '../utils/store.js';
import { listJobs, enqueueJob, processJob, replayJob } from './queue.js';

const checkFile = () => path.join(resolveDataDir(), '.queue_adapter_check.json');
const queueFile = () => path.join(resolveDataDir(), 'work_queue.json');

export function queueAdapterStatus() {
  const driver = queueDriver();
  const supported = supportedQueueDrivers();
  const activeSupported = supported.includes(driver);
  return {
    ok: activeSupported,
    queue_adapter_version: 'queue_adapter_v0_7_0',
    active_driver: driver,
    supported_drivers: supported,
    future_drivers: futureQueueDrivers(),
    redis_ready_boundary: true,
    redis_connected: false,
    redis_activation: 'inactive_until_explicit_owner_approval_and_tests',
    current_mode: driver === 'json_file' ? 'json_file_queue_default' : 'unsupported_driver_requested',
    queue_file: queueFile(),
    recent_jobs_available: true,
    replay_auto_process_default: true,
    safety: {
      public_chat: 'inactive_until_explicit_approval',
      provider_dispatch: process.env.AI_ALLOW_PROVIDER_DISPATCH === 'true' ? 'enabled' : 'inactive',
      customer_data: 'inactive',
      payment_account_access: 'inactive',
      automatic_arche_import: 'inactive'
    },
    rule: 'Queue modules must use queue adapter boundaries. Redis Streams may be connected later without changing AI, lane, release, trace, or memory behavior.'
  };
}

export function queueAdapterCheck() {
  const checkId = id('queue_adapter_check');
  const beforeCount = listJobs(100000).length;
  const payload = {
    check_id: checkId,
    created_at: nowIso(),
    driver: queueDriver(),
    purpose: 'Verify queue adapter enqueue/process/replay path without provider dispatch or public activation.'
  };
  writeJson(checkFile(), payload);
  const readBack = readJson(checkFile(), null);

  const job = enqueueJob({
    request: 'Queue adapter self-check Janitor workflow.',
    project_id: 'room_janitor_client_reply',
    priority: 'normal',
    risk_tier: 'medium',
    speed_mode: 'balanced',
    source: 'queue_adapter_check'
  });
  const processed = processJob(job.queue_id);
  const replay = replayJob(job.queue_id, { force: true });
  const afterCount = listJobs(100000).length;

  const ok = readBack?.check_id === checkId && processed.ok === true && replay.ok === true && replay.auto_processed === true && replay.job?.status === 'completed';
  return {
    ok,
    queue_adapter_version: 'queue_adapter_v0_7_0',
    driver: queueDriver(),
    check_id: checkId,
    read_write_round_trip: readBack?.check_id === checkId ? 'passed' : 'failed',
    enqueue_process_round_trip: processed.ok === true && processed.job?.status === 'completed' ? 'passed' : 'failed',
    replay_auto_process_round_trip: replay.ok === true && replay.auto_processed === true && replay.job?.status === 'completed' ? 'passed' : 'failed',
    original_queue_id: job.queue_id,
    replay_queue_id: replay.replay_queue_id || null,
    jobs_before: beforeCount,
    jobs_after: afterCount,
    file: checkFile()
  };
}

export function queueAdapterMigrationPlan() {
  return {
    ok: true,
    queue_adapter_version: 'queue_adapter_v0_7_0',
    current_driver: queueDriver(),
    current_state: 'json_file_queue_default',
    target_future_driver: 'redis_streams',
    redis_stream_design: {
      stream_names: [
        'mtthorne:queue:jobs',
        'mtthorne:queue:completed',
        'mtthorne:queue:dead_letter',
        'mtthorne:events:signals'
      ],
      consumer_groups: [
        'internal-ai-workers',
        'round-table-reviewers',
        'bridge-export-workers'
      ],
      message_contract: [
        'queue_id',
        'request_id',
        'trace_id',
        'project_id',
        'risk_tier',
        'speed_mode',
        'priority',
        'payload_ref',
        'created_at'
      ],
      payload_rule: 'Do not put large artifacts, raw owner records, API keys, provider payloads, customer records, or payment data directly into queue messages. Store bulky/private payloads in approved storage and pass IDs only.'
    },
    gates_before_switch: [
      'backup current data folder',
      'run npm test',
      'run /storage/check',
      'run /queue/adapter/check',
      'verify queue/replay auto-process still passes',
      'verify dead-letter visibility still works',
      'verify trace finalization remains clean',
      'verify release gate still blocks unsafe release',
      'confirm owner approval before enabling Redis or any persistent production queue'
    ],
    activation_rule: 'AI_QUEUE_DRIVER=redis_streams must remain unsupported until a real Redis client, credentials, TLS/RBAC plan, backup/recovery plan, and test suite are added and verified.'
  };
}
