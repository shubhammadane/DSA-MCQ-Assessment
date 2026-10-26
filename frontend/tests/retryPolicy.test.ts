import test from 'node:test';
import assert from 'node:assert/strict';
import { canRetryRequest } from '../src/services/retryPolicy.ts';

test('only reads and idempotent student writes retry transient failures', () => {
  assert.equal(canRetryRequest('get', '/student/exams', 503, 0), true);
  for (const url of ['/attempts/1/answers', '/attempts/1/submit', '/student/exams/2/start']) {
    assert.equal(canRetryRequest('post', url, 503, 0), true);
    assert.equal(canRetryRequest('post', url, undefined, 0), true);
    assert.equal(canRetryRequest('post', url, 403, 0), false);
    assert.equal(canRetryRequest('post', url, 503, 3), false);
  }
  for (const url of ['/admin/exams', '/attempts/1/security-log', '/auth/login', '/student/login']) {
    assert.equal(canRetryRequest('post', url, 503, 0), false);
  }
});
