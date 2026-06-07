import { id, nowIso } from '../utils/store.js';

const allowedRisk = new Set(['low', 'medium', 'high', 'release', 'blocked']);
const allowedSpeed = new Set(['fast', 'balanced', 'deep', 'round_table']);
const allowedSourcePolicy = new Set(['room_only', 'approved_sources_only', 'owner_approved_transfer', 'public_only']);

function textOf(input = {}) {
  return String(input.request || input.text || input.message || input?.payload?.request || '').trim();
}

export function inferRiskTier(input = {}) {
  if (allowedRisk.has(input.risk_tier)) return input.risk_tier;
  const text = textOf(input).toLowerCase();
  const joined = JSON.stringify(input).toLowerCase();
  if (/api key|secret|token|password|payment|customer data|provider payload|owner record|private project|delete|public activation|deploy|production|merge|push/.test(joined)) return 'high';
  if (/release|launch|customer-facing|publish|legal|security|billing|account/.test(joined)) return 'release';
  if (/bridge|transfer|source|file|proposal|quote|image|cover|order|support/.test(joined)) return 'medium';
  return 'low';
}

export function inferSpeedMode(input = {}, riskTier = inferRiskTier(input)) {
  if (allowedSpeed.has(input.speed_mode)) return input.speed_mode;
  if (riskTier === 'release' || riskTier === 'high') return 'round_table';
  if (riskTier === 'medium') return 'balanced';
  return 'fast';
}

export function normalizeEnvelope(input = {}) {
  const request = textOf(input);
  const risk_tier = inferRiskTier(input);
  const speed_mode = inferSpeedMode(input, risk_tier);
  const envelope = {
    contract_version: 'typed_message_contract_v0_4_0',
    request_id: input.request_id || id('req'),
    trace_id: input.trace_id || id('trace'),
    created_at: input.created_at || nowIso(),
    project_id: input.project_id || input.project_room || null,
    requested_by: input.requested_by || 'owner',
    risk_tier,
    speed_mode,
    source_policy: allowedSourcePolicy.has(input.source_policy) ? input.source_policy : 'room_only',
    requires_verification: input.requires_verification !== false,
    payload: {
      ...(input.payload && typeof input.payload === 'object' ? input.payload : {}),
      request
    },
    original: input
  };
  return envelope;
}

export function validateEnvelope(envelope = {}) {
  const blocks = [];
  const warnings = [];
  if (envelope.contract_version !== 'typed_message_contract_v0_4_0') blocks.push('invalid_contract_version');
  if (!envelope.request_id) blocks.push('missing_request_id');
  if (!envelope.trace_id) blocks.push('missing_trace_id');
  if (!envelope.project_id) blocks.push('missing_project_id');
  if (!String(envelope?.payload?.request || '').trim()) blocks.push('missing_request');
  if (!allowedRisk.has(envelope.risk_tier)) blocks.push('invalid_risk_tier');
  if (!allowedSpeed.has(envelope.speed_mode)) blocks.push('invalid_speed_mode');
  if (!allowedSourcePolicy.has(envelope.source_policy)) blocks.push('invalid_source_policy');
  if (envelope.risk_tier === 'release' && envelope.requires_verification === false) warnings.push('release_tier_should_require_verification');
  return { ok: blocks.length === 0, blocks, warnings, envelope };
}

export function buildContract(input = {}) {
  const envelope = normalizeEnvelope(input);
  return validateEnvelope(envelope);
}
