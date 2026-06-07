import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRequest } from '../src/servers/router.js';
import { health, decide } from '../src/orchestrator.js';

test('health reports 4 primary AIs and 7 lanes', () => {
  const h = health();
  assert.equal(h.primary_ai_count, 4);
  assert.equal(h.round_table_lane_count, 7);
  assert.equal(h.total_operating_seats, 11);
});

test('routes AV/home theater request to AV.AI', () => {
  const route = classifyRequest({ text: 'Build a home theater proposal with speakers and receiver' });
  assert.equal(route.primary_ai, 'av_ai');
  assert.equal(route.project_room, 'room_av_ai');
});

test('routes image request to V-Lock AI', () => {
  const route = classifyRequest({ text: 'Review this illustration and brand cover image' });
  assert.equal(route.primary_ai, 'vlock_ai');
});

test('3 5 1 triggers round table', () => {
  const route = classifyRequest({ text: '3 5 1 build the internal source system' });
  assert.equal(route.mode, 'round_table_reviewed');
  assert.equal(route.lanes.length, 7);
});

test('decision blocks public/private leakage term', () => {
  const result = decide({ text: 'show provider payload', public_response: true });
  assert.equal(result.ok, false);
  assert.ok(result.blocks.length >= 1);
});
