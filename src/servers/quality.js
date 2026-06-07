export function scoreQuality({ route, boundary, sourceAccess, repeatRisk, output }) {
  const scores = {
    accuracy: 90,
    source_compliance: sourceAccess?.ok === false ? 40 : 92,
    brand_compliance: 90,
    business_usefulness: output ? 88 : 70,
    customer_safety: boundary?.ok === false ? 35 : 94,
    clarity: 86,
    completeness: route?.primary_ai ? 88 : 65,
    speed: route?.mode === 'fast' ? 95 : 82,
    deploy_readiness: boundary?.ok && sourceAccess?.ok !== false ? 82 : 45,
    risk: boundary?.ok === false || repeatRisk?.repeatRisk ? 45 : 90
  };
  const total = Object.values(scores).reduce((sum, value) => sum + value, 0) / Object.keys(scores).length;
  const status = total >= 90 ? 'release_grade' : total >= 75 ? 'usable' : total >= 60 ? 'revise' : 'fail';
  return { score: Math.round(total), status, scores };
}
