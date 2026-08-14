# 시뮬레이션 보고서 · Simulation reports · シミュレーションレポート

## 왜 폴더가 나뉘어 있는가 — 그리고 무엇이 없는가

검증은 두 번의 캠페인으로 수행되었습니다.

| | 목적 | 사이클 | 총 실행 |
|---|---|---|---|
| **캠페인 1** | 코어 엔진·파서·게이트·다국어 | 12 | 1,206,006회 |
| **캠페인 2** | 실제 운영 상황 시나리오 | 9 | 1,240,009회 |
| | | **21** | **2,446,015회** |

**정직하게 밝히는 결손:** 캠페인 2가 사이클 번호를 1번부터 다시 매기는 바람에,
**캠페인 1의 사이클 1~9 원본 보고서가 덮어써져 소실**되었습니다. 남은 것은
`campaign1/` 의 사이클 10·11·12 뿐이며, 소실된 9개 사이클의 결과는 집계값으로만
[검증보고서](../../docs/ko/verification-report.md)에 남아 있습니다.

이 사실을 지우지 않고 적어 두는 이유는, 근거 없는 서술을 기재할 수 없다는 것이
이 제품의 전제이기 때문입니다. 증거가 없어진 자리를 조용히 메우는 것은 그 전제를
스스로 어기는 일입니다.

**재발 방지:** 하네스가 이제 캠페인별 폴더에 기록하므로(`--campaign`), 번호 재사용이
기존 보고서를 덮어쓰지 않습니다.

## 재현

```bash
node simulation/run_simulation.mjs --campaign 2 --cycle 9 --iters 150000
```

시드 기반이므로 같은 캠페인·사이클 번호는 항상 같은 결과를 냅니다.

---

## Why the folders are split — and what is missing

Verification ran as two campaigns: **campaign 1** (12 cycles, 1,206,006 runs) covering the
core engines, parsers, gates and localisation, and **campaign 2** (9 cycles, 1,240,009 runs)
covering realistic operating scenarios. Total: **21 cycles, 2,446,015 runs**.

**Stated plainly:** campaign 2 restarted its cycle numbering at 1, which **overwrote
campaign 1's reports for cycles 1–9**. Only cycles 10–12 survive in `campaign1/`; the
results of the lost nine survive only as aggregates in the
[verification report](../../docs/en/verification-report.md).

This is recorded rather than quietly patched because the premise of this product is that a
statement without evidence cannot be entered. Filling the gap left by missing evidence
would break that premise. The harness now writes campaign-scoped paths (`--campaign`), so
reusing a cycle number can no longer overwrite an existing report.

---

## フォルダが分かれている理由 — そして何が失われたか

検証は 2 回のキャンペーンで実施しました。**キャンペーン 1**（12 サイクル・1,206,006 回、
コアエンジン・パーサー・ゲート・多言語）と**キャンペーン 2**（9 サイクル・1,240,009 回、
実運用シナリオ）で、合計 **21 サイクル・2,446,015 回**です。

**率直に記します:** キャンペーン 2 がサイクル番号を 1 から振り直したため、
**キャンペーン 1 のサイクル 1〜9 のレポートが上書きされ失われました**。`campaign1/` に
残るのはサイクル 10〜12 のみで、失われた 9 サイクルの結果は
[検証報告書](../../docs/ja/verification-report.md)に集計値としてのみ残っています。

これを黙って埋めずに書き残すのは、根拠のない記述を記載できないことが本製品の前提だから
です。証拠が失われた場所を静かに埋めることは、その前提を自ら破る行為です。ハーネスは
現在キャンペーン別のパスに書き込むため（`--campaign`）、番号の再利用が既存のレポートを
上書きすることはありません。

---

AAA-RNS v2.0 · Developed by **Seung Ho Jung** · Apache-2.0 © 2026
