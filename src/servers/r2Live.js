import crypto from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { CONFIG } from '../config.js';
import { r2ConfigStatus } from './r2Storage.js';

function client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }
  });
}

function ownerAuthorized(input = {}) {
  return Boolean(CONFIG.ownerApprovalToken) && String(input.owner_approval_token || '') === CONFIG.ownerApprovalToken;
}

export async function r2LiveStatus({ ping = false } = {}) {
  const cfg = r2ConfigStatus();
  const base = {
    ok: true,
    version: 'r2_live_driver_v1_1_0',
    driver: CONFIG.objectStorageDriver,
    writes_enabled: CONFIG.allowR2Writes,
    config_complete: cfg.complete,
    missing: cfg.missing,
    bucket: process.env.R2_BUCKET || null,
    connected: false
  };
  if (!ping || !cfg.complete) return base;
  try {
    await client().send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET }));
    return { ...base, connected: true };
  } catch (error) {
    return { ...base, connected: false, error: String(error?.name || error?.message || error) };
  }
}

export async function putR2Object(input = {}) {
  if (CONFIG.objectStorageDriver !== 'r2') return { ok: false, error: 'r2_driver_inactive' };
  if (!CONFIG.allowR2Writes) return { ok: false, error: 'r2_writes_disabled' };
  if (!ownerAuthorized(input)) return { ok: false, error: 'owner_authorization_required' };
  const cfg = r2ConfigStatus();
  if (!cfg.complete) return { ok: false, error: 'r2_config_incomplete', missing: cfg.missing };
  const key = String(input.key || '').replace(/^\/+/, '');
  if (!key || key.includes('..')) return { ok: false, error: 'invalid_object_key' };
  const body = typeof input.body === 'string' ? input.body : JSON.stringify(input.body ?? input.data ?? {}, null, 2);
  const sha256 = crypto.createHash('sha256').update(body).digest('hex');
  await client().send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: body, ContentType: input.content_type || 'application/json', Metadata: { sha256, project_id: String(input.project_id || 'unknown') } }));
  return { ok: true, bucket: process.env.R2_BUCKET, key, sha256, bytes: Buffer.byteLength(body) };
}

export async function getR2Object(input = {}) {
  if (CONFIG.objectStorageDriver !== 'r2') return { ok: false, error: 'r2_driver_inactive' };
  if (!ownerAuthorized(input)) return { ok: false, error: 'owner_authorization_required' };
  const key = String(input.key || '').replace(/^\/+/, '');
  if (!key || key.includes('..')) return { ok: false, error: 'invalid_object_key' };
  const out = await client().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
  const text = await out.Body.transformToString();
  return { ok: true, bucket: process.env.R2_BUCKET, key, content_type: out.ContentType || null, body: text };
}
