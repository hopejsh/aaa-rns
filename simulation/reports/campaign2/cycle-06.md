# 검증 시뮬레이션 보고서 — 사이클 6/12

| 항목 | 값 |
|---|---|
| 실행 시각 | 2026-08-14T01:36:53.968Z |
| 시뮬레이션 횟수 | 140,003회 (최소 요구 100,000회) |
| 소요 시간 | 40.9초 |
| 실패 | 0건 · 고유 결함 0종 |
| 판정 | **PASS** |

## 카테고리별 결과
| 카테고리 | 횟수 | 실패 | 시간 |
|---|---|---|---|
| util_dates | 7,551 | 0 | 84ms |
| util_numbers | 5,034 | 0 | 47ms |
| csv_roundtrip | 3,146 | 0 | 10ms |
| docx_roundtrip | 1,888 | 0 | 117ms |
| xlsx_roundtrip | 1,888 | 0 | 93ms |
| parser_fuzz | 5,034 | 0 | 144ms |
| analyzer_truth | 6,292 | 0 | 449ms |
| analyzer_adversarial | 5,034 | 0 | 213ms |
| generator_invariants | 15,730 | 0 | 10272ms |
| gates_planted | 9,438 | 0 | 316ms |
| notes_lifecycle | 5,034 | 0 | 1099ms |
| ledger_citations | 1,888 | 0 | 18ms |
| format_edges | 1,888 | 0 | 46ms |
| store_concurrency | 1,258 | 0 | 57ms |
| autodraft_writer | 2,517 | 0 | 276ms |
| i18n_dictionary | 3,775 | 0 | 16ms |
| sc_multiuser | 7,551 | 0 | 5179ms |
| sc_multilang | 7,551 | 0 | 3594ms |
| sc_revision | 5,034 | 0 | 3037ms |
| sc_backup | 5,034 | 0 | 802ms |
| sc_llm_safety | 3,775 | 0 | 6ms |
| sc_longterm | 6,292 | 0 | 5926ms |
| sc_license | 3,775 | 0 | 205ms |
| sc_ledger_scale | 3,146 | 0 | 399ms |
| sc_store_migration | 2,517 | 0 | 49ms |
| sc_tamper | 5,034 | 0 | 2725ms |
| sc_calendar | 6,292 | 0 | 2526ms |
| sc_false_claim | 6,292 | 0 | 2807ms |
| e2e_pipeline | 315 | 0 | 383ms |

## 발견 결함 없음 — 전 시뮬레이션 통과