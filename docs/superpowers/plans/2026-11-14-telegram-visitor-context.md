# Telegram Visitor Context Implementation Plan

**Goal:** Include connection context with confirmed dating tickets without asking for a name.

**Architecture:** Extend server-rendered Telegram text using existing request headers and `request.cf`; show a notice before the current confirmation button. No new services, credentials, persistence or client fields.

**Spec:** `docs/superpowers/specs/2026-11-14-telegram-visitor-context-design.md`

**Baseline:** commit6bdf582,92 passing tests, existing live site and bot already configured. Isolated checkout D:/webu/hen-ho-telegram, branch feat/telegram-visitor-context.

## Tasks

- [x] Backend agent owns `functions/api/notify.js` and `tests/notify.test.js`: write RED tests for trusted metadata, spoofed body fields, missing values, bounded text, coarse browser/OS, IPv6/pseudo IPv4 and VN timestamp; implement and run full suite GREEN (100 tests).
- [x] Root owns `index.html`/README: add visible disclosure before confirmation, accessible button description, no name field; document data/limits.
- [x] Review the whole change independently; verify the notice fits mobile and does not trigger notifications before confirmation.
- [ ] Run final tests/build, commit, deploy, send one live test, verify success and update main/GitHub.

## Review focus

- A caller must not override network/geography through JSON fields or arbitrary forwarded-IP headers.
- Missing Cloudflare context and unknown User-Agent must not break delivery or invent identity.
- No raw metadata in browser responses/application logs/KV; notice must be present before collection.
- Keep message length bounded and the existing manual-redirect, retry and dedup behavior.
