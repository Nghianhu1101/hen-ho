export function invitationCodeFromPath(pathname) {
  return typeof pathname === 'string' ? /^\/([A-Z]-[0-9a-f]{32})\/?$/.exec(pathname)?.[1] : undefined;
}

export function createTicketNotifier({ fetchImpl = globalThis.fetch, onStatus = () => {} } = {}) {
  const entries = new Map();
  let version = 0;

  function notify(ticket) {
    const fields = ['ticketNo', 'date', 'time', 'food', 'pronouns', 'inviteCode'];
    const payload = Object.fromEntries(fields.map(field => [field, ticket[field]]));
    const key = JSON.stringify(payload);
    let entry = entries.get(key);
    if (entry?.status === 'sent') return Promise.resolve(true);
    if (entry?.status === 'pending') return entry.promise;

    const currentVersion = ++version;
    entry ??= { requestId: crypto.randomUUID() };
    entry.status = 'pending';
    entries.set(key, entry);
    onStatus('pending');

    entry.promise = (async () => {
      let delivered = false;
      try {
        const response = await fetchImpl('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, requestId: entry.requestId }),
          signal: AbortSignal.timeout(12000)
        });
        delivered = response.ok && (await response.json()).ok === true;
      } catch {
        delivered = false;
      }
      entry.status = delivered ? 'sent' : 'failed';
      if (version === currentVersion) onStatus(entry.status);
      return delivered;
    })();
    return entry.promise;
  }

  function reset() {
    version++;
    entries.clear();
    onStatus('idle');
  }

  return { notify, reset };
}
