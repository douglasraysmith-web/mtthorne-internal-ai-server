import { CONFIG } from '../config.js';
import { readJson, resolveDataDir } from '../utils/store.js';
import path from 'node:path';

const rulesFile = () => path.join(resolveDataDir(), 'decision_rules.json');

export function scanPublicBoundary(payload) {
  const text = JSON.stringify(payload || {}).toLowerCase();
  const rules = readJson(rulesFile(), { blocked_public_terms: [] });
  const hits = (rules.blocked_public_terms || []).filter((term) => text.includes(term.toLowerCase()));
  const blocks = [];
  if (hits.length) blocks.push(`Blocked public/private term(s): ${hits.join(', ')}`);
  if (CONFIG.publicMode && payload?.visibility === 'owner_only') blocks.push('Owner-only material cannot be served in public mode.');
  if (payload?.provider_dispatch === true && !CONFIG.allowProviderDispatch) blocks.push('Provider dispatch is inactive unless explicitly enabled.');
  if (payload?.public_room_creation === true && !CONFIG.allowPublicRoomCreation) blocks.push('Public room creation is inactive unless explicitly enabled.');
  if (payload?.public_source_upload === true && !CONFIG.allowPublicSourceUpload) blocks.push('Public source upload is inactive unless explicitly enabled.');
  return { ok: blocks.length === 0, blocks };
}

export function redactForPublic(payload) {
  const clone = JSON.parse(JSON.stringify(payload || {}));
  const forbiddenKeys = ['api_key', 'token', 'provider_payload', 'raw_prompt', 'owner_record', 'customer_record', 'payment_record'];
  function walk(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (forbiddenKeys.includes(key.toLowerCase())) obj[key] = '[REDACTED]';
      else walk(obj[key]);
    }
  }
  walk(clone);
  return clone;
}
