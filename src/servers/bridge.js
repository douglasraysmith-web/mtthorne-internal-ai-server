export function buildArcheBridgePayload(decisionResult = {}, input = {}) {
  return {
    bridge_version: 'arche_bridge_payload_v0_4_0',
    target: 'arche-backend',
    created_for: 'owner_only_internal_handoff',
    public_safe: decisionResult?.blocks?.length === 0,
    selected_ai: decisionResult?.route?.selected_ai || null,
    project_room: decisionResult?.route?.room || input.project_id || input.project_room || null,
    mode: decisionResult?.route?.mode || null,
    lanes: decisionResult?.route?.lanes || [],
    quality_report: decisionResult?.quality_report || null,
    contamination: decisionResult?.contamination || null,
    handoff: decisionResult?.handoff || null,
    output: decisionResult?.output || null,
    blocked_items: decisionResult?.blocks || [],
    import_rule: 'Do not import into arche-backend as public/runtime behavior until owner explicitly approves activation.'
  };
}
