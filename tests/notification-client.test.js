import test from 'node:test';
import assert from 'node:assert/strict';
import { createTicketNotifier } from '../notification-client.js';

const ticket = { ticketNo: '1234', date: '2099-06-20', time: '19:00', food: 'sushi', pronouns: 'anh-em' };
const accepted = () => Response.json({ ok: true });

test('sends structured ticket once while pending and after success', async () => {
  let finish;
  const calls = [], statuses = [];
  const notifier = createTicketNotifier({
    fetchImpl: (url, init) => {
      calls.push({ url, init });
      return new Promise(resolve => { finish = resolve; });
    },
    onStatus: status => statuses.push(status)
  });
  const first = notifier.notify(ticket);
  const duplicate = notifier.notify({ ...ticket });
  assert.equal(calls.length, 1);
  assert.deepEqual(statuses, ['pending']);
  assert.equal(calls[0].url, '/api/notify');
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual({ ...body, requestId: undefined }, { ...ticket, requestId: undefined });
  assert.match(body.requestId, /^[0-9a-f-]{36}$/i);
  finish(accepted());
  assert.equal(await first, true);
  assert.equal(await duplicate, true);
  assert.equal(await notifier.notify(ticket), true);
  assert.equal(calls.length, 1);
  assert.deepEqual(statuses, ['pending', 'sent']);
});

test('a failed delivery can be retried with the same request ID', async () => {
  const bodies = [], statuses = [];
  const notifier = createTicketNotifier({
    fetchImpl: async (url, init) => {
      bodies.push(JSON.parse(init.body));
      return bodies.length === 1 ? Response.json({ ok: false }, { status: 502 }) : accepted();
    },
    onStatus: status => statuses.push(status)
  });
  assert.equal(await notifier.notify(ticket), false);
  assert.equal(await notifier.notify(ticket), true);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].requestId, bodies[1].requestId);
  assert.deepEqual(statuses, ['pending', 'failed', 'pending', 'sent']);
});

test('HTTP success without a confirmed delivery is a visible failure', async () => {
  for (const response of [Response.json({ ok: false }), new Response('not JSON')]) {
    const statuses = [];
    const notifier = createTicketNotifier({ fetchImpl: async () => response, onStatus: s => statuses.push(s) });
    assert.equal(await notifier.notify(ticket), false);
    assert.deepEqual(statuses, ['pending', 'failed']);
  }
});

test('a network failure resolves as failure instead of freezing the ticket', async () => {
  const statuses = [];
  const notifier = createTicketNotifier({ fetchImpl: async () => { throw new Error('offline'); }, onStatus: s => statuses.push(s) });
  assert.equal(await notifier.notify(ticket), false);
  assert.deepEqual(statuses, ['pending', 'failed']);
});

test('reset invalidates a pending response and permits a new confirmation', async () => {
  const resolvers = [], bodies = [], statuses = [];
  const notifier = createTicketNotifier({
    fetchImpl: (url, init) => {
      bodies.push(JSON.parse(init.body));
      return new Promise(resolve => resolvers.push(resolve));
    },
    onStatus: s => statuses.push(s)
  });
  const old = notifier.notify(ticket);
  notifier.reset();
  const fresh = notifier.notify(ticket);
  assert.notEqual(bodies[0].requestId, bodies[1].requestId);
  resolvers[0](accepted());
  await old;
  assert.deepEqual(statuses, ['pending', 'idle', 'pending']);
  resolvers[1](accepted());
  assert.equal(await fresh, true);
  assert.deepEqual(statuses, ['pending', 'idle', 'pending', 'sent']);
});

test('an older choice does not replace the status of the latest confirmation', async () => {
  const resolvers = [], statuses = [];
  const notifier = createTicketNotifier({
    fetchImpl: () => new Promise(resolve => resolvers.push(resolve)),
    onStatus: s => statuses.push(s)
  });
  const old = notifier.notify(ticket);
  const latest = notifier.notify({ ...ticket, food: 'pho' });
  resolvers[1](accepted());
  await latest;
  resolvers[0](Response.json({ ok: false }, { status: 502 }));
  await old;
  assert.deepEqual(statuses, ['pending', 'pending', 'sent']);
});
