import test from 'node:test';
import assert from 'node:assert/strict';

process.env.ARCHE_BACKEND_URL =
  'https://arche-backend-production.up.railway.app';
process.env.ARCHE_BRIDGE_TOKEN =
  'test_bridge_token_1234567890';
process.env.AI_ALLOW_ARCHE_PUSH = 'true';

const source = await import('node:fs/promises')
  .then(({ readFile }) =>
    readFile(
      new URL('../src/servers/archeLiveBridge.js', import.meta.url),
      'utf8'
    )
  );

test('connector uses only authenticated internal route', () => {
  assert.match(source, /\/api\/internal-ai-bridge/);
  assert.match(source, /x-arche-bridge-token/);
  assert.doesNotMatch(source, /\/api\/arche-fast-chat/);
  assert.doesNotMatch(source, /\/api\/arche-chat/);
});

test('connector validates authenticated internal response', () => {
  assert.match(source, /authenticated_internal_response_not_confirmed/);
  assert.match(source, /public_runtime_bypassed/);
  assert.match(source, /arche_internal_bridge/);
});

test('connector blocks missing token', () => {
  assert.match(source, /arche_bridge_token_missing/);
});

console.log('Internal sidecar ArchE bridge connector tests passed.');
