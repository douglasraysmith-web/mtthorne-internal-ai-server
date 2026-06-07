import { scoreQuality } from '../servers/quality.js';

export function qualityJudgeLane({ route, boundary, sourceAccess, repeatRisk, output }) {
  return { lane: 'quality_judge', ok: true, quality: scoreQuality({ route, boundary, sourceAccess, repeatRisk, output }) };
}
