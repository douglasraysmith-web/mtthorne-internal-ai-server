import path from 'node:path';
import { CONFIG } from '../config.js';
import { resolveDataDir, readJson, writeJson, nowIso, id } from '../utils/store.js';
import { scanPublicBoundary } from './publicBoundary.js';
import { callProvider } from './providerNetwork.js';

const costFile = () => path.join(resolveDataDir(), 'cost_ledger.json');
const providerLogFile = () => path.join(resolveDataDir(), 'provider_dispatch_log.json');
const approvalLogFile = () => path.join(resolveDataDir(), 'owner_approval_log.json');

const DEFAULT_COST_STATE = {
  cost_gate_version: 'provider_cost_gate_v1_0_0',
  emergency_stop: true,
  daily_limit_usd: 0,
  spent_today_usd: 0,
  currency: 'USD',
  current_day: new Date().toISOString().slice(0, 10),
  owner_approval_required: true,
  low_risk_auto_limit_usd: 0,
  updated_at: null,
  events: []
};

const MODEL_ESTIMATES = {
  openai_fast: { provider: 'openai', model: 'fast_route', input_per_1k: 0.00015, output_per_1k: 0.0006 },
  openai_premium: { provider: 'openai', model: 'premium_route', input_per_1k: 0.005, output_per_1k: 0.015 },
  anthropic_fast: { provider: 'anthropic', model: 'fast_fallback_route', input_per_1k: 0.00025, output_per_1k: 0.00125 },
  anthropic_premium: { provider: 'anthropic', model: 'premium_fallback_route', input_per_1k: 0.003, output_per_1k: 0.015 }
};

function loadCostState() {
  const state = readJson(costFile(), DEFAULT_COST_STATE);
  const today = new Date().toISOString().slice(0, 10);
  if (state.current_day !== today) {
    const reset = { ...DEFAULT_COST_STATE, ...state, cost_gate_version: 'provider_cost_gate_v1_0_0', current_day: today, spent_today_usd: 0, updated_at: nowIso(), events: [...(state.events || []), { at: nowIso(), event: 'daily_cost_counter_reset' }] };
    writeJson(costFile(), reset);
    return reset;
  }
  return { ...DEFAULT_COST_STATE, ...state, cost_gate_version: 'provider_cost_gate_v1_0_0' };
}

function saveCostState(state) {
  writeJson(costFile(), { ...state, cost_gate_version: 'provider_cost_gate_v1_0_0', updated_at: nowIso() });
}

function keysPresent() {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY)
  };
}

function selectEstimateProfile(input = {}) {
  const provider = String(input.provider || '').toLowerCase();
  const tier = String(input.model_tier || input.tier || input.risk_tier || 'fast').toLowerCase();
  if (provider === 'anthropic') return tier.includes('premium') || tier.includes('high') || tier.includes('release') ? 'anthropic_premium' : 'anthropic_fast';
  if (provider === 'openai') return tier.includes('premium') || tier.includes('high') || tier.includes('release') ? 'openai_premium' : 'openai_fast';
  if (tier.includes('premium') || tier.includes('high') || tier.includes('release')) return 'openai_premium';
  return 'openai_fast';
}

function appendProviderLog(entry) {
  const log = readJson(providerLogFile(), { entries: [] });
  log.entries = [{ ...entry, at: nowIso() }, ...(log.entries || [])].slice(0, 1000);
  writeJson(providerLogFile(), log);
}

function appendApprovalLog(entry) {
  const log = readJson(approvalLogFile(), { entries: [] });
  log.entries = [{ ...entry, at: nowIso() }, ...(log.entries || [])].slice(0, 500);
  writeJson(approvalLogFile(), log);
}

export function providerStatus() {
  const keys = keysPresent();
  const cost = loadCostState();
  return {
    ok: true,
    provider_gate_version: 'provider_dispatch_gate_v1_1_0',
    provider_dispatch: CONFIG.allowProviderDispatch ? 'enabled_by_env_but_still_gated' : 'inactive',
    active_dispatch_driver: CONFIG.allowProviderNetwork ? 'network_driver_enabled_by_env_but_guarded' : 'gated_no_network_default',
    openai_key_present: keys.openai,
    anthropic_key_present: keys.anthropic,
    supported_providers: ['openai', 'anthropic'],
    real_provider_calls: CONFIG.allowProviderNetwork ? 'possible_only_after_all_gates_pass' : 'blocked_no_network_driver',
    emergency_stop: cost.emergency_stop,
    daily_limit_usd: cost.daily_limit_usd,
    spent_today_usd: cost.spent_today_usd,
    remaining_today_usd: Math.max(0, Number((Number(cost.daily_limit_usd || 0) - Number(cost.spent_today_usd || 0)).toFixed(6))),
    owner_approval_required: cost.owner_approval_required,
    owner_approval_layer: 'owner_approval_gate_v1_0_0',
    key_values_exposed: false,
    safety: {
      public_chat: 'inactive_until_explicit_approval',
      provider_dispatch: CONFIG.allowProviderDispatch ? 'env_enabled_but_still_cost_owner_boundary_gated' : 'inactive',
      provider_network: CONFIG.allowProviderNetwork ? 'env_enabled_but_not_used_without_all_gates' : 'inactive',
      customer_data: 'inactive',
      payment_account_access: 'inactive',
      automatic_arche_import: 'inactive'
    },
    rule: 'Existing OpenAI and Anthropic keys are allowed only through provider, cost, boundary, and owner-approval gates. No key values are exposed.'
  };
}

export function providerCheck() {
  const status = providerStatus();
  return {
    ok: true,
    provider_gate_version: status.provider_gate_version,
    env_dispatch_enabled: CONFIG.allowProviderDispatch,
    env_network_enabled: CONFIG.allowProviderNetwork,
    dry_run_only: CONFIG.providerDryRunOnly,
    key_check: {
      openai_key_present: status.openai_key_present,
      anthropic_key_present: status.anthropic_key_present,
      key_values_exposed: false
    },
    network_call: 'not_performed',
    gate_checks: [
      { name: 'provider_dispatch_default_off', ok: true, note: 'Dispatch requires env enablement, cost gate, boundary check, key presence, and owner approval when required.' },
      { name: 'provider_network_default_off', ok: !CONFIG.allowProviderNetwork || CONFIG.allowProviderDispatch, note: 'Network cannot be safely useful unless dispatch gate is also enabled.' },
      { name: 'emergency_stop_available', ok: true },
      { name: 'daily_cost_cap_available', ok: true },
      { name: 'public_private_boundary_available', ok: true },
      { name: 'owner_approval_gate_available', ok: true }
    ]
  };
}

export function providerEstimate(input = {}) {
  const profileKey = selectEstimateProfile(input);
  const profile = MODEL_ESTIMATES[profileKey];
  const requestText = String(input.request || input.prompt || input.text || '');
  const estimatedInputTokens = Number(input.estimated_input_tokens || Math.max(1, Math.ceil(requestText.length / 4)) || 250);
  const estimatedOutputTokens = Number(input.estimated_output_tokens || 750);
  const estimatedCostUsd = Number((((estimatedInputTokens / 1000) * profile.input_per_1k) + ((estimatedOutputTokens / 1000) * profile.output_per_1k)).toFixed(6));
  const cost = loadCostState();
  const projectedSpend = Number((Number(cost.spent_today_usd || 0) + estimatedCostUsd).toFixed(6));
  return {
    ok: true,
    estimate_version: 'provider_cost_estimate_v1_0_0',
    estimate_id: id('estimate'),
    provider: profile.provider,
    model_route: profile.model,
    profile: profileKey,
    estimated_input_tokens: estimatedInputTokens,
    estimated_output_tokens: estimatedOutputTokens,
    estimated_cost_usd: estimatedCostUsd,
    spent_today_usd: cost.spent_today_usd,
    daily_limit_usd: cost.daily_limit_usd,
    projected_spend_today_usd: projectedSpend,
    under_daily_limit: cost.daily_limit_usd > 0 && projectedSpend <= cost.daily_limit_usd,
    cost_gate_note: 'Estimate only; no provider API call performed.'
  };
}

export function approvalCheck(input = {}) {
  const cost = loadCostState();
  const estimate = input.estimate || providerEstimate(input);
  const risk = String(input.risk_tier || '').toLowerCase();
  const publicFacing = input.public_response === true || input.public_facing === true;
  const configuredToken = CONFIG.ownerApprovalToken;
  const suppliedToken = String(input.owner_approval_token || input.owner_token || '');
  const tokenOk = configuredToken ? suppliedToken === configuredToken : false;
  const phraseOk = input.owner_approved === true || input.owner_approval === true || input.owner_approval_phrase === 'I_APPROVE_PROVIDER_DISPATCH';
  const lowRiskAutoAllowed = !publicFacing && ['low', 'fast', ''].includes(risk) && Number(estimate.estimated_cost_usd || 0) <= Number(cost.low_risk_auto_limit_usd || 0);
  const required = cost.owner_approval_required || ['medium', 'high', 'release'].includes(risk) || publicFacing;
  const approved = lowRiskAutoAllowed || tokenOk || phraseOk;
  const result = {
    ok: !required || approved,
    approval_version: 'owner_approval_gate_v1_0_0',
    required,
    approved,
    low_risk_auto_allowed: lowRiskAutoAllowed,
    token_configured: Boolean(configuredToken),
    token_supplied: Boolean(suppliedToken),
    token_value_exposed: false,
    phrase_accepted: phraseOk,
    reason: !required ? 'approval_not_required_for_this_request' : approved ? 'approval_gate_passed' : 'owner_approval_required'
  };
  appendApprovalLog({ type: 'approval_check', ok: result.ok, required, approved, reason: result.reason, provider: estimate.provider, estimated_cost_usd: estimate.estimated_cost_usd });
  return result;
}

export async function providerDispatch(input = {}) {
  const estimate = providerEstimate(input);
  const cost = loadCostState();
  const boundary = scanPublicBoundary({ ...input, provider_dispatch: true });
  const approval = approvalCheck({ ...input, estimate });
  const blocks = [];
  const warnings = [];
  const keys = keysPresent();
  const providerKeyPresent = estimate.provider === 'anthropic' ? keys.anthropic : keys.openai;

  if (!CONFIG.allowProviderDispatch) blocks.push('provider_dispatch_env_disabled');
  if (!CONFIG.allowProviderNetwork) blocks.push('provider_network_driver_disabled');
  if (CONFIG.providerDryRunOnly) warnings.push('provider_dry_run_only_active');
  if (cost.emergency_stop) blocks.push('cost_gate_emergency_stop_active');
  if (!providerKeyPresent) blocks.push(`provider_key_missing:${estimate.provider}`);
  if (!estimate.under_daily_limit) blocks.push('estimated_cost_exceeds_or_daily_limit_zero');
  if (!approval.ok) blocks.push('owner_approval_required');
  if (boundary.blocks?.length) blocks.push(...boundary.blocks);

  const gatePassed = blocks.length === 0;
  const networkWillRun = gatePassed && CONFIG.allowProviderNetwork && !CONFIG.providerDryRunOnly;
  let providerResponse = null;
  let networkError = null;

  if (networkWillRun) {
    try {
      providerResponse = await callProvider({
        provider: estimate.provider,
        request: String(input.request || input.prompt || input.text || ''),
        system: String(input.system || input.instructions || 'You are a careful assistant for M.T. Thorne Publishing Company. Follow the supplied project boundary and do not expose private data.'),
        max_output_tokens: Number(input.max_output_tokens || input.estimated_output_tokens || 1200),
        model: input.model
      });
      const next = loadCostState();
      next.spent_today_usd = Number((Number(next.spent_today_usd || 0) + Number(estimate.estimated_cost_usd || 0)).toFixed(6));
      next.events = [{ at: nowIso(), event: 'provider_charge_estimate_recorded', provider: estimate.provider, estimated_cost_usd: estimate.estimated_cost_usd }, ...(next.events || [])].slice(0, 100);
      saveCostState(next);
    } catch (error) {
      networkError = String(error?.message || error);
    }
  }

  const ok = gatePassed && (!networkWillRun || Boolean(providerResponse));
  const result = {
    ok,
    provider_gate_version: 'provider_dispatch_gate_v1_1_0',
    status: !gatePassed ? 'blocked' : networkError ? 'network_failed' : networkWillRun ? 'provider_response_received' : 'dispatch_gate_passed_dry_run_only',
    provider: estimate.provider,
    model_route: estimate.model_route,
    estimate,
    approval,
    blocks,
    warnings,
    network_call: networkWillRun ? (providerResponse ? 'performed' : 'attempted_failed') : 'not_performed',
    charged: networkWillRun && Boolean(providerResponse),
    response: providerResponse,
    error: networkError
  };
  appendProviderLog({ type: 'dispatch_attempt', ok: result.ok, provider: result.provider, status: result.status, estimated_cost_usd: estimate.estimated_cost_usd, blocks, warnings, network_call: result.network_call });
  return result;
}

export function providerLog(input = {}) {
  const limit = Number(input.limit || 50);
  const log = readJson(providerLogFile(), { entries: [] });
  return { ok: true, provider_gate_version: 'provider_dispatch_gate_v1_1_0', entries: (log.entries || []).slice(0, limit) };
}

export function costStatus() {
  const cost = loadCostState();
  return {
    ok: true,
    cost_gate_version: 'cost_gate_v1_0_0',
    emergency_stop: cost.emergency_stop,
    daily_limit_usd: cost.daily_limit_usd,
    spent_today_usd: cost.spent_today_usd,
    remaining_today_usd: Math.max(0, Number((Number(cost.daily_limit_usd || 0) - Number(cost.spent_today_usd || 0)).toFixed(6))),
    low_risk_auto_limit_usd: Number(cost.low_risk_auto_limit_usd || 0),
    currency: cost.currency,
    current_day: cost.current_day,
    owner_approval_required: cost.owner_approval_required,
    provider_dispatch_env_enabled: CONFIG.allowProviderDispatch,
    provider_network_env_enabled: CONFIG.allowProviderNetwork,
    dry_run_only: CONFIG.providerDryRunOnly,
    rule: 'Configured daily limit is shown above. Emergency stop defaults on, provider dispatch defaults off, and real network calls remain disabled until explicitly approved.'
  };
}

export function setCostLimit(input = {}) {
  const amount = Number(input.daily_limit_usd ?? input.amount ?? input.limit ?? 0);
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: 'invalid_daily_limit_usd' };
  const lowRiskAuto = Number(input.low_risk_auto_limit_usd ?? input.auto_limit ?? 0);
  if (!Number.isFinite(lowRiskAuto) || lowRiskAuto < 0) return { ok: false, error: 'invalid_low_risk_auto_limit_usd' };
  const cost = loadCostState();
  const next = {
    ...cost,
    daily_limit_usd: Number(amount.toFixed(6)),
    low_risk_auto_limit_usd: Number(lowRiskAuto.toFixed(6)),
    owner_approval_required: input.owner_approval_required !== false,
    events: [{ at: nowIso(), event: 'daily_limit_updated', daily_limit_usd: Number(amount.toFixed(6)), low_risk_auto_limit_usd: Number(lowRiskAuto.toFixed(6)) }, ...(cost.events || [])].slice(0, 100)
  };
  saveCostState(next);
  return { ok: true, cost_gate_version: 'cost_gate_v1_0_0', daily_limit_usd: next.daily_limit_usd, low_risk_auto_limit_usd: next.low_risk_auto_limit_usd, owner_approval_required: next.owner_approval_required, emergency_stop: next.emergency_stop };
}

export function setEmergencyStop(input = {}) {
  const active = input.active !== undefined ? Boolean(input.active) : true;
  const cost = loadCostState();
  const next = {
    ...cost,
    emergency_stop: active,
    events: [{ at: nowIso(), event: active ? 'emergency_stop_enabled' : 'emergency_stop_disabled' }, ...(cost.events || [])].slice(0, 100)
  };
  saveCostState(next);
  return { ok: true, cost_gate_version: 'cost_gate_v1_0_0', emergency_stop: next.emergency_stop, provider_dispatch_env_enabled: CONFIG.allowProviderDispatch, provider_network_env_enabled: CONFIG.allowProviderNetwork };
}
