import test from 'node:test';
import assert from 'node:assert/strict';
import { avaStatus } from '../src/servers/ava.js';
import { archeLiveBridgeStatus } from '../src/servers/archeLiveBridge.js';
import { r2LiveStatus, putR2Object } from '../src/servers/r2Live.js';
import { providerDispatch } from '../src/servers/providerGate.js';

test('AVA gateway is bound to AV.AI room', () => {
  const s = avaStatus();
  assert.equal(s.project_id, 'room_av_ai');
  assert.equal(s.av_ai_room_bound, true);
});

test('ArchE live bridge targets current backend', () => {
  const s = archeLiveBridgeStatus();
  assert.match(s.target_url, /arche-backend-production/);
});

test('R2 live writes are blocked by default', async () => {
  const out = await putR2Object({ key: 'test.json', body: '{}' });
  assert.equal(out.ok, false);
});

test('provider dispatch remains gated without env activation', async () => {
  const out = await providerDispatch({ provider: 'openai', request: 'test', estimated_input_tokens: 1, estimated_output_tokens: 1 });
  assert.equal(out.ok, false);
  assert.equal(out.network_call, 'not_performed');
});

test('R2 status does not expose secrets', async () => {
  const s = await r2LiveStatus();
  assert.equal('secret' in s, false);
});
