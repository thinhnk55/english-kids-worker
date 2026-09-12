import assert from 'node:assert/strict';
import { test } from 'node:test';

test('Admin API module import check', async () => {
  const { routeAdminRequest } = await import('../src/routes/admin.ts');
  assert.equal(typeof routeAdminRequest, 'function');
});
