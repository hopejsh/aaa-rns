# 검증 시뮬레이션 보고서 — 사이클 9/12

| 항목 | 값 |
|---|---|
| 실행 시각 | 2026-08-14T04:02:22.467Z |
| 시뮬레이션 횟수 | 149,999회 (최소 요구 100,000회) |
| 소요 시간 | 43.7초 |
| 실패 | 0건 · 고유 결함 0종 |
| 판정 | **PASS** |

## 카테고리별 결과
| 카테고리 | 횟수 | 실패 | 시간 |
|---|---|---|---|
| util_dates | 8,090 | 0 | 90ms |
| util_numbers | 5,393 | 0 | 50ms |
| csv_roundtrip | 3,371 | 0 | 10ms |
| docx_roundtrip | 2,022 | 0 | 126ms |
| xlsx_roundtrip | 2,022 | 0 | 100ms |
| parser_fuzz | 5,393 | 0 | 154ms |
| analyzer_truth | 6,742 | 0 | 478ms |
| analyzer_adversarial | 5,393 | 0 | 230ms |
| generator_invariants | 16,854 | 0 | 10938ms |
| gates_planted | 10,112 | 0 | 342ms |
| notes_lifecycle | 5,393 | 0 | 1152ms |
| ledger_citations | 2,022 | 0 | 19ms |
| format_edges | 2,022 | 0 | 48ms |
| store_concurrency | 1,348 | 0 | 59ms |
| autodraft_writer | 2,697 | 0 | 296ms |
| i18n_dictionary | 4,045 | 0 | 14ms |
| sc_multiuser | 8,090 | 0 | 5459ms |
| sc_multilang | 8,090 | 0 | 3825ms |
| sc_revision | 5,393 | 0 | 3261ms |
| sc_backup | 5,393 | 0 | 836ms |
| sc_llm_safety | 4,045 | 0 | 6ms |
| sc_longterm | 6,742 | 0 | 6467ms |
| sc_license | 4,045 | 0 | 218ms |
| sc_ledger_scale | 3,371 | 0 | 438ms |
| sc_store_migration | 2,697 | 0 | 52ms |
| sc_tamper | 5,393 | 0 | 2897ms |
| sc_calendar | 6,742 | 0 | 2688ms |
| sc_false_claim | 6,742 | 0 | 3017ms |
| e2e_pipeline | 337 | 0 | 399ms |

## 발견 결함 없음 — 전 시뮬레이션 통과