import { classifyRequest, explainRoute } from './servers/router.js';
import { runPrimaryAi } from './ais/index.js';
import { runLanes } from './lanes/index.js';
import { scanPublicBoundary, redactForPublic } from './servers/publicBoundary.js';
import { listProjectRooms } from './servers/projectRooms.js';
import { listSources } from './servers/sourceManifest.js';
import { listErrors } from './servers/errorLedger.js';
import { scoreQuality } from './servers/quality.js';
import { checkContamination } from './servers/contamination.js';
import { recordDecision } from './servers/decisionHistory.js';
import { buildContract } from './servers/contracts.js';
import { createTrace, appendTraceEvent, finalizeTrace } from './servers/trace.js';
import { storageStatus } from './servers/storage.js';
import { queueAdapterStatus } from './servers/queueAdapter.js';
import { r2StorageStatus } from './servers/r2Storage.js';
import { providerStatus, costStatus } from './servers/providerGate.js';

export function health() {
  return {
    ok: true,
    service: 'mtthorne-internal-ai-server',
    version: '1.5.0',
    primary_ai_count: 4,
    round_table_lane_count: 7,
    total_operating_seats: 11,
    public_chat: process.env.AI_PUBLIC_MODE === 'true' ? 'enabled' : 'inactive_until_explicit_approval',
    provider_dispatch: process.env.AI_ALLOW_PROVIDER_DISPATCH === 'true' ? 'enabled' : 'inactive',
    rooms: listProjectRooms().length,
    sources: listSources().length,
    active_errors: listErrors().filter((e) => e.status === 'active').length,
    contract_layer: 'typed_message_contract_v0_4_0',
    trace_layer: 'trace_log_v0_5_0',
    memory_layer: 'memory_layers_v0_4_0',
    release_gate: 'release_gate_v0_4_0',
    queue_layer: 'durable_queue_lifecycle_v0_5_1',
    workflow_layer: 'replayable_workflows_v0_5_1',
    storage_layer: 'storage_adapter_v1_5_0',
    storage_driver: storageStatus().active_driver,
    queue_adapter_layer: 'queue_adapter_v0_7_0',
    queue_driver: queueAdapterStatus().active_driver,
    object_storage_layer: 'r2_adapter_v0_8_0',
    object_storage_driver: r2StorageStatus().active_driver,
    deployment_readiness_layer: 'deployment_readiness_v0_8_0',
    provider_gate_layer: 'provider_dispatch_gate_v1_1_0',
    provider_dispatch_gate: providerStatus().provider_dispatch,
    cost_gate_layer: 'cost_gate_v1_0_0',
    owner_approval_layer: 'owner_approval_gate_v1_0_0',
    deployment_profile_layer: 'existing_services_profile_v1_0_0',
    stable_sidecar_layer: 'stable_internal_sidecar_v1_1_0',
    emergency_stop: costStatus().emergency_stop,
    ava_gateway_layer: 'ava_gateway_v1_4_0',
    arche_live_bridge_layer: 'arche_live_bridge_v1_1_0',
    r2_live_driver_layer: 'r2_live_driver_v1_1_0'
  };
}

export function decide(input = {}) {
  const contract = buildContract(input);
  const envelope = contract.envelope;
  const trace = createTrace({ ...input, ...envelope }, 'decision_started');
  const normalizedInput = {
    ...input,
    request: envelope.payload.request,
    project_id: envelope.project_id,
    risk_tier: envelope.risk_tier,
    speed_mode: envelope.speed_mode,
    request_id: envelope.request_id,
    trace_id: envelope.trace_id,
    source_policy: envelope.source_policy,
    contract: envelope
  };

  if (!contract.ok) {
    appendTraceEvent(trace.trace_id, 'contract_blocked', { blocks: contract.blocks });
    const blocked = {
      ok: false,
      contract,
      trace: { trace_id: trace.trace_id, request_id: trace.request_id },
      route: null,
      contamination: null,
      preflight: null,
      output: null,
      review: null,
      quality_report: { score: 0, status: 'fail', scores: {} },
      blocks: contract.blocks,
      handoff: 'blocked_or_needs_revision'
    };
    if (input.record_history !== false) blocked.history = recordDecision(normalizedInput, blocked);
    finalizeTrace(trace.trace_id, 'blocked', { handoff: blocked.handoff, blocks: blocked.blocks });
    return blocked;
  }

  const route = classifyRequest(normalizedInput);
  appendTraceEvent(trace.trace_id, 'route_selected', { selected_ai: route.primary_ai, project_room: route.project_room, mode: route.mode });
  const contamination = checkContamination({
    ...normalizedInput,
    project_id: route.project_room,
    requested_sources: input.sources || input.source_ids || input.requested_sources || []
  });
  appendTraceEvent(trace.trace_id, 'contamination_checked', { ok: contamination.ok, blocks: contamination.blocks || [] });
  const preflight = runLanes(normalizedInput, route, null);
  appendTraceEvent(trace.trace_id, 'preflight_complete', { ok: preflight.ok });
  const context = {
    contract: envelope,
    trace: { trace_id: trace.trace_id, request_id: trace.request_id },
    route: explainRoute(route),
    preflight_lanes: preflight.lanes,
    contamination
  };
  const aiOutput = runPrimaryAi(route.primary_ai, normalizedInput, context);
  const review = runLanes(normalizedInput, route, aiOutput);
  appendTraceEvent(trace.trace_id, 'review_complete', { ok: review.ok });
  const boundary = scanPublicBoundary(aiOutput);
  const qualityReport = scoreQuality({
    route,
    boundary,
    sourceAccess: preflight?.lanes?.source_lock?.source_access,
    repeatRisk: review?.lanes?.error_ledger,
    output: aiOutput
  });
  appendTraceEvent(trace.trace_id, 'quality_scored', { score: qualityReport.score, status: qualityReport.status });
  const finalOutput = input.public_response ? redactForPublic(aiOutput) : aiOutput;
  const result = {
    ok: preflight.ok && review.ok && boundary.ok && contamination.ok && qualityReport.status !== 'fail',
    contract,
    trace: { trace_id: trace.trace_id, request_id: trace.request_id },
    route: explainRoute(route),
    contamination,
    preflight,
    output: finalOutput,
    review,
    quality_report: qualityReport,
    blocks: [...(contract.blocks || []), ...(boundary.blocks || []), ...(contamination.blocks || [])],
    warnings: [...(contract.warnings || [])],
    handoff: boundary.ok && review.ok && contamination.ok ? 'usable_internal_handoff' : 'blocked_or_needs_revision'
  };
  if (input.record_history !== false) result.history = recordDecision(normalizedInput, result);
  appendTraceEvent(trace.trace_id, 'decision_finished', { ok: result.ok, handoff: result.handoff });
  finalizeTrace(trace.trace_id, result.ok ? 'completed' : 'blocked', { handoff: result.handoff, blocks: result.blocks || [] });
  return result;
}
