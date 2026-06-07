import { runArche } from './arche.js';
import { runAvAi } from './avAi.js';
import { runVlockAi } from './vlockAi.js';
import { runJanitor } from './janitor.js';

const runners = {
  arche: runArche,
  av_ai: runAvAi,
  vlock_ai: runVlockAi,
  janitor: runJanitor
};

export function runPrimaryAi(aiId, input, context) {
  const runner = runners[aiId] || runners.arche;
  return runner(input, context);
}
