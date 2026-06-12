import crypto from 'node:crypto';
import { CONFIG } from '../config.js';

const BRIDGE_VERSION = 'arche_live_bridge_v1_2_0';
const INTERNAL_BRIDGE_PATH = '/api/internal-ai-bridge';

function requestId(input = {}) {
  return String(
    input.request_id ||
    input.requestId ||
    `sidecar_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  );
}

function bridgeHeaders(input = {}) {
  const token = String(
    input.bridge_token ||
    CONFIG.archeBridgeToken ||
    ''
  );

  const id = requestId(input);

  const output = {
    'content-type': 'application/json',
    'x-request-id': id
  };

  if (token) {
    output['x-arche-bridge-token'] = token;
  }

  return {
    headers: output,
    request_id: id
  };
}

export function archeLiveBridgeStatus() {
  return {
    ok: true,
    bridge_version: BRIDGE_VERSION,
    target_url: CONFIG.archeBackendUrl,
    internal_bridge_path: INTERNAL_BRIDGE_PATH,
    public_routes_disabled_for_bridge: true,
    push_enabled: CONFIG.allowArchePush,
    bridge_token_present: Boolean(CONFIG.archeBridgeToken),
    connected: false,
    note: 'The sidecar bridge uses only the authenticated ArchE internal receiver.'
  };
}

export async function pingArche() {
  const checks = [];

  try {
    const response = await fetch(
      `${CONFIG.archeBackendUrl}/health`,
      { method: 'GET' }
    );

    checks.push({
      path: '/health',
      ok: response.ok,
      status: response.status
    });
  } catch (error) {
    checks.push({
      path: '/health',
      ok: false,
      error: String(error?.message || error)
    });
  }

  /*
    A token-free OPTIONS request proves that the internal route exists
    without issuing an authenticated job.
  */
  try {
    const response = await fetch(
      `${CONFIG.archeBackendUrl}${INTERNAL_BRIDGE_PATH}`,
      { method: 'OPTIONS' }
    );

    checks.push({
      path: INTERNAL_BRIDGE_PATH,
      method: 'OPTIONS',
      ok: response.status === 204 || response.ok,
      status: response.status
    });
  } catch (error) {
    checks.push({
      path: INTERNAL_BRIDGE_PATH,
      method: 'OPTIONS',
      ok: false,
      error: String(error?.message || error)
    });
  }

  const healthOk = checks.some(
    (check) => check.path === '/health' && check.ok
  );

  const internalRouteOk = checks.some(
    (check) => check.path === INTERNAL_BRIDGE_PATH && check.ok
  );

  return {
    ...archeLiveBridgeStatus(),
    connected: healthOk && internalRouteOk,
    checks
  };
}

export async function sendToArche(input = {}) {
  if (!CONFIG.allowArchePush) {
    return {
      ok: false,
      status: 'blocked',
      error: 'arche_push_disabled'
    };
  }

  if (!CONFIG.archeBridgeToken && !input.bridge_token) {
    return {
      ok: false,
      status: 'blocked',
      error: 'arche_bridge_token_missing'
    };
  }

  const message = String(
    input.message ||
    input.request ||
    ''
  ).trim();

  if (!message) {
    return {
      ok: false,
      status: 'blocked',
      error: 'message_required'
    };
  }

  const mode = input.mode === 'full' ? 'full' : 'fast';
  const url = `${CONFIG.archeBackendUrl}${INTERNAL_BRIDGE_PATH}`;
  const headerResult = bridgeHeaders(input);

  const envelope = {
    request_id: headerResult.request_id,
    source_service: 'mtthorne-internal-ai-server',
    message,
    mode,
    project_id: input.project_id || null,
    risk_tier: input.risk_tier || 'medium',
    speed_mode: input.speed_mode || (
      mode === 'full' ? 'round_table' : 'balanced'
    )
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headerResult.headers,
      body: JSON.stringify(envelope)
    });

    const text = await response.text();

    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { text };
    }

    const authenticatedInternalResponse =
      response.ok &&
      body?.route === 'arche_internal_bridge' &&
      body?.authenticated === true &&
      body?.public_runtime_bypassed === true;

    if (response.ok && !authenticatedInternalResponse) {
      return {
        ok: false,
        status: 'invalid_bridge_response',
        error: 'authenticated_internal_response_not_confirmed',
        http_status: response.status,
        target_url: url,
        request_id: headerResult.request_id,
        response: body
      };
    }

    return {
      ok: authenticatedInternalResponse,
      status: authenticatedInternalResponse
        ? 'authenticated_arche_response_received'
        : 'arche_rejected',
      http_status: response.status,
      target_url: url,
      request_id: headerResult.request_id,
      public_route_fallback_used: false,
      response: body
    };
  } catch (error) {
    return {
      ok: false,
      status: 'bridge_network_failed',
      target_url: url,
      request_id: headerResult.request_id,
      error: String(error?.message || error)
    };
  }
}
