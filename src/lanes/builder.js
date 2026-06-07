export function builderLane(input, route) {
  return {
    lane: 'builder',
    ok: true,
    build_target: input.build_target || 'internal_response_or_artifact',
    instruction: input.text || input.message || ''
  };
}
