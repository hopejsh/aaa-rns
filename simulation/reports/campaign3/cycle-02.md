# 검증 시뮬레이션 보고서 — 사이클 2/12

| 항목 | 값 |
|---|---|
| 실행 시각 | 2026-08-15T17:37:00.265Z |
| 시뮬레이션 횟수 | 150,001회 (최소 요구 100,000회) |
| 소요 시간 | 44.4초 |
| 실패 | 0건 · 고유 결함 0종 |
| 판정 | **PASS** |

## 카테고리별 결과
| 카테고리 | 횟수 | 실패 | 시간 |
|---|---|---|---|
| util_dates | 7,809 | 0 | 86ms |
| util_numbers | 5,206 | 0 | 49ms |
| csv_roundtrip | 3,254 | 0 | 10ms |
| docx_roundtrip | 1,952 | 0 | 123ms |
| xlsx_roundtrip | 1,952 | 0 | 95ms |
| parser_fuzz | 5,206 | 0 | 152ms |
| analyzer_truth | 6,508 | 0 | 495ms |
| analyzer_adversarial | 5,206 | 0 | 230ms |
| generator_invariants | 16,269 | 0 | 11875ms |
| gates_planted | 9,761 | 0 | 332ms |
| notes_lifecycle | 5,206 | 0 | 1134ms |
| ledger_citations | 1,952 | 0 | 19ms |
| format_edges | 1,952 | 0 | 47ms |
| store_concurrency | 1,302 | 0 | 62ms |
| autodraft_writer | 2,603 | 0 | 310ms |
| i18n_dictionary | 3,905 | 0 | 16ms |
| gate_wording_langs | 3,254 | 0 | 7ms |
| crypto_sign_ts | 1,952 | 0 | 489ms |
| sc_multiuser | 7,809 | 0 | 5432ms |
| sc_multilang | 7,809 | 0 | 3666ms |
| sc_revision | 5,206 | 0 | 3153ms |
| sc_backup | 5,206 | 0 | 852ms |
| sc_llm_safety | 3,905 | 0 | 8ms |
| sc_longterm | 6,508 | 0 | 6276ms |
| sc_license | 3,905 | 0 | 16ms |
| sc_ledger_scale | 3,254 | 0 | 428ms |
| sc_store_migration | 2,603 | 0 | 51ms |
| sc_tamper | 5,206 | 0 | 2903ms |
| sc_calendar | 6,508 | 0 | 2710ms |
| sc_false_claim | 6,508 | 0 | 2957ms |
| e2e_pipeline | 325 | 0 | 400ms |

## 발견 결함 없음 — 전 시뮬레이션 통과