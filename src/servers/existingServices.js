export function existingServicesStatus() {
  return {
    ok: true,
    profile_version: 'existing_services_profile_v1_0_0',
    no_new_services_required: true,
    services: {
      github: { role: 'source_control_and_rollback', required_now: true, new_service: false },
      railway: { role: 'private_internal_sidecar_backend_host', required_now: true, new_service: false },
      netlify: { role: 'public_mtthorne_frontend_boundary', required_now: true, new_service: false },
      r2_storage: { role: 'approved_object_storage_by_pointer', required_now: false, new_service: false },
      openai: { role: 'future_gated_provider_route', required_now: false, new_service: false },
      anthropic: { role: 'future_gated_fallback_or_review_route', required_now: false, new_service: false }
    },
    rejected_for_now: ['redis_required_now', 'qdrant_required_now', 'new_managed_database_required_now'],
    rule: 'Use current services first. Add new paid infrastructure only after owner approval and a proven need.'
  };
}

export function railwayEnvPlan() {
  return {
    ok: true,
    profile_version: 'existing_services_profile_v1_0_0',
    required_for_private_sidecar: [
      'AI_SERVER_HOST=0.0.0.0',
      'AI_SERVER_PORT=${PORT}',
      'AI_PUBLIC_MODE=false',
      'AI_ALLOW_PROVIDER_DISPATCH=false',
      'AI_ALLOW_PROVIDER_NETWORK=false',
      'AI_PROVIDER_DRY_RUN_ONLY=true',
      'AI_ALLOW_ARCHE_PUSH=false'
    ],
    optional_later_when_approved: [
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'AI_OWNER_APPROVAL_TOKEN',
      'R2_ACCOUNT_ID',
      'R2_BUCKET',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY'
    ],
    do_not_commit: ['.env', 'API keys', 'R2 secrets', 'owner approval token', 'customer/payment records'],
    start_command: 'npm start'
  };
}

export function netlifyBridgeContract() {
  return {
    ok: true,
    contract_version: 'netlify_bridge_contract_v1_0_0',
    approved_public_safe_reads_now: [
      'GET /health with public redaction through a future public facade',
      'GET /deployment/readiness with public-safe fields only',
      'GET /bridge/outbox only after owner-approved public-safe filtering is added'
    ],
    blocked_from_public: [
      'raw project rooms',
      'raw source manifests',
      'provider payloads',
      'API keys',
      'owner records',
      'customer records',
      'payment/account records',
      'raw bridge payloads without filtering'
    ],
    rule: 'Netlify may only call public-safe sidecar routes after a public facade or filtering layer is explicitly approved.'
  };
}

export function stableSidecarCheck() {
  return {
    ok: true,
    stable_sidecar_version: 'stable_internal_sidecar_v1_0_0',
    verified_layers: [
      '4 primary AI registry',
      '7 round-table lanes',
      'project room/source boundary',
      'contamination checks',
      'queue/replay auto-process',
      'trace finalization',
      'release gate',
      'storage adapter',
      'queue adapter',
      'R2 object adapter boundary',
      'deployment readiness',
      'provider/cost/owner approval gates'
    ],
    still_inactive_by_design: [
      'public chat',
      'real provider network calls',
      'customer-data access',
      'payment/account access',
      'automatic ArchE backend import',
      'real R2 writes'
    ],
    next_safe_action: 'Commit to GitHub and deploy to Railway as a private/internal sidecar with all activation flags false.'
  };
}
