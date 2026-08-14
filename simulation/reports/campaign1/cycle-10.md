# 검증 시뮬레이션 보고서 — 사이클 10/10

| 항목 | 값 |
|---|---|
| 실행 시각 | 2026-08-13T04:48:18.868Z |
| 시뮬레이션 횟수 | 100,504회 (최소 요구 100,000회) |
| 소요 시간 | 18.0초 |
| 실패 | 0건 · 고유 결함 0종 |
| 판정 | **PASS** |

## 카테고리별 결과
| 카테고리 | 횟수 | 실패 | 시간 |
|---|---|---|---|
| util_dates | 10,264 | 0 | 113ms |
| util_numbers | 6,843 | 0 | 64ms |
| csv_roundtrip | 4,277 | 0 | 13ms |
| docx_roundtrip | 2,566 | 0 | 157ms |
| xlsx_roundtrip | 2,566 | 0 | 126ms |
| parser_fuzz | 6,843 | 0 | 185ms |
| analyzer_truth | 8,553 | 0 | 611ms |
| analyzer_adversarial | 6,843 | 0 | 294ms |
| generator_invariants | 21,384 | 0 | 13967ms |
| gates_planted | 12,830 | 0 | 426ms |
| notes_lifecycle | 6,843 | 0 | 990ms |
| ledger_citations | 2,566 | 0 | 24ms |
| format_edges | 2,566 | 0 | 61ms |
| store_concurrency | 1,711 | 0 | 77ms |
| autodraft_writer | 3,421 | 0 | 374ms |
| e2e_pipeline | 428 | 0 | 493ms |

## 발견 결함 없음 — 전 시뮬레이션 통과