import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, clientIp } from '../../src/security/rateLimit.ts';

test('5 passages puis refus, puis de nouveau après la fenêtre', () => {
  let t = 0;
  const rl = createRateLimiter(5, 3_600_000, () => t);
  for (let i = 0; i < 5; i++) assert.equal(rl.hit('ip'), true);
  assert.equal(rl.hit('ip'), false);
  assert.equal(rl.hit('autre'), true);
  t += 3_600_001;
  assert.equal(rl.hit('ip'), true);
});

test('clientIp selon le nombre de proxys de confiance', () => {
  const r = new Request('http://x/', { headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3', 'x-carte-remote-addr': '127.0.0.1' } });
  assert.equal(clientIp(r, 1), '3.3.3.3');
  assert.equal(clientIp(r, 2), '2.2.2.2');
  assert.equal(clientIp(r, 0), '127.0.0.1');
  assert.equal(clientIp(r, 9), '1.1.1.1');
  assert.equal(clientIp(new Request('http://x/', { headers: { 'x-carte-remote-addr': '9.9.9.9' } }), 1), '9.9.9.9');
});
