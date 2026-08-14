# 검증 시뮬레이션 보고서 — 사이클 8/12

| 항목 | 값 |
|---|---|
| 실행 시각 | 2026-08-14T01:39:04.085Z |
| 시뮬레이션 횟수 | 149,999회 (최소 요구 100,000회) |
| 소요 시간 | 44.1초 |
| 실패 | 0건 · 고유 결함 0종 |
| 판정 | **PASS** |

## 카테고리별 결과
| 카테고리 | 횟수 | 실패 | 시간 |
|---|---|---|---|
| util_dates | 8,090 | 0 | 90ms |
| util_numbers | 5,393 | 0 | 51ms |
| csv_roundtrip | 3,371 | 0 | 10ms |
| docx_roundtrip | 2,022 | 0 | 128ms |
| xlsx_roundtrip | 2,022 | 0 | 101ms |
| parser_fuzz | 5,393 | 0 | 149ms |
| analyzer_truth | 6,742 | 0 | 491ms |
| analyzer_adversarial | 5,393 | 0 | 236ms |
| generator_invariants | 16,854 | 0 | 11238ms |
| gates_planted | 10,112 | 0 | 344ms |
| notes_lifecycle | 5,393 | 0 | 1147ms |
| ledger_citations | 2,022 | 0 | 20ms |
| format_edges | 2,022 | 0 | 47ms |
| store_concurrency | 1,348 | 0 | 63ms |
| autodraft_writer | 2,697 | 0 | 299ms |
| i18n_dictionary | 4,045 | 0 | 13ms |
| sc_multiuser | 8,090 | 0 | 5488ms |
| sc_multilang | 8,090 | 0 | 3898ms |
| sc_revision | 5,393 | 0 | 3259ms |
| sc_backup | 5,393 | 0 | 854ms |
| sc_llm_safety | 4,045 | 0 | 6ms |
| sc_longterm | 6,742 | 0 | 6456ms |
| sc_license | 4,045 | 0 | 217ms |
| sc_ledger_scale | 3,371 | 0 | 437ms |
| sc_store_migration | 2,697 | 0 | 52ms |
| sc_tamper | 5,393 | 0 | 2908ms |
| sc_calendar | 6,742 | 0 | 2714ms |
| sc_false_claim | 6,742 | 0 | 2991ms |
| e2e_pipeline | 337 | 0 | 405ms |

## 발견 결함 없음 — 전 시뮬레이션 통과