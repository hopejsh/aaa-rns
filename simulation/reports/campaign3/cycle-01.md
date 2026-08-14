# 검증 시뮬레이션 보고서 — 사이클 1/12

| 항목 | 값 |
|---|---|
| 실행 시각 | 2026-08-14T23:53:36.429Z |
| 시뮬레이션 횟수 | 150,001회 (최소 요구 100,000회) |
| 소요 시간 | 43.6초 |
| 실패 | 0건 · 고유 결함 0종 |
| 판정 | **PASS** |

## 카테고리별 결과
| 카테고리 | 횟수 | 실패 | 시간 |
|---|---|---|---|
| util_dates | 7,912 | 0 | 90ms |
| util_numbers | 5,275 | 0 | 50ms |
| csv_roundtrip | 3,297 | 0 | 10ms |
| docx_roundtrip | 1,978 | 0 | 128ms |
| xlsx_roundtrip | 1,978 | 0 | 101ms |
| parser_fuzz | 5,275 | 0 | 146ms |
| analyzer_truth | 6,593 | 0 | 487ms |
| analyzer_adversarial | 5,275 | 0 | 233ms |
| generator_invariants | 16,484 | 0 | 11498ms |
| gates_planted | 9,890 | 0 | 346ms |
| notes_lifecycle | 5,275 | 0 | 1136ms |
| ledger_citations | 1,978 | 0 | 19ms |
| format_edges | 1,978 | 0 | 47ms |
| store_concurrency | 1,319 | 0 | 63ms |
| autodraft_writer | 2,637 | 0 | 314ms |
| i18n_dictionary | 3,956 | 0 | 13ms |
| gate_wording_langs | 3,297 | 0 | 7ms |
| sc_multiuser | 7,912 | 0 | 5431ms |
| sc_multilang | 7,912 | 0 | 3725ms |
| sc_revision | 5,275 | 0 | 3151ms |
| sc_backup | 5,275 | 0 | 841ms |
| sc_llm_safety | 3,956 | 0 | 8ms |
| sc_longterm | 6,593 | 0 | 6304ms |
| sc_license | 3,956 | 0 | 15ms |
| sc_ledger_scale | 3,297 | 0 | 450ms |
| sc_store_migration | 2,637 | 0 | 52ms |
| sc_tamper | 5,275 | 0 | 2883ms |
| sc_calendar | 6,593 | 0 | 2660ms |
| sc_false_claim | 6,593 | 0 | 2961ms |
| e2e_pipeline | 330 | 0 | 402ms |

## 발견 결함 없음 — 전 시뮬레이션 통과