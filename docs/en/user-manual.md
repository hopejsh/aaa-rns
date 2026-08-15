# AI Agent Research Notebook Automation System (AAA-RNS) — User Manual

> This is a reference document to consult as needed. To install and follow the steps in order for the first time, see `installation-guide.pdf`.

## 1. Starting

| Platform | How to start |
|---|---|
| macOS | Double-click `start_mac.command` |
| Windows | Double-click `start_windows.bat` |
| Manual | Run `python3 server.py`, then open `http://localhost:8777` |

- Recommended browsers: **Chrome or Edge** (shared-folder connection works only in these two)
- No internet connection is required. Everything is processed on this PC.
- The server window (the black one) is the engine. Leave it open while you work.
- Its messages are in English regardless of the interface language — terminal fonts
  cannot be relied on to render Korean or Japanese, and English beats mojibake.

## 2. Language

The interface is available in **Korean · English · Japanese**.

- On first run the language is **chosen automatically from your browser (OS) language**.
  In an unsupported locale it starts in English.
- Change it any time: the selector at the top right of the registration screen before
  you enter the app, and the selector in the header once inside. The choice is saved.
- Changing the language also changes the labels of the official document (on screen and in DOCX).

**What is never translated** — company data (project titles, organisation names, people's
names, quoted evidence, measured values) stays exactly as written, in every language,
because the authenticity of the record is the point of the product. Sentences the system
composes itself (interpretations, measurement conditions, evidence locators) are
**generated in the interface language at the time of writing** and stored that way.

## 3. Editions and licensing

The **Community edition** you downloaded from this repository **requires no
registration key.** Unzip it, run it, and onboarding begins immediately; there is no
limit on the number of projects you may create.

**Enterprise edition** — builds issued individually to a company or institute behave
differently.

- On first run, paste the **license key** you received into the registration screen, or
  select the `.lic` file. Verification is a digital-signature check and completes
  **instantly, offline**.
- **One license = one project.** During the first onboarding the key is bound to that
  project number; a different project needs a new key. A system reset does not clear the binding.

Either way, Settings → Product information shows your current licensing status.

Note, plainly: because this is a local application with published source, a key check
cannot stop anyone able to edit the code. Its purpose is not technical copy protection
but confirming who a build was issued to and making the one-project limit contractually
enforceable.

## 4. Initial setup and user roles

On first access the **initial setup** dialog appears: register your name, e-mail,
and a PIN (at least four digits). If your company uses a shared folder, connect it here
(once per PC).

- **First registrant = Data Custodian (default)** — [Data management] (backup, restore,
  reset) is shown only to this person, and restore and reset re-confirm the PIN.
- **Transferring the role** — Settings → Data management → [Transfer Data Custodian role]
  hands it to another registered user at any time (current custodian's PIN required, written to the audit log).
- Change your PIN: Settings → My account.

Note: being a local application, this role separation is an operational-policy control.
Enforceable access control comes from the OS permissions on the shared folder, and
tamper detection comes from the hash chain.

## 5. Onboarding — building the system for your project

A four-step onboarding starts on first run.

1. **Upload documents** — drag in the R&D plan, proposal, schedule, metrics table, and so on.
   Supported: PDF · DOCX · XLSX · HWPX · CSV · TXT (several at once).
2. **Deep analysis** — the project title, number, organisation, period, budget, work
   packages, metrics, milestones, and members are extracted. Every extracted value carries
   its basis (document, position, quotation) and a confidence rating.
3. **Review the extraction** — the system decides nothing on its own. Check and correct each
   item before continuing. Anything it could not extract is listed under "Items needing review".
4. **Generate the system** — the research period is divided into a fortnightly (or weekly)
   sprint grid, with one research-note slot per sprint.

## 6. Screens

| Screen | Purpose |
|---|---|
| Dashboard | Elapsed period, sealed notes, awaiting signature, evidence entries, milestones, current sprint |
| Roadmap | The whole project on one screen: WP bars + note-status dots + ◆ milestones + today line |
| Planner | **Sprint** (list by period) · **WP Gantt** (schedule bars) · **Monthly** (progress by month) |
| Research Note | The note list and states |
| Evidence Ledger | Every registered evidence item `[E#]` with source and hash |
| Performance Metrics | Measured values from sealed notes, against target |
| AI Agents | Roster of the 26 specialist agents (reference) |
| Settings | My account, AI engine, data management, product information |

**Linked navigation** — clicking a WP row in the Roadmap, a WP row in the Planner's Gantt,
or a row in the Monthly view opens the related research notes; clicking a note there opens it.
The **←** button at the top returns to the previous screen at any time.

**View period** — the Roadmap and the WP Gantt can be narrowed to All time, This year,
Last 12 months, Next 6 months, or a custom range. Narrowing switches the axis to months,
and if today falls outside the view the screen says so.

## 7. Writing a research note

Click a sprint in the Planner or the Roadmap to open the note editor. Enter the
**author** and the **reviewer** at the top (they must differ).

**Auto-writing (the core feature)**

1. Drag the raw material for the period — experiment logs (TXT), measurement data (CSV) —
   onto the dashed box.
2. Each file is attached with its SHA-256 hash, and evidence is registered from its contents as `[E#]`.
3. Confirm at the "Analyse now?" prompt, or press [Start analysis] later, and the
   **work performed · result data · interpretation** are written automatically and the gates run.

- Every sentence carries the evidence number `[E#]` that supports it. Sentences come only
  from the uploaded originals; the system never invents facts.
- Originals containing prohibited wording, and records dated outside the period, are excluded
  from the draft (they remain as evidence).
- If a record's date falls outside the note's period, the system **finds the sprint it belongs
  to and offers to write into that note**. Sealed notes are skipped with a note that a revision is required.
- Measured values are never adjusted — if an original breaks a unit rule, G3 reports it.

**Manual routes** — [Manual entry] lets you pick evidence candidates yourself, and
[Direct entry] registers a researcher statement (no original to check against → low evidence strength).

## 8. Verification gates

A gate is not a suggestion but a **barrier**. A note with outstanding findings cannot
be sealed (in advisory mode it can still be saved, with the findings preserved).

| Gate | What it checks |
|---|---|
| G1 Evidence mapping | Sentences without an evidence number, citations of non-existent evidence, speculative or exaggerated wording |
| G2 Longitudinal consistency | Period overlap with sealed notes, contradictory values for one metric, status regression |
| G3 Numeric & unit audit | Recalculated sums and ratios, unit notation, direction against target, unsupported claims of achievement |
| G4 Compliance | Required fields (author, reviewer, period, hash, …) and originals attached for cited evidence |

G3's achievement check covers not only the structured field but also **achievement claims
written in free text** in the measurement condition (Korean, English, Japanese). Negations such as
"not achieved" are not treated as claims.

## 9. Signing, sealing, revising

1. The author gives a [Contributor signature].
2. The reviewer gives [Final approval · Seal] under their own name → **sealed**.
   - Final approval by the author is blocked by the cross-approval principle.
3. A sealed note cannot be edited. Changes are made only by issuing a **revision (-R1, -R2, …)**;
   the original and the revision history both remain.

**How sealing works** — on sealing, the note's hash **covers the content and the signatures
together** and is chained to the hash of the previous sealed note (`seal_algo: v2`). So not
only editing the text afterwards but also **swapping an approver's name** is exposed
immediately by Settings → Verify hash chain. At the moment of sealing, the original JSON and
the official DOCX are archived automatically under `archive/<year>/`.

**Cryptographic signatures (v2.1)** — every signature automatically carries a **device-key**
signature (ECDSA P-256). The private key is generated non-extractable inside the browser
(IndexedDB) and never leaves the machine; only the public key is published in the user record
for the team to check against. In Settings → **Signing · Timestamping** you can additionally
enroll a **passkey** (Touch ID, Windows Hello, …) to require a presence check at the moment of
signing. Both are locked under the seal hash, so swapping them after sealing breaks the chain,
and a signature made with a key that is not in the key registry is flagged in the verification
panel. Clearing browser storage destroys the device key — existing signatures remain
verifiable, and a new key is enrolled on the next signature.

**Timestamping (RFC-3161, optional)** — when an administrator enables it in Settings →
Signing · Timestamping, sealing sends **only the 32-byte seal hash** (never content or files)
to a timestamping authority (TSA) and attaches the signed time token to the note. **Off by
default**; when offline, the note seals with the local clock and is never blocked. The
"Signature · timestamp verification" panel on a sealed note checks the token's structure, hash
match and issue time, and shows the command for full cryptographic verification
(`openssl ts -verify`). The default TSA (FreeTSA) is not an accredited authority.

## 10. Connecting an AI engine (optional)

The system works completely without an LLM. Connecting one makes the auto-written prose
read more naturally.

- Settings → **AI engine (LLM)** (Data Custodian only): choose Anthropic Claude, Google Gemini,
  or OpenAI → enter the model and API key → [Test connection] → [Save].
- Once saved, a **[Polish prose with AI]** button appears on the note screen.
- **Safeguards**: polished sentences are re-verified by the gates; any sentence whose `[E#]`
  citations change or that introduces prohibited wording is discarded, and if gate findings
  increase the whole result is reverted.
- Note: OpenAI sometimes blocks direct browser calls (CORS) — in that case use Claude or Gemini.
- The key is stored in `data/llm.json` — in shared-folder mode the team shares it and it is included in backups.

## 11. Team collaboration (shared folder)

- Click the storage indicator at the top left → designate a folder on the company drive
  (Chrome/Edge, once per PC).
- Once connected, every record is stored there as real files and the team sees the same records.
- Concurrent editing is protected by optimistic locking (`_rev`), which prevents lost updates.
- Enforce real access control through your company's folder permissions (read/write).

## 12. Storage, backup, security

| Folder | Contents |
|---|---|
| `data/` | Project structure, planner, metrics, audit log (append-only) |
| `notes/` | Research notes (state, signatures, hashes) |
| `notes_files/` | The original uploaded files |
| `ledger/` | Evidence ledger |
| `archive/` | Permanent copies of sealed notes (created on sealing; never rewritten by the app) |

**Backup** — Settings → [Full backup (.zip, originals included)]. The archive contains
`backup_manifest.json` with a per-file SHA-256, so a restore begins writing **only after every
file passes integrity verification**. If even one byte is damaged, your existing data is left
completely untouched. You can take a backup **whenever you like**, and 30 days after the last one
the dashboard reminds you once a month (this can be switched off in Settings).

**Security design**

1. **Fully offline** — CSP `connect-src 'self'` blocks outbound transmission itself
   (only the three AI endpoints are excepted, and only when an AI engine is connected; with
   timestamping enabled, the local server relays only the 32-byte seal hash to the TSA —
   content never leaves the machine in any case).
2. **Local server only** — bound to `localhost`; never exposed externally.
3. **Tamper detection** — SHA-256 for uploaded originals; a content+signature hash chain for sealed notes.
4. **Audit trail** — gate verdicts, signatures, sealing, backup, restore, and role transfers are recorded append-only.
5. **PIN storage** — PBKDF2-SHA256 (210,000 iterations, per-user salt). Hashes from before
   v2.1 are upgraded in place on the next successful entry. The PIN is still not access
   control — real access control is the OS permissions on your shared folder.

## 13. Testing with synthetic documents

Ways to exercise the system without real documents:

1. **Sample documents** — upload the sample plan and metrics table in `sample_docs/` during onboarding.
2. **Synthetic document generator** — double-click `가상문서_만들기.command` (Mac) / `.bat` (Windows)
   to create, under `가상문서/`, a set for a fictitious company: plan, metrics, experiment log, and
   measurement CSV (Node.js required). The `사용법.txt` inside each set walks you through the test.
   For several sets: `node simulation/make_test_docs.mjs 5`
3. **Automated verification simulation** — see section 14.

Testing tip: deliberately add a sentence without `[E#]`, or try final approval under the author's
own name — you will see the gates and the cross-approval principle block them.

## 14. Re-running verification

```bash
node simulation/run_simulation.mjs --campaign 2 --cycle 9 --iters 150000
```

Runs are fully reproducible from the seed (same cycle number → same result). Reports are written to
`simulation/reports/` as JSON and MD. For the verification history and the defects found and fixed,
see `검증보고서.md` (Verification Report).

---

AAA-RNS v2.0 · Developed by **Seung Ho Jung** · Apache-2.0 © 2026
