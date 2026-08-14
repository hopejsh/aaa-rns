/* ════════════════════════════════════════════════════════════════
 * AAA-RNS 설치·사용 가이드 생성기 (한국어 · English · 日本語)
 * Developed by Seung Ho Jung
 *
 * 하나의 구조에서 세 언어판을 만든다. 문서 구조를 언어마다 따로
 * 손보면 반드시 어긋나므로, 장·절·그림 배치는 코드가 정하고
 * 언어팩은 문구만 담는다. 그림은 각 언어로 촬영한 실화면을 쓴다.
 *
 * 사용: node docs/guide_src/build_guides.mjs
 * ════════════════════════════════════════════════════════════════ */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));

/* ── 공통 스타일 (세 언어 동일) ── */
const CSS = `
  @page { size: A4; margin: 18mm 16mm 20mm 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Apple SD Gothic Neo','Hiragino Sans','Yu Gothic','Malgun Gothic','Pretendard',sans-serif;
    font-size: 10.5pt; line-height: 1.75; color: #1c2b3a; word-break: keep-all; }
  .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
  .cover .band { border-top: 3px solid #14508f; border-bottom: 1px solid #c9d4e2; padding: 14mm 0; }
  .cover h1 { font-size: 23pt; letter-spacing: -0.5px; color: #14508f; margin-bottom: 4mm; }
  .cover .sub { font-size: 12pt; color: #47586f; }
  .cover .en { font-family: Menlo, monospace; font-size: 8.5pt; color: #7d8ba0; margin-top: 2mm; }
  .cover .doc { margin-top: 30mm; font-size: 11pt; color: #47586f; }
  .cover table { margin-top: 8mm; border-collapse: collapse; font-size: 9.5pt; }
  .cover td { padding: 1.6mm 6mm 1.6mm 0; color: #47586f; }
  .cover td:first-child { color: #7d8ba0; width: 32mm; }
  h2 { font-size: 15pt; color: #14508f; border-bottom: 2px solid #14508f; padding-bottom: 2mm;
    margin: 0 0 6mm; page-break-after: avoid; }
  .ch { page-break-before: always; }
  h3 { font-size: 11.5pt; color: #17253b; margin: 7mm 0 2.5mm; page-break-after: avoid; }
  p { margin-bottom: 3mm; text-align: justify; }
  ol, ul { margin: 0 0 3mm 5mm; } li { margin-bottom: 1.2mm; }
  code, .mono { font-family: Menlo, Consolas, monospace; font-size: 9pt;
    background: #eef2f7; padding: 0.4mm 1.2mm; border-radius: 1mm; }
  figure { margin: 4mm 0 5mm; page-break-inside: avoid; }
  figure img { width: 100%; border: 1px solid #c9d4e2; border-radius: 1.5mm; }
  figure.narrow img { width: 76%; display: block; margin: 0 auto; }
  figcaption { font-size: 8.5pt; color: #5b6b80; text-align: center; margin-top: 1.6mm; }
  figcaption b { color: #14508f; }
  table.t { width: 100%; border-collapse: collapse; margin: 3mm 0 4mm; font-size: 9.5pt; page-break-inside: avoid; }
  table.t th { background: #eef2f7; border: 1px solid #c9d4e2; padding: 1.8mm 2.5mm; text-align: left; font-weight: 700; }
  table.t td { border: 1px solid #d8e0ea; padding: 1.8mm 2.5mm; vertical-align: top; }
  .note, .warn { border-left: 3px solid #14508f; background: #f2f6fb; padding: 2.5mm 4mm;
    margin: 3mm 0 4mm; font-size: 9.8pt; page-break-inside: avoid; }
  .warn { border-left-color: #b02a41; background: #fbf3f4; }
  .toc { page-break-after: always; } .toc h2 { margin-bottom: 8mm; }
  .toc ol { list-style: none; margin: 0; }
  .toc > ol > li { margin-bottom: 3mm; font-weight: 700; font-size: 11pt; }
  .toc ol ol { margin: 1.5mm 0 0 6mm; font-weight: 400; font-size: 10pt; }
  .toc ol ol li { margin-bottom: 1mm; color: #47586f; }
  kbd { border: 1px solid #b9c5d4; border-bottom-width: 2px; border-radius: 1.2mm;
    padding: 0 1.8mm; font-size: 9.3pt; background: #fff; white-space: nowrap; }
  .btn { display: inline-block; background: #14508f; color: #fff; border-radius: 1.2mm;
    padding: 0 2mm; font-size: 9.3pt; white-space: nowrap; }
  footer { margin-top: 10mm; padding-top: 3mm; border-top: 1px solid #c9d4e2; font-size: 8.5pt; color: #7d8ba0; }
`;

/* ── 언어팩 ── */
const L = {};

L.ko = {
  htmlLang: 'ko', file: '설치사용가이드',
  title: 'AI 에이전트 연구노트 자동화 시스템', sub: '설치·사용 가이드',
  docNo: '문서 번호', ver: '적용 버전', date: '발행일', dev: '개발', aud: '대상 독자',
  dateVal: '2026년 8월', audVal: '연구노트 작성자·점검자·책임 데이터 관리자',
  tocT: '차례',
  note: '참고', warn: '주의',
  ch: [
    '제1장 시작하기 전에', '제2장 설치', '제3장 최초 실행과 시작 설정', '제4장 프로젝트 만들기',
    '제5장 화면 안내', '제6장 연구노트 작성', '제7장 증거·지표·에이전트', '제8장 데이터 관리와 보안',
  ],
  sec: [
    ['1.1 이 소프트웨어가 하는 일', '1.2 동작 환경', '1.3 이 문서의 표기 규칙'],
    ['2.1 설치 파일 받기', '2.2 압축 해제가 곧 설치입니다', '2.3 폴더를 어디에 둘 것인가'],
    ['3.1 프로그램 시작', '3.2 첫 화면과 사용권', '3.3 언어 선택', '3.4 시작 설정 — 이름·PIN·공유폴더'],
    ['4.1 연구 문서 업로드', '4.2 추출 결과 확인', '4.3 시스템 생성'],
    ['5.1 대시보드', '5.2 로드맵', '5.3 플래너 — 스프린트·WP 간트·월간'],
    ['6.1 노트 열기', '6.2 자료 업로드와 자동 집필', '6.3 검증 게이트', '6.4 서명과 확정', '6.5 AI 서술 다듬기 (선택)'],
    ['7.1 증거원장', '7.2 성능지표', '7.3 AI 에이전트'],
    ['8.1 기록은 어디에 저장되는가', '8.2 백업과 복원', '8.3 사용자 권한', '8.4 문제 해결'],
  ],
  b: {
    intro1: 'AAA-RNS는 연구 과제의 전자연구노트 작성을 자동화하는 소프트웨어입니다. 연구개발계획서와 성능지표표를 업로드하면 시스템이 과제 구조(과제명·기간·워크패키지·지표)를 분석하여 그 과제 전용의 연구노트 작성 환경을 구성하고, 이후에는 실험일지와 측정 데이터를 올리는 것만으로 연구노트 초안이 자동으로 작성됩니다.',
    intro2: '이 시스템의 설계 원칙은 "거짓을 쓸 수 없는 시스템"입니다. 모든 문장은 업로드한 원본 자료에서 발급된 증거번호 <code>[E#]</code>를 달고 나오며, 네 개의 검증 게이트(G1~G4)가 증거 없는 서술·과거 기록과의 모순·수치 오류·규정 미충족을 자동으로 걸러냅니다. 확정된 노트는 본문과 서명을 함께 덮는 해시 체인으로 봉인되어 사후 변조가 즉시 탐지됩니다.',
    intro3: '인터넷 연결과 별도 서버가 필요 없습니다. 모든 기록은 회사가 지정한 폴더 안에만 남으며, 외부로 전송되지 않습니다. 화면은 한국어·English·日本語를 지원합니다.',
    envRows: [['운영체제', 'macOS 12 이상 또는 Windows 10 이상'], ['브라우저', 'Chrome 또는 Edge (최신 버전 권장) — 팀 공유폴더 기능은 이 두 브라우저에서만 동작합니다'],
      ['추가 소프트웨어', '필요 없음 (Mac은 기본 탑재 Python, Windows는 기본 탑재 PowerShell을 사용합니다)'],
      ['디스크 공간', '프로그램 약 1MB + 기록 데이터(업로드 원본 크기에 비례)'],
      ['네트워크', '불필요 — 완전 오프라인 동작 (선택 기능인 AI 서술 다듬기 사용 시에만 해당 AI 서비스 접속)']],
    conv: '화면의 단추는 <span class="btn">분석 시작하기</span>처럼, 키보드 입력은 <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>처럼, 파일·폴더 이름은 <code>start_mac.command</code>처럼 표기합니다. 절차 중 특별히 확인할 내용은 "참고" 상자에, 잘못하면 되돌리기 어려운 내용은 "주의" 상자에 담았습니다.',
    getFiles: '커뮤니티 에디션은 설치 파일 하나만 있으면 됩니다.',
    getList: ['설치 파일: <code>AAA-RNS_v2.0.zip</code>', '(기업용 빌드에 한함) 발급받은 사용권 키: 긴 문자열 한 줄 또는 <code>.lic</code> 파일 — 3.2절 참고'],
    unzip: '내려받은 ZIP 파일을 원하는 위치에 풀면 설치가 끝납니다. 별도의 설치 프로그램이나 관리자 권한은 필요하지 않습니다. 압축을 풀면 다음과 같은 파일이 만들어집니다.',
    fileRows: [['<code>start_mac.command</code>', 'Mac 시작 파일 — 이것을 더블클릭합니다'], ['<code>start_windows.bat</code>', 'Windows 시작 파일 — 이것을 더블클릭합니다'],
      ['<code>설치안내.txt</code>', '한 장짜리 요약 안내'], ['<code>sample_docs/</code>', '체험용 샘플 문서'],
      ['<code>index.html</code>, <code>js/</code>, <code>css/</code>, <code>agents/</code>', '프로그램 본체 (수정하지 마십시오)']],
    where: '프로그램 폴더는 각자 PC의 문서 폴더 등 편한 위치에 두면 됩니다. 팀으로 사용할 때 공유해야 하는 것은 프로그램이 아니라 <b>기록 데이터</b>이며, 이는 3.4절의 "공유폴더 연결"로 지정합니다. 즉 프로그램은 각자 PC에, 기록은 회사 공유 드라이브의 한 폴더에 두는 구성이 표준입니다.',
    startMac: '<b>Mac</b> — <code>start_mac.command</code>를 더블클릭합니다. 처음 한 번은 "확인되지 않은 개발자" 경고가 나타날 수 있습니다. 이때는 파일을 마우스 오른쪽 버튼으로 클릭하여 <b>열기</b>를 선택한 뒤 다시 <b>열기</b>를 누르면 됩니다.',
    startWin: '<b>Windows</b> — <code>start_windows.bat</code>를 더블클릭합니다. SmartScreen 경고가 나타나면 <b>추가 정보</b>를 누른 뒤 <b>실행</b>을 선택하십시오.',
    startNote: '실행하면 검은 서버 창이 열리고 곧이어 브라우저가 자동으로 열립니다(주소 <code>http://localhost:8777</code>). 서버 창은 시스템의 엔진이므로 작업하는 동안 닫지 마십시오. 이 서버는 사용자의 PC 안에서만 동작하며 외부에 공개되지 않습니다. 서버 창의 안내문은 어떤 언어를 쓰든 영어로 표시됩니다 — 터미널 글꼴은 한국어·일본어를 제대로 그리지 못하는 경우가 있어, 깨진 글자보다 영어가 낫다고 판단했습니다.',
    licIntro: '이 배포본은 <b>커뮤니티 에디션</b>입니다. 등록 키를 입력하는 인증 절차가 없으며, 프로그램을 시작하면 그림 3-1처럼 곧바로 온보딩 1단계(연구 문서 업로드)가 열립니다. 별도의 활성화나 온라인 확인 없이 바로 사용을 시작하십시오.',
    licSteps: ['<b>커뮤니티 에디션</b> — 등록 키가 필요 없습니다. 프로그램을 시작한 뒤 4.1절로 넘어가 연구 문서를 올리면 됩니다.', '<b>기업용 빌드</b> — 특정 회사·연구소에 발급되는 빌드로, 첫 화면에서 서명된 사용권 키를 요구합니다. 키 문자열을 붙여넣거나 <span class="btn">.lic 파일 선택</span>으로 키 파일을 지정한 뒤 <span class="btn">등록 인증</span>을 누르면, 전자서명 검증으로 즉시(오프라인) 끝납니다.'],
    licNote: '커뮤니티 에디션은 만들 수 있는 프로젝트 수에 제한이 없습니다. 기업용 빌드는 이와 달리 사용권 하나가 연구 프로젝트 하나에만 쓰이며, 첫 프로젝트를 만드는 순간 키가 그 과제번호에 귀속되어 다른 프로젝트에는 새 키가 필요합니다(시스템 초기화로도 이 귀속은 지워지지 않습니다). 두 빌드의 기능 차이는 이 사용권 처리뿐이며, 연구노트 작성·검증·봉인 기능은 완전히 동일합니다.',
    lang: '화면 언어는 처음 실행할 때 <b>브라우저(운영체제) 언어를 따라 자동으로 결정</b>됩니다 — 한국어 환경이면 한국어, 일본어 환경이면 日本語, 그 밖에는 English입니다. 첫 화면 오른쪽 위의 선택기로 언제든 바꿀 수 있으며, 선택은 저장되어 다음 실행에도 유지됩니다(브라우저 탭 제목도 함께 바뀝니다). 앱에 들어가면 화면 오른쪽 위 선택기가 같은 역할을 이어받습니다.',
    setup: '온보딩을 마치면 시작 설정 창이 나타납니다. 연구노트 서명에 쓰일 이름과 이메일, 그리고 확인용 PIN(4자리 이상)을 등록합니다.',
    setup2: '가장 먼저 등록하는 사람이 <b>책임 데이터 관리자</b>(기본값)가 되어 백업·복원·초기화 권한을 갖습니다. 이 권한은 이후 설정 화면에서 다른 등록 사용자에게 언제든 양도할 수 있습니다(8.3절). 팀 공유폴더를 쓰는 회사라면 이 창의 <span class="btn">공유폴더 연결</span>로 회사 공유 드라이브의 폴더를 지정하십시오. 각 PC에서 최초 1회만 하면 되며, 연결된 저장소는 왼쪽 메뉴 상단에 항상 표시됩니다.',
    ob1: '처음 진입하면 4단계 온보딩이 시작됩니다. 첫 단계에서 연구개발계획서·제안서·성능지표표 등 과제를 설명하는 문서를 점선 상자에 끌어다 놓습니다(여러 개 가능). PDF·Word(DOCX)·Excel(XLSX)·한글(HWPX)·CSV·TXT를 읽을 수 있습니다.',
    obNote: '먼저 체험해 보려면 <code>sample_docs/</code> 폴더의 샘플 문서 두 개를 올려 보십시오. 실제 문서는 언제든 시스템 초기화 후 다시 올릴 수 있습니다.',
    ob2: '<span class="btn">분석 시작 →</span>을 누르면 시스템이 문서를 심층 분석하여 과제명·과제번호·수행기관·연구기간·워크패키지·성능지표를 추출하고, 확인 화면을 보여줍니다. 시스템은 임의로 결정하지 않습니다 — 각 항목 옆의 신뢰도 표시를 참고하여 내용을 확인하고, 틀린 항목은 이 화면에서 직접 고치십시오.',
    ob3: '<span class="btn">이 내용으로 시스템 생성 →</span>을 누르면 연구기간 전체가 격주(또는 주간) 스프린트로 분해되고, 스프린트마다 연구노트 슬롯이 만들어지며, 지표 대시보드와 26개 AI 에이전트 구성이 완료됩니다.',
    dash: '생성이 끝나면 대시보드가 열립니다. 기간 경과율, 확정된 노트 수, 서명 대기, 증거원장 등재 건수, 다가오는 마일스톤과 현재 스프린트를 한눈에 보여줍니다.',
    road: '로드맵은 연구 전체를 한 화면에 펼칩니다. 워크패키지(WP)별 기간 막대 위에 노트 상태 점이 찍히며(초록=확정, 호박=서명 대기, 남색=초안), ◆는 마일스톤, 붉은 세로선은 오늘입니다. 보기 기간을 전체·올해·최근 12개월·향후 6개월·사용자 지정으로 좁힐 수 있고, 좁히면 축이 월 단위로 바뀝니다.',
    road2: 'WP 행을 클릭하면 그 작업의 관련 연구노트 목록으로 이동하고, 목록에서 노트를 클릭하면 해당 노트가 열립니다. 화면 왼쪽 위의 <b>←</b> 단추로 언제든 이전 화면으로 돌아갈 수 있습니다.',
    plan: '플래너는 세 가지 보기를 제공합니다. <b>스프린트</b>는 기간별 목록이고, <b>WP 간트</b>는 작업 일정을 막대로 보여주며(보기 기간 조정·오늘 표시선 포함), <b>월간</b>은 달 단위 진행 상황입니다. 세 보기 모두 행을 클릭하면 관련 정보와 연구노트로 연결됩니다.',
    noteOpen: '플래너(또는 로드맵)에서 작성할 기간의 스프린트를 클릭하면 노트 편집기가 열립니다. 맨 위에서 작성기간을 확인하고 <b>작성자</b>와 <b>점검자</b>를 입력하십시오. 점검자는 작성자와 달라야 합니다 — 같은 사람이 승인까지 하는 것을 시스템이 막습니다.',
    auto1: '이 시스템의 핵심 기능입니다. 실험일지(TXT)·측정데이터(CSV) 등 그 기간의 원자료를 점선 상자에 끌어다 놓으면, 파일이 해시(SHA-256)와 함께 첨부되고 내용에서 증거가 추출·등재된 뒤 바로 분석할지 묻습니다.',
    auto2: '<span class="btn">지금 분석·집필</span>을 누르면(또는 나중에 <span class="btn">분석 시작하기</span>를 누르면) 시스템이 수행 내용·결과 데이터·해석을 자동으로 작성합니다. 모든 문장 끝에는 근거 증거번호 <code>[E#]</code>가 붙습니다. 문장은 업로드한 원문에서만 나오며, 시스템이 사실을 지어내지 않습니다.',
    autoNote: '기록의 날짜가 이 노트의 작성기간 밖이면 시스템이 채택하지 않고, 날짜가 속한 스프린트를 찾아 "해당 기간의 노트에 자동 집필할까요?"라고 제안합니다. 수락하면 그 노트를 만들어 작성과 검증까지 자동으로 진행합니다.',
    autoNote2: '해석문·측정조건처럼 <b>시스템이 직접 작문하는 문장은 선택한 화면 언어로 생성</b>됩니다. 반면 수행 내용은 업로드한 원문에서 인용하므로 원본 언어 그대로 남습니다 — 기록의 원본성을 지키기 위한 의도된 동작입니다.',
    gate1: '자동 집필 후 네 개의 검증 게이트가 자동 실행됩니다. 게이트는 수정 제안이 아니라 차단 장치입니다 — 지적이 남아 있는 노트는 확정할 수 없습니다(권고 모드에서는 저장은 가능하되 지적이 보존됩니다).',
    gateRows: [['G1 증거매핑', '증거번호 없는 문장, 존재하지 않는 증거 인용, 추정·과장 표현'], ['G2 과거정합성', '확정된 과거 노트와의 기간 중복, 같은 지표의 모순 수치, 상태 역행'],
      ['G3 수치단위감사', '합계·비율 재계산, 단위 표기, 목표 대비 방향, 근거 없는 "달성" 표기(자유 서술 포함)'], ['G4 지침준수', '전자연구노트 필수 필드(작성자·점검자·기간·해시 등), 인용 증거의 원본 첨부 여부']],
    seal1: '게이트를 통과한 노트는 서명 단계로 넘어갑니다. 작성자가 <span class="btn">기여자 서명</span>을 하고, 점검자가 자기 이름으로 <span class="btn">최종 승인 · 확정</span>을 하면 노트가 확정(봉인)됩니다. 작성자 본인이 최종 승인을 시도하면 교차 승인 원칙에 따라 거부됩니다.',
    seal2: '확정된 노트는 수정할 수 없습니다. 내용을 고쳐야 하면 개정판(-R1, -R2…)을 발행하며, 원본과 개정 이력이 모두 남습니다. 확정과 동시에 노트 원본과 정본 DOCX가 <code>archive/</code> 폴더에 자동 보관되고, 노트의 해시가 <b>본문과 서명을 함께 덮어</b> 직전 확정 노트의 해시와 사슬로 연결됩니다. 이후 본문이든 승인자 이름이든 바꾸면 검증에서 즉시 드러납니다.',
    ai: '책임 데이터 관리자가 설정에서 AI 엔진(Anthropic Claude·Google Gemini·OpenAI 중 택일)을 연결하면 노트 화면에 <span class="btn">AI 서술 다듬기</span> 단추가 나타납니다. 자동 집필된 문장을 더 자연스러운 연구노트 문체로 다듬어 주되, 증거번호가 바뀌거나 금지 표현이 유입된 문장은 자동 폐기되고, 다듬은 결과 전체가 게이트로 재검증됩니다. AI를 연결하지 않아도 시스템의 모든 기능은 완전히 동작합니다.',
    ledger: '업로드한 자료에서 추출된 모든 사실 조각이 증거번호 <code>[E#]</code>와 함께 이곳에 등재됩니다. 어떤 노트의 어떤 문장이 어느 원본의 어느 위치를 근거로 하는지 언제든 역추적할 수 있습니다. 감사 대응 시 이 화면이 출발점입니다.',
    metrics: '노트가 확정될 때마다 측정값이 지표별로 누적되어 목표 대비 추이가 그려집니다. 값은 확정 노트에서만 오며, 보간이나 외삽은 하지 않습니다.',
    agents: '시스템 내부에서 일하는 26개 전문 에이전트의 편성표입니다. 기획(5)·수집(6)·집필(6)·검증(4)·출력(2)·기억(2) 그룹이 형식이 고정된 패킷으로 통신하며, 그룹마다 리드(★)가 산출물의 완결성을 책임집니다. 일반 사용자가 조작할 것은 없으며, 시스템이 왜 이렇게 동작하는지 이해하는 참고 자료입니다.',
    store1: '공유폴더를 연결했다면 모든 기록이 그 폴더 안에 실제 파일로 저장됩니다. 연결하지 않았다면 이 브라우저의 내부 저장소에 저장됩니다 — 개인 사용·체험에는 충분하지만, 정식 운영에는 공유폴더 연결을 권장합니다.',
    storeRows: [['<code>data/</code>', '과제 구조·플래너·지표·감사로그(추가 전용)'], ['<code>notes/</code>', '연구노트(상태·서명·해시 포함)'],
      ['<code>notes_files/</code>', '업로드한 원본 파일'], ['<code>ledger/</code>', '증거원장'],
      ['<code>archive/</code>', '확정 노트 영구 보관본 — 확정 시 자동 생성, 앱이 다시 쓰지 않음']],
    backup: '설정 화면의 <span class="btn">전체 백업 (.zip · 원본 포함)</span>은 위 전체를 하나의 ZIP으로 내보냅니다. ZIP 안에는 파일별 SHA-256 목록이 함께 들어가며, 복원할 때 전체 무결성 검증을 통과해야만 기록이 시작됩니다 — 단 1바이트라도 손상된 백업이면 기존 데이터는 전혀 변경되지 않습니다. 백업은 원할 때 언제든 받을 수 있고, 마지막 백업 후 30일이 지나면 대시보드가 월 1회 알림으로 안내합니다.',
    perm: '백업·복원·초기화는 책임 데이터 관리자에게만 표시되며, 복원과 초기화는 실행 전에 PIN을 다시 확인합니다. 권한은 설정 → 데이터 관리의 <span class="btn">책임 데이터 관리자 양도</span>로 다른 등록 사용자에게 넘길 수 있습니다(현 관리자 PIN 확인 필요, 감사로그 기록). 공유폴더 연결·변경은 PC별 설정이므로 모든 사용자가 왼쪽 위 저장소 표시를 클릭해 할 수 있습니다.',
    permWarn: '시스템 초기화는 모든 로컬 기록을 지우고 온보딩부터 다시 시작합니다. 반드시 전체 백업을 먼저 받으십시오. 커뮤니티 에디션은 사용권 기록 자체가 없으므로 초기화하면 첫 화면부터 그대로 다시 시작합니다. 기업용 빌드에서는 사용권과 프로젝트 귀속 기록이 초기화 후에도 유지됩니다.',
    troubleRows: [['브라우저가 자동으로 열리지 않는다', '브라우저 주소창에 <code>http://localhost:8777</code>을 직접 입력합니다.'],
      ['"포트를 열 수 없습니다" 오류', '이미 실행 중인 서버 창이 있는지 확인하고, 있으면 그 창을 사용합니다.'],
      ['화면이 이상하거나 예전 화면이 보인다', '강력 새로고침: Windows <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> / Mac <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>'],
      ['공유폴더 연결 단추가 동작하지 않는다', 'Chrome 또는 Edge를 사용하고 있는지 확인합니다. 다른 브라우저는 폴더 연결을 지원하지 않습니다.'],
      ['자동 집필 결과가 0건이다', '기록의 날짜가 노트의 작성기간 안에 있는지 확인합니다. 기간 밖이면 시스템이 올바른 노트를 제안합니다.'],
      ['최종 승인이 거부된다', '승인자 이름이 작성자와 같지 않은지 확인합니다. 교차 승인 원칙에 따라 본인 승인은 차단됩니다.'],
      ['첫 화면에서 등록 키를 요구한다', '커뮤니티 에디션은 키를 묻지 않습니다. 키 입력 화면이 나온다면 기업용 빌드이므로, 발급받은 키를 입력하십시오.'],
      ['(기업용 빌드) 사용권 키가 유효하지 않다고 나온다', '키 전체가 빠짐없이 복사되었는지 확인하고, 계속 실패하면 개발자에게 재발급을 요청합니다.']],
  },
  cap: {
    '01': ['그림 3-1', '프로그램을 시작하면 처음 보이는 화면. 커뮤니티 에디션은 등록 절차 없이 곧바로 온보딩 1단계로 들어간다. 오른쪽 위 선택기로 언어를 바꿀 수 있다.'],
    '02': ['그림 4-1', '문서 업로드 단계. 파일이 등록되면 목록에 나타난다.'],
    '03': ['그림 4-2', '추출 결과 확인. 신뢰도가 낮은 항목은 배지로 표시되어 확인을 요구한다.'],
    '04': ['그림 3-2', '시작 설정 창. 첫 등록자가 책임 데이터 관리자가 된다.'],
    '05': ['그림 5-1', '대시보드. 오른쪽 위에서 테마·이름·언어를 설정한다.'],
    '06': ['그림 5-2', '로드맵. 보기 기간을 좁히면 축이 월 단위로 바뀐다.'],
    '07': ['그림 5-3', 'WP 간트. 행을 클릭하면 그 작업의 연구노트 목록으로 이동한다.'],
    '08': ['그림 5-4', '월간 보기. 각 줄을 클릭하면 그 달의 스프린트·노트 상세로 이동한다.'],
    '09': ['그림 6-1', '노트 편집기. 점선 상자와 [분석 시작하기]가 자동 집필의 입구다.'],
    '10': ['그림 6-2', '업로드 직후의 확인 창. 파일을 더 올리려면 "추가 작업 계속"을 선택한다.'],
    '11': ['그림 6-3', '자동 집필된 수행 내용. 각 문장에 연결된 증거 번호가 표시된다.'],
    '12': ['그림 6-4', '검증 게이트 결과. 지적이 있으면 위치·사유·조치가 카드로 표시된다.'],
    '13': ['그림 6-5', '확정된 연구노트의 정본 보기. 상단에서 DOCX·XLSX 내려받기와 인쇄가 가능하다.'],
    '14': ['그림 7-1', '증거원장. 증거마다 종류·원본 파일·위치·해시가 기록된다.'],
    '15': ['그림 7-2', '성능지표. 각 점은 확정 노트의 실측값이다.'],
    '16': ['그림 7-3', 'AI 에이전트 편성. 상세 설계는 agents/MAS_SPEC.md에 있다.'],
    '17': ['그림 6-6', 'AI 엔진 설정 (책임 데이터 관리자 전용).'],
    '18': ['그림 8-1', '설정의 데이터 관리. 백업·복원·알림 주기·권한 양도가 이곳에 있다.'],
  },
  foot: 'AAA-RNS 설치·사용 가이드 · 적용 버전 v2.0 · 2026년 8월 · Developed by Seung Ho Jung · 라이선스·기술 문의는 개발자에게 연락하십시오. 본 문서의 화면 그림은 v2.0 실제 화면을 캡처한 것이며, 예시의 회사·과제·수치는 모두 가상 데이터입니다.',
};

L.en = {
  htmlLang: 'en', file: 'Installation_and_User_Guide',
  title: 'AI Agent Research Notebook Automation System', sub: 'Installation & User Guide',
  docNo: 'Document no.', ver: 'Applies to', date: 'Issued', dev: 'Developed by', aud: 'Audience',
  dateVal: 'August 2026', audVal: 'Note authors, reviewers, and the Data Custodian',
  tocT: 'Contents',
  note: 'Note', warn: 'Caution',
  ch: ['1. Before You Begin', '2. Installation', '3. First Run and Initial Setup', '4. Creating a Project',
    '5. Screen Guide', '6. Writing a Research Note', '7. Evidence, Metrics, Agents', '8. Data Management and Security'],
  sec: [
    ['1.1 What this software does', '1.2 System requirements', '1.3 Conventions used in this guide'],
    ['2.1 Getting the files', '2.2 Unzipping is the installation', '2.3 Where to put the folder'],
    ['3.1 Starting the program', '3.2 The first screen and licensing', '3.3 Choosing a language', '3.4 Initial setup — name, PIN, shared folder'],
    ['4.1 Uploading research documents', '4.2 Reviewing what was extracted', '4.3 Generating the system'],
    ['5.1 Dashboard', '5.2 Roadmap', '5.3 Planner — Sprint, WP Gantt, Monthly'],
    ['6.1 Opening a note', '6.2 Uploading material and auto-writing', '6.3 Verification gates', '6.4 Signing and sealing', '6.5 Polishing prose with AI (optional)'],
    ['7.1 Evidence Ledger', '7.2 Performance Metrics', '7.3 AI Agents'],
    ['8.1 Where records are stored', '8.2 Backup and restore', '8.3 User roles', '8.4 Troubleshooting'],
  ],
  b: {
    intro1: 'AAA-RNS automates the writing of electronic research notes for R&D projects. Upload an R&D plan and a metrics table, and the system analyses the project structure (title, period, work packages, metrics) and builds a note-writing environment dedicated to that project. From then on, uploading experiment logs and measurement data is enough for a draft note to be written automatically.',
    intro2: 'The design principle is a system in which <b>falsehood cannot be written</b>. Every sentence carries an evidence number <code>[E#]</code> issued from the uploaded source material, and four verification gates (G1–G4) automatically block unevidenced statements, contradictions with past records, numeric errors, and compliance gaps. A sealed note is protected by a hash chain that covers both the content and the signatures, so any later alteration is detected immediately.',
    intro3: 'No internet connection and no separate server are required. All records stay inside the folder your company designates and are never transmitted outside. The interface is available in Korean, English, and Japanese.',
    envRows: [['Operating system', 'macOS 12 or later, or Windows 10 or later'], ['Browser', 'Chrome or Edge (latest recommended) — the shared-folder feature works only in these two'],
      ['Additional software', 'None (macOS uses its built-in Python; Windows uses its built-in PowerShell)'],
      ['Disk space', 'About 1 MB for the program, plus your records (proportional to the uploaded originals)'],
      ['Network', 'Not required — fully offline (only the optional AI polishing feature contacts an AI service)']],
    conv: 'Buttons appear as <span class="btn">Start analysis</span>, keyboard input as <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>, and file or folder names as <code>start_mac.command</code>. Points worth checking are placed in "Note" boxes; actions that are hard to undo are placed in "Caution" boxes.',
    getFiles: 'For the Community edition, the installer archive is all you need.',
    getList: ['The installer archive: <code>AAA-RNS_v2.0.zip</code>', '(Enterprise builds only) the license key you were issued: one long line of text, or a <code>.lic</code> file — see section 3.2'],
    unzip: 'Unzip the downloaded archive wherever you like; that completes the installation. No installer and no administrator rights are needed. Unzipping produces the following files.',
    fileRows: [['<code>start_mac.command</code>', 'Mac launcher — double-click this'], ['<code>start_windows.bat</code>', 'Windows launcher — double-click this'],
      ['<code>INSTALL.txt</code>', 'One-page quick reference'], ['<code>sample_docs/</code>', 'Sample documents for a trial run'],
      ['<code>index.html</code>, <code>js/</code>, <code>css/</code>, <code>agents/</code>', 'The program itself (do not modify)']],
    where: 'Put the program folder wherever is convenient on each PC. What a team shares is not the program but the <b>records</b>, and those are designated with "Connect shared folder" in section 3.4. The standard arrangement is therefore: the program on each PC, the records in one folder on the company drive.',
    startMac: '<b>Mac</b> — double-click <code>start_mac.command</code>. The first time, macOS may warn about an unidentified developer. If so, right-click the file, choose <b>Open</b>, then click <b>Open</b> again.',
    startWin: '<b>Windows</b> — double-click <code>start_windows.bat</code>. If SmartScreen appears, click <b>More info</b> and then <b>Run anyway</b>.',
    startNote: 'A black server window opens and a browser follows automatically (address <code>http://localhost:8777</code>). The server window is the engine — leave it open while you work. It listens only on your own PC and is not exposed externally. Its messages are in English regardless of the interface language: terminal fonts cannot be relied on to render Korean or Japanese, and English is better than mojibake.',
    licIntro: 'This build is the <b>Community edition</b>. There is no registration key to enter: starting the program takes you straight to step 1 of onboarding — uploading your research documents — as shown in Figure 3-1. No activation and no online check stand between you and the first screen.',
    licSteps: ['<b>Community edition</b> — no key is required. Start the program and go on to section 4.1 to upload your research documents.', '<b>Enterprise builds</b> — issued to a specific company or institute, these ask for a signed license key on the first screen. Paste the key into the field, or choose the key file with <span class="btn">Select .lic file</span>, then press <span class="btn">Register</span>. Verification is a digital-signature check and completes instantly, offline.'],
    licNote: 'The Community edition places no limit on the number of projects you create. An enterprise build does: one license covers exactly one research project, and the moment you create the first project the key is bound to that project number, so a different project requires a new key (a system reset does not clear that binding). Licensing is the only difference between the two builds — note writing, verification, and sealing are identical.',
    lang: 'On first run the interface language is <b>chosen automatically from your browser (operating system) language</b> — Korean in a Korean environment, 日本語 in a Japanese one, English otherwise. You can change it at any time with the selector at the top right of the first screen; the choice is saved for later runs, and the browser tab title follows it too. Once inside the application, the selector at the top right of the screen takes over the same role.',
    setup: 'Once onboarding is complete the initial-setup dialog appears. Register the name and e-mail that will be used for note signatures, plus a confirmation PIN of at least four digits.',
    setup2: 'The first person to register becomes the <b>Data Custodian</b> (the default) and holds the backup, restore, and reset permissions. That role can be transferred to another registered user at any time from Settings (section 8.3). If your company uses a shared folder, use <span class="btn">Connect shared folder</span> in this dialog to designate a folder on the company drive. This is done once per PC, and the connected storage is always shown at the top of the left menu.',
    ob1: 'On first entry a four-step onboarding begins. In the first step, drag the documents that describe the project — R&D plan, proposal, metrics table — onto the dashed box (several at once is fine). PDF, Word (DOCX), Excel (XLSX), Hangul (HWPX), CSV, and TXT can be read.',
    obNote: 'To try the system first, upload the two sample documents in <code>sample_docs/</code>. You can always reset the system and upload your real documents afterwards.',
    ob2: 'Press <span class="btn">Start analysis →</span> and the system analyses the documents in depth, extracting the project title, number, organisation, period, work packages, and metrics, then shows a review screen. The system does not decide anything on its own — check each item against the confidence badge beside it and correct anything wrong right here.',
    ob3: 'Press <span class="btn">Generate the system with this →</span> and the whole research period is divided into fortnightly (or weekly) sprints, a note slot is created for each sprint, and the metrics dashboard and the 26 AI agents are configured.',
    dash: 'When generation finishes, the dashboard opens. It shows elapsed period, the number of sealed notes, items awaiting signature, evidence-ledger entries, upcoming milestones, and the current sprint at a glance.',
    road: 'The Roadmap lays the whole project out on one screen. Above each work package (WP) bar, dots show note status (green = sealed, amber = awaiting signature, indigo = draft); ◆ marks a milestone and the red vertical line is today. The view period can be narrowed to All time, This year, Last 12 months, Next 6 months, or a custom range; narrowing it switches the axis to months.',
    road2: 'Clicking a WP row opens the list of research notes for that work package, and clicking a note in the list opens it. The <b>←</b> button at the top left returns to the previous screen at any time.',
    plan: 'The Planner offers three views. <b>Sprint</b> is a list by period, <b>WP Gantt</b> shows the schedule as bars (with view-period control and a today marker), and <b>Monthly</b> shows progress by month. In all three views, clicking a row leads to the related information and research notes.',
    noteOpen: 'Click the sprint for the period you want to write about, in the Planner or the Roadmap, and the note editor opens. Check the writing period at the top and enter the <b>author</b> and the <b>reviewer</b>. The reviewer must differ from the author — the system prevents one person from also approving their own note.',
    auto1: 'This is the core feature. Drag the raw material for that period — experiment logs (TXT), measurement data (CSV) — onto the dashed box. Each file is attached with its SHA-256 hash, evidence is extracted and registered from its contents, and the system then asks whether to analyse it now.',
    auto2: 'Press <span class="btn">Analyse and write now</span> (or press <span class="btn">Start analysis</span> later) and the system writes the work performed, the result data, and the interpretation automatically. Every sentence ends with the evidence number <code>[E#]</code> that supports it. Sentences come only from the uploaded originals; the system never invents facts.',
    autoNote: 'If a record\'s date falls outside this note\'s writing period, the system does not adopt it. Instead it finds the sprint the date belongs to and offers: "Auto-write into the note for that period?" Accept, and it creates that note and completes the writing and verification for you.',
    autoNote2: 'Sentences the system composes itself — interpretations and measurement conditions — are <b>generated in the interface language you selected</b>. The work-performed entries, however, are quoted from the uploaded originals and therefore remain in the source language: preserving the authenticity of the record is deliberate.',
    gate1: 'After auto-writing, four verification gates run automatically. A gate is not a suggestion but a barrier — a note with outstanding findings cannot be sealed (in advisory mode it can still be saved, with the findings preserved).',
    gateRows: [['G1 Evidence mapping', 'Sentences without an evidence number, citations of non-existent evidence, speculative or exaggerated wording'],
      ['G2 Longitudinal consistency', 'Period overlap with sealed past notes, contradictory values for the same metric, status regression'],
      ['G3 Numeric & unit audit', 'Recalculation of sums and ratios, unit notation, direction against the target, unsupported claims of achievement (including in free text)'],
      ['G4 Compliance', 'Required electronic-note fields (author, reviewer, period, hash, and so on) and whether cited evidence has its original attached']],
    seal1: 'A note that passes the gates moves to the signing stage. The author gives a <span class="btn">Contributor signature</span>, and the reviewer gives <span class="btn">Final approval · Seal</span> under their own name, which seals the note. If the author attempts final approval, it is refused under the cross-approval principle.',
    seal2: 'A sealed note cannot be edited. To change something, issue a revision (-R1, -R2, …); the original and the revision history both remain. At the moment of sealing, the note and its official DOCX are archived automatically under <code>archive/</code>, and the note\'s hash — which <b>covers the content and the signatures together</b> — is chained to the hash of the previous sealed note. Any later change, whether to the text or to an approver\'s name, is exposed immediately by verification.',
    ai: 'If the Data Custodian connects an AI engine in Settings (Anthropic Claude, Google Gemini, or OpenAI), a <span class="btn">Polish prose with AI</span> button appears on the note screen. It rewrites the auto-written sentences in a more natural research-note style, but any sentence whose evidence numbers change or that introduces prohibited wording is discarded automatically, and the whole result is re-verified by the gates. Every function of the system works fully without an AI engine.',
    ledger: 'Every fact extracted from the uploaded material is registered here with an evidence number <code>[E#]</code>. You can always trace which sentence of which note rests on which position of which original file. This screen is the starting point for an audit.',
    metrics: 'Each time a note is sealed, its measured values accumulate per metric and the trend against the target is drawn. Values come only from sealed notes; no interpolation or extrapolation is performed.',
    agents: 'This is the roster of the 26 specialist agents working inside the system. The Planning (5), Collection (6), Writing (6), Verification (4), Output (2), and Memory (2) groups communicate through fixed-format packets, and each group\'s lead (★) is accountable for the completeness of its output. There is nothing here for an ordinary user to operate; it is reference material for understanding why the system behaves as it does.',
    store1: 'If you connected a shared folder, every record is stored as real files inside it. If you did not, records are stored in this browser\'s internal storage — sufficient for personal use or a trial, but a shared folder is recommended for real operation.',
    storeRows: [['<code>data/</code>', 'Project structure, planner, metrics, audit log (append-only)'], ['<code>notes/</code>', 'Research notes (state, signatures, hashes)'],
      ['<code>notes_files/</code>', 'The original uploaded files'], ['<code>ledger/</code>', 'Evidence ledger'],
      ['<code>archive/</code>', 'Permanent copies of sealed notes — created automatically on sealing; never rewritten by the app']],
    backup: '<span class="btn">Full backup (.zip, originals included)</span> in Settings exports all of the above as a single ZIP. The archive carries a per-file SHA-256 list, and a restore begins writing only after the whole archive passes integrity verification — if even one byte is damaged, your existing data is left completely untouched. You can take a backup whenever you wish, and 30 days after the last one the dashboard reminds you once a month.',
    perm: 'Backup, restore, and reset are shown only to the Data Custodian, and restore and reset ask for the PIN again before running. The role can be handed to another registered user with <span class="btn">Transfer Data Custodian role</span> under Settings → Data management (the current custodian\'s PIN is required, and the transfer is written to the audit log). Connecting or changing the shared folder is a per-PC setting, so any user can do it by clicking the storage indicator at the top left.',
    permWarn: 'A system reset deletes all local records and starts again from onboarding. Always take a full backup first. The Community edition keeps no licence record, so a reset simply returns you to the first screen. On an enterprise build, the licence and the project binding survive a reset.',
    troubleRows: [['The browser does not open automatically', 'Type <code>http://localhost:8777</code> into the address bar yourself.'],
      ['"Cannot open port" error', 'Check whether a server window is already running; if so, use that one.'],
      ['The screen looks wrong or shows an old version', 'Hard refresh: Windows <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> / Mac <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>'],
      ['The shared-folder button does nothing', 'Confirm you are using Chrome or Edge. Other browsers do not support folder connection.'],
      ['Auto-writing produced nothing', 'Check that the record dates fall within the note\'s writing period. If they do not, the system suggests the correct note.'],
      ['Final approval is refused', 'Check that the approver\'s name differs from the author\'s. Self-approval is blocked by the cross-approval principle.'],
      ['The first screen asks for a registration key', 'The Community edition never asks for one. If a key screen appears, you are running an enterprise build — enter the key you were issued.'],
      ['(Enterprise builds) the license key is reported invalid', 'Make sure the whole key was copied. If it keeps failing, ask the developer to reissue it.']],
  },
  cap: {
    '01': ['Figure 3-1', 'The very first screen after starting the program. The Community edition goes straight to onboarding step 1, with no registration. The selector at the top right changes the language.'],
    '02': ['Figure 4-1', 'The document upload step. Registered files appear in the list.'],
    '03': ['Figure 4-2', 'Reviewing what was extracted. Low-confidence items are badged and ask to be checked.'],
    '04': ['Figure 3-2', 'The initial-setup dialog. The first person to register becomes the Data Custodian.'],
    '05': ['Figure 5-1', 'The dashboard. Theme, name, and language are set at the top right.'],
    '06': ['Figure 5-2', 'The Roadmap. Narrowing the view period switches the axis to months.'],
    '07': ['Figure 5-3', 'The WP Gantt. Clicking a row opens that work package\'s research notes.'],
    '08': ['Figure 5-4', 'The Monthly view. Clicking a row opens that month\'s sprints and notes.'],
    '09': ['Figure 6-1', 'The note editor. The dashed box and [Start analysis] are the entrance to auto-writing.'],
    '10': ['Figure 6-2', 'The prompt shown right after upload. Choose "Continue working" to add more files first.'],
    '11': ['Figure 6-3', 'Auto-written work entries. The evidence number linked to each sentence is shown.'],
    '12': ['Figure 6-4', 'Verification gate results. Findings are shown as cards with location, reason, and action.'],
    '13': ['Figure 6-5', 'The official view of a sealed note. DOCX, XLSX, and printing are available at the top.'],
    '14': ['Figure 7-1', 'The Evidence Ledger. Each entry records its kind, source file, position, and hash.'],
    '15': ['Figure 7-2', 'Performance Metrics. Each point is a measured value from a sealed note.'],
    '16': ['Figure 7-3', 'The AI agent roster. The detailed design is in agents/MAS_SPEC.md.'],
    '17': ['Figure 6-6', 'AI engine settings (Data Custodian only).'],
    '18': ['Figure 8-1', 'Data management in Settings — backup, restore, reminder interval, and role transfer.'],
  },
  foot: 'AAA-RNS Installation & User Guide · Applies to v2.0 · August 2026 · Developed by Seung Ho Jung · For licensing and technical enquiries, contact the developer. The screenshots in this guide are captured from the actual v2.0 interface; the companies, projects, and figures shown are fictitious sample data.',
};

L.ja = {
  htmlLang: 'ja', file: 'インストール・利用ガイド',
  title: 'AI エージェント研究ノート自動化システム', sub: 'インストール・利用ガイド',
  docNo: '文書番号', ver: '適用バージョン', date: '発行日', dev: '開発', aud: '対象読者',
  dateVal: '2026年8月', audVal: '研究ノートの作成者・点検者・データ管理責任者',
  tocT: '目次',
  note: '参考', warn: '注意',
  ch: ['第1章 はじめに', '第2章 インストール', '第3章 初回起動と開始設定', '第4章 プロジェクトの作成',
    '第5章 画面ガイド', '第6章 研究ノートの作成', '第7章 証拠・指標・エージェント', '第8章 データ管理とセキュリティ'],
  sec: [
    ['1.1 このソフトウェアができること', '1.2 動作環境', '1.3 本書の表記規則'],
    ['2.1 インストールファイルの受領', '2.2 解凍がそのままインストールです', '2.3 フォルダの置き場所'],
    ['3.1 プログラムの起動', '3.2 最初の画面とライセンス', '3.3 言語の選択', '3.4 開始設定 — 氏名・PIN・共有フォルダ'],
    ['4.1 研究文書のアップロード', '4.2 抽出結果の確認', '4.3 システムの生成'],
    ['5.1 ダッシュボード', '5.2 ロードマップ', '5.3 プランナー — スプリント・WP ガント・月次'],
    ['6.1 ノートを開く', '6.2 資料のアップロードと自動執筆', '6.3 検証ゲート', '6.4 署名と確定', '6.5 AI による記述の推敲（任意）'],
    ['7.1 証拠台帳', '7.2 性能指標', '7.3 AI エージェント'],
    ['8.1 記録はどこに保存されるか', '8.2 バックアップと復元', '8.3 ユーザー権限', '8.4 トラブルシューティング'],
  ],
  b: {
    intro1: 'AAA-RNS は、研究課題の電子研究ノート作成を自動化するソフトウェアです。研究開発計画書と性能指標表をアップロードすると、システムが課題構造（課題名・期間・ワークパッケージ・指標）を分析し、その課題専用の研究ノート作成環境を構成します。以後は実験日誌と測定データをアップロードするだけで、研究ノートの下書きが自動で作成されます。',
    intro2: '本システムの設計原則は「虚偽を書けないシステム」です。すべての文はアップロードした原本資料から発行された証拠番号 <code>[E#]</code> を伴って生成され、四つの検証ゲート（G1〜G4）が、証拠のない記述・過去記録との矛盾・数値の誤り・規程未充足を自動的に遮断します。確定したノートは本文と署名の両方を覆うハッシュチェーンで封印され、事後の改ざんは直ちに検出されます。',
    intro3: 'インターネット接続や別途のサーバーは不要です。すべての記録は会社が指定したフォルダ内にのみ残り、外部に送信されることはありません。画面は日本語・English・한국어に対応しています。',
    envRows: [['オペレーティングシステム', 'macOS 12 以降、または Windows 10 以降'], ['ブラウザ', 'Chrome または Edge（最新版を推奨）— チーム共有フォルダ機能はこの二つでのみ動作します'],
      ['追加ソフトウェア', '不要（Mac は標準搭載の Python、Windows は標準搭載の PowerShell を使用します）'],
      ['ディスク容量', 'プログラム約 1MB＋記録データ（アップロード原本のサイズに比例）'],
      ['ネットワーク', '不要 — 完全オフライン動作（任意機能の AI 推敲を使う場合のみ当該 AI サービスに接続）']],
    conv: '画面のボタンは <span class="btn">分析開始</span> のように、キーボード入力は <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> のように、ファイル・フォルダ名は <code>start_mac.command</code> のように表記します。手順の中で特に確認すべき内容は「参考」枠に、誤ると元に戻しにくい内容は「注意」枠にまとめています。',
    getFiles: 'コミュニティ・エディションは、インストールファイル 1 つだけで使い始められます。',
    getList: ['インストールファイル: <code>AAA-RNS_v2.0.zip</code>', '（企業向けビルドのみ）発行されたライセンスキー: 長い文字列 1 行、または <code>.lic</code> ファイル — 3.2 節を参照'],
    unzip: 'ダウンロードした ZIP を任意の場所に解凍すれば、インストールは完了です。別途のインストーラや管理者権限は必要ありません。解凍すると次のファイルが作成されます。',
    fileRows: [['<code>start_mac.command</code>', 'Mac 起動ファイル — これをダブルクリックします'], ['<code>start_windows.bat</code>', 'Windows 起動ファイル — これをダブルクリックします'],
      ['<code>INSTALL.ja.txt</code>', '1 枚もののクイックリファレンス'], ['<code>sample_docs/</code>', '体験用サンプル文書'],
      ['<code>index.html</code>, <code>js/</code>, <code>css/</code>, <code>agents/</code>', 'プログラム本体（変更しないでください）']],
    where: 'プログラムのフォルダは各 PC の書類フォルダなど、都合のよい場所に置いてください。チームで共有すべきものはプログラムではなく<b>記録データ</b>であり、これは 3.4 節の「共有フォルダの接続」で指定します。すなわち、プログラムは各 PC に、記録は会社の共有ドライブ上の一つのフォルダに置く構成が標準です。',
    startMac: '<b>Mac</b> — <code>start_mac.command</code> をダブルクリックします。初回は「開発元を確認できません」という警告が出ることがあります。その場合はファイルを右クリックして<b>開く</b>を選び、もう一度<b>開く</b>を押してください。',
    startWin: '<b>Windows</b> — <code>start_windows.bat</code> をダブルクリックします。SmartScreen の警告が出たら<b>詳細情報</b>を押し、<b>実行</b>を選択してください。',
    startNote: '起動すると黒いサーバーウィンドウが開き、続いてブラウザが自動的に開きます（アドレス <code>http://localhost:8777</code>）。サーバーウィンドウはシステムのエンジンですので、作業中は閉じないでください。このサーバーはご自身の PC 内でのみ動作し、外部には公開されません。サーバーウィンドウの案内文は、どの言語を使っていても英語で表示されます — ターミナルのフォントは日本語や韓国語を正しく描画できない場合があり、文字化けよりは英語のほうがよいと判断したためです。',
    licIntro: '本配布物は<b>コミュニティ・エディション</b>です。登録キーを入力する認証手順はなく、プログラムを起動すると図 3-1 のようにそのままオンボーディングの第 1 段階（研究文書のアップロード）が開きます。アクティベーションやオンライン確認は一切必要ありません。',
    licSteps: ['<b>コミュニティ・エディション</b> — 登録キーは不要です。プログラムを起動したら 4.1 節に進み、研究文書をアップロードしてください。', '<b>企業向けビルド</b> — 特定の会社・研究所に発行されるビルドで、最初の画面で署名済みライセンスキーを求めます。キーの文字列を貼り付けるか、<span class="btn">.lic ファイルを選択</span>でキーファイルを指定し、<span class="btn">登録認証</span>を押します。認証は電子署名の検証で、オフラインで即座に完了します。'],
    licNote: 'コミュニティ・エディションでは作成できるプロジェクト数に制限がありません。企業向けビルドはこれと異なり、ライセンス 1 つにつき研究プロジェクトは 1 つです。最初のプロジェクトを作成した時点でキーがその課題番号に紐付けられ、別のプロジェクトには新しいキーが必要になります（システム初期化を行ってもこの紐付けは消えません）。両ビルドの違いはこのライセンス処理のみで、研究ノートの作成・検証・封印の機能は完全に同一です。',
    lang: '画面の言語は初回起動時に<b>ブラウザ（OS）の言語に従って自動的に決定</b>されます — 日本語環境なら日本語、韓国語環境なら한국어、それ以外は English です。最初の画面の右上の選択器でいつでも変更でき、選択は保存されて次回以降も維持されます（ブラウザのタブ名も併せて切り替わります）。アプリに入ると、画面右上の選択器が同じ役割を引き継ぎます。',
    setup: 'オンボーディングが終わると、開始設定のウィンドウが表示されます。研究ノートの署名に使用する氏名とメールアドレス、確認用の PIN（4 桁以上）を登録します。',
    setup2: '最初に登録した人が<b>データ管理責任者</b>（既定）となり、バックアップ・復元・初期化の権限を持ちます。この権限は後から設定画面で、登録済みの他のユーザーにいつでも譲渡できます（8.3 節）。チーム共有フォルダを使う会社の場合は、このウィンドウの <span class="btn">共有フォルダ接続</span> で会社の共有ドライブ上のフォルダを指定してください。各 PC で初回 1 回のみ行えばよく、接続されたストレージは左メニューの上部に常に表示されます。',
    ob1: '初回に入ると 4 段階のオンボーディングが始まります。最初の段階で、研究開発計画書・提案書・性能指標表など課題を説明する文書を点線の枠にドラッグします（複数可）。PDF・Word（DOCX）・Excel（XLSX）・ハングル（HWPX）・CSV・TXT を読み取れます。',
    obNote: 'まず体験してみる場合は、<code>sample_docs/</code> フォルダのサンプル文書 2 点をアップロードしてください。実際の文書はいつでもシステム初期化のうえ改めてアップロードできます。',
    ob2: '<span class="btn">分析開始 →</span> を押すと、システムが文書を詳細に分析し、課題名・課題番号・実施機関・研究期間・ワークパッケージ・性能指標を抽出して確認画面を表示します。システムが独断で決めることはありません — 各項目の横の信頼度表示を参考に内容を確認し、誤りはこの画面で直接修正してください。',
    ob3: '<span class="btn">この内容でシステム生成 →</span> を押すと、研究期間全体が隔週（または週次）のスプリントに分解され、スプリントごとに研究ノートのスロットが作成され、指標ダッシュボードと 26 の AI エージェントの構成が完了します。',
    dash: '生成が終わるとダッシュボードが開きます。期間の経過率、確定したノート数、署名待ち、証拠台帳の登録件数、近づくマイルストーンと現在のスプリントを一目で示します。',
    road: 'ロードマップは研究全体を 1 画面に展開します。ワークパッケージ（WP）ごとの期間バーの上にノートの状態が点で示され（緑＝確定、琥珀＝署名待ち、藍＝下書き）、◆ はマイルストーン、赤い縦線は本日です。表示期間は全期間・今年・直近 12 か月・今後 6 か月・ユーザー指定に絞ることができ、絞ると軸が月単位に変わります。',
    road2: 'WP の行をクリックすると、その作業に関連する研究ノートの一覧に移動し、一覧でノートをクリックするとそのノートが開きます。画面左上の <b>←</b> ボタンでいつでも前の画面に戻れます。',
    plan: 'プランナーは 3 つの表示を備えています。<b>スプリント</b>は期間別の一覧、<b>WP ガント</b>は作業日程をバーで示し（表示期間の調整と本日の表示線を含む）、<b>月次</b>は月単位の進捗です。いずれの表示でも、行をクリックすると関連情報と研究ノートに繋がります。',
    noteOpen: 'プランナー（またはロードマップ）で作成対象の期間のスプリントをクリックすると、ノート編集画面が開きます。上部で作成期間を確認し、<b>作成者</b>と<b>点検者</b>を入力してください。点検者は作成者と異なる必要があります — 同一人物が承認まで行うことをシステムが防ぎます。',
    auto1: '本システムの中核機能です。実験日誌（TXT）・測定データ（CSV）など、その期間の原資料を点線の枠にドラッグすると、ファイルがハッシュ（SHA-256）とともに添付され、内容から証拠が抽出・登録されたうえで、すぐに分析するかを尋ねます。',
    auto2: '<span class="btn">今すぐ分析・執筆</span> を押すと（または後から <span class="btn">分析開始</span> を押すと）、システムが実施内容・結果データ・解釈を自動的に作成します。すべての文の末尾には根拠となる証拠番号 <code>[E#]</code> が付きます。文はアップロードした原文からのみ生成され、システムが事実を作り出すことはありません。',
    autoNote: '記録の日付がこのノートの作成期間の外である場合、システムは採用せず、日付が属するスプリントを探して「該当期間のノートに自動執筆しますか？」と提案します。承諾すると、そのノートを作成し執筆と検証まで自動で進めます。',
    autoNote2: '解釈文や測定条件のように<b>システム自身が作文する文は、選択した画面の言語で生成</b>されます。一方、実施内容はアップロードした原文から引用するため、原本の言語のまま残ります — 記録の原本性を守るための意図的な動作です。',
    gate1: '自動執筆の後、四つの検証ゲートが自動的に実行されます。ゲートは修正提案ではなく遮断装置です — 指摘が残っているノートは確定できません（勧告モードでは保存は可能ですが、指摘は保持されます）。',
    gateRows: [['G1 証拠マッピング', '証拠番号のない文、存在しない証拠の引用、推測・誇張表現'],
      ['G2 過去整合性', '確定済みの過去ノートとの期間重複、同一指標の矛盾する数値、状態の逆行'],
      ['G3 数値・単位監査', '合計・比率の再計算、単位表記、目標に対する方向、根拠のない「達成」表記（自由記述を含む）'],
      ['G4 指針遵守', '電子研究ノートの必須項目（作成者・点検者・期間・ハッシュなど）、引用証拠の原本添付の有無']],
    seal1: 'ゲートを通過したノートは署名段階に進みます。作成者が <span class="btn">寄与者署名</span> を行い、点検者が自分の名前で <span class="btn">最終承認・確定</span> を行うとノートが確定（封印）されます。作成者本人が最終承認を試みた場合は、相互承認の原則により拒否されます。',
    seal2: '確定したノートは修正できません。内容を直す必要がある場合は改訂版（-R1、-R2 …）を発行し、原本と改訂履歴の両方が残ります。確定と同時にノートの原本と正本 DOCX が <code>archive/</code> フォルダに自動保管され、ノートのハッシュは<b>本文と署名の両方を覆って</b>直前の確定ノートのハッシュと鎖状に連結されます。以後、本文であれ承認者名であれ変更すれば、検証で直ちに明らかになります。',
    ai: 'データ管理責任者が設定で AI エンジン（Anthropic Claude・Google Gemini・OpenAI のいずれか）を接続すると、ノート画面に <span class="btn">AI で記述を推敲</span> ボタンが表示されます。自動執筆された文をより自然な研究ノートの文体に整えますが、証拠番号が変わった文や禁止表現が混入した文は自動的に破棄され、推敲結果の全体がゲートで再検証されます。AI を接続しなくても、システムのすべての機能は完全に動作します。',
    ledger: 'アップロードした資料から抽出されたすべての事実が、証拠番号 <code>[E#]</code> とともにここに登録されます。どのノートのどの文が、どの原本のどの位置を根拠としているかを、いつでも遡って確認できます。監査対応の際はこの画面が出発点になります。',
    metrics: 'ノートが確定するたびに測定値が指標ごとに累積され、目標に対する推移が描かれます。値は確定ノートからのみ取られ、補間や外挿は行いません。',
    agents: 'システム内部で働く 26 の専門エージェントの編成表です。企画（5）・収集（6）・執筆（6）・検証（4）・出力（2）・記憶（2）の各グループが形式の定まったパケットで通信し、グループごとのリード（★）が成果物の完結性に責任を持ちます。一般の利用者が操作するものはなく、システムがなぜこのように動作するかを理解するための参考資料です。',
    store1: '共有フォルダを接続していれば、すべての記録はそのフォルダ内に実ファイルとして保存されます。接続していない場合は、このブラウザの内部ストレージに保存されます — 個人利用や体験には十分ですが、本格運用では共有フォルダの接続を推奨します。',
    storeRows: [['<code>data/</code>', '課題構造・プランナー・指標・監査ログ（追記専用）'], ['<code>notes/</code>', '研究ノート（状態・署名・ハッシュを含む）'],
      ['<code>notes_files/</code>', 'アップロードした原本ファイル'], ['<code>ledger/</code>', '証拠台帳'],
      ['<code>archive/</code>', '確定ノートの永久保管本 — 確定時に自動生成され、アプリが書き換えることはありません']],
    backup: '設定画面の <span class="btn">全体バックアップ（.zip・原本を含む）</span> は、上記すべてを一つの ZIP として書き出します。ZIP にはファイルごとの SHA-256 一覧が同梱され、復元時は全体の完全性検証を通過してはじめて書き込みが始まります — 1 バイトでも破損していれば、既存のデータは一切変更されません。バックアップは必要なときにいつでも取得でき、前回から 30 日が過ぎるとダッシュボードが月 1 回の頻度で案内します。',
    perm: 'バックアップ・復元・初期化はデータ管理責任者にのみ表示され、復元と初期化は実行前に PIN を再確認します。権限は設定 → データ管理の <span class="btn">データ管理責任者の譲渡</span> で、登録済みの他のユーザーに引き継げます（現管理者の PIN 確認が必要で、監査ログに記録されます）。共有フォルダの接続・変更は PC ごとの設定のため、すべてのユーザーが左上のストレージ表示をクリックして行えます。',
    permWarn: 'システム初期化はすべてのローカル記録を削除し、オンボーディングからやり直します。必ず先に全体バックアップを取得してください。コミュニティ・エディションはライセンス記録自体を持たないため、初期化するとそのまま最初の画面に戻ります。企業向けビルドでは、ライセンスとプロジェクトの紐付けは初期化後も維持されます。',
    troubleRows: [['ブラウザが自動的に開かない', 'ブラウザのアドレス欄に <code>http://localhost:8777</code> を直接入力します。'],
      ['「ポートを開けません」エラー', 'すでに起動中のサーバーウィンドウがないか確認し、あればそちらを使用します。'],
      ['画面がおかしい、古い画面が表示される', '強制再読み込み: Windows <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> / Mac <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>'],
      ['共有フォルダ接続ボタンが反応しない', 'Chrome または Edge を使用しているか確認します。他のブラウザはフォルダ接続に対応していません。'],
      ['自動執筆の結果が 0 件になる', '記録の日付がノートの作成期間内にあるか確認します。期間外の場合はシステムが正しいノートを提案します。'],
      ['最終承認が拒否される', '承認者の氏名が作成者と同じでないか確認します。相互承認の原則により本人承認は遮断されます。'],
      ['最初の画面で登録キーを求められる', 'コミュニティ・エディションがキーを求めることはありません。キー入力画面が出る場合は企業向けビルドですので、発行されたキーを入力してください。'],
      ['（企業向けビルド）ライセンスキーが無効と表示される', 'キー全体が漏れなくコピーされているか確認し、それでも失敗する場合は開発者に再発行を依頼してください。']],
  },
  cap: {
    '01': ['図 3-1', 'プログラムを起動して最初に表示される画面。コミュニティ・エディションは登録手順なしでオンボーディング第 1 段階に入る。右上の選択器で言語を変更できる。'],
    '02': ['図 4-1', '文書アップロードの段階。登録されたファイルが一覧に表示される。'],
    '03': ['図 4-2', '抽出結果の確認。信頼度の低い項目はバッジで示され、確認を促す。'],
    '04': ['図 3-2', '開始設定のウィンドウ。最初に登録した人がデータ管理責任者になる。'],
    '05': ['図 5-1', 'ダッシュボード。右上でテーマ・氏名・言語を設定する。'],
    '06': ['図 5-2', 'ロードマップ。表示期間を絞ると軸が月単位に変わる。'],
    '07': ['図 5-3', 'WP ガント。行をクリックするとその作業の研究ノート一覧に移動する。'],
    '08': ['図 5-4', '月次表示。各行をクリックすると、その月のスプリントとノートの詳細に移動する。'],
    '09': ['図 6-1', 'ノート編集画面。点線の枠と［分析開始］が自動執筆の入口である。'],
    '10': ['図 6-2', 'アップロード直後の確認ウィンドウ。ファイルを追加する場合は「追加作業を続ける」を選ぶ。'],
    '11': ['図 6-3', '自動執筆された実施内容。各文に紐付いた証拠番号が表示される。'],
    '12': ['図 6-4', '検証ゲートの結果。指摘がある場合は位置・理由・対応がカードで示される。'],
    '13': ['図 6-5', '確定した研究ノートの正本表示。上部から DOCX・XLSX のダウンロードと印刷ができる。'],
    '14': ['図 7-1', '証拠台帳。証拠ごとに種類・原本ファイル・位置・ハッシュが記録される。'],
    '15': ['図 7-2', '性能指標。各点は確定ノートの実測値である。'],
    '16': ['図 7-3', 'AI エージェントの編成。詳細設計は agents/MAS_SPEC.md にある。'],
    '17': ['図 6-6', 'AI エンジンの設定（データ管理責任者専用）。'],
    '18': ['図 8-1', '設定のデータ管理。バックアップ・復元・通知周期・権限譲渡がここにある。'],
  },
  foot: 'AAA-RNS インストール・利用ガイド · 適用バージョン v2.0 · 2026年8月 · Developed by Seung Ho Jung · ライセンス・技術に関するお問い合わせは開発者までご連絡ください。本書の画面図は v2.0 の実際の画面を撮影したものであり、例示の会社・課題・数値はすべて架空のデータです。',
};

/* ── 문서 조립 (구조는 세 언어 공통) ── */
function build(lang) {
  const t = L[lang], b = t.b, S = t.sec;
  const fig = (n, cls = '') => {
    const [num, cap] = t.cap[n];
    return `<figure class="${cls}"><img src="../img/${lang}/${
      { '01':'01-first-screen','02':'02-upload','03':'03-review','04':'04-setup','05':'05-dashboard',
        '06':'06-roadmap','07':'07-gantt','08':'08-monthly','09':'09-note-editor','10':'10-ask',
        '11':'11-autodraft','12':'12-gates','13':'13-sealed','14':'14-ledger','15':'15-metrics',
        '16':'16-agents','17':'17-settings-llm','18':'18-settings-data' }[n]
    }.png" alt=""><figcaption><b>${num}</b>&ensp;${cap}</figcaption></figure>`;
  };
  const rows = arr => arr.map(([a, c]) => `<tr><td style="width:32%">${a}</td><td>${c}</td></tr>`).join('');
  const ol = arr => `<ol>${arr.map(x => `<li>${x}</li>`).join('')}</ol>`;
  const noteBox = s => `<div class="note"><b>${t.note}</b>&ensp;${s}</div>`;
  const warnBox = s => `<div class="warn"><b>${t.warn}</b>&ensp;${s}</div>`;

  return `<!DOCTYPE html><html lang="${t.htmlLang}"><head><meta charset="utf-8">
<title>${t.title} — ${t.sub}</title><style>${CSS}</style></head><body>

<div class="cover"><div class="band">
  <h1>${t.title}</h1><div class="sub">${t.sub}</div>
  <div class="en">AAA-RNS · AI Agent-driven Autonomous Research Notebook System</div>
</div><div class="doc"><table>
  <tr><td>${t.docNo}</td><td>AAA-RNS-UG-200</td></tr>
  <tr><td>${t.ver}</td><td>v2.0</td></tr>
  <tr><td>${t.date}</td><td>${t.dateVal}</td></tr>
  <tr><td>${t.dev}</td><td>Seung Ho Jung</td></tr>
  <tr><td>${t.aud}</td><td>${t.audVal}</td></tr>
</table></div></div>

<div class="toc"><h2>${t.tocT}</h2><ol>
${t.ch.map((c, i) => `<li>${c}<ol>${S[i].map(s => `<li>${s}</li>`).join('')}</ol></li>`).join('')}
</ol></div>

<h2>${t.ch[0]}</h2>
<h3>${S[0][0]}</h3><p>${b.intro1}</p><p>${b.intro2}</p><p>${b.intro3}</p>
<h3>${S[0][1]}</h3><table class="t">${rows(b.envRows)}</table>
<h3>${S[0][2]}</h3><p>${b.conv}</p>

<h2 class="ch">${t.ch[1]}</h2>
<h3>${S[1][0]}</h3><p>${b.getFiles}</p>${ol(b.getList)}
<h3>${S[1][1]}</h3><p>${b.unzip}</p><table class="t">${rows(b.fileRows)}</table>
<h3>${S[1][2]}</h3><p>${b.where}</p>

<h2 class="ch">${t.ch[2]}</h2>
<h3>${S[2][0]}</h3><p>${b.startMac}</p><p>${b.startWin}</p><p>${b.startNote}</p>
<h3>${S[2][1]}</h3><p>${b.licIntro}</p>${fig('01')}${ol(b.licSteps)}${noteBox(b.licNote)}
<h3>${S[2][2]}</h3><p>${b.lang}</p>
<h3>${S[2][3]}</h3><p>${b.setup}</p>${fig('04', 'narrow')}<p>${b.setup2}</p>

<h2 class="ch">${t.ch[3]}</h2>
<h3>${S[3][0]}</h3><p>${b.ob1}</p>${fig('02')}${noteBox(b.obNote)}
<h3>${S[3][1]}</h3><p>${b.ob2}</p>${fig('03')}
<h3>${S[3][2]}</h3><p>${b.ob3}</p>

<h2 class="ch">${t.ch[4]}</h2>
<h3>${S[4][0]}</h3><p>${b.dash}</p>${fig('05')}
<h3>${S[4][1]}</h3><p>${b.road}</p>${fig('06')}<p>${b.road2}</p>
<h3>${S[4][2]}</h3><p>${b.plan}</p>${fig('07')}${fig('08')}

<h2 class="ch">${t.ch[5]}</h2>
<h3>${S[5][0]}</h3><p>${b.noteOpen}</p>${fig('09')}
<h3>${S[5][1]}</h3><p>${b.auto1}</p>${fig('10', 'narrow')}<p>${b.auto2}</p>${fig('11')}
${noteBox(b.autoNote)}${noteBox(b.autoNote2)}
<h3>${S[5][2]}</h3><p>${b.gate1}</p><table class="t">${rows(b.gateRows)}</table>${fig('12')}
<h3>${S[5][3]}</h3><p>${b.seal1}</p><p>${b.seal2}</p>${fig('13')}
<h3>${S[5][4]}</h3><p>${b.ai}</p>${fig('17')}

<h2 class="ch">${t.ch[6]}</h2>
<h3>${S[6][0]}</h3><p>${b.ledger}</p>${fig('14')}
<h3>${S[6][1]}</h3><p>${b.metrics}</p>${fig('15')}
<h3>${S[6][2]}</h3><p>${b.agents}</p>${fig('16')}

<h2 class="ch">${t.ch[7]}</h2>
<h3>${S[7][0]}</h3><p>${b.store1}</p><table class="t">${rows(b.storeRows)}</table>
<h3>${S[7][1]}</h3><p>${b.backup}</p>${fig('18')}
<h3>${S[7][2]}</h3><p>${b.perm}</p>${warnBox(b.permWarn)}
<h3>${S[7][3]}</h3><table class="t">${rows(b.troubleRows)}</table>

<footer>${t.foot}</footer>
</body></html>`;
}

for (const lang of ['ko', 'en', 'ja']) {
  const html = build(lang);
  /* 언어별 폴더에 같은 파일명으로 — 저장소 URL 안전성과 예측 가능성 */
  mkdirSync(join(DIR, lang), { recursive: true });
  writeFileSync(join(DIR, lang, 'guide.html'), html);
  console.log(`생성: ${L[lang].file}.html (${(html.length / 1024).toFixed(0)}KB)`);
}
