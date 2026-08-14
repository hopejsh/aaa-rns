# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
