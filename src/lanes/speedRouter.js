export function speedRouterLane(input, route) {
  const text = input.text || input.message || '';
  let speed_path = 'quick_generated_answer';
  if (route.mode === 'round_table_reviewed') speed_path = 'round_table_reviewed_answer';
  else if (text.length < 160) speed_path = 'instant_or_cached_answer';
  else if (text.length > 1200) speed_path = 'deep_verified_answer';
  return { lane: 'speed_router', ok: true, speed_path };
}
