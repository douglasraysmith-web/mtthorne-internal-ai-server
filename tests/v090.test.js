import test from 'node:test';
import assert from 'node:assert/strict';
import { health } from '../src/orchestrator.js';
import { providerStatus, providerCheck, providerEstimate, providerDispatch, costStatus, setCostLimit, setEmergencyStop } from '../src/servers/providerGate.js';

test('v0.9.0 health exposes provider and cost gate layers', () => {
  const h = health();
  assert.equal(h.version, '1.0.0');
  assert.equal(h.provider_gate_layer, 'provider_dispatch_gate_v1_0_0');
  assert.equal(h.cost_gate_layer, 'cost_gate_v1_0_0');
});

test('v0.9.0 provider status recognizes existing providers but keeps dispatch gated', () => {
  const s = providerStatus();
  assert.equal(s.ok, true);
  assert.equal(s.provider_gate_version, 'provider_dispatch_gate_v1_0_0');
  assert.ok(s.supported_providers.includes('openai'));
  assert.ok(s.supported_providers.includes('anthropic'));
  assert.equal(s.real_provider_calls, 'blocked_no_network_driver');
});

test('v0.9.0 provider check performs no network call and exposes key presence only', () => {
  const check = providerCheck();
  assert.equal(check.ok, true);
  assert.equal(check.network_call, 'not_performed');
  assert.equal(check.key_check.key_values_exposed, false);
});

test('v0.9.0 provider estimate returns a cost without dispatching', () => {
  const estimate = providerEstimate({ provider: 'openai', request: 'Build a client reply.', estimated_input_tokens: 1000, estimated_output_tokens: 500 });
  assert.equal(estimate.ok, true);
  assert.equal(estimate.provider, 'openai');
  assert.ok(estimate.estimated_cost_usd > 0);
  assert.equal(estimate.cost_gate_note, 'Estimate only; no provider API call performed.');
});

test('v0.9.0 provider dispatch is blocked by default', () => {
  const result = providerDispatch({ provider: 'openai', request: 'Call provider now.', estimated_input_tokens: 100, estimated_output_tokens: 100 });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.network_call, 'not_performed');
  assert.equal(result.charged, false);
  assert.ok(result.blocks.includes('provider_dispatch_env_disabled'));
});

test('v0.9.0 cost gate supports limit and emergency-stop controls', () => {
  const limit = setCostLimit({ daily_limit_usd: 1.25 });
  assert.equal(limit.ok, true);
  assert.equal(limit.daily_limit_usd, 1.25);
  const stopped = setEmergencyStop({ active: true });
  assert.equal(stopped.ok, true);
  assert.equal(stopped.emergency_stop, true);
  const status = costStatus();
  assert.equal(status.cost_gate_version, 'cost_gate_v1_0_0');
  assert.equal(status.emergency_stop, true);
});
