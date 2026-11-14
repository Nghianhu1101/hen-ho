import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { onRequest } from '../functions/api/notify.js';

const originalFetch = globalThis.fetch;
const consoleMethods = ['warn', 'error', 'log', 'info', 'debug'];
const originalConsole = Object.fromEntries(consoleMethods.map(method => [method, console[method]]));
let capturedLogs;
beforeEach(() => {
  capturedLogs = [];
  for (const method of consoleMethods) console[method] = (...args) => { capturedLogs.push(args); };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const method of consoleMethods) console[method] = originalConsole[method];
});

class MemoryKV {
  records = new Map();
  async get(key) {
    const record = this.records.get(key);
    if (!record || record.expires <= Date.now()) return null;
    return record.value;
  }
  async put(key, value, options) {
    assert.ok(options.expirationTtl > 0, 'KV state must expire');
    this.records.set(key, {
      value,
      ttl: options.expirationTtl,
      expires: Date.now() + options.expirationTtl * 1000,
    });
  }
}

function fixture(overrides = {}) {
  return {
    ticketNo: '0042',
    date: '2099-12-25',
    time: '19:00',
    food: 'buncha',
    pronouns: 'anh-em',
    requestId: randomUUID(),
    ...overrides,
  };
}

function environment() {
  return {
    TELEGRAM_BOT_TOKEN: 'test-token-never-return',
    TELEGRAM_CHAT_ID: '123456789',
    NOTIFICATION_STATE: new MemoryKV(),
  };
}

function acceptTelegram(calls = []) {
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, payload: JSON.parse(init.body) });
    return Response.json({
      ok: true,
      result: {
        message_id: 1,
        date: 1893456000,
        chat: { id: 123456789, type: 'private', first_name: 'Test' },
        text: JSON.parse(init.body).text,
      },
    });
  };
  return calls;
}

function cloudflareTransport(reply) {
  return async (url, init) => {
    // Workers supports follow/manual, unlike Node's additional error mode.
    if (!['follow', 'manual'].includes(init.redirect ?? 'follow')) {
      throw new TypeError('Unsupported redirect mode');
    }
    return reply(url, init);
  };
}

async function notify(payload = fixture(), options = {}) {
  const { env = environment(), method = 'POST', headers = {}, cf, body = JSON.stringify(payload) } = options;
  const request = new Request('https://henho.example/api/notify', {
    method,
    headers: {
      Origin: 'https://henho.example',
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.42',
      ...headers,
    },
    ...(method !== 'GET' && method !== 'HEAD' ? { body } : {}),
  });
  if (cf !== undefined) Object.defineProperty(request, 'cf', { value: cf });
  const response = await onRequest({ request, env });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-type'), /application\/json/);
  return { response, body: await response.json() };
}

async function rejectsWithoutSending(payload, options, status, error) {
  const calls = acceptTelegram();
  const result = await notify(payload, options);
  assert.equal(result.response.status, status);
  assert.deepEqual(result.body, { ok: false, error });
  assert.equal(calls.length, 0, 'Rejected requests must not reach Telegram');
}

test('a valid ticket sends a Vietnamese notification only to the configured recipient', async () => {
  const calls = acceptTelegram();
  const result = await notify(fixture({
    chat_id: 'attacker-chat',
    recipient: 'attacker-chat',
    message: '<b>arbitrary injected text</b>',
  }));

  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.telegram.org/bottest-token-never-return/sendMessage');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
  assert.equal(calls[0].payload.chat_id, '123456789');
  assert.equal(calls[0].payload.parse_mode, undefined);
  assert.match(calls[0].payload.text, /0042/);
  assert.match(calls[0].payload.text, /25\/12\/2099/);
  assert.match(calls[0].payload.text, /19:00/);
  assert.match(calls[0].payload.text, /Ăn tối đàng hoàng/);
  assert.match(calls[0].payload.text, /Bún chả/);
  assert.match(calls[0].payload.text, /anh.*em/i);
  assert.doesNotMatch(calls[0].payload.text, /attacker|arbitrary|<b>/);
});

for (const [time, food, pronouns, activity, foodLabel, ride] of [
  ['09:30', 'lau', 'anh-em', 'Cà phê sáng cuối tuần', 'Lẩu', 'Anh qua tận nhà đón em'],
  ['17:30', 'pho', 'em-anh', 'Dạo phố ngắm hoàng hôn', 'Phở', 'Em qua tận nhà đón anh'],
  ['19:00', 'buncha', 'to-cau', 'Ăn tối đàng hoàng', 'Bún chả', 'Tớ qua tận nhà đón cậu'],
  ['21:00', 'oc', 'anh-em', 'Đi chơi đêm, tâm sự', 'Ốc', 'Anh qua tận nhà đón em'],
  ['09:30', 'nuong', 'anh-em', 'Cà phê sáng cuối tuần', 'Đồ nướng', 'Anh qua tận nhà đón em'],
  ['17:30', 'sushi', 'em-anh', 'Dạo phố ngắm hoàng hôn', 'Sushi', 'Em qua tận nhà đón anh'],
  ['19:00', 'pizza', 'to-cau', 'Ăn tối đàng hoàng', 'Pizza', 'Tớ qua tận nhà đón cậu'],
  ['21:00', 'trasua', 'anh-em', 'Đi chơi đêm, tâm sự', 'Trà sữa', 'Anh qua tận nhà đón em'],
  ['19:00', 'gi', 'em-anh', 'Ăn tối đàng hoàng', 'Gì cũng được, để em lo', 'Em qua tận nhà đón anh'],
]) {
  test(`the ${time}/${food}/${pronouns} choices render their Vietnamese labels`, async () => {
    const calls = acceptTelegram();
    const result = await notify(fixture({ time, food, pronouns }));
    assert.equal(result.response.status, 200);
    assert.ok(calls[0].payload.text.includes(activity));
    assert.ok(calls[0].payload.text.includes(foodLabel));
    assert.ok(calls[0].payload.text.includes(ride));
  });
}

for (const method of ['GET', 'PUT', 'OPTIONS']) {
  test(`${method} requests are rejected before sending`, async () => {
    await rejectsWithoutSending(fixture(), { method }, 405, 'method_not_allowed');
  });
}

for (const origin of ['https://attacker.example', 'https://henho.example.attacker.example', 'null', '']) {
  test(`the Origin ${JSON.stringify(origin)} is rejected before sending`, async () => {
    await rejectsWithoutSending(fixture(), { headers: { Origin: origin } }, 403, 'forbidden');
  });
}

for (const contentType of ['text/plain', 'application/x-www-form-urlencoded', 'application/jsonp', '']) {
  test(`the content type ${JSON.stringify(contentType)} is rejected before sending`, async () => {
    await rejectsWithoutSending(fixture(), {
      headers: { 'Content-Type': contentType },
    }, 400, 'invalid_request');
  });
}

test('JSON with a charset parameter remains accepted', async () => {
  const calls = acceptTelegram();
  const result = await notify(fixture(), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  assert.equal(result.response.status, 200);
  assert.equal(calls.length, 1);
});

for (const [name, payload] of [
  ['null payload', null],
  ['array payload', []],
  ['missing ticket', { date: '2099-12-25', time: '19:00', food: 'lau', pronouns: 'anh-em', requestId: randomUUID() }],
  ['numeric ticket', fixture({ ticketNo: 42 })],
  ['short ticket', fixture({ ticketNo: '042' })],
  ['ticket injection', fixture({ ticketNo: '0042\n' })],
  ['date without padding', fixture({ date: '2099-2-05' })],
  ['impossible date', fixture({ date: '2099-02-29' })],
  ['April 31', fixture({ date: '2099-04-31' })],
  ['zero month', fixture({ date: '2099-00-12' })],
  ['past date', fixture({ date: '2000-01-01' })],
  ['date with time suffix', fixture({ date: '2099-12-25T00:00:00Z' })],
  ['date injection', fixture({ date: '2099-12-25\n' })],
  ['unavailable time', fixture({ time: '19:30' })],
  ['array time', fixture({ time: ['19:00'] })],
  ['time object key', fixture({ time: 'toString' })],
  ['food text', fixture({ food: 'Lẩu' })],
  ['array food', fixture({ food: ['lau'] })],
  ['food object key', fixture({ food: '__proto__' })],
  ['unknown pronouns', fixture({ pronouns: 'you-me' })],
  ['array pronouns', fixture({ pronouns: ['anh-em'] })],
  ['pronouns object key', fixture({ pronouns: 'constructor' })],
  ['missing request id', fixture({ requestId: undefined })],
  ['non UUID request id', fixture({ requestId: 'not-a-uuid' })],
  ['UUID suffix injection', fixture({ requestId: `${randomUUID()}\n` })],
]) {
  test(`${name} is rejected before sending`, async () => {
    await rejectsWithoutSending(payload, {}, 400, 'invalid_request');
  });
}

test('a real leap day remains valid', async () => {
  const calls = acceptTelegram();
  const result = await notify(fixture({ date: '2096-02-29' }));
  assert.equal(result.response.status, 200);
  assert.match(calls[0].payload.text, /29\/02\/2096/);
});

test('today in Bangkok remains valid', async () => {
  const calls = acceptTelegram();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
  const result = await notify(fixture({ date: today }));
  assert.equal(result.response.status, 200);
  assert.equal(calls.length, 1);
});

for (const raw of ['{', '', 'not json']) {
  test(`malformed JSON ${JSON.stringify(raw)} is rejected before sending`, async () => {
    await rejectsWithoutSending(fixture(), { body: raw }, 400, 'invalid_request');
  });
}

test('an actual body over 2048 bytes is rejected without trusting Content-Length', async () => {
  const body = JSON.stringify({ ...fixture(), padding: 'a'.repeat(2048) });
  await rejectsWithoutSending(fixture(), { body, headers: { 'Content-Length': '20' } }, 413, 'payload_too_large');
});

test('a multibyte body is limited by bytes rather than character count', async () => {
  const body = JSON.stringify({ ...fixture(), padding: '🛵'.repeat(500) });
  assert.ok(body.length < 2048);
  assert.ok(new TextEncoder().encode(body).length > 2048);
  await rejectsWithoutSending(fixture(), { body }, 413, 'payload_too_large');
});

test('a declared Content-Length over 2048 bytes is rejected', async () => {
  await rejectsWithoutSending(fixture(), { headers: { 'Content-Length': '2049' } }, 413, 'payload_too_large');
});

test('a body of exactly 2048 bytes remains accepted', async () => {
  const ticket = { ...fixture(), padding: '' };
  const missing = 2048 - new TextEncoder().encode(JSON.stringify(ticket)).length;
  ticket.padding = 'a'.repeat(missing);
  const calls = acceptTelegram();
  const result = await notify(ticket);
  assert.equal(result.response.status, 200);
  assert.equal(calls.length, 1);
});

for (const binding of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'NOTIFICATION_STATE']) {
  test(`a missing ${binding} fails closed before sending`, async () => {
    const env = environment();
    delete env[binding];
    await rejectsWithoutSending(fixture(), { env }, 503, 'not_configured');
  });
}

for (const [name, reply] of [
  ['an HTTP error', () => Response.json({ ok: true }, { status: 500 })],
  ['a rejected Telegram send', () => Response.json({ ok: false, error_code: 400, description: 'secret upstream details' })],
  ['malformed upstream JSON', () => new Response('secret upstream details')],
  ['a missing Telegram confirmation', () => Response.json({ result: { message_id: 1 } })],
  ['a nonboolean Telegram confirmation', () => Response.json({ ok: 'true' })],
]) {
  test(`${name} returns a generic failure without retrying`, async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return reply(); };
    const result = await notify();
    assert.equal(result.response.status, 502);
    assert.deepEqual(result.body, { ok: false, error: 'notification_failed' });
    assert.equal(calls, 1);
  });
}

test('a network error returns a generic failure without exposing secrets', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error('test-token-never-return; chat 123456789; secret upstream details');
  };
  const result = await notify();
  assert.equal(result.response.status, 502);
  assert.deepEqual(result.body, { ok: false, error: 'notification_failed' });
  assert.equal(calls, 1);
});

test('a stalled Telegram request is aborted after eight seconds', { timeout: 15000 }, async () => {
  let aborted = false;
  globalThis.fetch = async (url, init) => {
    assert.ok(init.signal instanceof AbortSignal, 'The Telegram request must have an abort signal');
    return new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        aborted = true;
        reject(new DOMException('Upstream timed out with secret details', 'AbortError'));
      }, { once: true });
    });
  };
  const started = performance.now();
  const result = await notify();
  const elapsed = performance.now() - started;
  assert.equal(result.response.status, 502);
  assert.deepEqual(result.body, { ok: false, error: 'notification_failed' });
  assert.equal(aborted, true);
  assert.ok(elapsed >= 7900 && elapsed < 12000, `Expected an eight-second timeout; took ${elapsed}ms`);
  assert.deepEqual(capturedLogs, [['telegram_notification_failed', { reason: 'timeout' }]]);
});

test('a failed delivery can be retried and only an accepted delivery is remembered', async () => {
  const env = environment();
  const ticket = fixture();
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts++;
    return Response.json(attempts === 1
      ? { ok: false, error_code: 500, description: 'try later' }
      : { ok: true, result: { message_id: 2 } });
  };

  const failed = await notify(ticket, { env });
  assert.equal(failed.response.status, 502);
  assert.equal([...env.NOTIFICATION_STATE.records.values()].some(record => record.ttl === 86400), false);
  const accepted = await notify(ticket, { env });
  assert.equal(accepted.response.status, 200);
  const duplicate = await notify(ticket, { env });
  assert.deepEqual(duplicate.body, { ok: true });
  assert.equal(attempts, 2);
});

test('a completed request ID is deduplicated for 24 hours including UUID case changes', async () => {
  const env = environment();
  const calls = acceptTelegram();
  const ticket = fixture();
  const first = await notify(ticket, { env });
  const repeated = await notify({ ...ticket, requestId: ticket.requestId.toUpperCase() }, { env });
  assert.equal(first.response.status, 200);
  assert.equal(repeated.response.status, 200);
  assert.deepEqual(repeated.body, { ok: true });
  assert.equal(calls.length, 1);
  const completed = [...env.NOTIFICATION_STATE.records.values()].filter(record => record.ttl === 86400);
  assert.equal(completed.length, 1);
});

test('a sixth distinct request from one IP is rate limited while a second IP can send', async () => {
  const env = environment();
  const calls = acceptTelegram();
  for (let index = 0; index < 5; index++) {
    const result = await notify(fixture(), { env });
    assert.equal(result.response.status, 200);
  }
  const limited = await notify(fixture(), { env });
  assert.equal(limited.response.status, 429);
  assert.deepEqual(limited.body, { ok: false, error: 'rate_limited' });
  assert.equal(calls.length, 5);
  const otherIP = await notify(fixture(), { env, headers: { 'CF-Connecting-IP': '203.0.113.43' } });
  assert.equal(otherIP.response.status, 200);
  assert.equal(calls.length, 6);

  const counters = [...env.NOTIFICATION_STATE.records].filter(([, value]) => value.ttl === 120);
  assert.equal(counters.length, 2);
  for (const [key, value] of counters) {
    assert.match(key, /[a-f0-9]{64}/);
    assert.doesNotMatch(`${key}${value.value}`, /203\.0\.113\./);
  }
});

test('failed deliveries also consume the per-IP rate limit', async () => {
  const env = environment();
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts++;
    throw new Error('network failure');
  };
  for (let index = 0; index < 5; index++) {
    assert.equal((await notify(fixture(), { env })).response.status, 502);
  }
  assert.equal((await notify(fixture(), { env })).response.status, 429);
  assert.equal(attempts, 5);
});

for (const operation of ['get', 'put']) {
  test(`a KV ${operation} failure prevents sending and returns a generic service error`, async () => {
    const env = environment();
    env.NOTIFICATION_STATE[operation] = async () => { throw new Error('secret storage error'); };
    await rejectsWithoutSending(fixture(), { env }, 503, 'unavailable');
  });
}

test('a failed completed-request write still confirms an already accepted Telegram delivery', async () => {
  const env = environment();
  const calls = acceptTelegram();
  const realPut = env.NOTIFICATION_STATE.put.bind(env.NOTIFICATION_STATE);
  env.NOTIFICATION_STATE.put = async (key, value, options) => {
    if (options.expirationTtl === 86400) throw new Error('secret completed-state error');
    return realPut(key, value, options);
  };
  const result = await notify(fixture(), { env });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, { ok: true });
  assert.equal(calls.length, 1);
});

for (const [name, status, upstream, expected] of [
  ['unauthorized', 401, { ok: false, error_code: 401, description: 'Unauthorized test-token-never-return 123456789 private details' },
    { status: 401, error_code: 401, reason: 'unauthorized' }],
  ['chat not found', 400, { ok: false, error_code: 400, description: 'Bad Request: chat not found test-token-never-return 123456789 private details' },
    { status: 400, error_code: 400, reason: 'chat_not_found' }],
  ['blocked', 403, { ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user test-token-never-return 123456789 private details' },
    { status: 403, error_code: 403, reason: 'blocked' }],
  ['thread not found', 400, { ok: false, error_code: 400, description: 'Bad Request: message thread not found test-token-never-return 123456789 private details' },
    { status: 400, error_code: 400, reason: 'thread_not_found' }],
  ['unclassified upstream error', 500, { ok: false, error_code: 500, description: 'test-token-never-return 123456789 private details' },
    { status: 500, error_code: 500, reason: 'other_upstream_error' }],
  ['nonnumeric error code', 400, { ok: false, error_code: 'test-token-never-return 123456789 private details', description: 'private details' },
    { status: 400, reason: 'other_upstream_error' }],
]) {
  test(`diagnostics classify ${name} without logging upstream text or credentials`, async () => {
    globalThis.fetch = async () => Response.json(upstream, { status });
    const result = await notify();
    assert.equal(result.response.status, 502);
    assert.deepEqual(result.body, { ok: false, error: 'notification_failed' });
    assert.deepEqual(capturedLogs, [['telegram_notification_failed', expected]]);
    assert.doesNotMatch(JSON.stringify(capturedLogs), /test-token-never-return|123456789|private details|description|https?:/);
  });
}

test('diagnostics classify malformed upstream JSON without logging its body', async () => {
  globalThis.fetch = async () => new Response('test-token-never-return 123456789 private details', { status: 502 });
  const result = await notify();
  assert.equal(result.response.status, 502);
  assert.deepEqual(result.body, { ok: false, error: 'notification_failed' });
  assert.deepEqual(capturedLogs, [['telegram_notification_failed', { status: 502, reason: 'other_upstream_error' }]]);
});

test('diagnostics classify network errors without logging exceptions or their URLs', async () => {
  globalThis.fetch = async () => { throw new Error('https://api.telegram.org/bottest-token-never-return/sendMessage 123456789 private details'); };
  const result = await notify();
  assert.equal(result.response.status, 502);
  assert.deepEqual(result.body, { ok: false, error: 'notification_failed' });
  assert.deepEqual(capturedLogs, [['telegram_notification_failed', { reason: 'network_error' }]]);
});

test('diagnostics stay silent after a confirmed successful Telegram delivery', async () => {
  acceptTelegram();
  const result = await notify();
  assert.equal(result.response.status, 200);
  assert.deepEqual(capturedLogs, []);
});

test('the Telegram transport succeeds with a Cloudflare-supported redirect mode', async () => {
  const calls = [];
  globalThis.fetch = cloudflareTransport(async (url, init) => {
    calls.push({ url, init });
    return Response.json({ ok: true, result: { message_id: 1 } });
  });
  const result = await notify();
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.redirect, 'manual');
  assert.deepEqual(capturedLogs, []);
});

test('a Telegram 302 is not followed, accepted, or remembered as a completed delivery', async () => {
  const env = environment();
  const ticket = fixture();
  const calls = [];
  globalThis.fetch = cloudflareTransport(async (url, init) => {
    calls.push({ url, init });
    return calls.length === 1
      ? Response.json({ ok: true }, { status: 302, headers: { Location: 'https://attacker.example/redirected' } })
      : Response.json({ ok: true, result: { message_id: 2 } });
  });
  const redirected = await notify(ticket, { env });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.redirect, 'manual');
  assert.equal(redirected.response.status, 502);
  assert.deepEqual(redirected.body, { ok: false, error: 'notification_failed' });
  assert.equal([...env.NOTIFICATION_STATE.records.values()].some(record => record.ttl === 86400), false);
  assert.deepEqual(capturedLogs, [['telegram_notification_failed', { status: 302, reason: 'other_upstream_error' }]]);

  const retried = await notify(ticket, { env });
  assert.equal(retried.response.status, 200);
  assert.equal(calls.length, 2);
  await notify(ticket, { env });
  assert.equal(calls.length, 2);
});

test('visitor context comes from the server request and the current Vietnam time, ignoring body metadata', async () => {
  const env = environment();
  const calls = acceptTelegram();
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  const started = Date.now();
  const result = await notify(fixture({
    name: 'Spoofed Visitor Name',
    ip: '198.51.100.99',
    location: 'Spoofed Location',
    userAgent: 'Spoofed Browser',
    timestamp: '2099-12-25T19:00:00Z',
  }), {
    env,
    cf: { city: 'Hanoi', region: 'Hanoi', country: 'VN' },
    headers: { 'User-Agent': userAgent, 'X-Forwarded-For': '198.51.100.98' },
  });
  assert.equal(result.response.status, 200);
  const text = calls[0].payload.text;
  assert.ok(text.indexOf('IP: 203.0.113.42') > text.indexOf('Vé số 0042'));
  assert.match(text, /Vị trí gần đúng: Hanoi, Hanoi, VN/);
  assert.match(text, /Trình duyệt: Chrome · Hệ điều hành: Windows/);
  const confirmed = text.match(/Xác nhận lúc: (\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2}) \(giờ Việt Nam, UTC\+7\)/);
  assert.ok(confirmed, 'The actual confirmation timestamp must be labelled as Vietnam time');
  const [, day, month, year, hour, minute, second] = confirmed;
  const instant = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}+07:00`);
  assert.ok(instant >= started - 1000 && instant <= Date.now());
  assert.doesNotMatch(text, /Spoofed|198\.51\.100\.|Mozilla\/|Chrome\/130/);
  assert.equal(calls[0].payload.parse_mode, undefined);
  assert.doesNotMatch(JSON.stringify([...env.NOTIFICATION_STATE.records]), /203\.0\.113\.42|Mozilla|Hanoi/);
  assert.deepEqual(capturedLogs, []);
});

test('missing visitor context uses unknown labels and does not use body, forwarded IP, or IPv6 overrides', async () => {
  const calls = acceptTelegram();
  const result = await notify(fixture({ ip: '198.51.100.99', name: 'Spoofed Name' }), {
    headers: { 'CF-Connecting-IP': '', 'CF-Connecting-IPv6': '2001:db8::99', 'X-Forwarded-For': '198.51.100.98', 'User-Agent': '' },
  });
  assert.equal(result.response.status, 200);
  const text = calls[0].payload.text;
  assert.match(text, /IP: Không rõ/);
  assert.match(text, /Vị trí gần đúng: Không rõ/);
  assert.match(text, /Trình duyệt: Không rõ · Hệ điều hành: Không rõ/);
  assert.doesNotMatch(text, /Spoofed|198\.51\.100\.|2001:db8/);
});

for (const [label, userAgent, browser, os] of [
  ['Android Chrome', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36', 'Chrome', 'Android'],
  ['iPhone Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 'Safari', 'iOS'],
  ['macOS Firefox', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:130.0) Gecko/20100101 Firefox/130.0', 'Firefox', 'macOS'],
  ['Windows Edge', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0', 'Edge', 'Windows'],
]) {
  test(`visitor context identifies ${label} without sending its raw user agent`, async () => {
    const calls = acceptTelegram();
    const result = await notify(fixture(), { headers: { 'User-Agent': userAgent } });
    assert.equal(result.response.status, 200);
    assert.ok(calls[0].payload.text.includes(`Trình duyệt: ${browser} · Hệ điều hành: ${os}`));
    assert.doesNotMatch(calls[0].payload.text, /Mozilla|AppleWebKit|130\.0|605\.1/);
  });
}

test('visitor context uses the IPv6 override only for a Class E pseudo IPv4 edge address', async () => {
  for (const [edgeIP, expected] of [
    ['240.12.34.56', '2001:db8::42'],
    ['255.12.34.56', '2001:db8::42'],
    ['239.12.34.56', '239.12.34.56'],
    ['203.0.113.42', '203.0.113.42'],
    ['2001:db8::1234', '2001:db8::1234'],
  ]) {
    const calls = acceptTelegram();
    const result = await notify(fixture(), {
      headers: { 'CF-Connecting-IP': edgeIP, 'CF-Connecting-IPv6': '2001:db8::42' },
    });
    assert.equal(result.response.status, 200);
    assert.ok(calls[0].payload.text.split('\n').includes(`IP: ${expected}`), `Wrong IP selection for ${edgeIP}`);
  }
});

test('visitor context bounds and sanitizes location values while displaying only coarse UA labels', async () => {
  const calls = acceptTelegram();
  const result = await notify(fixture(), {
    cf: { city: `Hanoi\nINJECTED\u0000\u2028\u202e${'x'.repeat(300)}`, region: { malicious: 'object' }, country: 'VN' },
    headers: { 'User-Agent': `private-device-name\t${'x'.repeat(3000)}Chrome/130.0.0.0` },
  });
  assert.equal(result.response.status, 200);
  const text = calls[0].payload.text;
  const location = text.split('\n').find(line => line.startsWith('Vị trí gần đúng: '));
  assert.ok(location, 'The bounded location must remain on one line');
  assert.ok(location.length <= 110);
  assert.match(location, /Hanoi INJECTED/);
  assert.match(location, /, VN$/);
  assert.doesNotMatch(text, /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/);
  assert.doesNotMatch(text, /private-device-name|malicious|\[object Object\]|Chrome\/130/);
  assert.match(text, /Trình duyệt: Không rõ · Hệ điều hành: Không rõ/);
  assert.equal(calls[0].payload.parse_mode, undefined);
});

// Synthetic fixture codes only; real invitation mappings are provisioned privately in KV.
const inviteA = `A-${'a'.repeat(32)}`;
const inviteE = `E-${'e'.repeat(32)}`;

function withInvitation(code, label) {
  const env = environment();
  env.NOTIFICATION_STATE.records.set(`invite:${code}`, { value: label, expires: Infinity });
  return env;
}

test('invitation attribution uses the private A/E mapping, including aliases, and ignores body labels', async () => {
  for (const [inviteCode, label] of [[inviteA, 'A'], [inviteE, 'E'], [inviteA, 'Private Alias']]) {
    const env = withInvitation(inviteCode, label);
    const calls = acceptTelegram();
    const result = await notify(fixture({ inviteCode, inviteLabel: 'Spoofed Label', name: 'Spoofed Person' }), { env });
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body, { ok: true });
    assert.ok(calls[0].payload.text.split('\n').includes(`Link được gán cho: ${label}`));
    assert.ok(!calls[0].payload.text.includes(inviteCode));
    assert.doesNotMatch(calls[0].payload.text, /Spoofed/);
    assert.deepEqual(capturedLogs, []);
  }
});

test('invitation prefix or suffix tampering is rejected without sending or exposing the private mapping', async () => {
  const env = withInvitation(inviteA, 'Private Alias');
  for (const inviteCode of [`B-${'a'.repeat(32)}`, `A-${'a'.repeat(31)}b`]) {
    await rejectsWithoutSending(fixture({ inviteCode, inviteLabel: 'Private Alias' }), { env }, 400, 'invalid_invite');
    assert.equal(env.NOTIFICATION_STATE.records.size, 1, 'Invalid links must not consume rate or dedup state');
  }
  assert.deepEqual(capturedLogs, []);
});

test('invitation malformed shapes and wrong types are rejected before any KV lookup or send', async () => {
  const env = environment();
  env.NOTIFICATION_STATE.get = async () => { throw new Error('Malformed invitations must not reach storage'); };
  for (const inviteCode of [
    `a-${'a'.repeat(32)}`, `A-${'a'.repeat(31)}`, `A-${'A'.repeat(32)}`, `${inviteA}\n`, '', null, 42, [inviteA],
  ]) {
    await rejectsWithoutSending(fixture({ inviteCode }), { env }, 400, 'invalid_invite');
  }
  assert.deepEqual(capturedLogs, []);
});

test('invitation absence preserves the root flow without attribution or a mapping lookup', async () => {
  const env = environment();
  const realGet = env.NOTIFICATION_STATE.get.bind(env.NOTIFICATION_STATE);
  env.NOTIFICATION_STATE.get = async key => {
    assert.ok(!key.startsWith('invite:'), 'The root flow must not look up an invitation');
    return realGet(key);
  };
  const calls = acceptTelegram();
  const result = await notify(fixture({ inviteLabel: 'Spoofed Label', name: 'Spoofed Person' }), { env });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, { ok: true });
  assert.match(calls[0].payload.text, /Vé số 0042/);
  assert.match(calls[0].payload.text, /IP: 203\.0\.113\.42/);
  assert.doesNotMatch(calls[0].payload.text, /Link được gán cho|Spoofed/);
});

test('invitation revocation is checked before successful-request deduplication or an exhausted rate limit', async () => {
  const env = withInvitation(inviteA, 'A');
  const calls = acceptTelegram();
  const tickets = [];
  for (let index = 0; index < 5; index++) {
    const ticket = fixture({ inviteCode: inviteA });
    tickets.push(ticket);
    assert.equal((await notify(ticket, { env })).response.status, 200);
  }
  env.NOTIFICATION_STATE.records.delete(`invite:${inviteA}`);
  const result = await notify(tickets[0], { env });
  assert.equal(result.response.status, 400);
  assert.deepEqual(result.body, { ok: false, error: 'invalid_invite' });
  assert.equal(calls.length, 5);
  assert.deepEqual(capturedLogs, []);
});

test('invitation KV lookup failures return a generic service error without logging code or mapping', async () => {
  const env = withInvitation(inviteA, 'Private Alias');
  const realGet = env.NOTIFICATION_STATE.get.bind(env.NOTIFICATION_STATE);
  env.NOTIFICATION_STATE.get = async key => {
    if (key.startsWith('invite:')) throw new Error(`${inviteA} Private Alias private mapping failure`);
    return realGet(key);
  };
  await rejectsWithoutSending(fixture({ inviteCode: inviteA }), { env }, 503, 'unavailable');
  assert.deepEqual(capturedLogs, []);
});

test('invitation corrupt mapping records fail closed without sending, logging, or returning their contents', async () => {
  for (const label of ['', '   ', 42, 'x'.repeat(81), 'A\nInjected', 'A\u0000', 'A\u202e']) {
    const env = withInvitation(inviteA, label);
    await rejectsWithoutSending(fixture({ inviteCode: inviteA }), { env }, 503, 'unavailable');
    assert.equal(env.NOTIFICATION_STATE.records.size, 1);
  }
  assert.deepEqual(capturedLogs, []);
});

test('invitation aliases may contain ordinary Unicode and reach the 80-character limit', async () => {
  const label = `Nhóm ${'a'.repeat(75)}`;
  assert.equal(label.length, 80);
  const env = withInvitation(inviteA, label);
  const calls = acceptTelegram();
  const result = await notify(fixture({ inviteCode: inviteA }), { env });
  assert.equal(result.response.status, 200);
  assert.ok(calls[0].payload.text.split('\n').includes(`Link được gán cho: ${label}`));
  assert.deepEqual(result.body, { ok: true });
  assert.deepEqual(capturedLogs, []);
});
