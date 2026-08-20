# Security policy

## Threat model — read this before deploying

AAA-RNS is a **local, single-user application**. Being honest about what that means matters
more than a list of features:

- **The PIN is not access control.** It is stored as a salted PBKDF2-SHA256 hash
  (210,000 iterations; records created before v2.1.0 used unsalted SHA-256 and are upgraded
  in place on the next successful entry) and gates destructive actions in the interface.
  Anyone with file-system access to the data directories can read and modify records without
  going through the application. Real access control must come from the operating system's
  permissions on the folder.
- **Signature keys prove key possession, not legal identity.** Each user gets an ECDSA P-256
  device key, generated non-extractable and kept in the browser's IndexedDB — it never enters
  the shared folder; only the public key is published in `data/users.json`. A passkey
  (WebAuthn) can be added on top. Both signatures are covered by the seal hash, so replacing
  a signer after sealing breaks the chain, and a signature made with a key that is not in the
  user's key registry is flagged. What none of this provides is certification that a key
  belongs to a legal person — there is no CA. Clearing browser storage destroys the private
  key; past signatures stay verifiable, and a new key is enrolled alongside the old public key.
- **Do not expose it on a network.** `server.py` binds to `localhost` deliberately. It has no
  authentication, no TLS, and no rate limiting. Serving it on a LAN or the internet would give
  every reachable machine full read/write access to the records.
- **The hash chain is tamper-evident, not tamper-proof.** It detects modification of sealed
  content or signatures. It does not prevent it, and because the chain head is stored alongside
  the records, someone who controls the records can recompute the whole chain. Anchoring the
  chain head outside that control is required before the chain proves anything against a
  motivated insider — which is exactly what the opt-in RFC-3161 timestamping provides for
  notes sealed after it is enabled, and nothing provides for notes sealed before.
- **Timestamps default to the machine's clock** and can be moved by anyone who can change the
  system time. An administrator can enable RFC-3161 timestamping in Settings: on sealing, the
  32-byte seal hash — never content, filenames or metadata — is sent through the local server
  (`/tsa`, fixed allowlisted target, so the page's CSP stays `connect-src 'self'` plus the AI
  endpoints) to a TSA, and the signed token is stored on the note. In-app verification checks
  the token's structure, imprint and genTime; full cryptographic verification is one
  documented `openssl ts -verify` command. The default TSA (FreeTSA) is not an accredited
  authority, and if the request fails the note seals anyway with the local clock — a note is
  never blocked or lost because a third party was unreachable.
- **License keys can be forged by modifying the client.** The published build verifies an ECDSA
  signature in the browser using an embedded public key. Since the source is published, the
  check can be removed. It confirms who a build was issued to; it is not a security control.
- **API keys for optional AI engines are stored in `data/llm.json` in clear text**, and in
  shared-folder mode the whole team can read them. Use a key scoped to this purpose.

## Supply chain

This repository has **no runtime dependencies** — the parsers, generators, charts and hash chain
are all in this tree, and the application makes no network requests. The only externally authored
code that runs anywhere near it is the GitHub Actions used by CI and the release workflow, and the
release workflow holds `contents: write`.

Those actions are therefore **pinned to full commit SHAs, not to tags**. A tag like `@v2` can be
moved by the action's owner at any time; a commit SHA cannot. The repository deliberately runs no
update bot: SHA bumps are made by the maintainer by hand and reviewed like any other commit, which
for a dependency surface this small — a handful of pinned actions — is a workable trade.

Released archives ship with a SHA-256 sum, and `tools/verify-dist.sh` will re-check any archive —
including one you downloaded — against the same ten checks the build itself must pass.

## Supported versions

| Version | Supported |
|---|---|
| 2.0.x | ✅ |
| < 2.0 | ❌ |

## Reporting a vulnerability

**Please do not open a public issue.** Use GitHub's
[private vulnerability reporting](../../security/advisories/new) on this repository.

Include what you found, how to reproduce it, and what an attacker could achieve. You will get
an acknowledgement within a week. This is a single-maintainer project, so please allow
reasonable time before any public disclosure.

Reports about the classes listed under "Threat model" above are already known and documented —
they are design limits, not undisclosed vulnerabilities. Reports that these limits are worse
than described, or that a stated protection does not actually hold, are very welcome.
