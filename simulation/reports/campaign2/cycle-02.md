# 검증 시뮬레이션 보고서 — 사이클 2/12

| 항목 | 값 |
|---|---|
| 실행 시각 | 2026-08-14T01:29:53.341Z |
| 시뮬레이션 횟수 | 125,001회 (최소 요구 100,000회) |
| 소요 시간 | 34.9초 |
| 실패 | 0건 · 고유 결함 0종 |
| 판정 | **PASS** |

## 카테고리별 결과
| 카테고리 | 횟수 | 실패 | 시간 |
|---|---|---|---|
| util_dates | 8,357 | 0 | 93ms |
| util_numbers | 5,571 | 0 | 53ms |
| csv_roundtrip | 3,482 | 0 | 11ms |
| docx_roundtrip | 2,089 | 0 | 129ms |
| xlsx_roundtrip | 2,089 | 0 | 102ms |
| parser_fuzz | 5,571 | 0 | 162ms |
| analyzer_truth | 6,964 | 0 | 506ms |
| analyzer_adversarial | 5,571 | 0 | 240ms |
| generator_invariants | 17,409 | 0 | 11616ms |
| gates_planted | 10,446 | 0 | 350ms |
| notes_lifecycle | 5,571 | 0 | 801ms |
| ledger_citations | 2,089 | 0 | 20ms |
| format_edges | 2,089 | 0 | 49ms |
| store_concurrency | 1,393 | 0 | 67ms |
| autodraft_writer | 2,786 | 0 | 306ms |
| i18n_dictionary | 4,178 | 0 | 18ms |
| sc_multiuser | 8,357 | 0 | 5008ms |
| sc_multilang | 8,357 | 0 | 3825ms |
| sc_revision | 5,571 | 0 | 2973ms |
| sc_backup | 5,571 | 0 | 890ms |
| sc_llm_safety | 4,178 | 0 | 7ms |
| sc_longterm | 6,964 | 0 | 7345ms |
| e2e_pipeline | 348 | 0 | 373ms |

## 발견 결함 없음 — 전 시뮬레이션 통과