import { health, decide } from './orchestrator.js';

const cmd = process.argv[2] || 'health';
if (cmd === 'health') console.log(JSON.stringify(health(), null, 2));
else if (cmd === 'decision') {
  const text = process.argv.slice(3).join(' ') || '3 5 1 build internal AI server architecture';
  console.log(JSON.stringify(decide({ text, force_round_table: text.includes('3 5 1') }), null, 2));
} else {
  console.error(`Unknown command: ${cmd}`);
  process.exit(1);
}
