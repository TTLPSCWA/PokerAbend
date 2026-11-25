import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clientIp, createProxyTrust, requestSecure, sameOrigin, securityHeaders } from '../server/security.js';

function request(remoteAddress, headers = {}, encrypted = false) {
  return { socket: { remoteAddress, encrypted }, headers: { host: 'spieleabend.example', ...headers } };
}

test('only the configured immediate peer supplies client IP and HTTPS', () => {
  const trust = createProxyTrust(true, '172.20.0.5, fd00::5');
  const forwarding = { 'x-forwarded-for': '192.0.2.15, 198.51.100.16', 'x-forwarded-proto': 'https' };
  const proxy = request('::ffff:172.20.0.5', forwarding);
  assert.equal(clientIp(proxy, trust), '198.51.100.16');
  assert.equal(requestSecure(proxy, trust), true);
  assert.equal(requestSecure(request('fd00:0:0:0:0:0:0:5', forwarding), trust), true);

  for (const peer of ['172.20.0.8', '203.0.113.6']) {
    const direct = request(peer, forwarding);
    assert.equal(clientIp(direct, trust), peer);
    assert.equal(requestSecure(direct, trust), false);
  }
  const disabled = createProxyTrust(false, '172.20.0.5');
  assert.equal(clientIp(proxy, disabled), proxy.socket.remoteAddress);
  assert.equal(requestSecure(proxy, disabled), false);
  assert.equal(requestSecure(request('203.0.113.6', {}, true), disabled), true);
});

test('compatibility mode accepts only private direct peers and validates values', () => {
  const trust = createProxyTrust(true);
  const proxy = request('172.20.0.5', { 'x-forwarded-for': 'bad, 2001:0db8:0:0::10', 'x-forwarded-proto': 'https' });
  assert.equal(clientIp(proxy, trust), '2001:db8::10');
  assert.equal(requestSecure(proxy, trust), true);
  const ambiguous = request('172.20.0.5', { 'x-forwarded-for': '198.51.100.9, invalid', 'x-forwarded-proto': 'https, http' });
  assert.equal(clientIp(ambiguous, trust), '172.20.0.5');
  assert.equal(requestSecure(ambiguous, trust), false);
  assert.equal(trust('203.0.113.6'), false);
  assert.throws(() => createProxyTrust(true, 'invalid'), /TRUST_PROXY_PEERS/);
});

test('API and Socket.IO origin checks use Host and headers follow the verified TLS result', () => {
  const host = { origin: 'https://spieleabend.example', 'x-forwarded-host': 'other.example' };
  assert.equal(sameOrigin(request('203.0.113.6', host)), true);
  assert.equal(sameOrigin(request('203.0.113.6', { ...host, origin: 'https://other.example' })), false);
  assert.equal(sameOrigin(request('203.0.113.6', { origin: 'null' })), false);
  assert.equal(sameOrigin(request('203.0.113.6')), true);
  const buildHeaders = (secure) => {
    const map = new Map();
    securityHeaders({ setHeader: (name, value) => map.set(name, value) }, secure);
    return map;
  };
  assert.ok(buildHeaders(true).has('Strict-Transport-Security'));
  assert.equal(buildHeaders(false).has('Strict-Transport-Security'), false);
});
