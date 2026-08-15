<p align="center"><a href="README.md">English</a> · <b>한국어</b> · <a href="README.ja.md">日本語</a></p>

# AAA-RNS — AI 에이전트 연구노트 자동화 시스템

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.21937754.svg)](https://doi.org/10.5281/zenodo.21937754)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/hopejsh/aaa-rns)](https://github.com/hopejsh/aaa-rns/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/hopejsh/aaa-rns/total)](https://github.com/hopejsh/aaa-rns/releases)

**서버도, 클라우드 계정도, Docker 도, 전산 담당자도 필요 없는 연구노트 시스템.**

압축을 풀고 더블클릭하면 실행됩니다 — 랜선을 뽑은 노트북에서도 그대로 동작합니다.
연구개발계획서·제안서 같은 **회사 문서를 올리면 그 과제에 맞는 연구노트 체계를 스스로
구성**하고, 이후 실험일지와 측정 데이터를 넣으면 노트를 자동으로 집필합니다. 시스템이
쓴 모든 문장에는 근거가 된 증거번호가 붙고, 증거원장이 뒷받침하지 않는 주장이 남아
있는 노트는 확정되지 않습니다.

한국어 · English · 日本語 를 동등하게 지원합니다.

![AAA-RNS 34초: 계획서 업로드, 값마다 붙는 근거와 신뢰도, SHA-256 으로 첨부되는 실험일지와 측정 CSV, [E#] 인용이 달린 자동 집필, 게이트 넷, 두 사람의 서명, 그리고 확정](.github/branding/demo.gif)

*압축 해제부터 확정까지. 서버도, 계정도, 빌드 단계도 없습니다.*


---

## 빠른 시작

| 환경 | 방법 |
|---|---|
| macOS | `start_mac.command` 더블클릭 |
| Windows | `start_windows.bat` 더블클릭 |
| 공통 | `python3 server.py` → `http://localhost:8777` |

등록 키·계정·설치 프로그램이 필요 없습니다. Chrome 또는 Edge 를 권장합니다(공유폴더
모드가 File System Access API 를 사용합니다). 선행 조건은 Python 3 하나이며, macOS 와
대부분의 Linux 에는 이미 들어 있습니다.

첫 실행은 네 단계입니다: **문서 업로드 → 심층 분석 → 추출 결과 확인 → 시스템 생성.**
실제 문서 없이 먼저 보고 싶다면 `sample_docs/` 의 샘플 계획서·지표표를 쓰십시오.

📘 **[설치·사용 가이드 (PDF · 실제 화면 캡처 수록)](docs/ko/installation-guide.pdf)** · [사용설명서](docs/ko/user-manual.md) · [검증보고서](docs/ko/verification-report.md) · [3개 언어 전체 문서](docs/README.md)

---

## 무엇이 다른가

**템플릿이 아니라 증거에서 집필합니다.** 실험일지나 측정 CSV 를 끌어다 놓으면 파일이
SHA-256 해시와 함께 첨부되고, 내용에서 증거가 `[E#]` 로 등재되며, 수행 내용·결과
데이터·해석이 **그 증거만으로** 작성됩니다. 문장은 업로드한 원문에서만 나오며 시스템이
사실을 지어내지 않습니다.

**거부합니다.** 확정 전에 결정론 게이트 넷이 실행됩니다.

| 게이트 | 검사 내용 |
|---|---|
| G1 증거매핑 | 증거번호 없는 문장, 존재하지 않는 증거 인용, 추정·과장 표현 |
| G2 과거정합성 | 확정 노트와의 기간 중복, 같은 지표의 모순 수치, 상태 역행 |
| G3 수치단위감사 | 합계·비율 재계산, 단위 표기, 목표 대비 방향, 근거 없는 "달성" 표기 |
| G4 지침준수 | 필수 필드, 인용 증거의 원본 첨부 |

지적이 남은 노트는 확정할 수 없습니다. 다만 **아무것도 버리지 않습니다** — 본문과
지적사항이 함께 보존되므로, 거부는 삭제가 아니라 하나의 기록입니다.

**확정은 확정입니다.** 확정 시 노트 해시가 **본문과 서명을 함께 덮어** 직전 확정 노트와
사슬로 연결됩니다. 사후에 본문을 고치는 것은 물론 승인자 이름을 바꿔치기해도 체인
검증에서 드러납니다. 변경은 개정판(-R1, -R2 …) 발행으로만 가능하며 원본과 이력이 모두
남습니다.

**외부 의존성 0 — 수사가 아닙니다.** PDF·DOCX·XLSX·HWPX·CSV 파서, DOCX/XLSX 생성기,
차트, 해시 체인까지 전부 이 저장소 안에 구현되어 있습니다. CDN 도, npm install 도, 빌드
단계도 없습니다. CSP 가 외부 전송 자체를 차단하며, **예외는 AI 엔진 3사(Anthropic·
Google·OpenAI) 엔드포인트뿐**입니다 — 사용자가 직접 연결했을 때만이고, 기본값은 꺼짐이며
어떤 기능도 이를 요구하지 않습니다.

**26개 전문 에이전트.** 7계층·그룹 리드·typed packet·단일 작성자 블랙보드
([agents/MAS_SPEC.md](agents/MAS_SPEC.md)). 프롬프트는 엔진 중립 템플릿이며, 결정론
코어(파서·게이트·해시 체인)는 LLM 없이 브라우저에서 직접 실행됩니다.

---

## 정직한 한계

나중에 발견하기보다 먼저 밝힙니다.

- **LIMS 가 아닙니다.** 시료·재고 관리, 장비 연동, 실시간 공동편집, 모바일 앱이 없습니다.
- **신원은 자기 선언입니다.** 서명에는 기기 키(ECDSA P-256, 추출 불가)가 함께 실리고
  선택적으로 패스키(WebAuthn·Touch ID 등)를 더할 수 있으며, 둘 다 봉인 해시에 잠겨
  확정 후 서명자 바꿔치기는 체인 파손으로 드러납니다. 그러나 그 키가 *그 사람*이라는
  보증은 인증기관 없이 성립하지 않습니다. PIN 은 PBKDF2-SHA256(210,000회·솔트)으로
  저장되지만 접근 통제가 아닙니다 — 실제 접근 통제는 공유폴더의 OS 권한으로 수행하십시오.
- **시각은 기본적으로 기기 시계입니다.** 설정에서 RFC-3161 시점인증을 켜면 확정 시 봉인
  해시(해시 32바이트만, 본문·파일 아님)를 TSA 로 보내 서명된 토큰을 받아 붙입니다 —
  기본은 꺼짐이고, 오프라인이면 조용히 기기 시계로만 기록합니다. 기본 TSA(FreeTSA)는
  공인·적격 시점인증 기관이 아닙니다.
- **인증서 기반 전자서명이나 공인 시점인증을 요구하는 제도는 위 보강으로도 여전히
  충족하지 못합니다** — 하나의 기술적 사실이 나라마다 다른 이름으로 불릴 뿐입니다:
  **국가연구개발사업 연구노트 지침이 요구하는 전자서명인증**(전자서명법 제2조제5호·한국),
  **21 CFR Part 11**(미국 FDA), **eIDAS 적격 전자서명·적격 타임스탬프**와 **EU GMP Annex 11**(EU),
  **ER/ES 지침**(일본). 규제 기록 시스템이 아니라 연구 무결성·재현성 도구입니다.
  조문별 상세와 무엇이 확인 가능하고 무엇이 아닌지는
  [컴플라이언스 매트릭스](https://hopejsh.github.io/aaa-rns/compliance.html),
  위협 모델은 [SECURITY.md](SECURITY.md).
- 해시 체인은 **내부 정합성**을 증명합니다. 기본 상태에서는 변조 **탐지(tamper-evident)**이지
  변조 불가가 아닙니다. RFC-3161 을 켜면 확정 시각과 봉인 해시가 기록 보유자의 통제 밖
  (TSA 의 서명)에 고정됩니다 — 그 이전의 기록에는 소급 적용되지 않습니다.

자금이 넉넉하고 클라우드에 거부감이 없으며 서열·화학 도구가 깊게 필요한 연구실이라면
Benchling 이나 Revvity 가 더 낫습니다. 이 제품은 그 도구들이 닿지 못하는 연구실을 위한
것입니다.

---

## 검증

두 차례 캠페인, **21 사이클 · 총 2,446,015회** 시뮬레이션. 인용 누락·모순 수치·서명
변조·손상된 백업·위조 라이선스를 일부러 주입하고 제품이 이를 차단하는지 검사했습니다.
제품 실결함 5건을 찾아 수정했고, 3건은 시험 코드 자체의 결함으로 밝혀져 실적으로 세지
않고 철회했습니다.

```bash
node simulation/run_simulation.mjs --campaign 2 --cycle 9 --iters 150000
```

시드 기반이라 재현됩니다. 보고서는 [`simulation/reports/`](simulation/reports/) 에 있으며,
덮어쓰기로 **소실된 캠페인 1의 9개 보고서를 복원하지 않고 그대로 밝힌
[기록](simulation/reports/README.md)** 이 함께 들어 있습니다. 전문은
[검증보고서](docs/ko/verification-report.md).

---

## 에디션

이 저장소의 빌드는 **커뮤니티 에디션**입니다 — 등록 키가 없고 프로젝트 수 제한도
없습니다. **기업 에디션**은 같은 코드에서 [`js/core/edition.js`](js/core/edition.js) 의
상수 하나만 바꾼 것으로, 서명된 라이선스 키를 요구하고 설치본을 프로젝트 1개로 묶습니다 —
특정 회사·연구소에 발급하는 배포본용입니다.

소스가 공개되어 있으므로 키 검사는 코드를 고칠 수 있는 사람을 막지 못합니다. 이 장치의
목적은 기술적 복제 방지가 아니라 발급 대상 확인입니다.

---

## 데이터가 있는 곳

`data/` 과제 구조·감사로그 · `notes/` 연구노트 · `notes_files/` 업로드 원본 ·
`ledger/` 증거원장 · `archive/` 확정 노트 영구 보관본. 전부 사용자 기기 또는 지정한 팀
공유폴더에만 남으며, 어느 폴더도 git 이 추적하지 않습니다. 백업은 파일별 SHA-256
매니페스트를 담은 ZIP 하나이고, 복원은 전 파일이 검증을 통과해야만 기록을 시작합니다.

---

## 기여

이슈와 PR 을 환영합니다 — [CONTRIBUTING.md](CONTRIBUTING.md). 규칙은 둘입니다. 문서
변경은 저장소가 증거를 댈 수 없는 주장을 새로 넣을 수 없고, 3개 README 는 함께 움직입니다.

## 인용

이 소프트웨어가 발표하신 연구에 기여했다면 인용해 주십시오. 저장소에
[`CITATION.cff`](CITATION.cff) 가 있어 GitHub 사이드바의 **"Cite this repository"** 버튼이
APA·BibTeX 형식을 자동으로 만들어 줍니다.

> Jung, S. H. (2026). *AAA-RNS: AI Agent-driven Autonomous Research Notebook System* (Version 2.1.0)
> [Computer software]. https://doi.org/10.5281/zenodo.21937754

```bibtex
@software{jung_aaarns_2026,
  author    = {Jung, Seung Ho},
  title     = {{AAA-RNS: AI Agent-driven Autonomous Research Notebook System}},
  version   = {2.1.0},
  year      = {2026},
  publisher = {Zenodo},
  doi       = {10.5281/zenodo.21937754},
  url       = {https://github.com/hopejsh/aaa-rns}
}
```

Zenodo 는 DOI 를 두 개 발급합니다. **`10.5281/zenodo.21937754`** 는 *개념* DOI 로 항상 최신
릴리스로 연결됩니다 — 보통은 이쪽을 인용하십시오. **`10.5281/zenodo.21937755`** 는 *버전* DOI
로 v2.0.0 에 고정되어 있으며, 재현성 진술이나 특정 분석을 기술하는 방법 절처럼 **정확한 바이트가
문제가 될 때** 이쪽을 인용합니다.

## 라이선스

Apache License 2.0 — [LICENSE](LICENSE) · [NOTICE](NOTICE) · Copyright © 2026 Seung Ho Jung

## 개발자

**Seung Ho Jung** — 시스템 설계, 코어 엔진(파서·분석기·생성기·게이트·해시 체인),
26-에이전트 MAS 아키텍처, 검증 시뮬레이션 하네스 전체.
