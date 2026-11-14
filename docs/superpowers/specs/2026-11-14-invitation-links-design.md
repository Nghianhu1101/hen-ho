# Five invitation links

The owner requested five links labelled A–E, with the label letter first in the URL suffix. Provide canonical paths `/A-<random>`, `/B-<random>`, `/C-<random>`, `/D-<random>`, `/E-<random>`. Each random part is 16 cryptographic bytes encoded as 32 lowercase hex characters. Keep the existing dating experience and require no name or login.

The browser reads a code matching `[A-Z]-[0-9a-f]{32}` from the path (one optional trailing slash) and adds optional `inviteCode` to the existing notification payload and dedup identity. Use root-relative module imports, so invitation paths and trailing slashes load the correct scripts. Explicit Pages rewrites serve the existing index for A–E path prefixes; API function routing remains unchanged.

Store only each code-to-label mapping in the existing private Cloudflare KV: `invite:<code>` -> `A` through `E`. Generate once into ignored owner-local files and reuse on retries. Do not publish actual invitation codes/mappings to Git or public assets. No public mapping-list endpoint. The server resolves the exact configured code and sends `Link được gán cho: A` in the private Telegram message; it never trusts a client-supplied label or merely the visible letter. Missing code keeps the root URL flow unchanged. Supplied invalid/unknown codes reject without sending; mapping failure or corrupt labels fail closed.

This attributes a link, not the natural person holding a device. Forwarded links retain the original label. Existing IP/approximate location/browser/OS/time context, visible confirmation notice, fixed recipient secrets, retry and rate behavior remain intact. Add “mã link” to the notice.

Verify client path parsing, optional field forwarding/dedup, private server lookup, unknown/tampered codes and backward compatibility. Test all five paths as GETs and KV mappings, but send only one announced live test (label A, ticket0002). Final output supplies all five actual URLs to the owner.
