import fs from 'node:fs';
import path from 'node:path';
import { resolveDataDir, readJson, writeJson, nowIso, id } from '../utils/store.js';

const manifestFile = () => path.join(resolveDataDir(), 'r2_manifest.json');
const checkFile = () => path.join(resolveDataDir(), '.r2_adapter_check.json');

export function r2ConfigStatus() {
  const required = ['R2_ACCOUNT_ID', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
  const present = Object.fromEntries(required.map((key) => [key, Boolean(process.env[key])]));
  const missing = required.filter((key) => !process.env[key]);
  return { present, missing, complete: missing.length === 0 };
}

export function r2Manifest() {
  const fallback = {
    object_storage_version: 'r2_adapter_v0_8_0',
    active_driver: 'local_manifest',
    available_drivers: ['local_manifest'],
    future_drivers: ['cloudflare_r2_s3_compatible'],
    bucket_policy: 'Store artifacts, bridge archives, approved source packets, backups, and package exports by ID. Do not store secrets or unapproved raw private records.',
    payload_rule: 'Queue messages and bridge payloads should pass object IDs/pointers, not large artifacts or secrets.',
    public_activation: 'inactive',
    provider_dispatch: 'inactive'
  };
  return readJson(manifestFile(), fallback);
}

export function r2StorageStatus() {
  const cfg = r2ConfigStatus();
  return {
    ok: true,
    object_storage_version: 'r2_adapter_v0_8_0',
    active_driver: 'local_manifest',
    supported_drivers: ['local_manifest'],
    future_drivers: ['cloudflare_r2_s3_compatible'],
    r2_ready_boundary: true,
    r2_connected: false,
    r2_config_present: cfg.complete,
    r2_config_missing: cfg.missing,
    r2_activation: 'inactive_until_explicit_owner_approval_and_tests',
    current_mode: 'local_manifest_default',
    manifest: r2Manifest(),
    safety: {
      public_chat: 'inactive_until_explicit_approval',
      provider_dispatch: process.env.AI_ALLOW_PROVIDER_DISPATCH === 'true' ? 'enabled' : 'inactive',
      customer_data: 'inactive',
      payment_account_access: 'inactive',
      automatic_arche_import: 'inactive'
    },
    rule: 'Use R2 through the object-storage adapter boundary only. Do not hard-code R2 calls inside AI, lane, route, queue, trace, memory, or release modules.'
  };
}

export function r2StorageCheck() {
  const checkId = id('r2_adapter_check');
  const payload = {
    check_id: checkId,
    created_at: nowIso(),
    driver: 'local_manifest',
    purpose: 'Verify object-storage adapter boundary without sending data to R2.'
  };
  writeJson(checkFile(), payload);
  const readBack = readJson(checkFile(), null);
  const ok = readBack?.check_id === checkId;
  return {
    ok,
    object_storage_version: 'r2_adapter_v0_8_0',
    driver: 'local_manifest',
    read_write_round_trip: ok ? 'passed' : 'failed',
    r2_network_call: 'not_performed',
    r2_connected: false,
    check_id: checkId,
    file: checkFile()
  };
}

export function r2StorageMigrationPlan() {
  return {
    ok: true,
    object_storage_version: 'r2_adapter_v0_8_0',
    current_driver: 'local_manifest',
    current_state: 'local_object_manifest_default',
    target_future_driver: 'cloudflare_r2_s3_compatible',
    r2_design: {
      bucket_uses: [
        'bridge_payload_archives',
        'approved_source_packets',
        'artifact_exports',
        'package_backups',
        'large_job_payloads_by_reference'
      ],
      key_prefixes: [
        'bridge/',
        'sources/approved/',
        'artifacts/',
        'backups/',
        'jobs/payloads/'
      ],
      pointer_contract: [
        'object_id',
        'bucket',
        'key',
        'content_type',
        'sha256',
        'created_at',
        'project_id',
        'visibility',
        'source_authority'
      ],
      payload_rule: 'Do not put raw owner records, API keys, provider payloads, customer records, payment records, or unapproved private files in public-accessible objects.'
    },
    gates_before_switch: [
      'backup current data folder',
      'run npm test',
      'run /storage/check',
      'run /queue/adapter/check',
      'run /r2/check',
      'verify R2 credentials are stored only in Railway environment variables or approved secret storage',
      'verify private bucket / no public object access unless explicitly intended',
      'verify object IDs never expose secrets or owner-private content',
      'confirm owner approval before enabling any real R2 write path'
    ],
    activation_rule: 'AI_OBJECT_STORAGE_DRIVER=r2 must remain unsupported until a real S3-compatible client, credentials, bucket policy, object lifecycle plan, and tests are added and verified.'
  };
}
