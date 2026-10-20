const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseConfirmationCallback: parse } = require('../src/features/auth/callbackParams.ts');
const native = 'ineedhelp://auth-callback';
const expo = 'exp://preview.exp.direct/--/auth-callback';
test('accepts PKCE code on exact native and Expo Go callbacks', () => {
  for (const expected of [native, expo]) assert.deepEqual(parse(expected + '?code=test-code_123', expected), { kind: 'code', code: 'test-code_123' });
});
test('rejects other destinations, duplicate codes and malformed input', () => {
  for (const url of ['https://evil.example/auth-callback?code=x', 'ineedhelp://other?code=x', native + '/other?code=x', native + '?code=x&code=y', native + '?code=', native + '?code=%0Asecret', 'not a url']) assert.equal(parse(url, native).kind, 'error');
});
test('rejects provider errors and implicit bearer tokens', () => {
  for (const suffix of ['?error=expired', '#error_code=otp_expired', '#access_token=secret&refresh_token=secret', '?code=x#access_token=secret']) assert.equal(parse(native + suffix, native).kind, 'error');
});
test('allows manual fallback for an already consumed callback without code', () => {
  assert.equal(parse(native, native).kind, 'empty');
});

test('preserves per-flow PKCE verifier IDs and rejects ambiguous IDs', () => {
  assert.deepEqual(parse(native + '?code=code-123&sb_flow_id=flow-456', native), { kind: 'code', code: 'code-123', flowId: 'flow-456' });
  assert.equal(parse(native + '?code=x&sb_flow_id=a&sb_flow_id=b', native).kind, 'error');
});
