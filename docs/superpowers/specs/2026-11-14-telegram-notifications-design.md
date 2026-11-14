# Telegram notifications

The owner selected Telegram notifications and requested implementation. Notify their private chat when a visitor confirms a completed dating ticket with “Đi thôi!”. Include the date, year, time, activity, food, pronouns, and ticket number. Keep the current ticket and copy flow usable if delivery fails.

## Approach

Use a same-origin Cloudflare Pages Function at `POST /api/notify`. Telegram was chosen over email in the conversation. A server function keeps the bot token out of the browser; a direct browser Bot API call would expose it. Continue using the existing Pages project `hen-ho` and `henho.nghiacloud.cloud`.

The browser sends structured choices, a four-digit ticket number and UUID request ID. The server validates the choices and renders the message itself. Bot token and destination are Cloudflare encrypted secrets `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. The destination never comes from a visitor. Cloudflare KV `NOTIFICATION_STATE` provides successful-request deduplication and a best-effort five-per-minute IP limit. It is not an exactly-once delivery guarantee.

## Behavior and scope

Show pending/success/failure status on the final ticket. Disable duplicate in-flight requests and allow a deliberate retry after failure. A retry uses the same request ID. Never send during rendering, pronoun changes, page loads, or copying. Keep credentials, upstream error bodies, and recipient identifiers out of browser responses and Git. No login, personal data collection, new database, reminders, or general chatbot.

Both the browser's date minimum and server validation use the current Bangkok day. Recheck at confirmation so a page left open over midnight cannot submit an expired date.

## Configuration dependency

The owner says they already have a bot and wants private delivery. Its token and destination are not yet configured. Prepare and verify code before requesting the remaining configuration; do not report Telegram delivery as active until a real notification is accepted.
