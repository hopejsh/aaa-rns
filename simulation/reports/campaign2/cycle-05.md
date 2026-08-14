# 검증 시뮬레이션 보고서 — 사이클 5/12

| 항목 | 값 |
|---|---|
| 실행 시각 | 2026-08-14T01:33:42.427Z |
| 시뮬레이션 횟수 | 140,003회 (최소 요구 100,000회) |
| 소요 시간 | 39.6초 |
| 실패 | 2,057건 · 고유 결함 5종 |
| 판정 | **FAIL** |

## 카테고리별 결과
| 카테고리 | 횟수 | 실패 | 시간 |
|---|---|---|---|
| util_dates | 7,551 | 0 | 83ms |
| util_numbers | 5,034 | 0 | 47ms |
| csv_roundtrip | 3,146 | 0 | 10ms |
| docx_roundtrip | 1,888 | 0 | 118ms |
| xlsx_roundtrip | 1,888 | 0 | 93ms |
| parser_fuzz | 5,034 | 0 | 143ms |
| analyzer_truth | 6,292 | 0 | 459ms |
| analyzer_adversarial | 5,034 | 0 | 221ms |
| generator_invariants | 15,730 | 0 | 10415ms |
| gates_planted | 9,438 | 0 | 318ms |
| notes_lifecycle | 5,034 | 0 | 737ms |
| ledger_citations | 1,888 | 0 | 18ms |
| format_edges | 1,888 | 0 | 46ms |
| store_concurrency | 1,258 | 0 | 57ms |
| autodraft_writer | 2,517 | 0 | 283ms |
| i18n_dictionary | 3,775 | 0 | 14ms |
| sc_multiuser | 7,551 | 0 | 4535ms |
| sc_multilang | 7,551 | 0 | 3601ms |
| sc_revision | 5,034 | 0 | 2821ms |
| sc_backup | 5,034 | 0 | 815ms |
| sc_llm_safety | 3,775 | 0 | 6ms |
| sc_longterm | 6,292 | 0 | 6051ms |
| sc_license | 3,775 | 0 | 207ms |
| sc_ledger_scale | 3,146 | 0 | 408ms |
| sc_store_migration | 2,517 | 0 | 49ms |
| sc_tamper | 5,034 | 1045 | 2408ms |
| sc_calendar | 6,292 | 0 | 2473ms |
| sc_false_claim | 6,292 | 1012 | 2806ms |
| e2e_pipeline | 315 | 0 | 379ms |

## 발견 결함 (빈도순)

### D1 · 1,045회
- 서명: `sc_tamper::[signer] 사후 변조가 탐지되지 않음`
- 예시(seed 75000171): [signer] 사후 변조가 탐지되지 않음

### D2 · 501회
- 서명: `sc_false_claim::[under_achieved] 거짓 성과가 G# 를 통과함 (값=#%, 목표=#%)`
- 예시(seed 77000213): [under_achieved] 거짓 성과가 G3 를 통과함 (값=72%, 목표=82%)

### D3 · 263회
- 서명: `sc_false_claim::[under_achieved] 거짓 성과가 G# 를 통과함 (값=#건, 목표=#건)`
- 예시(seed 77000212): [under_achieved] 거짓 성과가 G3 를 통과함 (값=0건, 목표=3건)

### D4 · 129회
- 서명: `sc_false_claim::[under_achieved] 거짓 성과가 G# 를 통과함 (값=#ms, 목표=#ms)`
- 예시(seed 77000199): [under_achieved] 거짓 성과가 G3 를 통과함 (값=105ms, 목표=95ms)

### D5 · 119회
- 서명: `sc_false_claim::[under_achieved] 거짓 성과가 G# 를 통과함 (값=#시간, 목표=#시간)`
- 예시(seed 77000179): [under_achieved] 거짓 성과가 G3 를 통과함 (값=16775시간, 목표=16785시간)