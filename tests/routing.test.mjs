import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../src/index.ts';

const mockEnv = {
  JWT_PUBLIC_KEY_PEM: 'MOCK_PEM',
};

test('GET / or /info returns worker info', async () => {
  const req = new Request('https://api.hocnhe.com/info', { method: 'GET' });
  const res = await worker.fetch(req, mockEnv);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.name, 'english-kids-worker');
  assert.equal(data.version, '1.3.0');
});

test('OPTIONS request returns CORS headers', async () => {
  const req = new Request('https://api.hocnhe.com/v1', {
    method: 'OPTIONS',
    headers: { Origin: 'https://hocnhe.com' },
  });
  const res = await worker.fetch(req, mockEnv);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://hocnhe.com');
});
