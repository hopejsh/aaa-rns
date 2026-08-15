# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Pending
- **RRID `SCR_028836`** was assigned by the SciCrunch registry on submission, but the
  record is still `Pending` curation and `scicrunch.org/resolver/RRID:SCR_028836`
  returns 404. It was briefly added to the READMEs, the landing page, `CITATION.cff`
  and `codemeta.json`, then reverted: publishing an identifier that does not resolve is
  the same defect this product exists to prevent, and `CITATION.cff` in particular is
  harvested by tools that would propagate a dead identifier further than the mistake.
  It goes back in once the resolver answers.

## [2.1.0] — 2026-08-15

Tier-1/2 hardening: cryptographic signatures and opt-in trusted time. What this release
does **not** change: identity is still self-asserted (no certificate authority), and the
default TSA is not an accredited service — the compliance matrix rows moved by this
release are marked there, and the ones that did not move are marked too.

### Added
- Archived on Zenodo: version DOI `10.5281/zenodo.21955354` (frozen to this release);
  the concept DOI `10.5281/zenodo.21937754` continues to resolve to the latest.
- **Device-key signatures** (`js/core/signing.js`): every user gets an ECDSA P-256 key
  pair on registration, generated non-extractable and kept in the browser's IndexedDB.
  The private key cannot be exported and never enters the shared folder; the public key
  is recorded in `data/users.json` with a fingerprint. Contributor and final-approval
  signatures automatically carry a signature over the content hash, and both are locked
  under the `seal_algo: v2` digest — swapping a signature after sealing breaks the chain.
- **Passkey (WebAuthn) signing, optional**: enroll a platform authenticator (Touch ID,
  Windows Hello, …) in Settings and require a presence check at signing. ES256 only;
  assertions are verified against the challenge (the content hash), origin type and
  authenticator data, with DER→P1363 conversion handled explicitly.
- **Opt-in RFC-3161 timestamping** (`js/core/timestamp.js`): off by default, admin-only
  toggle. On sealing, the 32-byte seal hash — never content, filenames or metadata — is
  sent to the TSA and the signed token is attached to the note (`note.rfc3161`). Offline
  or TSA failure degrades silently to the local clock and never blocks sealing. In-app
  verification checks token structure, imprint match and genTime; the panel shows the
  `openssl ts -verify` command for full cryptographic verification. Because public TSAs
  send no CORS headers, the local server relays the request (`/tsa`, fixed allowlisted
  target in both `server.py` and `server.ps1`) — the page CSP stays `connect-src 'self'`.
- **Signature · timestamp verification panel** on sealed notes: per-signature verdicts
  (device key / passkey / name-only), key-registry match, and timestamp status, in all
  three languages.
- Simulation category `crypto_sign_ts` (3,000 planned iterations per cycle): TSQ
  structure against RFC 3161 §2.4.1, a real FreeTSA response fixture cross-checked with
  openssl (`simulation/fixtures/`), token tampering, ECDSA verify/tamper/rogue-key,
  seal-coverage invariants, and PBKDF2 vectors. Detection was proven by planting two
  deliberate defects (imprint check skipped; signature digest constant) and watching
  them get caught — 16,762 failures across 9 defect signatures — before the clean run:
  **campaign 3, cycle 2: 150,001 iterations, 0 failures.** Cumulative: 2,746,017.

### Changed
- **PIN storage: PBKDF2-SHA256** (210,000 iterations, 16-byte per-user salt) replaces
  the unsalted SHA-256 hash. Existing hashes are upgraded in place on the next
  successful entry, with an audit entry. The PIN is still not access control.
- READMEs (×3), landing page, `SECURITY.md`, the compliance matrix and the user manuals
  (×3) rewritten where their statements stopped being true — including the roadmap
  items this release ships (item 2 in full; the RFC-3161 half of item 5; the key-pair
  half of item 6) and the § 11.200(a)(1) and § 11.10(h) verdicts, which moved from
  "Not supported" to "Partially supported" with the conditions stated.

## [2.0.1] — 2026-08-14

(This entry was written retroactively on 2026-08-15 — the v2.0.1 release shipped without
its changelog section, which this file exists to prevent.)

### Added
- GitHub Pages landing page (`docs/index.html`) and the clause-by-clause compliance
  matrix (`docs/compliance.html`, 92 verdicts), both trilingual.
- Demo recording (GIF and MP4) and its capture/encoding scripts; the landing page and
  README lead with it.
- Author ORCID in the citation metadata; Zenodo DOIs recorded in the READMEs.
- GitHub Actions pinned to full commit SHAs; Dependabot bumps reviewed and merged.

### Fixed
- **G1 blocked speculative wording in Korean only** — the forbidden-pattern list now
  covers all three interface languages (22 patterns), with a hand-written test category
  whose cases do not come from the implementation.
- The landing page offered a v2.0.0 download next to a badge reading v2.0.1; the button
  is now versionless and CI checks for stale version strings.
- A README claim attributing 시점인증 to a specific clause of the 연구노트 지침 was
  corrected — the article number could not be verified against the primary source.

### Reverted
- RRID `SCR_028836` (see Pending above): added, then removed while the registry record
  is still awaiting curation and the resolver returns 404.

## [2.0.0] — 2026-08-14

First public release.

### Added
- Archived on Zenodo with a DOI: `10.5281/zenodo.21937754` (concept, always latest) and
  `10.5281/zenodo.21937755` (this release). `CITATION.cff` carries both, so GitHub's
  "Cite this repository" button produces APA and BibTeX.
- **Community edition** (`js/core/edition.js`): the published build needs no registration
  key and places no limit on the number of projects. The signed-key path and the
  one-project binding remain, behind a single constant, for builds issued to a named
  company or institute.
- Trilingual interface at parity — Korean, English, Japanese — including the official
  document labels and the browser tab title.
- Automatic drafting: uploaded experiment logs and measurement files become evidence
  ledger entries, and the work-performed / result-data / interpretation sections are
  written from that evidence alone.
- Roadmap and Planner views (sprint list, WP Gantt, monthly) with a today marker,
  adjustable view period, and click-through from any row to the related research notes.
- 26-agent multi-agent specification with group leads and typed packets.
- Monthly backup reminder, on-demand full backup with a per-file SHA-256 manifest, and
  a restore that writes nothing unless every file verifies.

### Changed
- **License: MIT → Apache-2.0.** The explicit patent grant and change-notice terms make
  corporate legal review substantially easier, which is the adoption path this project
  is aimed at.
- Seal hash now covers the signatures as well as the content (`seal_algo: v2`), so
  substituting an approver's name after sealing is detected. Existing v1 records keep
  verifying under the original formula rather than raising false tampering alarms.
- G3 now detects achievement claims written in free text, in all three languages, while
  excluding negations such as "not achieved".
- Simulation reports are written to campaign-scoped paths so reusing a cycle number can
  no longer overwrite existing evidence.

### Fixed
- Browser tab, bookmark and window title stayed Korean in the English and Japanese
  interfaces — `<title>` lives in `<head>`, outside the translation layer's reach.
- Product title read "Research Note Automation System" directly above the acronym
  expansion "…Research Notebook System" on the same screen.
- Sample document metadata carried the removed edition label in its `dc:creator` field.

- Training decks: the legal-notice slide said the program is distributed under the
  MIT License. Corrected to Apache License 2.0 in the PowerPoint sources and in all
  three exported PDFs.
