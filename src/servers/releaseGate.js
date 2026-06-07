import { decide } from '../orchestrator.js';
import { scanPublicBoundary } from './publicBoundary.js';

export function releaseCheck(input = {}) {
  const decision = input.decision_result || decide({ ...input, risk_tier: input.risk_tier || 'release', speed_mode: input.speed_mode || 'round_table', record_history: input.record_history !== false });
  const boundary = scanPublicBoundary(decision.output || {});
  const blocks = [];
  const warnings = [];
  if (!decision.ok) blocks.push('decision_not_ok');
  if (!boundary.ok) blocks.push(...(boundary.blocks || []));
  if ((decision.quality_report?.score || 0) < 90) blocks.push('quality_score_below_release_gate_90');
  if (decision.contamination && decision.contamination.ok === false) blocks.push(...(decision.contamination.blocks || ['contamination_not_ok']));
  if (input.owner_approved !== true) warnings.push('owner_approval_required_before_public_or_runtime_release');
  const release_ready = blocks.length === 0 && input.owner_approved === true;
  return {
    ok: blocks.length === 0,
    release_ready,
    release_gate_version: 'release_gate_v0_4_0',
    status: release_ready ? 'release_ready_owner_approved' : blocks.length ? 'blocked' : 'owner_review_required',
    blocks,
    warnings,
    quality_report: decision.quality_report,
    route: decision.route,
    handoff: decision.handoff,
    import_rule: 'No public/runtime activation, provider dispatch, payment/customer-data activation, or arche-backend import without explicit owner approval.'
  };
}
