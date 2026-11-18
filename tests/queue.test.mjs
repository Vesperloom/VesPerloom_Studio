import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { JobQueue } from '../server/runtime/queue.mjs';
const tick = () => new Promise((r) => setImmediate(r));
function harness(opts) {
  const order = [],
    fin = [];
  const q = new JobQueue(
    (s, { signal }) =>
      new Promise((resolve, reject) => {
        order.push(s);
        fin.push(resolve);
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      }),
    opts,
  );
  return { q, order, fin };
}
test('one running job and bounded FIFO pending queue', async () => {
  const { q, order, fin } = harness({ pending: 1 });
  const a = q.submit('A'),
    b = q.submit('B');
  assert.equal(a.status, 'running');
  assert.equal(b.status, 'queued');
  assert.throws(
    () => q.submit('C'),
    (e) => e.status === 429,
  );
  fin[0]('a.png');
  await tick();
  assert.equal(a.result, 'a.png');
  assert.equal(b.status, 'running');
  assert.deepEqual(order, ['A', 'B']);
  fin[1]('b.png');
  await tick();
  assert.equal(b.status, 'done');
});
test('cancelling a queued job never starts it; cancelling active work releases the slot', async () => {
  const { q, order } = harness();
  const a = q.submit('A'),
    b = q.submit('B'),
    c = q.submit('C');
  q.cancel(b.id);
  q.cancel(a.id);
  await tick();
  assert.deepEqual(order, ['A', 'C']);
  assert.equal(a.status, 'cancelled');
  assert.equal(b.status, 'cancelled');
  q.shutdown();
  await tick();
  assert.equal(c.status, 'cancelled');
  assert.throws(
    () => q.submit('new'),
    (e) => e.status === 503,
  );
});
test('deadline failure is distinct from cancellation', async () => {
  const { q } = harness({ timeout: 15 });
  const a = q.submit('slow');
  await delay(60);
  assert.equal(a.status, 'failed');
  assert.match(a.error, /deadline/);
  assert.equal(q.active, null);
});
test('worker failure is isolated and later work completes', async () => {
  const q = new JobQueue(async (n) => {
    if (!n) throw Error('fixture failure');
    return n;
  });
  const a = q.submit(0),
    b = q.submit(2);
  await tick();
  assert.equal(a.status, 'failed');
  assert.equal(b.result, 2);
  assert.throws(
    () => q.cancel(b.id),
    (e) => e.status === 409,
  );
});
