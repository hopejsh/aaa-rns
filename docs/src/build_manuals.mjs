/* ════════════════════════════════════════════════════════════════
 * AAA-RNS 사용설명서 생성기 (한국어 · English · 日本語)
 * Developed by Seung Ho Jung
 *
 * 가이드(PDF)가 "처음 설치하고 따라 하는 문서"라면, 사용설명서는
 * "필요할 때 찾아보는 참조 문서"다. 세 언어의 절 구성이 어긋나지
 * 않도록 구조는 코드가 정하고 언어팩은 문구만 담는다.
 *
 * 사용: node docs/guide_src/build_manuals.mjs
 * ════════════════════════════════════════════════════════════════ */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..');   // docs/
const M = {};

M.ko = {
  file: '사용설명서',
  title: 'AI 에이전트 연구노트 자동화 시스템 (AAA-RNS) 사용설명서',
  lead: '이 문서는 필요할 때 찾아보는 참조 문서입니다. 처음 설치하고 순서대로 따라 하려면 `installation-guide.pdf` 를 보십시오.',
  h: ['1. 시작', '2. 언어', '3. 에디션과 라이선스', '4. 시작 설정과 사용자 권한',
      '5. 온보딩 — 회사 맞춤 시스템 자동 구성', '6. 화면 구성', '7. 연구노트 작성',
      '8. 검증 게이트', '9. 서명·확정·개정', '10. AI 엔진(LLM) 연결 — 선택',
      '11. 팀 협업 (공유폴더)', '12. 저장 위치·백업·보안', '13. 가상 문서로 테스트', '14. 검증 재실행'],
  body: {
    start: `| 환경 | 방법 |
|---|---|
| macOS | \`start_mac.command\` 더블클릭 |
| Windows | \`start_windows.bat\` 더블클릭 |
| 수동 | \`python3 server.py\` 실행 후 \`http://localhost:8777\` 접속 |

- **처음 한 번만**: 내려받은 zip 에서 꺼낸 파일은 OS 가 실행 전에 확인을 요구합니다 —
  macOS 는 \`start_mac.command\` 우클릭 → 열기, Windows 는 SmartScreen 에서
  추가 정보 → 실행. 이후에는 더블클릭만으로 열립니다.
- 권장 브라우저: **Chrome 또는 Edge** (공유폴더 연결은 이 두 브라우저만 지원)
- 인터넷 연결이 필요 없습니다. 모든 처리가 이 PC 안에서 끝납니다.
- 서버 창(검은 창)은 시스템의 엔진입니다. 작업 중에는 닫지 마십시오.
- 서버 창의 안내문은 언어와 무관하게 영어입니다 — 터미널 글꼴이 한글·일본어를
  제대로 그리지 못하는 경우가 있어, 깨진 글자보다 영어가 낫다고 판단했습니다.`,
    lang: `화면 언어는 **한국어 · English · 日本語** 를 지원합니다.

- 최초 실행 시 **브라우저(OS) 언어를 따라 자동 선택**됩니다. 지원하지 않는 언어
  환경이면 영어로 시작합니다.
- 인증 화면(앱 진입 전)은 오른쪽 위 선택기로, 앱 안에서는 상단 오른쪽 선택기로
  언제든 바꿀 수 있습니다. 선택은 저장되어 다음 실행에도 유지됩니다.
- 언어를 바꾸면 정본 문서(화면·DOCX)의 라벨도 함께 바뀝니다.

**번역하지 않는 것** — 회사 데이터(과제명·기관명·사람 이름·증거 원문·측정값)는
어떤 언어에서도 원문 그대로 둡니다. 기록의 원본성이 제품의 핵심이기 때문입니다.
반면 시스템이 직접 작문하는 문장(해석문·측정조건·증거 위치)은 **생성 시점의
화면 언어로 만들어져** 그대로 기록됩니다.`,
    license: `이 저장소에서 받은 **커뮤니티 에디션은 등록 키가 필요 없습니다.** 압축을 풀고
실행하면 바로 온보딩이 시작되며, 만들 수 있는 프로젝트 수에도 제한이 없습니다.

**기업 에디션** — 회사·연구소에 개별 발급하는 배포본은 다르게 동작합니다.

- 첫 실행 시 인증 화면에서 전달받은 **라이선스 키**를 붙여넣거나 \`.lic\` 파일을
  선택합니다. 인증은 전자서명 검증으로 **오프라인에서 즉시** 끝납니다.
- **라이선스 1개 = 프로젝트 1개.** 최초 온보딩 시 키가 그 과제번호에 귀속되며,
  다른 프로젝트에는 새 키가 필요합니다. 시스템 초기화로도 귀속은 지워지지 않습니다.

어느 쪽이든 설정 → 제품 정보에서 현재 사용 허가 상태를 확인할 수 있습니다.

※ 정직한 한계: 소스가 공개된 로컬 앱이므로 키 검사는 코드를 고칠 수 있는 사람까지
막지 못합니다. 이 장치의 목적은 기술적 복제 방지가 아니라 발급 대상 확인과
1프로젝트 제한의 계약적 집행입니다.`,
    setup: `처음 접속하면 **시작 설정** 창이 뜹니다: 이름 · 이메일 · PIN(4자리 이상)을
등록하고, 팀 공유폴더를 쓰는 회사라면 이때 연결합니다 (PC마다 최초 1회).

- **첫 등록자 = 책임 데이터 관리자 (기본값)** — 백업·복원·초기화 등
  [데이터 관리]는 이 사람에게만 보이며, 복원·초기화는 PIN 재확인을 요구합니다.
- **권한 양도** — 설정 → 데이터 관리 → [책임 데이터 관리자 양도]로 언제든 다른
  등록 사용자에게 넘길 수 있습니다 (현 관리자 PIN 확인, 감사로그 기록).
- PIN 변경: 설정 → 내 계정.

※ 로컬 앱 특성상 이 권한 구분은 운영 정책 통제입니다 — 강제력 있는 접근 통제는
공유폴더의 OS 권한으로, 기록 변조 탐지는 해시 체인으로 수행됩니다.`,
    onboard: `첫 실행 시 4단계 온보딩이 시작됩니다.

1. **문서 업로드** — 연구개발계획서·제안서·일정표·지표표 등을 끌어다 놓습니다.
   지원 형식: PDF · DOCX · XLSX · HWPX · CSV · TXT (여러 개 가능).
2. **심층 분석** — 과제명·과제번호·기관·기간·예산·WP·성능지표·마일스톤·참여
   인력을 추출합니다. 모든 추출값에 근거(문서·위치·인용)와 신뢰도가 붙습니다.
3. **추출 결과 확인** — 시스템은 임의로 결정하지 않습니다. 각 항목을 확인·수정한
   뒤 진행하십시오. 추출하지 못한 항목은 「확인 필요 항목」으로 표시됩니다.
4. **시스템 생성** — 연구기간이 격주(또는 주간) 스프린트 격자로 분해되고,
   스프린트마다 연구노트 슬롯이 1:1로 만들어집니다.`,
    screens: `| 화면 | 용도 |
|---|---|
| 대시보드 | 기간 경과·확정 노트 수·서명 대기·증거 등재·마일스톤·현재 스프린트 |
| 로드맵 | 연구 전체를 한 화면에. WP별 기간 막대 + 노트 상태 점 + ◆마일스톤 + 오늘선 |
| 플래너 | **스프린트**(기간 목록) · **WP 간트**(일정 막대) · **월간**(달 단위 진행) |
| 연구노트 | 노트 목록과 상태 |
| 증거원장 | 등재된 모든 증거 \`[E#]\` 와 출처·해시 |
| 성능지표 | 확정 노트의 실측값 추이 (목표 대비) |
| AI 에이전트 | 26개 전문 에이전트 편성표 (참고용) |
| 설정 | 내 계정·AI 엔진·데이터 관리·제품 정보 |

**연결 탐색** — 로드맵의 WP 행, 플래너 간트의 WP 행, 월간의 각 줄을 클릭하면
관련 연구노트 목록으로 이동하고, 거기서 노트를 클릭하면 노트가 열립니다.
상단 **←** 버튼으로 언제든 이전 화면으로 돌아갑니다.

**보기 기간 조정** — 로드맵과 WP 간트는 전체 기간·올해·최근 12개월·향후 6개월·
사용자 지정으로 좁힐 수 있습니다. 좁히면 축이 월 단위로 바뀌고, 오늘이 보기 기간
밖이면 그 사실을 안내합니다.`,
    write: `플래너나 로드맵에서 스프린트를 클릭하면 노트 편집기가 열립니다.
상단에서 **작성자**와 **점검자**를 입력하십시오(서로 달라야 합니다).

**자동 집필 (핵심 기능)**

1. 실험일지(TXT)·측정데이터(CSV) 등을 점선 상자에 끌어다 놓습니다.
2. 파일이 SHA-256 해시와 함께 첨부되고, 내용에서 증거가 \`[E#]\` 로 등재됩니다.
3. "분석할까요?" 확인 후 [지금 분석·집필] 또는 나중에 [분석 시작하기]를 누르면
   **수행 내용 · 결과 데이터 · 해석**이 자동 작성되고 게이트가 실행됩니다.

- 모든 문장에 근거 증거번호 \`[E#]\` 가 붙습니다. 문장은 업로드 원문에서만 나오며
  시스템이 사실을 지어내지 않습니다.
- 금지 표현이 든 원문과 기간 외 기록은 초안에서 제외됩니다(증거로는 유지).
- 기록 날짜가 노트 기간 밖이면 **날짜가 속한 스프린트를 찾아 그 노트에 자동
  집필할지 제안**합니다. 확정된 노트는 건너뛰고 개정판 필요를 안내합니다.
- 측정값은 절대 보정하지 않습니다 — 원본이 단위 규칙에 어긋나면 G3가 지적합니다.

**수동 방식** — [수동 등재]로 증거 후보를 골라 등재하거나, [직접 기록]으로
연구자 진술을 등재할 수 있습니다(원본 대조 불가 → 증거 강도 낮음).`,
    gates: `게이트는 수정 제안이 아니라 **차단 장치**입니다. 지적이 남은 노트는
확정할 수 없습니다(권고 모드에서는 저장은 되되 지적이 보존됩니다).

| 게이트 | 검사 내용 |
|---|---|
| G1 증거매핑 | 증거번호 없는 문장, 존재하지 않는 증거 인용, 추정·과장 표현 |
| G2 과거정합성 | 확정 노트와의 기간 중복, 같은 지표의 모순 수치, 상태 역행 |
| G3 수치단위감사 | 합계·비율 재계산, 단위 표기, 목표 대비 방향, 근거 없는 "달성" 표기 |
| G4 지침준수 | 필수 필드(작성자·점검자·기간·해시 등), 인용 증거의 원본 첨부 |

G3의 달성 표기 검사는 구조화된 필드뿐 아니라 **측정조건에 자유 서술로 적은
달성 주장**도 검사합니다(한/영/일). "미달성" 같은 부정 표현은 주장으로 보지 않습니다.`,
    seal: `1. 작성자가 [기여자 서명]
2. 점검자가 자기 이름으로 [최종 승인 · 확정] → **확정(sealed)**
   - 작성자 본인의 최종 승인은 교차 승인 원칙으로 차단됩니다.
3. 확정 노트는 수정 불가. 변경은 **개정판(-R1, -R2…)** 발행으로만 가능하며
   원본과 개정 이력이 모두 남습니다.

**봉인 방식** — 확정 시 노트 해시가 **본문과 서명을 함께 덮어** 직전 확정 노트의
해시와 사슬로 연결됩니다(\`seal_algo: v2\`). 따라서 확정 후에 본문을 고치는 것은
물론 **승인자 이름을 바꿔치기해도** 설정 → 해시 체인 검증에서 즉시 드러납니다.
확정과 동시에 원본 JSON과 정본 DOCX가 \`archive/<연도>/\` 에 자동 보관됩니다.

**암호 서명 (v2.1)** — 모든 서명에는 **기기 키**(ECDSA P-256) 서명이 자동으로
함께 실립니다. 개인키는 브라우저 안(IndexedDB)에 추출 불가로 생성되어 기기를
떠나지 않으며, 공개키만 사용자 기록에 실려 팀이 대조합니다. 설정 → **서명 ·
시점인증**에서 **패스키**(Touch ID·Windows Hello 등)를 등록하면 서명 순간
본인 확인 절차를 추가할 수 있습니다. 두 서명 모두 봉인 해시에 함께 잠기므로
확정 후 바꿔치기는 체인 파손으로 드러나고, 키 대장에 없는 키로 만든 서명은
검증 패널에 표시됩니다. 브라우저 저장소를 지우면 기기 키도 사라집니다 —
기존 서명의 검증은 계속 가능하고, 다음 서명 때 새 키가 등록됩니다.

**시점인증 (RFC-3161 · 선택)** — 설정 → 서명 · 시점인증에서 관리자가 켜면,
확정 순간 **봉인 해시 32바이트만**(본문·파일이 아님) 시점인증 기관(TSA)으로
보내 서명된 시각 토큰을 받아 노트에 붙입니다. **기본은 꺼짐**이고, 오프라인이면
기기 시계로만 기록하며 확정을 막지 않습니다. 확정 노트의 「서명 · 시점인증 검증」
패널이 토큰의 구조·해시 일치·발급 시각을 확인하고, 완전한 암호학적 검증 명령
(\`openssl ts -verify\`)을 안내합니다. 기본 TSA(FreeTSA)는 공인 시점인증
기관이 아닙니다.`,
    llm: `시스템은 LLM 없이 완전히 동작합니다. 연결하면 자동 초안의 서술이 더
자연스러워집니다.

- 설정 → **AI 엔진 (LLM)** (책임 데이터 관리자 전용): Anthropic Claude ·
  Google Gemini · OpenAI 중 선택 → 모델·API 키 입력 → [연결 테스트] → [저장]
- 저장하면 노트 화면에 **[AI 서술 다듬기]** 버튼이 나타납니다.
- **안전 장치**: AI가 다듬은 문장도 게이트가 재검증하며, 증거 인용 \`[E#]\` 이
  바뀌거나 금지 표현이 유입된 문장은 자동 폐기, 게이트 지적이 늘면 전체 되돌림.
- 주의: OpenAI는 브라우저 직접 호출을 차단하는 경우가 있습니다(CORS) — 이 경우
  Claude 또는 Gemini를 사용하십시오.
- 키는 \`data/llm.json\` 에 저장됩니다 — 공유폴더 모드에서는 팀 공유·백업 포함.`,
    team: `- 왼쪽 위 저장소 표시를 클릭 → 회사 공유 드라이브의 폴더를 지정합니다
  (Chrome/Edge, PC마다 최초 1회).
- 연결하면 모든 기록이 그 폴더에 실제 파일로 저장되어 팀원이 같은 기록을 봅니다.
- 동시 편집은 낙관적 잠금(\`_rev\`)으로 갱신 소실을 막습니다.
- 실제 접근 통제는 회사의 폴더 공유 권한(읽기/쓰기)으로 수행하십시오.`,
    storage: `| 폴더 | 내용 |
|---|---|
| \`data/\` | 과제 구조·플래너·지표·감사로그(추가 전용) |
| \`notes/\` | 연구노트(상태·서명·해시 포함) |
| \`notes_files/\` | 업로드한 원본 파일 |
| \`ledger/\` | 증거원장 |
| \`archive/\` | 확정 노트 영구 보관본 (확정 시 자동 생성, 앱이 다시 쓰지 않음) |

**백업** — 설정 → [전체 백업 (.zip · 원본 포함)]. ZIP 안에
\`backup_manifest.json\` 이 파일별 SHA-256을 담고 있어, 복원 시 **전 파일 무결성
검증을 통과해야만** 기록이 시작됩니다. 1바이트라도 손상되면 기존 데이터는 전혀
변경되지 않습니다. 백업은 **언제든** 받을 수 있고, 마지막 백업 후 30일이 지나면
대시보드가 월 1회 안내합니다(설정에서 끌 수 있음).

**보안 설계**

1. **완전 오프라인** — CSP \`connect-src 'self'\` 로 외부 전송 자체를 차단
   (AI 엔진 연결 시 해당 3사 엔드포인트만 예외. 시점인증을 켠 경우에는 로컬
   서버가 봉인 해시 32바이트만 TSA 로 중계 — 본문은 어떤 경우에도 나가지 않음).
2. **로컬 서버 전용** — \`localhost\` 에만 바인딩, 외부 공개 아님.
3. **변조 탐지** — 업로드 원본은 SHA-256, 확정 노트는 본문+서명 해시 체인.
4. **감사추적** — 게이트 판정·서명·확정·백업·복원·권한 양도가 append-only 기록.
5. **PIN 저장** — PBKDF2-SHA256(210,000회·사용자별 솔트). 구판(v2.1 이전)
   해시는 다음 정상 입력 때 자동 승격됩니다. 다만 PIN 은 접근 통제가 아닙니다 —
   실제 접근 통제는 공유폴더의 OS 권한입니다.`,
    testing: `실제 문서 없이 시스템을 시험하는 방법:

1. **샘플 문서** — \`sample_docs/\` 의 샘플 계획서·지표를 온보딩에 업로드.
2. **가상 문서 생성기** — \`가상문서_만들기.command\`(Mac) / \`.bat\`(Windows)
   더블클릭 → \`가상문서/\` 폴더에 가상 회사의 계획서·지표·실험일지·측정 CSV
   세트가 생성됩니다 (Node.js 필요). 세트 안의 \`사용법.txt\` 가 테스트 순서를
   안내합니다. 여러 세트: \`node simulation/make_test_docs.mjs 5\`
3. **자동 검증 시뮬레이션** — 아래 14절.

테스트 팁: 일부러 \`[E#]\` 없는 문장을 넣거나 작성자 본인 이름으로 최종 승인을
시도해 보십시오 — 게이트와 교차 승인 원칙이 차단하는 것을 직접 볼 수 있습니다.`,
    verify: `\`\`\`bash
node simulation/run_simulation.mjs --campaign 2 --cycle 9 --iters 150000
\`\`\`

시드 기반으로 완전히 재현됩니다(같은 사이클 번호 → 같은 결과). 보고서는
\`simulation/reports/\` 에 JSON·MD로 저장됩니다. 검증 이력과 발견·수정된 결함은
\`검증보고서.md\` 를 보십시오.`,
  },
  foot: 'AAA-RNS v2.0 · Developed by **Seung Ho Jung** · Apache-2.0 © 2026',
};

M.en = {
  file: 'User_Manual',
  title: 'AI Agent Research Notebook Automation System (AAA-RNS) — User Manual',
  lead: 'This is a reference document to consult as needed. To install and follow the steps in order for the first time, see `installation-guide.pdf`.',
  h: ['1. Starting', '2. Language', '3. Editions and licensing', '4. Initial setup and user roles',
      '5. Onboarding — building the system for your project', '6. Screens', '7. Writing a research note',
      '8. Verification gates', '9. Signing, sealing, revising', '10. Connecting an AI engine (optional)',
      '11. Team collaboration (shared folder)', '12. Storage, backup, security', '13. Testing with synthetic documents', '14. Re-running verification'],
  body: {
    start: `| Platform | How to start |
|---|---|
| macOS | Double-click \`start_mac.command\` |
| Windows | Double-click \`start_windows.bat\` |
| Manual | Run \`python3 server.py\`, then open \`http://localhost:8777\` |

- **First run only**: the OS checks files extracted from a downloaded zip — on macOS,
  right-click \`start_mac.command\` → Open; on Windows, click More info → Run anyway on the
  SmartScreen prompt. After that, a double-click is enough.
- Recommended browsers: **Chrome or Edge** (shared-folder connection works only in these two)
- No internet connection is required. Everything is processed on this PC.
- The server window (the black one) is the engine. Leave it open while you work.
- Its messages are in English regardless of the interface language — terminal fonts
  cannot be relied on to render Korean or Japanese, and English beats mojibake.`,
    lang: `The interface is available in **Korean · English · Japanese**.

- On first run the language is **chosen automatically from your browser (OS) language**.
  In an unsupported locale it starts in English.
- Change it any time: the selector at the top right of the registration screen before
  you enter the app, and the selector in the header once inside. The choice is saved.
- Changing the language also changes the labels of the official document (on screen and in DOCX).

**What is never translated** — company data (project titles, organisation names, people's
names, quoted evidence, measured values) stays exactly as written, in every language,
because the authenticity of the record is the point of the product. Sentences the system
composes itself (interpretations, measurement conditions, evidence locators) are
**generated in the interface language at the time of writing** and stored that way.`,
    license: `The **Community edition** you downloaded from this repository **requires no
registration key.** Unzip it, run it, and onboarding begins immediately; there is no
limit on the number of projects you may create.

**Enterprise edition** — builds issued individually to a company or institute behave
differently.

- On first run, paste the **license key** you received into the registration screen, or
  select the \`.lic\` file. Verification is a digital-signature check and completes
  **instantly, offline**.
- **One license = one project.** During the first onboarding the key is bound to that
  project number; a different project needs a new key. A system reset does not clear the binding.

Either way, Settings → Product information shows your current licensing status.

Note, plainly: because this is a local application with published source, a key check
cannot stop anyone able to edit the code. Its purpose is not technical copy protection
but confirming who a build was issued to and making the one-project limit contractually
enforceable.`,
    setup: `On first access the **initial setup** dialog appears: register your name, e-mail,
and a PIN (at least four digits). If your company uses a shared folder, connect it here
(once per PC).

- **First registrant = Data Custodian (default)** — [Data management] (backup, restore,
  reset) is shown only to this person, and restore and reset re-confirm the PIN.
- **Transferring the role** — Settings → Data management → [Transfer Data Custodian role]
  hands it to another registered user at any time (current custodian's PIN required, written to the audit log).
- Change your PIN: Settings → My account.

Note: being a local application, this role separation is an operational-policy control.
Enforceable access control comes from the OS permissions on the shared folder, and
tamper detection comes from the hash chain.`,
    onboard: `A four-step onboarding starts on first run.

1. **Upload documents** — drag in the R&D plan, proposal, schedule, metrics table, and so on.
   Supported: PDF · DOCX · XLSX · HWPX · CSV · TXT (several at once).
2. **Deep analysis** — the project title, number, organisation, period, budget, work
   packages, metrics, milestones, and members are extracted. Every extracted value carries
   its basis (document, position, quotation) and a confidence rating.
3. **Review the extraction** — the system decides nothing on its own. Check and correct each
   item before continuing. Anything it could not extract is listed under "Items needing review".
4. **Generate the system** — the research period is divided into a fortnightly (or weekly)
   sprint grid, with one research-note slot per sprint.`,
    screens: `| Screen | Purpose |
|---|---|
| Dashboard | Elapsed period, sealed notes, awaiting signature, evidence entries, milestones, current sprint |
| Roadmap | The whole project on one screen: WP bars + note-status dots + ◆ milestones + today line |
| Planner | **Sprint** (list by period) · **WP Gantt** (schedule bars) · **Monthly** (progress by month) |
| Research Note | The note list and states |
| Evidence Ledger | Every registered evidence item \`[E#]\` with source and hash |
| Performance Metrics | Measured values from sealed notes, against target |
| AI Agents | Roster of the 26 specialist agents (reference) |
| Settings | My account, AI engine, data management, product information |

**Linked navigation** — clicking a WP row in the Roadmap, a WP row in the Planner's Gantt,
or a row in the Monthly view opens the related research notes; clicking a note there opens it.
The **←** button at the top returns to the previous screen at any time.

**View period** — the Roadmap and the WP Gantt can be narrowed to All time, This year,
Last 12 months, Next 6 months, or a custom range. Narrowing switches the axis to months,
and if today falls outside the view the screen says so.`,
    write: `Click a sprint in the Planner or the Roadmap to open the note editor. Enter the
**author** and the **reviewer** at the top (they must differ).

**Auto-writing (the core feature)**

1. Drag the raw material for the period — experiment logs (TXT), measurement data (CSV) —
   onto the dashed box.
2. Each file is attached with its SHA-256 hash, and evidence is registered from its contents as \`[E#]\`.
3. Confirm at the "Analyse now?" prompt, or press [Start analysis] later, and the
   **work performed · result data · interpretation** are written automatically and the gates run.

- Every sentence carries the evidence number \`[E#]\` that supports it. Sentences come only
  from the uploaded originals; the system never invents facts.
- Originals containing prohibited wording, and records dated outside the period, are excluded
  from the draft (they remain as evidence).
- If a record's date falls outside the note's period, the system **finds the sprint it belongs
  to and offers to write into that note**. Sealed notes are skipped with a note that a revision is required.
- Measured values are never adjusted — if an original breaks a unit rule, G3 reports it.

**Manual routes** — [Manual entry] lets you pick evidence candidates yourself, and
[Direct entry] registers a researcher statement (no original to check against → low evidence strength).`,
    gates: `A gate is not a suggestion but a **barrier**. A note with outstanding findings cannot
be sealed (in advisory mode it can still be saved, with the findings preserved).

| Gate | What it checks |
|---|---|
| G1 Evidence mapping | Sentences without an evidence number, citations of non-existent evidence, speculative or exaggerated wording |
| G2 Longitudinal consistency | Period overlap with sealed notes, contradictory values for one metric, status regression |
| G3 Numeric & unit audit | Recalculated sums and ratios, unit notation, direction against target, unsupported claims of achievement |
| G4 Compliance | Required fields (author, reviewer, period, hash, …) and originals attached for cited evidence |

G3's achievement check covers not only the structured field but also **achievement claims
written in free text** in the measurement condition (Korean, English, Japanese). Negations such as
"not achieved" are not treated as claims.`,
    seal: `1. The author gives a [Contributor signature].
2. The reviewer gives [Final approval · Seal] under their own name → **sealed**.
   - Final approval by the author is blocked by the cross-approval principle.
3. A sealed note cannot be edited. Changes are made only by issuing a **revision (-R1, -R2, …)**;
   the original and the revision history both remain.

**How sealing works** — on sealing, the note's hash **covers the content and the signatures
together** and is chained to the hash of the previous sealed note (\`seal_algo: v2\`). So not
only editing the text afterwards but also **swapping an approver's name** is exposed
immediately by Settings → Verify hash chain. At the moment of sealing, the original JSON and
the official DOCX are archived automatically under \`archive/<year>/\`.

**Cryptographic signatures (v2.1)** — every signature automatically carries a **device-key**
signature (ECDSA P-256). The private key is generated non-extractable inside the browser
(IndexedDB) and never leaves the machine; only the public key is published in the user record
for the team to check against. In Settings → **Signing · Timestamping** you can additionally
enroll a **passkey** (Touch ID, Windows Hello, …) to require a presence check at the moment of
signing. Both are locked under the seal hash, so swapping them after sealing breaks the chain,
and a signature made with a key that is not in the key registry is flagged in the verification
panel. Clearing browser storage destroys the device key — existing signatures remain
verifiable, and a new key is enrolled on the next signature.

**Timestamping (RFC-3161, optional)** — when an administrator enables it in Settings →
Signing · Timestamping, sealing sends **only the 32-byte seal hash** (never content or files)
to a timestamping authority (TSA) and attaches the signed time token to the note. **Off by
default**; when offline, the note seals with the local clock and is never blocked. The
"Signature · timestamp verification" panel on a sealed note checks the token's structure, hash
match and issue time, and shows the command for full cryptographic verification
(\`openssl ts -verify\`). The default TSA (FreeTSA) is not an accredited authority.`,
    llm: `The system works completely without an LLM. Connecting one makes the auto-written prose
read more naturally.

- Settings → **AI engine (LLM)** (Data Custodian only): choose Anthropic Claude, Google Gemini,
  or OpenAI → enter the model and API key → [Test connection] → [Save].
- Once saved, a **[Polish prose with AI]** button appears on the note screen.
- **Safeguards**: polished sentences are re-verified by the gates; any sentence whose \`[E#]\`
  citations change or that introduces prohibited wording is discarded, and if gate findings
  increase the whole result is reverted.
- Note: OpenAI sometimes blocks direct browser calls (CORS) — in that case use Claude or Gemini.
- The key is stored in \`data/llm.json\` — in shared-folder mode the team shares it and it is included in backups.`,
    team: `- Click the storage indicator at the top left → designate a folder on the company drive
  (Chrome/Edge, once per PC).
- Once connected, every record is stored there as real files and the team sees the same records.
- Concurrent editing is protected by optimistic locking (\`_rev\`), which prevents lost updates.
- Enforce real access control through your company's folder permissions (read/write).`,
    storage: `| Folder | Contents |
|---|---|
| \`data/\` | Project structure, planner, metrics, audit log (append-only) |
| \`notes/\` | Research notes (state, signatures, hashes) |
| \`notes_files/\` | The original uploaded files |
| \`ledger/\` | Evidence ledger |
| \`archive/\` | Permanent copies of sealed notes (created on sealing; never rewritten by the app) |

**Backup** — Settings → [Full backup (.zip, originals included)]. The archive contains
\`backup_manifest.json\` with a per-file SHA-256, so a restore begins writing **only after every
file passes integrity verification**. If even one byte is damaged, your existing data is left
completely untouched. You can take a backup **whenever you like**, and 30 days after the last one
the dashboard reminds you once a month (this can be switched off in Settings).

**Security design**

1. **Fully offline** — CSP \`connect-src 'self'\` blocks outbound transmission itself
   (only the three AI endpoints are excepted, and only when an AI engine is connected; with
   timestamping enabled, the local server relays only the 32-byte seal hash to the TSA —
   content never leaves the machine in any case).
2. **Local server only** — bound to \`localhost\`; never exposed externally.
3. **Tamper detection** — SHA-256 for uploaded originals; a content+signature hash chain for sealed notes.
4. **Audit trail** — gate verdicts, signatures, sealing, backup, restore, and role transfers are recorded append-only.
5. **PIN storage** — PBKDF2-SHA256 (210,000 iterations, per-user salt). Hashes from before
   v2.1 are upgraded in place on the next successful entry. The PIN is still not access
   control — real access control is the OS permissions on your shared folder.`,
    testing: `Ways to exercise the system without real documents:

1. **Sample documents** — upload the sample plan and metrics table in \`sample_docs/\` during onboarding.
2. **Synthetic document generator** — double-click \`가상문서_만들기.command\` (Mac) / \`.bat\` (Windows)
   to create, under \`가상문서/\`, a set for a fictitious company: plan, metrics, experiment log, and
   measurement CSV (Node.js required). The \`사용법.txt\` inside each set walks you through the test.
   For several sets: \`node simulation/make_test_docs.mjs 5\`
3. **Automated verification simulation** — see section 14.

Testing tip: deliberately add a sentence without \`[E#]\`, or try final approval under the author's
own name — you will see the gates and the cross-approval principle block them.`,
    verify: `\`\`\`bash
node simulation/run_simulation.mjs --campaign 2 --cycle 9 --iters 150000
\`\`\`

Runs are fully reproducible from the seed (same cycle number → same result). Reports are written to
\`simulation/reports/\` as JSON and MD. For the verification history and the defects found and fixed,
see \`검증보고서.md\` (Verification Report).`,
  },
  foot: 'AAA-RNS v2.0 · Developed by **Seung Ho Jung** · Apache-2.0 © 2026',
};

M.ja = {
  file: '利用マニュアル',
  title: 'AI エージェント研究ノート自動化システム（AAA-RNS）利用マニュアル',
  lead: '本書は必要なときに参照するリファレンスです。はじめてインストールして順に進める場合は `installation-guide.pdf` をご覧ください。',
  h: ['1. 起動', '2. 言語', '3. エディションとライセンス', '4. 開始設定とユーザー権限',
      '5. オンボーディング — 課題専用システムの自動構成', '6. 画面構成', '7. 研究ノートの作成',
      '8. 検証ゲート', '9. 署名・確定・改訂', '10. AI エンジン（LLM）の接続 — 任意',
      '11. チーム協業（共有フォルダ）', '12. 保存場所・バックアップ・セキュリティ', '13. 仮想文書によるテスト', '14. 検証の再実行'],
  body: {
    start: `| 環境 | 方法 |
|---|---|
| macOS | \`start_mac.command\` をダブルクリック |
| Windows | \`start_windows.bat\` をダブルクリック |
| 手動 | \`python3 server.py\` を実行し \`http://localhost:8777\` を開く |

- **初回のみ**: ダウンロードした zip から取り出したファイルは OS が実行前に確認を求めます —
  macOS では \`start_mac.command\` を右クリック → 開く、Windows では SmartScreen の
  詳細情報 → 実行をクリック。以後はダブルクリックだけで開きます。
- 推奨ブラウザ: **Chrome または Edge**（共有フォルダ接続はこの二つのみ対応）
- インターネット接続は不要です。すべての処理がこの PC 内で完結します。
- サーバーウィンドウ（黒い画面）はシステムのエンジンです。作業中は閉じないでください。
- その案内文は言語にかかわらず英語です — ターミナルのフォントが日本語・韓国語を
  正しく描画できない場合があり、文字化けよりは英語がよいと判断しました。`,
    lang: `画面の言語は **한국어 · English · 日本語** に対応しています。

- 初回起動時に**ブラウザ（OS）の言語に従って自動選択**されます。対応していない
  言語環境では英語で開始します。
- 認証画面（アプリ入場前）は右上の選択器で、アプリ内では上部右の選択器でいつでも
  変更できます。選択は保存され、次回以降も維持されます。
- 言語を変更すると、正本文書（画面・DOCX）のラベルも合わせて変わります。

**翻訳しないもの** — 会社データ（課題名・機関名・氏名・証拠の原文・測定値）は、
どの言語でも原文のまま残します。記録の原本性が製品の核心だからです。一方、
システム自身が作文する文（解釈文・測定条件・証拠の位置）は**生成時点の画面言語で
作られ**、そのまま記録されます。`,
    license: `このリポジトリから入手した**コミュニティエディションは登録キーを必要としません。**
展開して実行すればすぐにオンボーディングが始まり、作成できるプロジェクト数にも
制限はありません。

**エンタープライズエディション** — 会社・研究所へ個別に発行する配布本は動作が異なります。

- 初回起動時、認証画面で受領した**ライセンスキー**を貼り付けるか \`.lic\` ファイルを
  選択します。認証は電子署名の検証で、**オフラインで即座に**完了します。
- **ライセンス 1 つ = プロジェクト 1 つ。** 初回オンボーディング時にキーがその課題
  番号へ紐付けられ、別のプロジェクトには新しいキーが必要です。システム初期化を
  行っても紐付けは消えません。

いずれの場合も、設定 → 製品情報で現在の使用許諾状態を確認できます。

※ 率直な限界: ソースが公開されたローカルアプリであるため、キー検査はコードを
書き換えられる人までは止められません。この仕組みの目的は技術的なコピー防止では
なく、発行先の確認と 1 プロジェクト制限の契約的な履行にあります。`,
    setup: `初回アクセス時に**開始設定**のウィンドウが表示されます。氏名・メール・
PIN（4 桁以上）を登録し、チーム共有フォルダを使う会社はこのとき接続します
（PC ごとに初回 1 回）。

- **最初の登録者 = データ管理責任者（既定）** — バックアップ・復元・初期化などの
  ［データ管理］はこの人にのみ表示され、復元と初期化は PIN を再確認します。
- **権限の譲渡** — 設定 → データ管理 →［データ管理責任者の譲渡］で、登録済みの
  他のユーザーにいつでも引き継げます（現管理者の PIN 確認、監査ログに記録）。
- PIN の変更: 設定 → 自分のアカウント。

※ ローカルアプリという性質上、この権限区分は運用ポリシー上の統制です。強制力の
ある強制的なアクセス統制は共有フォルダの OS 権限で、記録の改ざん検出はハッシュチェーンで行います。`,
    onboard: `初回起動時に 4 段階のオンボーディングが始まります。

1. **文書のアップロード** — 研究開発計画書・提案書・日程表・指標表などをドラッグします。
   対応形式: PDF · DOCX · XLSX · HWPX · CSV · TXT（複数可）。
2. **詳細分析** — 課題名・課題番号・機関・期間・予算・WP・性能指標・マイルストーン・
   参加人員を抽出します。すべての抽出値に根拠（文書・位置・引用）と信頼度が付きます。
3. **抽出結果の確認** — システムが独断で決めることはありません。各項目を確認・修正
   してから進めてください。抽出できなかった項目は「確認が必要な項目」として示されます。
4. **システムの生成** — 研究期間が隔週（または週次）のスプリント格子に分解され、
   スプリントごとに研究ノートのスロットが 1 対 1 で作成されます。`,
    screens: `| 画面 | 用途 |
|---|---|
| ダッシュボード | 期間の経過・確定ノート数・署名待ち・証拠登録・マイルストーン・現在のスプリント |
| ロードマップ | 研究全体を 1 画面に。WP 別の期間バー＋ノート状態の点＋◆マイルストーン＋本日線 |
| プランナー | **スプリント**（期間別一覧）·**WP ガント**（日程バー）·**月次**（月単位の進捗） |
| 研究ノート | ノートの一覧と状態 |
| 証拠台帳 | 登録されたすべての証拠 \`[E#]\` と出典・ハッシュ |
| 性能指標 | 確定ノートの実測値の推移（目標対比） |
| AI エージェント | 26 の専門エージェント編成表（参考） |
| 設定 | 自分のアカウント・AI エンジン・データ管理・製品情報 |

**連携ナビゲーション** — ロードマップの WP 行、プランナーのガントの WP 行、月次の各行を
クリックすると関連する研究ノートの一覧に移動し、そこでノートをクリックすると開きます。
上部の **←** ボタンでいつでも前の画面に戻れます。

**表示期間の調整** — ロードマップと WP ガントは、全期間・今年・直近 12 か月・今後 6 か月・
ユーザー指定に絞れます。絞ると軸が月単位に変わり、本日が表示期間の外にある場合はその旨を案内します。`,
    write: `プランナーまたはロードマップでスプリントをクリックすると、ノート編集画面が開きます。
上部で**作成者**と**点検者**を入力してください（互いに異なる必要があります）。

**自動執筆（中核機能）**

1. 実験日誌（TXT）・測定データ（CSV）などを点線の枠にドラッグします。
2. ファイルが SHA-256 ハッシュとともに添付され、内容から証拠が \`[E#]\` として登録されます。
3. 「分析しますか？」の確認で［今すぐ分析・執筆］、または後から［分析開始］を押すと、
   **実施内容・結果データ・解釈**が自動作成され、ゲートが実行されます。

- すべての文に根拠となる証拠番号 \`[E#]\` が付きます。文はアップロードした原文からのみ
  生成され、システムが事実を作り出すことはありません。
- 禁止表現を含む原文と期間外の記録は下書きから除外されます（証拠としては保持）。
- 記録の日付がノートの期間外の場合、**日付が属するスプリントを見つけてそのノートに
  自動執筆するかを提案**します。確定済みのノートはスキップし、改訂版が必要な旨を案内します。
- 測定値は決して補正しません — 原本が単位の規則に反していれば G3 が指摘します。

**手動の方法** — ［手動登録］で証拠候補を選んで登録するか、［直接記録］で研究者の
陳述を登録できます（原本との照合不可 → 証拠強度は低）。`,
    gates: `ゲートは修正提案ではなく**遮断装置**です。指摘が残っているノートは確定できません
（勧告モードでは保存は可能で、指摘は保持されます）。

| ゲート | 検査内容 |
|---|---|
| G1 証拠マッピング | 証拠番号のない文、存在しない証拠の引用、推測・誇張表現 |
| G2 過去整合性 | 確定ノートとの期間重複、同一指標の矛盾する数値、状態の逆行 |
| G3 数値・単位監査 | 合計・比率の再計算、単位表記、目標に対する方向、根拠のない「達成」表記 |
| G4 指針遵守 | 必須項目（作成者・点検者・期間・ハッシュなど）、引用証拠の原本添付 |

G3 の達成表記の検査は、構造化された項目だけでなく、測定条件に**自由記述で書かれた
達成の主張**も対象とします（韓・英・日）。「未達成」のような否定表現は主張とみなしません。`,
    seal: `1. 作成者が［寄与者署名］を行います。
2. 点検者が自分の名前で［最終承認・確定］を行うと **確定（sealed）** となります。
   - 作成者本人による最終承認は、相互承認の原則により遮断されます。
3. 確定したノートは修正できません。変更は**改訂版（-R1、-R2 …）**の発行でのみ可能で、
   原本と改訂履歴の両方が残ります。

**封印の仕組み** — 確定時、ノートのハッシュは**本文と署名の両方を覆い**、直前の確定
ノートのハッシュと鎖状に連結されます（\`seal_algo: v2\`）。したがって確定後に本文を
直すことはもちろん、**承認者名をすり替えても**、設定 → ハッシュチェーン検証で直ちに
明らかになります。確定と同時に、原本 JSON と正本 DOCX が \`archive/<年>/\` に自動保管されます。

**暗号署名（v2.1）** — すべての署名には**端末キー**（ECDSA P-256）の署名が自動的に
付きます。秘密鍵はブラウザ内（IndexedDB）に抽出不可として生成され、端末を離れません。
公開鍵のみが利用者記録に載り、チームが照合します。設定 → **署名・タイムスタンプ**で
**パスキー**（Touch ID・Windows Hello など）を登録すると、署名の瞬間に本人確認を追加
できます。どちらも封印ハッシュに閉じ込められるため、確定後のすり替えはチェーンの破損
として現れ、鍵台帳にない鍵による署名は検証パネルに表示されます。ブラウザの保存領域を
消去すると端末キーも消えます — 既存署名の検証は引き続き可能で、次の署名時に新しい鍵が
登録されます。

**タイムスタンプ（RFC-3161・任意）** — 設定 → 署名・タイムスタンプで管理者が有効に
すると、確定の瞬間に**封印ハッシュ 32 バイトのみ**（本文・ファイルではありません）を
タイムスタンプ局（TSA）に送り、署名済みの時刻トークンを受け取ってノートに添付します。
**既定はオフ**で、オフライン時は端末時計のみで記録し、確定を妨げません。確定ノートの
「署名・タイムスタンプ検証」パネルがトークンの構造・ハッシュ一致・発行時刻を確認し、
完全な暗号学的検証コマンド（\`openssl ts -verify\`）を案内します。既定の TSA
（FreeTSA）は認定タイムスタンプ局ではありません。`,
    llm: `システムは LLM なしで完全に動作します。接続すると自動下書きの記述がより自然になります。

- 設定 → **AI エンジン（LLM）**（データ管理責任者専用）: Anthropic Claude・Google Gemini・
  OpenAI から選択 → モデルと API キーを入力 →［接続テスト］→［保存］。
- 保存すると、ノート画面に **［AI で記述を推敲］** ボタンが表示されます。
- **安全装置**: 推敲された文もゲートが再検証し、証拠引用 \`[E#]\` が変わった文や禁止表現が
  混入した文は自動的に破棄され、ゲートの指摘が増えた場合は全体が巻き戻されます。
- 注意: OpenAI はブラウザからの直接呼び出しを遮断する場合があります（CORS）— その場合は
  Claude または Gemini をご利用ください。
- キーは \`data/llm.json\` に保存されます — 共有フォルダモードではチームで共有され、バックアップにも含まれます。`,
    team: `- 左上のストレージ表示をクリック → 会社の共有ドライブ上のフォルダを指定します
  （Chrome/Edge、PC ごとに初回 1 回）。
- 接続すると、すべての記録がそのフォルダに実ファイルとして保存され、チーム全員が同じ記録を見ます。
- 同時編集は楽観的ロック（\`_rev\`）で更新の消失を防ぎます。
- 実際のアクセス統制は、会社のフォルダ共有権限（読み取り／書き込み）で行ってください。`,
    storage: `| フォルダ | 内容 |
|---|---|
| \`data/\` | 課題構造・プランナー・指標・監査ログ（追記専用） |
| \`notes/\` | 研究ノート（状態・署名・ハッシュを含む） |
| \`notes_files/\` | アップロードした原本ファイル |
| \`ledger/\` | 証拠台帳 |
| \`archive/\` | 確定ノートの永久保管本（確定時に自動生成、アプリは書き換えない） |

**バックアップ** — 設定 →［全体バックアップ（.zip・原本を含む）］。ZIP 内の
\`backup_manifest.json\` がファイルごとの SHA-256 を保持しており、復元は**全ファイルの
完全性検証を通過してはじめて**書き込みを開始します。1 バイトでも破損していれば、既存の
データは一切変更されません。バックアップは**いつでも**取得でき、前回から 30 日が過ぎると
ダッシュボードが月 1 回案内します（設定でオフにできます）。

**セキュリティ設計**

1. **完全オフライン** — CSP \`connect-src 'self'\` により外部送信そのものを遮断
   （AI エンジン接続時のみ、当該 3 社のエンドポイントを例外とします。タイムスタンプを
   有効にした場合は、ローカルサーバーが封印ハッシュ 32 バイトのみを TSA へ中継します —
   本文はいかなる場合も端末を離れません）。
2. **ローカルサーバー専用** — \`localhost\` にのみバインドし、外部には公開しません。
3. **改ざん検出** — アップロード原本は SHA-256、確定ノートは本文＋署名のハッシュチェーン。
4. **監査証跡** — ゲート判定・署名・確定・バックアップ・復元・権限譲渡を追記専用で記録。
5. **PIN の保存** — PBKDF2-SHA256（210,000 回・利用者ごとのソルト）。v2.1 より前の
   ハッシュは、次回の正常入力時にその場で昇格されます。PIN はアクセス統制ではありません —
   実際の統制は共有フォルダの OS 権限です。`,
    testing: `実際の文書がなくてもシステムを試せます。

1. **サンプル文書** — \`sample_docs/\` のサンプル計画書・指標表をオンボーディングでアップロード。
2. **仮想文書生成ツール** — \`가상문서_만들기.command\`（Mac）/ \`.bat\`（Windows）を
   ダブルクリックすると、\`가상문서/\` フォルダに架空の会社の計画書・指標・実験日誌・測定 CSV
   のセットが生成されます（Node.js が必要）。各セット内の \`사용법.txt\` がテスト手順を案内します。
   複数セット: \`node simulation/make_test_docs.mjs 5\`
3. **自動検証シミュレーション** — 14 節を参照。

テストのコツ: わざと \`[E#]\` のない文を入れる、あるいは作成者本人の名前で最終承認を試みて
ください — ゲートと相互承認の原則が遮断する様子を実際に確認できます。`,
    verify: `\`\`\`bash
node simulation/run_simulation.mjs --campaign 2 --cycle 9 --iters 150000
\`\`\`

シードに基づき完全に再現されます（同じサイクル番号 → 同じ結果）。レポートは
\`simulation/reports/\` に JSON・MD で保存されます。検証の履歴と発見・修正された欠陥は
\`검증보고서.md\`（検証報告書）をご覧ください。`,
  },
  foot: 'AAA-RNS v2.0 · Developed by **Seung Ho Jung** · Apache-2.0 © 2026',
};

const KEYS = ['start','lang','license','setup','onboard','screens','write','gates','seal','llm','team','storage','testing','verify'];
for (const lang of ['ko','en','ja']) {
  const t = M[lang];
  const md = `# ${t.title}\n\n> ${t.lead}\n\n` +
    KEYS.map((k, i) => `## ${t.h[i]}\n\n${t.body[k]}\n`).join('\n') +
    `\n---\n\n${t.foot}\n`;
  /* 세 언어 파일명을 동일하게 두고 언어는 폴더로 가른다 — URL 안전하고,
     저장소 방문자가 언어만 바꿔 같은 경로를 예측할 수 있다. */
  writeFileSync(join(OUT, lang, 'user-manual.md'), md);
  console.log(`생성: ${lang}/user-manual.md (${md.split('\n').length}줄)`);
}
