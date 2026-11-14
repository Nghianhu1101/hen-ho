# Telegram Notifications Implementation Plan

> **For agentic workers:** Use the existing shared worktree and bounded ownership below. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send the confirmed dating ticket to the owner's private Telegram chat.

**Architecture:** A buildless browser sends structured choices to a Pages Function. The function validates inputs, uses encrypted server secrets and KV, and calls Telegram.

**Tech Stack:** Existing HTML/CSS/JS, Cloudflare Pages Functions and KV, Node native tests, Telegram Bot API. No runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-11-14-telegram-notifications-design.md`

## Global Constraints

- Preserve the existing site and copy/ticket flow.
- Secrets and destination are server-only; never commit credentials.
- Trigger only when “Đi thôi!” confirms a valid ticket.
- Current Pages project is `hen-ho`; production domain is `henho.nghiacloud.cloud`.
- Failures keep the ticket usable and offer a deliberate retry.

## Review Focus

- A successful upstream HTTP response with Telegram `ok:false` must be a failure.
- Retrying a completed request must avoid a second delivery; an unsuccessful attempt may be retried.
- Network failures must not freeze the ticket or show false success.
- Date validation must use real calendar dates and Asia/Bangkok's current day.
- Secrets and upstream error contents must not appear in static files, JSON responses, or logs.

### Task 1: Server delivery endpoint

**Files:** `functions/api/notify.js`, `tests/notify.test.js` (endpoint agent only).

**Interface:** `POST /api/notify` accepts `{ticketNo,date,time,food,pronouns,requestId}`; returns `{ok:true}` or `{ok:false,error}`. Environment bindings: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NOTIFICATION_STATE`.

- [x] Write tests for payload validation, bounded body, fixed recipient/message, configuration failure, Telegram failures, deduplication and rate limiting.
- [x] Run `npm test` and observe missing-handler RED.
- [x] Implement handler with no external dependencies; run `npm test` to GREEN.

### Task 2: Browser confirmation and deployment preparation

**Files:** `index.html`, `notification-client.js`, `date-utils.js`, client/date tests, `scripts/build.mjs`, `wrangler.jsonc`, `README.md` (root only).

**Interface:** `createTicketNotifier({fetchImpl,onStatus})` exposes `notify(payload)` and `reset()`; status is idle/pending/sent/failed. It adds a stable UUID to the structured payload, deduplicates pending/completed choices and preserves failed IDs for deliberate retry.

- [x] Test pending deduplication, success, failure/retry, reset and stale responses with native Node tests; observe RED before implementation.
- [x] Integrate confirmation and retry status into final ticket; keep existing copy controls.
- [x] Build `dist/` from explicit static files; configure only actual `/api/notify` function routing.
- [x] Run the complete tests and local Pages/browser smoke tests; request independent code review.
- [x] Fix reviewed date mismatch using two RED/GREEN tests and an actual browser clock-boundary regression check. Full suite: 81 passing.
- [ ] Complete Cloudflare secret/recipient setup, send one clearly marked test notification, deploy, verify the live confirmation flow, and preserve a clean source commit.
