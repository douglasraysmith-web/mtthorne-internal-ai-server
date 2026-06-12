import { loadAvAiSeed, verifyAvAiKnowledge } from '../src/servers/knowledge.js';
const result = verifyAvAiKnowledge(loadAvAiSeed());
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
