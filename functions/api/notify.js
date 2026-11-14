const ACTIVITIES = {
  '09:30': 'Cà phê sáng cuối tuần ☕',
  '17:30': 'Dạo phố ngắm hoàng hôn 🌅',
  '19:00': 'Ăn tối đàng hoàng 🍽️',
  '21:00': 'Đi chơi đêm, tâm sự 🌙',
};

const FOODS = {
  lau: 'Lẩu 🍲',
  pho: 'Phở 🍜',
  buncha: 'Bún chả 🥢',
  oc: 'Ốc 🐚',
  nuong: 'Đồ nướng 🍢',
  sushi: 'Sushi 🍣',
  pizza: 'Pizza 🍕',
  trasua: 'Trà sữa 🧋',
  gi: 'Gì cũng được',
};

const PRONOUNS = {
  'anh-em': ['anh', 'em'],
  'em-anh': ['em', 'anh'],
  'to-cau': ['tớ', 'cậu'],
};

const MAX_BODY_BYTES = 2048;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(status, value) {
  return Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function failure(status, error) {
  return json(status, { ok: false, error });
}

async function readTicket(request) {
  const reader = request.body?.getReader();
  if (!reader) return { error: 'invalid_request' };

  let size = 0;
  let text = '';
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return { error: 'payload_too_large' };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { ticket: JSON.parse(text) };
  } catch {
    return { error: 'invalid_request' };
  } finally {
    reader.releaseLock();
  }
}

function validTicket(ticket) {
  if (!ticket || typeof ticket !== 'object' || Array.isArray(ticket)) return false;
  if (typeof ticket.ticketNo !== 'string' || ticket.ticketNo.length !== 4 || !/^\d{4}$/.test(ticket.ticketNo)) return false;
  if (typeof ticket.date !== 'string' || ticket.date.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(ticket.date)) return false;
  const date = new Date(`${ticket.date}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== ticket.date) return false;
  const bangkokToday = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (ticket.date < bangkokToday) return false;
  if (typeof ticket.time !== 'string' || !Object.hasOwn(ACTIVITIES, ticket.time)) return false;
  if (typeof ticket.food !== 'string' || !Object.hasOwn(FOODS, ticket.food)) return false;
  if (typeof ticket.pronouns !== 'string' || !Object.hasOwn(PRONOUNS, ticket.pronouns)) return false;
  return typeof ticket.requestId === 'string' && ticket.requestId.length === 36 && UUID.test(ticket.requestId);
}

function configured(env) {
  return typeof env?.TELEGRAM_BOT_TOKEN === 'string' && env.TELEGRAM_BOT_TOKEN.trim() !== ''
    && typeof env?.TELEGRAM_CHAT_ID === 'string' && env.TELEGRAM_CHAT_ID.trim() !== ''
    && typeof env?.NOTIFICATION_STATE?.get === 'function'
    && typeof env?.NOTIFICATION_STATE?.put === 'function';
}

function boundedLocation(value) {
  if (typeof value !== 'string') return '';
  return value.slice(0, 256)
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 80);
}

function validIp(value) {
  if (typeof value !== 'string') return '';
  const ip = value.trim();
  if (ip.length > 45) return '';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) && ip.split('.').every(part => Number(part) <= 255)) return ip;
  if (!ip.includes(':') || !/^[\da-f:.]+$/i.test(ip)) return '';
  try {
    new URL(`http://[${ip}]/`);
    return ip;
  } catch {
    return '';
  }
}

function visitorIp(request) {
  const edgeIp = validIp(request.headers.get('CF-Connecting-IP'));
  // Only Pseudo IPv4 overwrite mode may replace the ordinary edge address with this header.
  if (edgeIp.includes('.') && !edgeIp.includes(':') && Number(edgeIp.split('.')[0]) >= 240) {
    const ipv6 = validIp(request.headers.get('CF-Connecting-IPv6'));
    if (ipv6.includes(':')) return ipv6;
  }
  return edgeIp || 'Không rõ';
}

function browserAndOs(request) {
  const ua = (request.headers.get('User-Agent') || '').slice(0, 512);
  const browser = [
    [/Edg(?:e|A|iOS)?\//i, 'Edge'],
    [/Firefox\/|FxiOS\//i, 'Firefox'],
    [/Chrome\/|CriOS\//i, 'Chrome'],
    [/Safari\//i, 'Safari'],
  ].find(([pattern]) => pattern.test(ua))?.[1] || 'Không rõ';
  const os = [
    [/Android/i, 'Android'],
    [/iPhone|iPad|iPod/i, 'iOS'],
    [/Windows/i, 'Windows'],
    [/Macintosh|Mac OS X/i, 'macOS'],
    [/CrOS/i, 'ChromeOS'],
    [/Linux/i, 'Linux'],
  ].find(([pattern]) => pattern.test(ua))?.[1] || 'Không rõ';
  return { browser, os };
}

function confirmationTime() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function notification(ticket, request) {
  const [a, e] = PRONOUNS[ticket.pronouns];
  const [year, month, day] = ticket.date.split('-');
  const cap = word => word.charAt(0).toUpperCase() + word.slice(1);
  const food = ticket.food === 'gi' ? `Gì cũng được, để ${a} lo 🤷` : FOODS[ticket.food];
  const location = [request.cf?.city, request.cf?.region, request.cf?.country].map(boundedLocation).filter(Boolean).join(', ') || 'Không rõ';
  const { browser, os } = browserAndOs(request);
  return [
    `${cap(e)} đồng ý đi hẹn hò với ${a} rồi nè 💌`,
    `🗓 ${day}/${month}/${year} lúc ${ticket.time} (giờ Việt Nam)`,
    `Hoạt động: ${ACTIVITIES[ticket.time]}`,
    `🍽 Ăn: ${food}`,
    `🛵 ${cap(a)} qua tận nhà đón ${e}`,
    `Vé số ${ticket.ticketNo}`,
    '',
    'Thông tin lượt xác nhận:',
    `IP: ${visitorIp(request)}`,
    `Vị trí gần đúng: ${location}`,
    `Trình duyệt: ${browser} · Hệ điều hành: ${os}`,
    `Xác nhận lúc: ${confirmationTime()} (giờ Việt Nam, UTC+7)`,
  ].join('\n');
}

async function rateLimited(state, ip) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip || 'unknown'));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const key = `rate:${hash}`;
  const stored = await state.get(key);
  const now = Date.now();
  let window = stored === null ? null : JSON.parse(stored);
  if (window && (!Number.isInteger(window.count) || window.count < 0 || !Number.isFinite(window.resetAt))) {
    throw new Error('Invalid notification state');
  }
  if (!window || window.resetAt <= now) window = { count: 0, resetAt: now + 60000 };
  if (window.count >= 5) return true;
  window.count++;
  // KV counters are best effort because read/write pairs are not atomic.
  await state.put(key, JSON.stringify(window), { expirationTtl: 120 });
  return false;
}

async function sendTelegram(env, ticket, request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: notification(ticket, request) }),
      signal: controller.signal,
      redirect: 'manual',
    });
    const result = await response.json();
    if (response.ok && result?.ok === true) return true;
    const details = { status: response.status };
    if (Number.isInteger(result?.error_code)) details.error_code = result.error_code;
    const description = typeof result?.description === 'string' ? result.description.toLowerCase() : '';
    if (response.status === 401 || details.error_code === 401) details.reason = 'unauthorized';
    else if (description.includes('chat not found')) details.reason = 'chat_not_found';
    else if (description.includes('bot was blocked')) details.reason = 'blocked';
    else if (description.includes('message thread not found')) details.reason = 'thread_not_found';
    else details.reason = 'other_upstream_error';
    console.warn('telegram_notification_failed', details);
    return false;
  } catch (error) {
    const details = {};
    if (response) details.status = response.status;
    details.reason = controller.signal.aborted || error?.name === 'AbortError' ? 'timeout'
      : response && error?.name === 'SyntaxError' ? 'other_upstream_error' : 'network_error';
    console.warn('telegram_notification_failed', details);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return failure(405, 'method_not_allowed');
  if (request.headers.get('Origin') !== new URL(request.url).origin) return failure(403, 'forbidden');
  const contentType = request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') return failure(400, 'invalid_request');
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) return failure(413, 'payload_too_large');
  const { ticket, error } = await readTicket(request);
  if (error) return failure(error === 'payload_too_large' ? 413 : 400, error);
  if (!validTicket(ticket)) return failure(400, 'invalid_request');
  if (!configured(env)) return failure(503, 'not_configured');
  const state = env.NOTIFICATION_STATE;
  const completedKey = `sent:${ticket.requestId.toLowerCase()}`;
  try {
    if (await state.get(completedKey) === 'sent') return json(200, { ok: true });
    if (await rateLimited(state, request.headers.get('CF-Connecting-IP'))) return failure(429, 'rate_limited');
  } catch {
    return failure(503, 'unavailable');
  }
  if (!await sendTelegram(env, ticket, request)) return failure(502, 'notification_failed');
  try {
    await state.put(completedKey, 'sent', { expirationTtl: 86400 });
  } catch {
    // Telegram already accepted the message; reporting failure would encourage a duplicate send.
  }
  return json(200, { ok: true });
}
