function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function containsAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

export function evaluateAvaAnswer({
  message = '',
  answer = '',
  plan = {},
  archeReviewed = false
} = {}) {
  const source = String(message).toLowerCase();
  const text = String(answer).trim();
  const lower = text.toLowerCase();

  const scores = {
    av_specificity: 50,
    diagnostic_value: 50,
    directness: 70,
    question_quality: 60,
    premium_presence: 70,
    unsupported_claim_control: 90,
    privacy_boundary: 95,
    arche_review: archeReviewed ? 95 : 35
  };

  if (
    containsAny(lower, [
      'signal path',
      'firmware',
      'manufacturer',
      'model',
      'operating system',
      'receiver',
      'processor',
      'control platform',
      'hdmi',
      'speaker driver',
      'loudspeaker driver',
      'control-system driver',
      'control driver',
      'signal-path failure',
      'software driver',
      'affected device'
    ])
  ) {
    scores.av_specificity += 35;
  }

  if (
    containsAny(lower, [
      'first determine',
      'determine whether',
      'before replacing',
      'before changing',
      'isolate',
      'distinguish',
      'exact model',
      'exact manufacturer and model',
      'what changed',
      'before we change',
      'before changing hardware',
      'identify what driver means',
      'identify the exact',
      'narrow the failure',
      'isolate the cause'
    ])
  ) {
    scores.diagnostic_value += 35;
  }

  if (
    containsAny(lower, [
      'provide a bit more context',
      'how can i assist',
      'all things related to',
      'go-to expert',
      'exciting endeavor'
    ])
  ) {
    scores.directness -= 30;
    scores.premium_presence -= 30;
  }

  const questionCount = (text.match(/\?/g) || []).length;

  if (questionCount === 1) {
    scores.question_quality += 30;
  } else if (questionCount > 3) {
    scores.question_quality -= 25;
  }

  if (
    plan.intent === 'troubleshooting' &&
    containsAny(lower, [
      'replace',
      'buy a new',
      'recommend purchasing'
    ]) &&
    !containsAny(lower, ['first', 'isolate', 'confirm'])
  ) {
    scores.unsupported_claim_control -= 35;
  }

  if (
    containsAny(lower, [
      'api key',
      'owner token',
      'private project room',
      'provider payload',
      'internal prompt'
    ])
  ) {
    scores.privacy_boundary = 0;
  }

  for (const key of Object.keys(scores)) {
    scores[key] = clamp(scores[key]);
  }

  const values = Object.values(scores);
  const score = Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length
  );

  const failures = [];

  if (scores.av_specificity < 70) failures.push('insufficient_av_specificity');
  if (scores.diagnostic_value < 70) failures.push('insufficient_diagnostic_value');
  if (scores.directness < 60) failures.push('generic_or_passive_wording');
  if (scores.question_quality < 60) failures.push('weak_question_strategy');
  if (scores.privacy_boundary < 90) failures.push('privacy_boundary_failure');
  if (!archeReviewed) failures.push('arche_review_not_completed');

  return {
    score,
    status:
      failures.length === 0 && score >= 85
        ? 'verified'
        : score >= 70
          ? 'revise'
          : 'fail',
    scores,
    failures
  };
}
