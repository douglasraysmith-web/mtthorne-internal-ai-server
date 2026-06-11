import { CONFIG } from '../config.js';

function headers(input = {}) {
  const h = { 'content-type': 'application/json' };
  const token = input.bridge_token || CONFIG.archeBridgeToken;
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

export function archeLiveBridgeStatus() {
  return {
    ok: true,
    bridge_version: 'arche_live_bridge_v1_1_0',
    target_url: CONFIG.archeBackendUrl,
    fast_chat_path: CONFIG.archeFastChatPath,
    full_chat_path: CONFIG.archeChatPath,
    push_enabled: CONFIG.allowArchePush,
    bridge_token_present: Boolean(CONFIG.archeBridgeToken),
    connected: false,
    note: 'Use GET /bridge/arche/live-status?ping=true to verify reachability.'
  };
}

export async function pingArche() {
  const candidates = ['/health', CONFIG.archeFastChatPath];
  const results = [];
  for (const pathname of candidates) {
    try {
      const method = pathname === '/health' ? 'GET' : 'OPTIONS';
      const r = await fetch(`${CONFIG.archeBackendUrl}${pathname}`, { method });
      results.push({ path: pathname, ok: r.ok || r.status === 204 || r.status === 405, status: r.status });
    } catch (error) {
      results.push({ path: pathname, ok: false, error: String(error?.message || error) });
    }
  }
  return { ...archeLiveBridgeStatus(), connected: results.some((r) => r.ok), checks: results };
}

export async function sendToArche(input = {}) {
  if (!CONFIG.allowArchePush) return { ok: false, status: 'blocked', error: 'arche_push_disabled' };
  const message = String(input.message || input.request || '').trim();
  if (!message) return { ok: false, error: 'message_required' };
  const path = input.mode === 'full' ? CONFIG.archeChatPath : CONFIG.archeFastChatPath;
  const url = `${CONFIG.archeBackendUrl}${path}`;
  try {
    const response = await fetch(url, { method: 'POST', headers: headers(input), body: JSON.stringify({ message }) });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { text }; }
    return { ok: response.ok, status: response.ok ? 'arche_response_received' : 'arche_rejected', http_status: response.status, target_url: url, response: body };
  } catch (error) {
    return { ok: false, status: 'bridge_network_failed', target_url: url, error: String(error?.message || error) };
  }
}
