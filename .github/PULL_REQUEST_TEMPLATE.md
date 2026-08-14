## What and why

<!-- What behaviour changes, and what problem it solves. -->

## Checklist

- [ ] `node --check` passes on every changed `.js` / `.mjs`
- [ ] If parsing, gates, hash chain or i18n changed: the simulation harness ran clean
      (`node simulation/run_simulation.mjs --campaign 2 --cycle 9 --iters 150000`)
- [ ] If documentation changed: **all three** READMEs / manuals were updated together
- [ ] No new claim that the repository cannot evidence (numbers, compliance, comparisons)
- [ ] No runtime data (`data/`, `notes/`, `notes_files/`, `ledger/`, `archive/`) is included
- [ ] Interface strings added to `js/i18n/dict.js` for all three languages, and record content
      is not translated
