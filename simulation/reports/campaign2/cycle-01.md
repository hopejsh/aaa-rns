# 검증 시뮬레이션 보고서 — 사이클 1/12

| 항목 | 값 |
|---|---|
| 실행 시각 | 2026-08-14T01:28:32.476Z |
| 시뮬레이션 횟수 | 125,001회 (최소 요구 100,000회) |
| 소요 시간 | 34.6초 |
| 실패 | 13,928건 · 고유 결함 2종 |
| 판정 | **FAIL** |

## 카테고리별 결과
| 카테고리 | 횟수 | 실패 | 시간 |
|---|---|---|---|
| util_dates | 8,357 | 0 | 93ms |
| util_numbers | 5,571 | 0 | 53ms |
| csv_roundtrip | 3,482 | 0 | 10ms |
| docx_roundtrip | 2,089 | 0 | 132ms |
| xlsx_roundtrip | 2,089 | 0 | 102ms |
| parser_fuzz | 5,571 | 0 | 156ms |
| analyzer_truth | 6,964 | 0 | 497ms |
| analyzer_adversarial | 5,571 | 0 | 237ms |
| generator_invariants | 17,409 | 0 | 11448ms |
| gates_planted | 10,446 | 0 | 357ms |
| notes_lifecycle | 5,571 | 0 | 808ms |
| ledger_citations | 2,089 | 0 | 20ms |
| format_edges | 2,089 | 0 | 50ms |
| store_concurrency | 1,393 | 0 | 64ms |
| autodraft_writer | 2,786 | 0 | 308ms |
| i18n_dictionary | 4,178 | 0 | 16ms |
| sc_multiuser | 8,357 | 8357 | 4987ms |
| sc_multilang | 8,357 | 0 | 3802ms |
| sc_revision | 5,571 | 5571 | 2986ms |
| sc_backup | 5,571 | 0 | 894ms |
| sc_llm_safety | 4,178 | 0 | 6ms |
| sc_longterm | 6,964 | 0 | 7232ms |
| e2e_pipeline | 348 | 0 | 371ms |

## 발견 결함 (빈도순)

### D1 · 8,357회
- 서명: `sc_multiuser::동시 작성 후 해시 체인 손상: `
- 예시(seed 26000067): 동시 작성 후 해시 체인 손상: 

### D2 · 5,571회
- 서명: `sc_revision::개정 체인 손상: `
- 예시(seed 28000073): 개정 체인 손상: 