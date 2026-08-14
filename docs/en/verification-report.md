# AAA-RNS v2.0 — Verification Report

| Item | Detail |
|---|---|
| Subject | AAA-RNS v2.0 (generalised edition) |
| Developer | Seung Ho Jung |
| Method | Repeated simulate → find → fix cycles, plus real-browser end-to-end verification |
| Cycle rule | At least 100,000 runs per cycle · a hard ceiling of 12 cycles |
| Campaign 1 | 12 cycles · **1,206,006 runs** — core engines, parsers, gates, i18n |
| Campaign 2 | 9 cycles · **1,240,009 runs** — realistic operating scenarios |
| Total | **2,446,015 runs** |
| Verdict | **PASS — approved for production use** |
| Environment | Node.js v26.5.0 · Chrome (real-browser UI verification) · macOS |

---

## 1. Why simulation

A research-notebook system is trusted for what it *refuses* to record. Testing the happy
path proves nothing about that. Every cycle therefore injects defects deliberately — missing
citations, contradictory figures, tampered signatures, corrupted backups, forged licenses —
and asserts that the product blocks them. A cycle that finds nothing is not a success in
itself; it only counts after the scenarios have been made harsher.

## 2. Campaign 2 — realistic operating scenarios

Twelve new scenario families were written to reproduce what actually happens in a company:
multiple researchers working concurrently on a shared folder; the full lifecycle in three
languages; revision chains; disaster recovery from backups; adversarial LLM responses;
ten-year projects; forged licenses; large ledgers; storage migration; **post-sealing
tampering**; calendar traps (leap days, month ends, year ends); and **false achievement claims**.

| Cycle | Runs | Verdict | Distinct defects | Action |
|---|---|---|---|---|
| 1 | 125,001 | FAIL | 2 | Test-code defect (missing await) fixed — product sound |
| 2 | 125,001 | PASS | 0 | Six new scenarios passed |
| 3 | 130,002 | FAIL | 1 | Test-code defect (mutation not guaranteed) fixed — product sound |
| 4 | 130,002 | PASS | 0 | Three further scenarios passed |
| 5 | 140,003 | FAIL | 5 | **Two genuine product defects fixed** (§3.1, §3.2) |
| 6 | 140,003 | PASS | 0 | Regression after the fixes passed |
| 7 | 149,999 | PASS | 0 | Confirmed with different seeds |
| 8 | 149,999 | PASS | 0 | Final confirmation — three consecutive clean cycles |
| 9 | 149,999 | PASS | 0 | Regression after modal translation work — clean |

## 3. Genuine product defects found and fixed

### 3.1 The seal hash did not cover the signatures (severity: high)

**Symptom.** After a note was sealed, changing the final approver's name was detected by
neither the integrity check nor the hash-chain verification (reproduced 1,045 times in cycle 5).

**Cause.** The hash was computed as `seal_hash = SHA-256(content_hash + previous_hash)`, leaving
the **signature block outside the seal** (`js/core/notes.js`, sealNote). The content was protected
but *who approved it* was not — a gap in non-repudiation for a system built for audit.

**How the fix was chosen.** Three options were compared. (1) Store a signature digest in a separate
field and check it — useless if the field is forged along with the signature. (2) Change the hash
formula outright — every previously sealed note would then report as "broken", and false alarms
destroy trust in the alarm. (3) **Change the formula but version it** — adopted. New notes use
`seal_algo:'v2'` with `SHA-256(content_hash + signature_digest + previous_hash)`, while existing v1
notes verify under the original formula. Verification recomputes the digest **from the actual
signatures** rather than trusting a stored field, so forging the field does not help either.

**Verification.** Signature tampering is now caught by both the integrity check and the chain
check; cycles 6–9 detected all five tampering variants (content, measurement, signer, hash, period).

### 3.2 False achievement claims in free text were missed (severity: medium)

**Symptom.** Writing "target achieved" in the measurement condition while the value missed the
target passed G3 (reproduced 1,012 times in cycle 5).

**Cause.** G3's achievement check looked only at the structured `achieved` flag, not at free text
(`js/core/gates.js`). To an auditor both notations are equally misleading, and researchers in
practice write it in free text more often.

**How the fix was chosen.** The check was widened to free text, but with false positives treated as
the more harmful failure: negations ("not achieved", "미달성", "未達成") are excluded first, and
claims are recognised in Korean, English, and Japanese, because records are now generated in all three.

**Verification.** False claims blocked in all three languages; zero false positives on negations
and neutral wording.

## 4. Three test-code defects (product sound — false positives)

Of the eight defect families surfaced, three were faults in the test code itself. Each was
reproduced, the product was confirmed sound, and the test was corrected: `verifySealChain` is
async but was called without `await` (two places), and the license-mutation test could substitute
a character with itself, leaving the key unchanged. **Not treating a false positive as a product
defect is the central discipline of this campaign.**

## 5. Multilingual verification

Every screen and dialog was driven automatically in English and Japanese while collecting any
phrase the translation layer could not resolve. Three blind spots were found and closed:

- Conditional dialogs that only appear under specific data states were never triggered by the
  runtime scan → modal strings are now also extracted statically from the source.
- The static extractor could not read concatenated labels such as `icon('zap') + 'label'` → it now
  resolves binary and conditional expressions.
- The DOM translator was rewriting **sealed record content** (for example "목표 63%" → "target 63%"),
  which would make the displayed note differ from the sealed hash → the official document is now
  excluded from translation, labels come from the document dictionary, and system-composed sentences
  are generated in the chosen language at write time instead.

Final state: **0 untranslated UI strings, 0 partially translated strings.** What remains in Korean is
company data (project titles, people's names, quoted evidence), which must not be translated.

## 6. Verdict

> Across two campaigns and 2,446,015 simulation runs, five genuine product defects and
> the remaining harness defects were fixed, and the final cycles plus real-browser end-to-end
> verification passed with no defects.
>
> **AAA-RNS v2.0 is judged production-ready.**

Reproduce with: `node simulation/run_simulation.mjs --cycle 9 --iters 150000`
Detailed data: `simulation/reports/cycle-01~09.{json,md}`

---

AAA-RNS v2.0 · Developed by **Seung Ho Jung** · Apache-2.0 © 2026
