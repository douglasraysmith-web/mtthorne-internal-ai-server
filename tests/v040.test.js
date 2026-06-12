import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContract } from '../src/servers/contracts.js';
import { decide, health } from '../src/orchestrator.js';
import { memoryStatus, addMemory } from '../src/servers/memory.js';
import { releaseCheck } from '../src/servers/releaseGate.js';
import { listTraces, getTrace } from '../src/servers/trace.js';

test('v0.4.0 health exposes contract, trace, memory, and release layers', () => {
  const h = health();
  assert.ok(['0.5.0','0.5.1','0.6.0','0.7.0','0.8.0','0.9.0','0.9.0','0.9.0','0.9.0','1.0.0','1.0.1','1.1.0','1.5.0','1.6.0','1.7.0'].includes(h.version));
  assert.equal(h.contract_layer, 'typed_message_contract_v0_4_0');
  assert.equal(h.trace_layer, 'trace_log_v0_5_0');
  assert.equal(h.memory_layer, 'memory_layers_v0_4_0');
  assert.equal(h.release_gate, 'release_gate_v0_4_0');
});

test('v0.4.0 typed contract normalizes and validates requests', () => {
  const contract = buildContract({ request: 'Build a release-safe bridge summary.', project_id: 'room_arche_site' });
  assert.equal(contract.ok, true);
  assert.equal(contract.envelope.contract_version, 'typed_message_contract_v0_4_0');
  assert.ok(contract.envelope.request_id.startsWith('req_'));
  assert.ok(contract.envelope.trace_id.startsWith('trace_'));
});

test('v0.4.0 high risk requests use round table lanes', () => {
  const result = decide({ request: 'Prepare deploy production release without exposing provider payload.', project_id: 'room_arche_site', record_history: false });
  assert.equal(result.contract.ok, true);
  assert.equal(result.route.mode, 'round_table_reviewed');
  assert.equal(result.route.lanes.length, 7);
  assert.ok(result.trace.trace_id.startsWith('trace_'));
});

test('v0.4.0 trace log records decision events', () => {
  const result = decide({ request: 'Simple ArchE status check.', project_id: 'room_arche_site', record_history: false });
  const trace = getTrace(result.trace.trace_id);
  assert.ok(trace);
  assert.ok((trace.events || []).some((event) => event.event === 'decision_finished'));
  assert.ok(listTraces(10).length >= 1);
});

test('v0.4.0 memory blocks unvalidated long-term writes', () => {
  const blocked = addMemory('semantic_memory_manifest', { project_id: 'room_arche_site', summary: 'Unvalidated source.' });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.blocks.includes('long_term_memory_requires_validation'));
  const status = memoryStatus();
  assert.equal(status.memory_version, 'memory_layers_v0_4_0');
});

test('v0.4.0 memory accepts validated long-term writes', () => {
  const accepted = addMemory('verified_sources', { project_id: 'room_arche_site', source_id: 'arche_master_source_v1_3', summary: 'Canonical ArchE source pointer.', validated: true });
  assert.equal(accepted.ok, true);
  assert.ok(accepted.entry.memory_id.startsWith('mem_'));
});

test('v0.4.0 release gate requires owner approval even when checks pass', () => {
  const result = releaseCheck({ request: 'Prepare release check for internal bridge only.', project_id: 'room_arche_site', record_history: false });
  assert.equal(result.release_gate_version, 'release_gate_v0_4_0');
  assert.equal(result.release_ready, false);
  assert.ok(result.warnings.includes('owner_approval_required_before_public_or_runtime_release'));
});
