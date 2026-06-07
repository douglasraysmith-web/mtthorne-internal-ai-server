import { sourceLockLane } from './sourceLock.js';
import { builderLane } from './builder.js';
import { verifierLane } from './verifier.js';
import { errorLedgerLane } from './errorLedgerLane.js';
import { speedRouterLane } from './speedRouter.js';
import { qualityJudgeLane } from './qualityJudge.js';
import { securityPrivacyLane } from './securityPrivacy.js';

export function runLanes(input, route, output = null) {
  const source = sourceLockLane(input, route);
  const builder = builderLane(input, route);
  const error = errorLedgerLane(input, route);
  const speed = speedRouterLane(input, route);
  const security = securityPrivacyLane(input);
  const verifier = verifierLane(input, route, output || builder);
  const quality = qualityJudgeLane({
    route,
    boundary: security.boundary,
    sourceAccess: source.source_access,
    repeatRisk: error,
    output
  });
  const all = { source_lock: source, builder, verifier, error_ledger: error, speed_router: speed, quality_judge: quality, security_privacy: security };
  const selected = Object.fromEntries(route.lanes.map((lane) => [lane, all[lane]]).filter(([, value]) => value));
  return { ok: Object.values(selected).every((lane) => lane.ok !== false), lanes: selected };
}
