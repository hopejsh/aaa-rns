# 검증 시뮬레이션 보고서 — 사이클 2/12

| 항목 | 값 |
|---|---|
| 실행 시각 | 2026-08-14T23:52:28.114Z |
| 시뮬레이션 횟수 | 99,999회 (최소 요구 100,000회) |
| 소요 시간 | 29.2초 |
| 실패 | 1,124건 · 고유 결함 11종 |
| 판정 | **FAIL** |

## 카테고리별 결과
| 카테고리 | 횟수 | 실패 | 시간 |
|---|---|---|---|
| util_dates | 5,275 | 0 | 59ms |
| util_numbers | 3,516 | 0 | 34ms |
| csv_roundtrip | 2,198 | 0 | 7ms |
| docx_roundtrip | 1,319 | 0 | 86ms |
| xlsx_roundtrip | 1,319 | 0 | 68ms |
| parser_fuzz | 3,516 | 0 | 106ms |
| analyzer_truth | 4,396 | 0 | 334ms |
| analyzer_adversarial | 3,516 | 0 | 160ms |
| generator_invariants | 10,989 | 0 | 7671ms |
| gates_planted | 6,593 | 0 | 221ms |
| notes_lifecycle | 3,516 | 0 | 774ms |
| ledger_citations | 1,319 | 0 | 13ms |
| format_edges | 1,319 | 0 | 33ms |
| store_concurrency | 879 | 0 | 41ms |
| autodraft_writer | 1,758 | 0 | 195ms |
| i18n_dictionary | 2,637 | 0 | 13ms |
| gate_wording_langs | 2,198 | 1124 | 5ms |
| sc_multiuser | 5,275 | 0 | 3587ms |
| sc_multilang | 5,275 | 0 | 2446ms |
| sc_revision | 3,516 | 0 | 2097ms |
| sc_backup | 3,516 | 0 | 588ms |
| sc_llm_safety | 2,637 | 0 | 4ms |
| sc_longterm | 4,396 | 0 | 4314ms |
| sc_license | 2,637 | 0 | 11ms |
| sc_ledger_scale | 2,198 | 0 | 288ms |
| sc_store_migration | 1,758 | 0 | 33ms |
| sc_tamper | 3,516 | 0 | 1984ms |
| sc_calendar | 4,396 | 0 | 1763ms |
| sc_false_claim | 4,396 | 0 | 1988ms |
| e2e_pipeline | 220 | 0 | 269ms |

## 발견 결함 (빈도순)

### D1 · 117회
- 서명: `gate_wording_langs::[ja] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "次期には目標達成が見込まれる"`
- 예시(seed 36000136): [ja] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "次期には目標達成が見込まれる"

### D2 · 116회
- 서명: `gate_wording_langs::[en] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "Yield increased by approximately # percent"`
- 예시(seed 36000088): [en] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "Yield increased by approximately 30 percent"

### D3 · 109회
- 서명: `gate_wording_langs::[ja] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "おそらく装置誤差と判断される"`
- 예시(seed 36000092): [ja] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "おそらく装置誤差と判断される"

### D4 · 105회
- 서명: `gate_wording_langs::[ja] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "約 #% の向上を確認した"`
- 예시(seed 36000106): [ja] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "約 30% の向上を確認した"

### D5 · 103회
- 서명: `gate_wording_langs::[en] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "Coating uniformity appears to have improved"`
- 예시(seed 36000090): [en] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "Coating uniformity appears to have improved"

### D6 · 100회
- 서명: `gate_wording_langs::[en] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "It is judged that the deviation came from the jig"`
- 예시(seed 36000091): [en] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "It is judged that the deviation came from the jig"

### D7 · 99회
- 서명: `gate_wording_langs::[en] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "Throughput is expected to rise next quarter"`
- 예시(seed 36000101): [en] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "Throughput is expected to rise next quarter"

### D8 · 98회
- 서명: `gate_wording_langs::[en] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "The process was successfully completed"`
- 예시(seed 36000099): [en] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "The process was successfully completed"

### D9 · 97회
- 서명: `gate_wording_langs::[en] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "The result is possibly caused by thermal drift"`
- 예시(seed 36000086): [en] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "The result is possibly caused by thermal drift"

### D10 · 92회
- 서명: `gate_wording_langs::[ja] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "性能が改善したと思われる"`
- 예시(seed 36000119): [ja] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "性能が改善したと思われる"

### D11 · 88회
- 서명: `gate_wording_langs::[ja] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "成功裏に実験を完了した"`
- 예시(seed 36000102): [ja] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "成功裏に実験を完了した"