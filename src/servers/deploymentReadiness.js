export function deploymentReadinessStatus() {
  return {
    ok: true,
    deployment_readiness_version: 'deployment_readiness_v0_8_0',
    current_state: 'local_sidecar_ready_for_packaging',
    owned_services: {
      github: 'source_control_ready',
      railway: 'backend_hosting_target_ready',
      netlify: 'public_site_frontend_target_ready',
      r2_storage: 'object_storage_adapter_prepared',
      openai: process.env.OPENAI_API_KEY ? 'key_present_dispatch_inactive' : 'key_not_present_here',
      anthropic: process.env.ANTHROPIC_API_KEY ? 'key_present_dispatch_inactive' : 'key_not_present_here'
    },
    no_new_services_required_for_next_stage: true,
    safety: {
      public_chat: 'inactive_until_explicit_approval',
      provider_dispatch: process.env.AI_ALLOW_PROVIDER_DISPATCH === 'true' ? 'enabled' : 'inactive',
      customer_data: 'inactive',
      payment_account_access: 'inactive',
      automatic_arche_import: 'inactive'
    }
  };
}

export function deploymentReadinessCheck() {
  const checks = [
    { name: 'github_source_control', ok: true, note: 'Package is repo-ready; no GitHub API call performed.' },
    { name: 'railway_backend_target', ok: true, note: 'Server binds to host/port from environment variables.' },
    { name: 'netlify_frontend_boundary', ok: true, note: 'Public chat remains inactive; frontend bridge can call safe endpoints later.' },
    { name: 'r2_object_storage_boundary', ok: true, note: 'R2 adapter is manifest-only and performs no network calls.' },
    { name: 'provider_dispatch_gate', ok: process.env.AI_ALLOW_PROVIDER_DISPATCH !== 'true', note: 'Provider dispatch should stay disabled until v0.9 cost/provider gate is installed.' }
  ];
  return {
    ok: checks.every((c) => c.ok),
    deployment_readiness_version: 'deployment_readiness_v0_8_0',
    checks,
    railway_start_command: 'npm start',
    railway_required_env: [
      'AI_SERVER_HOST=0.0.0.0',
      'AI_SERVER_PORT=${PORT}',
      'AI_PUBLIC_MODE=false',
      'AI_ALLOW_PROVIDER_DISPATCH=false',
      'AI_ALLOW_ARCHE_PUSH=false'
    ],
    netlify_rule: 'Netlify should call only approved public-safe bridge/status endpoints until public chat is explicitly approved.',
    github_rule: 'Use GitHub for versioned source and rollback; do not commit .env files, API keys, or private data.'
  };
}

export function deploymentReadinessPlan() {
  return {
    ok: true,
    deployment_readiness_version: 'deployment_readiness_v0_8_0',
    stages: [
      {
        stage: 'github',
        goal: 'Commit internal-ai-server as its own repo or controlled folder.',
        gates: ['npm test passes', '.env ignored', 'README safety state accurate']
      },
      {
        stage: 'railway',
        goal: 'Deploy sidecar as a private/internal backend service.',
        gates: ['AI_SERVER_HOST=0.0.0.0', 'public/provider flags false', '/health passes']
      },
      {
        stage: 'r2',
        goal: 'Enable object-storage adapter only after bucket policy and tests exist.',
        gates: ['private bucket', 'credentials in Railway env only', '/r2/check passes before and after activation']
      },
      {
        stage: 'netlify_bridge',
        goal: 'Allow mtthorne.com to read approved sidecar outputs only.',
        gates: ['public boundary test', 'no raw owner/project/private data', 'owner approval']
      },
      {
        stage: 'provider_gate',
        goal: 'Use existing OpenAI/Anthropic keys with cost caps and approval locks.',
        gates: ['daily cap', 'per-request estimate', 'emergency shutoff', 'logging', 'owner approval']
      }
    ],
    no_new_paid_services_required: true
  };
}
