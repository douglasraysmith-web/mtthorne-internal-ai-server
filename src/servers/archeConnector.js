import { readJson, writeJson } from '../utils/store.js';
import { decide } from '../orchestrator.js';
import { buildArcheBridgePayload } from './bridge.js';

const OUTBOX_FILE = 'bridge_outbox.json';

function nowIso() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }

function loadOutbox() {
  return readJson(OUTBOX_FILE, []);
}

function saveOutbox(items) {
  writeJson(OUTBOX_FILE, items);
  return items;
}

export function connectorConfig() {
  return {
    connector_version: 'arche_sidecar_connector_v0_4_0',
    target: 'arche-backend',
    arche_backend_url: process.env.ARCHE_BACKEND_URL || 'http://127.0.0.1:3000',
    import_path: process.env.ARCHE_IMPORT_PATH || '/internal/sidecar/import',
    push_enabled: process.env.AI_ALLOW_ARCHE_PUSH === 'true',
    public_activation: 'inactive_until_explicit_owner_approval',
    provider_dispatch: process.env.AI_ALLOW_PROVIDER_DISPATCH === 'true' ? 'enabled' : 'inactive',
    default_behavior: 'manual_outbox_export_not_runtime_merge'
  };
}

export async function archeConnectorStatus(options = {}) {
  const config = connectorConfig();
  const status = {
    ok: true,
    ...config,
    outbox_count: loadOutbox().length,
    ping: { attempted: false, ok: null, note: 'Use ?ping=true to test local arche-backend reachability.' }
  };

  if (options.ping === true || options.ping === 'true') {
    status.ping.attempted = true;
    try {
      const response = await fetch(`${config.arche_backend_url}/health`, { method: 'GET' });
      status.ping.ok = response.ok;
      status.ping.status = response.status;
    } catch (error) {
      status.ping.ok = false;
      status.ping.error = String(error?.message || error);
    }
  }

  return status;
}

export function listBridgeOutbox(limit = 50) {
  return loadOutbox().slice(0, Number(limit));
}

export function getBridgeOutboxItem(bridgeId) {
  return loadOutbox().find((item) => item.bridge_id === bridgeId) || null;
}

export function createBridgeOutboxItem(input = {}) {
  const decisionResult = input.decision_result || decide({ ...input, record_history: input.record_history !== false });
  const payload = buildArcheBridgePayload(decisionResult, input);
  const item = {
    bridge_id: id('bridge'),
    created_at: nowIso(),
    updated_at: nowIso(),
    status: 'queued_for_manual_import',
    target: 'arche-backend',
    project_id: input.project_id || payload.project_room || 'room_arche_site',
    selected_ai: payload.selected_ai,
    public_safe: payload.public_safe === true,
    import_allowed: false,
    import_rule: 'Manual review required. Do not merge into arche-backend runtime behavior without explicit owner approval.',
    payload
  };
  const items = loadOutbox();
  items.unshift(item);
  saveOutbox(items);
  return item;
}

export function markBridgeOutboxImported(input = {}) {
  const bridgeId = input.bridge_id;
  const items = loadOutbox();
  const idx = items.findIndex((item) => item.bridge_id === bridgeId);
  if (idx === -1) return { ok: false, error: 'bridge_item_not_found', bridge_id: bridgeId };
  items[idx] = {
    ...items[idx],
    updated_at: nowIso(),
    status: 'marked_imported_by_owner',
    imported_at: nowIso(),
    import_note: input.note || 'Owner marked this bridge item as imported/reviewed.'
  };
  saveOutbox(items);
  return { ok: true, item: items[idx] };
}

export async function pushBridgePayload(input = {}) {
  const config = connectorConfig();
  if (!config.push_enabled) {
    const item = createBridgeOutboxItem(input);
    return {
      ok: false,
      status: 'blocked_owner_approval_required',
      reason: 'AI_ALLOW_ARCHE_PUSH is not true. Payload was placed in manual bridge outbox instead of pushed.',
      bridge_id: item.bridge_id,
      outbox_status: item.status,
      import_rule: item.import_rule
    };
  }

  const item = input.bridge_id ? getBridgeOutboxItem(input.bridge_id) : createBridgeOutboxItem(input);
  if (!item) return { ok: false, error: 'bridge_item_not_found', bridge_id: input.bridge_id };

  const url = `${config.arche_backend_url}${config.import_path}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(item.payload)
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.ok ? 'pushed_to_arche_backend' : 'arche_backend_rejected_or_failed',
      bridge_id: item.bridge_id,
      target_url: url,
      http_status: response.status,
      response_text: text.slice(0, 2000)
    };
  } catch (error) {
    return {
      ok: false,
      status: 'push_failed',
      bridge_id: item.bridge_id,
      target_url: url,
      error: String(error?.message || error)
    };
  }
}
