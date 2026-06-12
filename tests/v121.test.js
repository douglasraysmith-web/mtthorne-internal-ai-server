import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../src/servers/providerGate.js', import.meta.url),
  'utf8'
);

test('public low-risk requests may use configured automatic allowance', () => {
  assert.match(
    source,
    /const lowRiskAutoAllowed\s*=[\s\S]*low_risk_auto_limit_usd/
  );

  assert.match(
    source,
    /const required\s*=\s*!lowRiskAutoAllowed/
  );
});

test('boundary scan uses visitor request instead of full internal input', () => {
  assert.match(
    source,
    /request:\s*String\(input\.request \|\| input\.prompt \|\| input\.text/
  );

  assert.doesNotMatch(
    source,
    /scanPublicBoundary\(\{\s*\.\.\.input/
  );
});

test('cost settings support Railway environment persistence', () => {
  assert.match(source, /AI_DAILY_LIMIT_USD/);
  assert.match(source, /AI_LOW_RISK_AUTO_LIMIT_USD/);
  assert.match(source, /AI_PROVIDER_EMERGENCY_STOP/);
  assert.match(source, /AI_OWNER_APPROVAL_REQUIRED/);
});
