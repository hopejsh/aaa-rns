# Security policy

## Threat model — read this before deploying

AAA-RNS is a **local, single-user application**. Being honest about what that means matters
more than a list of features:

- **The PIN is not access control.** It is stored as an unsalted SHA-256 hash on the local
  machine and gates destructive actions in the interface. Anyone with file-system access to
  the data directories can read and modify records without going through the application.
  Real access control must come from the operating system's permissions on the folder.
- **Do not expose it on a network.** `server.py` binds to `localhost` deliberately. It has no
  authentication, no TLS, and no rate limiting. Serving it on a LAN or the internet would give
  every reachable machine full read/write access to the records.
- **The hash chain is tamper-evident, not tamper-proof.** It detects modification of sealed
  content or signatures. It does not prevent it, and because the chain head is stored alongside
  the records, someone who controls the records can recompute the whole chain. Anchoring the
  chain head outside that control — a timestamping authority, an append-only external store —
  is required before the chain proves anything against a motivated insider.
- **Timestamps come from the machine's clock.** They are not from an accredited timestamping
  authority and can be moved by anyone who can change the system time.
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
moved by the action's owner at any time; a commit SHA cannot. Dependabot proposes updates monthly
as pull requests, so a new SHA is reviewed by a person rather than picked up silently.

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
