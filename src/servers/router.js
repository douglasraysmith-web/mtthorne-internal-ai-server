import path from 'node:path';
import { readJson, resolveDataDir } from '../utils/store.js';
import { PRIMARY_AIS, ROUND_TABLE_LANES } from '../config.js';
import { getProjectRoom } from './projectRooms.js';

const rulesFile = () => path.join(resolveDataDir(), 'decision_rules.json');

const DEFAULT_ROOMS = Object.freeze({
  arche: 'room_arche_site',
  av_ai: 'room_av_ai',
  vlock_ai: 'room_vlock_images',
  janitor: 'room_janitor_client_reply'
});

export function classifyRequest(input = {}) {
  const text = String(input.request || input.text || input.message || input?.payload?.request || '').toLowerCase();
  const rules = readJson(rulesFile(), { routing_keywords: {}, escalation_triggers: [] });
  const scores = Object.fromEntries(PRIMARY_AIS.map((ai) => [ai, 0]));

  for (const [ai, keywords] of Object.entries(rules.routing_keywords || {})) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) scores[ai] = (scores[ai] || 0) + 1;
    }
  }

  let primary_ai = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'arche';
  if ((scores[primary_ai] || 0) === 0) primary_ai = input.preferred_ai || 'arche';

  const riskTier = input.risk_tier || input?.contract?.risk_tier || null;
  const speedMode = input.speed_mode || input?.contract?.speed_mode || null;
  const escalation =
    (rules.escalation_triggers || []).some((trigger) => text.includes(trigger.toLowerCase())) ||
    input.force_round_table === true ||
    speedMode === 'round_table' ||
    riskTier === 'high' ||
    riskTier === 'release';
  const mode = escalation ? 'round_table_reviewed' : (speedMode || (text.length < 280 ? 'fast' : 'deep_verified'));
  const lanes = escalation
    ? [...ROUND_TABLE_LANES]
    : riskTier === 'medium' || speedMode === 'balanced'
      ? ['source_lock', 'speed_router', 'security_privacy', 'verifier', 'quality_judge']
      : ['source_lock', 'speed_router', 'security_privacy', 'verifier'];

  const requestedRoom = input.project_id || input.project_room || null;
  const requestedRoomRecord = requestedRoom ? getProjectRoom(requestedRoom) : null;
  if (requestedRoomRecord?.active_ai) primary_ai = requestedRoomRecord.active_ai;

  const project_room = requestedRoom || DEFAULT_ROOMS[primary_ai] || 'room_arche_site';
  return {
    primary_ai,
    project_room,
    project: getProjectRoom(project_room)?.project_name || project_room,
    mode,
    lanes,
    scores,
    escalation,
    risk_tier: riskTier,
    speed_mode: speedMode
  };
}

export function explainRoute(route) {
  return {
    selected_ai: route.primary_ai,
    room: route.project_room,
    mode: route.mode,
    lanes: route.lanes,
    reason: route.escalation
      ? 'Escalation trigger detected or requested; using all seven round-table lanes.'
      : 'Standard internal route with source, speed, security, and verification checks.'
  };
}
