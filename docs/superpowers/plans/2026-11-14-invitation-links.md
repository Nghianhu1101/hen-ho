# Invitation Links Implementation Plan

**Goal:** Deliver five working A–E invitation URLs whose confirmed tickets identify the configured link label in Telegram.

**Architecture:** Path codes are optional browser inputs; private KV is authoritative for the server label. Existing static Pages and notification Function are reused.

**Spec:** `docs/superpowers/specs/2026-11-14-invitation-links-design.md`

**Baseline:**200367e,100passing tests. Isolated branch feat/invitation-links.

- [x] Backend agent owns notify handler/tests: RED unknown/known/malformed/spoofed/revoked/KV-error/legacy cases, implement lookup, GREEN suite.
- [x] Root owns client/parser/tests: RED path/trailing-slash/field forwarding/invite-aware dedup, implement; use absolute imports and add explicit static rewrites/notice/docs.
- [x] Generate A–E codes once in ignored owner-local manifest; provision and verify five private KV mappings.
- [x] Independent review and browser QA for deep paths/module loading/optional code/notice/noearlynotifications (112 tests passing; A–E and trailing slash verified).
- [ ] Tests/build, commit/deploy, five production GET checks and one announced real A confirmation; update main/GitHub and return all five links.

## Review focus

- Valid-looking but unconfigured codes and forged labels cannot produce attributed messages.
- Invitation paths including trailing slash must load JS and keep the code through confirmation/retry.
- Legacy root URL remains usable and unlabeled; existing metadata and transport protections remain.
- No real codes/mapping list in public assets or tracked Git; runtime responses disclose no label or secret.
