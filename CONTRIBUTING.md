# Contributing

Thank you for considering it. This is a single-maintainer project, so please open an issue
before starting anything substantial — it saves you from building something that will not be
merged.

## Running it

```bash
python3 server.py            # then open http://localhost:8777
```

No build step, no package manager, no dependencies. The source you edit is the source that
runs. Chrome or Edge is needed for shared-folder mode.

## Running the verification harness

```bash
node simulation/run_simulation.mjs --campaign 2 --cycle 9 --iters 150000
```

Runs are seeded and reproducible: the same campaign and cycle number always produce the same
result. Reports land in `simulation/reports/campaign<N>/`. A change that touches parsing,
gates, the hash chain, or the localisation layer should be accompanied by a clean run.

If the harness reports a failure, **first check whether the defect is in the test**. Three of
the eight defect families found during verification turned out to be harness bugs, and counting
those as product fixes would have been a lie in the verification report.

## Two house rules

**1. No claim without evidence.** This applies to the documentation as much as to the product.
Do not add a number, a compliance claim, or a comparison to another tool that the repository
cannot support. If a fact was true and stops being true, correct it rather than deleting the
inconvenient half — `simulation/reports/README.md` is the worked example.

**2. The three READMEs move together.** `README.md` (English, canonical), `README.ko.md`, and
`README.ja.md` must carry the same sections, the same anchors, and the same commands. Nothing
unique — a license, a DOI, an install command — may exist in only one of them, because GitHub
renders only `README.md`.

## Translations

Interface strings are keyed by their Korean source text in `js/i18n/dict.js`. Add the entry
there; dynamic strings with numbers go in `PATTERNS`, and mid-sentence substitutions go in
`INLINE_PATTERNS`.

Never translate company data — project titles, organisation and people's names, quoted evidence,
measured values. The authenticity of the record is the point of the product. Elements carrying
record content are marked `data-no-i18n`; do not remove that attribute.

## Never commit

`data/`, `notes/`, `notes_files/`, `ledger/`, `archive/`, `exports/` — these are runtime
directories holding real research records. They are gitignored; do not force-add them. The
license signing key lives outside the repository entirely and must stay there.

## Style

Match the surrounding code: no framework, no transpilation, ES modules, and comments that
explain *why* a decision was made rather than restating the code. Commit messages describe the
behaviour change, not the files touched.
