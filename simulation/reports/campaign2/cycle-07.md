# 검증 시뮬레이션 보고서 — 사이클 7/12

| 항목 | 값 |
|---|---|
| 실행 시각 | 2026-08-14T01:38:09.578Z |
| 시뮬레이션 횟수 | 149,999회 (최소 요구 100,000회) |
| 소요 시간 | 44.3초 |
| 실패 | 0건 · 고유 결함 0종 |
| 판정 | **PASS** |

## 카테고리별 결과
| 카테고리 | 횟수 | 실패 | 시간 |
|---|---|---|---|
| util_dates | 8,090 | 0 | 89ms |
| util_numbers | 5,393 | 0 | 50ms |
| csv_roundtrip | 3,371 | 0 | 10ms |
| docx_roundtrip | 2,022 | 0 | 127ms |
| xlsx_roundtrip | 2,022 | 0 | 101ms |
| parser_fuzz | 5,393 | 0 | 149ms |
| analyzer_truth | 6,742 | 0 | 485ms |
| analyzer_adversarial | 5,393 | 0 | 232ms |
| generator_invariants | 16,854 | 0 | 11187ms |
| gates_planted | 10,112 | 0 | 343ms |
| notes_lifecycle | 5,393 | 0 | 1174ms |
| ledger_citations | 2,022 | 0 | 19ms |
| format_edges | 2,022 | 0 | 48ms |
| store_concurrency | 1,348 | 0 | 63ms |
| autodraft_writer | 2,697 | 0 | 295ms |
| i18n_dictionary | 4,045 | 0 | 18ms |
| sc_multiuser | 8,090 | 0 | 5533ms |
| sc_multilang | 8,090 | 0 | 3868ms |
| sc_revision | 5,393 | 0 | 3305ms |
| sc_backup | 5,393 | 0 | 868ms |
| sc_llm_safety | 4,045 | 0 | 6ms |
| sc_longterm | 6,742 | 0 | 6556ms |
| sc_license | 4,045 | 0 | 221ms |
| sc_ledger_scale | 3,371 | 0 | 438ms |
| sc_store_migration | 2,697 | 0 | 51ms |
| sc_tamper | 5,393 | 0 | 2937ms |
| sc_calendar | 6,742 | 0 | 2710ms |
| sc_false_claim | 6,742 | 0 | 3007ms |
| e2e_pipeline | 337 | 0 | 406ms |

## 발견 결함 없음 — 전 시뮬레이션 통과