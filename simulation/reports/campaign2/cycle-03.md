# 검증 시뮬레이션 보고서 — 사이클 3/12

| 항목 | 값 |
|---|---|
| 실행 시각 | 2026-08-14T01:31:07.408Z |
| 시뮬레이션 횟수 | 130,002회 (최소 요구 100,000회) |
| 소요 시간 | 34.0초 |
| 실패 | 12건 · 고유 결함 1종 |
| 판정 | **FAIL** |

## 카테고리별 결과
| 카테고리 | 횟수 | 실패 | 시간 |
|---|---|---|---|
| util_dates | 8,021 | 0 | 87ms |
| util_numbers | 5,347 | 0 | 51ms |
| csv_roundtrip | 3,342 | 0 | 10ms |
| docx_roundtrip | 2,005 | 0 | 127ms |
| xlsx_roundtrip | 2,005 | 0 | 100ms |
| parser_fuzz | 5,347 | 0 | 148ms |
| analyzer_truth | 6,684 | 0 | 487ms |
| analyzer_adversarial | 5,347 | 0 | 235ms |
| generator_invariants | 16,710 | 0 | 11186ms |
| gates_planted | 10,026 | 0 | 331ms |
| notes_lifecycle | 5,347 | 0 | 769ms |
| ledger_citations | 2,005 | 0 | 19ms |
| format_edges | 2,005 | 0 | 46ms |
| store_concurrency | 1,337 | 0 | 60ms |
| autodraft_writer | 2,674 | 0 | 296ms |
| i18n_dictionary | 4,010 | 0 | 18ms |
| sc_multiuser | 8,021 | 0 | 4742ms |
| sc_multilang | 8,021 | 0 | 3869ms |
| sc_revision | 5,347 | 0 | 2995ms |
| sc_backup | 5,347 | 0 | 838ms |
| sc_llm_safety | 4,010 | 0 | 6ms |
| sc_longterm | 6,684 | 0 | 6478ms |
| sc_license | 4,010 | 12 | 227ms |
| sc_ledger_scale | 3,342 | 0 | 435ms |
| sc_store_migration | 2,674 | 0 | 51ms |
| e2e_pipeline | 334 | 0 | 376ms |

## 발견 결함 (빈도순)

### D1 · 12회
- 서명: `sc_license::[noise] 위조 키가 통과됨`
- 예시(seed 52000267): [noise] 위조 키가 통과됨