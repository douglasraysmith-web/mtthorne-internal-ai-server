const ROOMS = {
  rooms: [
    {
      project_id: 'room_arche_site',
      project_name: 'ArchE Site and Governance',
      active_ai: 'arche',
      allowed_sources: ['arche_master_source_v1_3', 'verified_sources'],
      forbidden_sources: ['customer_records', 'payment_records', 'provider_payloads', 'raw_api_keys'],
      privacy_class: 'owner_internal'
    },
    {
      project_id: 'room_av_ai',
      project_name: 'AV.AI and AVA',
      active_ai: 'av_ai',
      allowed_sources: ['av_ai_master_source', 'approved_av_sources'],
      forbidden_sources: ['customer_records', 'payment_records', 'raw_api_keys', 'redrawn_brand_marks'],
      privacy_class: 'public_safe_with_internal_governance'
    },
    {
      project_id: 'room_vlock_images',
      project_name: 'V-Lock Visual Production',
      active_ai: 'vlock_ai',
      allowed_sources: ['approved_brand_mark', 'approved_visual_sources'],
      forbidden_sources: ['redrawn_brand_marks', 'customer_records', 'payment_records', 'raw_api_keys'],
      privacy_class: 'owner_internal'
    },
    {
      project_id: 'room_janitor_client_reply',
      project_name: 'Janitor Client Reply',
      active_ai: 'janitor',
      allowed_sources: ['approved_support_rules', 'public_company_information'],
      forbidden_sources: ['customer_records', 'payment_records', 'raw_api_keys'],
      privacy_class: 'restricted_client_boundary'
    }
  ]
};

const SOURCES = {
  sources: [
    {
      source_id: 'arche_master_source_v1_3',
      title: 'ArchE Master Source v1.3',
      project_room: 'room_arche_site',
      allowed_ai: ['arche'],
      status: 'approved',
      authority: 'canonical'
    },
    {
      source_id: 'approved_brand_mark',
      title: 'Approved M.T. Thorne Brand Mark',
      project_room: 'room_vlock_images',
      allowed_ai: ['vlock_ai'],
      status: 'approved',
      authority: 'canonical'
    },
    {
      source_id: 'av_ai_master_source',
      title: 'AV.AI Governing Source',
      project_room: 'room_av_ai',
      allowed_ai: ['av_ai'],
      status: 'approved',
      authority: 'canonical'
    },
    {
      source_id: 'approved_support_rules',
      title: 'Janitor Support Rules',
      project_room: 'room_janitor_client_reply',
      allowed_ai: ['janitor'],
      status: 'approved',
      authority: 'canonical'
    }
  ]
};

const RULES = {
  routing_keywords: {
    arche: ['arche', 'site', 'governance', 'source system', 'publishing platform'],
    av_ai: ['audio', 'video', 'home theater', 'home theatre', 'speaker', 'receiver', 'projector', 'television', 'avr', 'acoustics', 'hdmi'],
    vlock_ai: ['image', 'illustration', 'visual', 'cover', 'brand mark', 'portrait', 'render'],
    janitor: ['customer', 'client reply', 'after hours', 'support', 'order problem', 'refund', 'complaint', 'email reply']
  },
  escalation_triggers: ['3 5 1', 'round table', 'high risk', 'release', 'production deploy', 'security review'],
  blocked_public_terms: ['provider payload', 'private project room', 'payment record', 'customer record', 'api key', 'owner token', 'raw prompt']
};

const AI_REGISTRY = {
  ais: [
    { ai_id: 'arche', name: 'ArchE', project_room: 'room_arche_site', status: 'active' },
    { ai_id: 'av_ai', name: 'AV.AI', project_room: 'room_av_ai', status: 'active' },
    { ai_id: 'vlock_ai', name: 'V-Lock AI', project_room: 'room_vlock_images', status: 'active' },
    { ai_id: 'janitor', name: 'The Janitor', project_room: 'room_janitor_client_reply', status: 'active' }
  ]
};

const DEFAULTS = Object.freeze({
  ai_registry: AI_REGISTRY,
  project_rooms: ROOMS,
  source_manifest: SOURCES,
  decision_rules: RULES,
  error_ledger: { errors: [] },
  decision_history: { decisions: [] },
  work_queue: { jobs: [] },
  trace_log: { traces: [] },
  transfer_requests: { transfers: [] },
  bridge_outbox: [],
  working_memory: { entries: [] },
  episodic_memory: { entries: [] },
  semantic_memory_manifest: { entries: [] },
  verified_sources: { entries: [] },
  knowledge_documents: { entries: [] },
  ai_knowledge_registry: { ais: {} },
  provider_dispatch_log: { entries: [] },
  owner_approval_log: { entries: [] },
  ava_sessions: { sessions: [] }
});

export function defaultCollectionFor(filePath) {
  const name = String(filePath || '').split(/[\\/]/).pop()?.replace(/\.json$/i, '');
  const value = DEFAULTS[name];
  return value === undefined ? undefined : structuredClone(value);
}

export function allDefaultCollections() {
  return structuredClone(DEFAULTS);
}
