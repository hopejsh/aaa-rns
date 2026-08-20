<p align="center"><b>English</b> · <a href="README.ko.md">한국어</a> · <a href="README.ja.md">日本語</a></p>

# AAA-RNS — AI Agent-driven Autonomous Research Notebook System

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.21937754.svg)](https://doi.org/10.5281/zenodo.21937754)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/hopejsh/aaa-rns)](https://github.com/hopejsh/aaa-rns/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/hopejsh/aaa-rns/total)](https://github.com/hopejsh/aaa-rns/releases)

**A research notebook for the labs the ELN market cannot reach: no server, no cloud account, no Docker, no IT department.**

Unzip a folder, double-click, and it runs — on a laptop with the network cable pulled.
Upload your own project documents and it builds a research-notebook system shaped around
*your* project, then drafts each note from the lab logs and measurement files you feed it.
Every sentence it writes carries the evidence ID it came from, and it will not seal a note
containing a claim the evidence ledger does not support.

Korean · English · Japanese, at parity.

![AAA-RNS in thirty-four seconds: uploading a project plan, the extraction showing a source and a confidence per value, an experiment log and a measurement CSV attached by SHA-256, sections drafted with [E#] citations, four gates running, two people signing, and the note sealed](.github/branding/demo.gif)

*Unzip to sealed note. No server, no account, no build step.*


---

## Quick start

| Platform | How to start |
|---|---|
| macOS | double-click `start_mac.command` |
| Windows | double-click `start_windows.bat` |
| Any | `python3 server.py` → open `http://localhost:8777` |

> **First run only:** the OS checks files extracted from a downloaded zip before running
> them — on macOS, **right-click `start_mac.command` → Open** (or System Settings → Privacy &
> Security → "Open Anyway"); on Windows, click **More info → Run anyway** on the SmartScreen
> prompt. After that, a double-click is enough.

No registration key. No account. No installer. Chrome or Edge recommended (shared-folder mode
uses the File System Access API). Python 3 is the only prerequisite, and macOS and most Linux
systems already have it.

First run walks you through four steps: **upload your documents → deep analysis → review what
was extracted → generate the system.** `sample_docs/` has a sample plan and metrics table if you
want to try it before using real documents.

📘 **[Installation & user guide (PDF, with real screen captures)](docs/en/installation-guide.pdf)** · [User manual](docs/en/user-manual.md) · [Verification report](docs/en/verification-report.md) · [All documents, three languages](docs/README.md)

---

## What makes it different

**It drafts from your evidence, not from a template.** Drop in an experiment log or a
measurement CSV; the file is attached with its SHA-256 hash, evidence is registered as `[E#]`,
and the work-performed, result-data and interpretation sections are written from that evidence
alone. Sentences come only from the uploaded originals — the system does not compose facts.

**It refuses.** Four deterministic gates run before a note can be sealed:

| Gate | What it checks |
|---|---|
| G1 Evidence mapping | Sentences with no evidence ID, citations of evidence that does not exist, speculative wording |
| G2 Longitudinal consistency | Period overlap with sealed notes, contradictory values for one metric, status regression |
| G3 Numeric & unit audit | Recalculated sums and ratios, unit notation, direction against target, unsupported claims of achievement |
| G4 Compliance | Required fields, and originals attached for every cited evidence item |

A note with outstanding findings cannot be sealed. Nothing is discarded — the text and the
findings are both kept, so a refusal is a record, not a deletion.

**Sealed means sealed.** On sealing, the note's hash covers the content *and the signatures*
together and chains to the previous sealed note. Editing the text afterwards — or swapping an
approver's name — is exposed by the chain check. Changes are made only by issuing a revision
(-R1, -R2 …); the original and the revision history both remain.

**Zero dependencies, and that is not a slogan.** The PDF, DOCX, XLSX, HWPX and CSV parsers, the
DOCX/XLSX generators, the charts and the hash chain are all implemented in this repository.
There is no CDN, no npm install, no build step. The Content-Security-Policy blocks outbound
requests entirely — *except* to the three AI endpoints (Anthropic, Google, OpenAI), and only if
you choose to connect an AI engine, which is off by default and never required.

**26 specialist agents.** Seven layers with group leads, typed packets and a single-writer
blackboard ([agents/MAS_SPEC.md](agents/MAS_SPEC.md)). The prompts are engine-neutral templates.
The deterministic core — parsers, gates, hash chain — runs in the browser with no LLM at all.

---

## Honest limits

Stated here rather than discovered later:

- **This is not a LIMS.** No sample or inventory management, no instrument integrations, no
  real-time co-editing, no mobile app.
- **Identity is self-asserted.** Signatures carry a per-user device key (ECDSA P-256,
  non-extractable) and optionally a passkey (WebAuthn — Touch ID and the like); both are locked
  under the seal hash, so swapping a signer after sealing breaks the chain. But no certificate
  authority vouches that the key belongs to *that person*. The PIN is stored with
  PBKDF2-SHA256 (210,000 iterations, salted) and is still not access control — real access
  control comes from the OS permissions on your shared folder.
- **Timestamps default to the machine's clock.** An admin can enable RFC-3161 timestamping in
  Settings: on sealing, the seal hash (32 hash bytes only — never content or files) is sent to
  a TSA and the signed token is attached. Off by default; when offline it silently falls back
  to the local clock. The default TSA (FreeTSA) is not an accredited authority.
- **It still cannot meet any regime that requires a certificate-based electronic signature
  or an accredited timestamp** — one technical fact that carries a different name in each
  jurisdiction: **not 21 CFR Part 11-capable** (US FDA); **not a qualified signature or
  timestamp under eIDAS**, and not compliant with **EU GMP Annex 11** (EU); not compliant with
  the **ER/ES guideline** (Japan); and it does not satisfy **국가연구개발사업 연구노트 지침
  전자서명인증** as required by 국가연구개발사업 연구노트 지침 (Korea). It is a research-integrity
  and reproducibility tool, not a regulated-record system. The clause-by-clause position, including
  what is and is not verifiable, is in the [compliance matrix](https://hopejsh.github.io/aaa-rns/compliance.html);
  the threat model is in [SECURITY.md](SECURITY.md).
- The hash chain proves **internal consistency**. By default it is tamper-*evident*, not
  tamper-proof. With RFC-3161 enabled, each sealed note's hash and time are anchored outside
  the record-holder's control (under the TSA's signature) — but never retroactively.

If your lab is well funded, cloud-comfortable and needs deep sequence or chemistry tooling,
Benchling or Revvity will serve you better. This is for the labs those products cannot reach.

---

## Verification

Two campaigns, **21 cycles, 2,446,015 simulation runs** — deliberately injecting missing
citations, contradictory figures, tampered signatures, corrupted backups and forged licenses,
then asserting the product blocks them. Five genuine defects were found and fixed; three
findings turned out to be defects in the test code and were retracted rather than counted.

```bash
node simulation/run_simulation.mjs --campaign 2 --cycle 9 --iters 150000
```

Runs are reproducible from the seed. Reports: [`simulation/reports/`](simulation/reports/) —
including [an honest note](simulation/reports/README.md) about nine campaign-1 reports that were
lost to an overwrite and are **not** reconstructed. Full write-up:
[verification report](docs/en/verification-report.md).

---

## Editions

The build in this repository is the **Community edition**: no registration key, no limit on the
number of projects. An **Enterprise edition** — the same code with one constant flipped in
[`js/core/edition.js`](js/core/edition.js) — requires a signed license key and binds an
installation to a single project, for builds issued to a named company or institute.

Because the source is published, a key check cannot stop anyone able to edit the code. Its
purpose is confirming who a build was issued to, not technical copy protection.

---

## Where your data lives

`data/` project structure and audit log · `notes/` research notes · `notes_files/` your uploaded
originals · `ledger/` evidence ledger · `archive/` permanent copies of sealed notes. All of it
stays on your machine, or in the team folder you point it at. None of these directories is
tracked by git. Backups are a single ZIP with a per-file SHA-256 manifest, and a restore writes
nothing unless every file passes verification.

---

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Two house rules:
documentation changes may not introduce a claim the repository cannot evidence, and the three
READMEs move together.

## Citing this software

If this software contributed to work you publish, please cite it. The repository carries a
[`CITATION.cff`](CITATION.cff), so GitHub's **"Cite this repository"** button on the sidebar
produces APA and BibTeX for you.

> Jung, S. H. (2026). *AAA-RNS: AI Agent-driven Autonomous Research Notebook System* (Version 2.1.0)
> [Computer software]. https://doi.org/10.5281/zenodo.21937754

```bibtex
@software{jung_aaarns_2026,
  author    = {Jung, Seung Ho},
  title     = {{AAA-RNS: AI Agent-driven Autonomous Research Notebook System}},
  version   = {2.1.0},
  year      = {2026},
  publisher = {Zenodo},
  doi       = {10.5281/zenodo.21937754},
  url       = {https://github.com/hopejsh/aaa-rns}
}
```

Zenodo issues two DOIs. **`10.5281/zenodo.21937754`** is the *concept* DOI and always resolves to
the newest release — cite this one normally. **`10.5281/zenodo.21955354`** is the *version* DOI,
frozen to v2.1.0 (this release); cite it instead when the exact bytes matter, such as in a
reproducibility statement or a methods section describing a specific analysis. Every earlier
release keeps its own version DOI, listed under the concept DOI on Zenodo.

If your journal uses Research Resource Identifiers, cite **AAA-RNS (RRID:SCR_028836)** inline
in the Methods section. That is the registry entry, and it is separate from the DOI: the DOI
belongs in the reference list, the RRID in the running text.

## License

Apache License 2.0 — [LICENSE](LICENSE) · [NOTICE](NOTICE) · Copyright © 2026 Seung Ho Jung

## Developer

**Seung Ho Jung** — system design, core engines (parsers, analyzer, generator, gates, hash chain),
the 26-agent MAS architecture, and the verification simulation harness.
