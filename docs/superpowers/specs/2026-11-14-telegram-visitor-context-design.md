# Visitor context in confirmed-ticket Telegram messages

The owner explicitly requested IP and related context instead of a name field. Append connection IP, approximate city/region/country, coarse browser/OS labels and the server confirmation time (Asia/Bangkok) to the private Telegram ticket message.

Use the existing Pages request and Cloudflare edge metadata. Avoid adding an external IP/geolocation provider, client-supplied identity fields, browser geolocation permission, cookies or fingerprinting. IP and coarse device data cannot establish a real person's name or identity; missing information must remain unknown.

Cloudflare `CF-Connecting-IP` is the normal IP source. When it is a Class E pseudo IPv4 (240–255 first octet), use a valid `CF-Connecting-IPv6` value if available. Do not use body `ip`, arbitrary forwarded-IP headers or body geography. Read city/region/country from `request.cf`. Infer only readable browser/OS categories from bounded User-Agent input, then discard the raw header. Sanitize/bound displayed values and include no precise coordinates.

Add a visible, accessible notice before confirmation that the ticket, IP, approximate area and browser/OS are sent privately to the inviter. No name form. Request/response contracts, triggering, server secrets, deduplication and retry behavior remain unchanged. Metadata is appended only to the private Telegram message; do not return it to the browser, add raw application logs, or add storage. Existing hashed-IP rate state remains unchanged.

Verify metadata inclusion and data sources through meaningful handler tests, an independent review, mobile notice QA, and one clearly announced live test. Keep the existing Cloudflare-compatible `redirect: manual` transport.
