import test from 'node:test';
import assert from 'node:assert/strict';
import { health } from '../src/orchestrator.js';
import { providerStatus, providerCheck, providerEstimate, providerDispatch, providerLog, approvalCheck, costStatus, setCostLimit, setEmergencyStop } from '../src/servers/providerGate.js';
import { existingServicesStatus, railwayEnvPlan, netlifyBridgeContract, stableSidecarCheck } from '../src/servers/existingServices.js';

test('v1.0.0 health exposes stable sidecar and owner approval layers', () => {
  const h = health();
  assert.ok(['1.0.0','1.0.1','1.1.0'].includes(h.version));
  assert.ok(['provider_dispatch_gate_v1_0_0','provider_dispatch_gate_v1_1_0'].includes(h.provider_gate_layer));
  assert.equal(h.cost_gate_layer, 'cost_gate_v1_0_0');
  assert.equal(h.owner_approval_layer, 'owner_approval_gate_v1_0_0');
  assert.ok(['stable_internal_sidecar_v1_0_0','stable_internal_sidecar_v1_1_0'].includes(h.stable_sidecar_layer));
});

test('v1.0.0 provider status and check do not expose keys or call network', () => {
  const s = providerStatus();
  const c = providerCheck();
  assert.ok(['provider_dispatch_gate_v1_0_0','provider_dispatch_gate_v1_1_0'].includes(s.provider_gate_version));
  assert.equal(s.key_values_exposed, false);
  assert.equal(c.network_call, 'not_performed');
  assert.equal(c.key_check.key_values_exposed, false);
});

test('v1.0.0 cost status wording matches configured values', () => {
  setCostLimit({ daily_limit_usd: 0, low_risk_auto_limit_usd: 0 });
  setEmergencyStop({ active: true });
  const s = costStatus();
  assert.equal(s.cost_gate_version, 'cost_gate_v1_0_0');
  assert.equal(s.daily_limit_usd, 0);
  assert.match(s.rule, /Configured daily limit/);
});

test('v1.0.0 approval gate requires approval for medium risk', () => {
  const estimate = providerEstimate({ provider: 'openai', request: 'test', estimated_input_tokens: 100, estimated_output_tokens: 100 });
  const denied = approvalCheck({ provider: 'openai', risk_tier: 'medium', estimate });
  assert.equal(denied.ok, false);
  const approved = approvalCheck({ provider: 'openai', risk_tier: 'medium', estimate, owner_approval_phrase: 'I_APPROVE_PROVIDER_DISPATCH' });
  assert.equal(approved.ok, true);
});

test('v1.0.0 dispatch remains blocked by default and logs attempt', async () => {
  const result = await providerDispatch({ provider: 'openai', request: 'Call provider now.', estimated_input_tokens: 100, estimated_output_tokens: 100, owner_approval_phrase: 'I_APPROVE_PROVIDER_DISPATCH' });
  assert.equal(result.status, 'blocked');
  assert.equal(result.network_call, 'not_performed');
  assert.equal(result.charged, false);
  assert.ok(result.blocks.includes('provider_dispatch_env_disabled'));
  const log = providerLog({ limit: 5 });
  assert.equal(log.ok, true);
  assert.ok(Array.isArray(log.entries));
});

test('v1.0.0 existing services profile rejects new services as requirements', () => {
  const s = existingServicesStatus();
  assert.equal(s.no_new_services_required, true);
  assert.ok(s.rejected_for_now.includes('redis_required_now'));
  assert.equal(s.services.railway.new_service, false);
});

test('v1.0.0 Railway and Netlify plans are present', () => {
  const r = railwayEnvPlan();
  assert.ok(r.required_for_private_sidecar.includes('AI_ALLOW_PROVIDER_DISPATCH=false'));
  const n = netlifyBridgeContract();
  assert.ok(n.blocked_from_public.includes('API keys'));
});

test('v1.0.0 stable sidecar check reports inactive public/provider paths', () => {
  const s = stableSidecarCheck();
  assert.equal(s.ok, true);
  assert.ok(s.still_inactive_by_design.includes('real provider network calls'));
});
