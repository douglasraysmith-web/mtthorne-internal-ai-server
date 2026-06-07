export function verifierLane(input, route, draft = {}) {
  const claims = JSON.stringify(draft).toLowerCase();
  const riskyClaims = ['fully deployed', 'publicly live', 'payment ready', 'customer-data ready', 'signed release'];
  const hits = riskyClaims.filter((claim) => claims.includes(claim));
  return {
    lane: 'verifier',
    ok: hits.length === 0,
    blocked_claims: hits,
    verification_state: hits.length ? 'revise_unverified_claims' : 'verified_for_internal_handoff'
  };
}
