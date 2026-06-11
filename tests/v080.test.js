import test from 'node:test';
import assert from 'node:assert/strict';
import { health } from '../src/orchestrator.js';
import { r2StorageStatus, r2StorageCheck, r2StorageMigrationPlan } from '../src/servers/r2Storage.js';
import { deploymentReadinessStatus, deploymentReadinessCheck, deploymentReadinessPlan } from '../src/servers/deploymentReadiness.js';

test('v0.8.0 health exposes R2 and deployment readiness layers', () => {
  const h = health();
  assert.ok(['0.8.0','0.9.0','1.0.0','1.0.1','1.1.0'].includes(h.version));
  assert.equal(h.object_storage_layer, 'r2_adapter_v0_8_0');
  assert.equal(h.object_storage_driver, 'local_manifest');
  assert.equal(h.deployment_readiness_layer, 'deployment_readiness_v0_8_0');
});

test('v0.8.0 R2 adapter is ready but not connected by default', () => {
  const s = r2StorageStatus();
  assert.equal(s.ok, true);
  assert.equal(s.active_driver, 'local_manifest');
  assert.equal(s.r2_ready_boundary, true);
  assert.equal(s.r2_connected, false);
  assert.equal(s.r2_activation, 'inactive_until_explicit_owner_approval_and_tests');
});

test('v0.8.0 R2 adapter check performs local manifest round trip only', () => {
  const check = r2StorageCheck();
  assert.equal(check.ok, true);
  assert.equal(check.read_write_round_trip, 'passed');
  assert.equal(check.r2_network_call, 'not_performed');
});

test('v0.8.0 R2 migration plan uses existing services and safe object pointers', () => {
  const plan = r2StorageMigrationPlan();
  assert.equal(plan.ok, true);
  assert.equal(plan.target_future_driver, 'cloudflare_r2_s3_compatible');
  assert.ok(plan.r2_design.key_prefixes.includes('bridge/'));
  assert.ok(plan.gates_before_switch.includes('run /r2/check'));
});

test('v0.8.0 deployment readiness uses existing owned services only', () => {
  const s = deploymentReadinessStatus();
  assert.equal(s.ok, true);
  assert.equal(s.no_new_services_required_for_next_stage, true);
  assert.equal(s.owned_services.github, 'source_control_ready');
  assert.equal(s.owned_services.railway, 'backend_hosting_target_ready');
  assert.equal(s.owned_services.netlify, 'public_site_frontend_target_ready');
});

test('v0.8.0 deployment readiness check keeps provider dispatch gated', () => {
  const check = deploymentReadinessCheck();
  assert.equal(check.ok, true);
  assert.ok(check.railway_required_env.includes('AI_ALLOW_PROVIDER_DISPATCH=false'));
});

test('v0.8.0 deployment plan requires no new paid services', () => {
  const plan = deploymentReadinessPlan();
  assert.equal(plan.ok, true);
  assert.equal(plan.no_new_paid_services_required, true);
  assert.equal(plan.stages[0].stage, 'github');
});
