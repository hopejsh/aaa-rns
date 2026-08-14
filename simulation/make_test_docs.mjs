/* ════════════════════════════════════════════════════════════════
 * AAA-RNS · simulation/make_test_docs.mjs
 * Developed by Seung Ho Jung · v2.0 · Apache-2.0 © 2026
 * 가상 테스트 문서 생성기
 *
 * 실제 회사 문서 없이 시스템을 시험해 볼 수 있도록,
 * 가상의 회사·연구과제 문서 세트를 생성한다:
 *
 *   ① 연구개발계획서.docx   → 온보딩 1단계에 업로드
 *   ② 성능지표.xlsx         → 온보딩 1단계에 함께 업로드
 *   ③ 실험일지_1주차.txt     → 연구노트 화면에서 증거로 업로드
 *   ④ 측정데이터.csv         → 연구노트 화면에서 증거로 업로드
 *   ⑤ 사용법.txt             → 이 세트의 테스트 순서 안내
 *
 * 시뮬레이션 하네스가 검증에 쓰는 것과 동일한 합성 엔진(synth.mjs)을
 * 사용하므로, 생성 문서는 항상 파서·분석기가 정확히 읽어낼 수 있다.
 *
 * 사용:
 *   node simulation/make_test_docs.mjs           # 세트 1개 생성
 *   node simulation/make_test_docs.mjs 3         # 세트 3개 생성
 *   node simulation/make_test_docs.mjs 1 1234    # 시드 고정(재현)
 * ════════════════════════════════════════════════════════════════ */

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeRng, rint, pick, synthProject, synthPlanDocx, synthKpiXlsx } from './synth.mjs';
import { addDays } from '../js/core/util.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COUNT = Math.max(1, Math.min(20, parseInt(process.argv[2] || '1', 10) || 1));
const SEED = parseInt(process.argv[3] || String(Date.now() % 2147483647), 10);

const ACTIVITIES = [
  '장비 교정 및 사전 점검을 수행하였다',
  '시료 3종 준비 작업을 완료하였다',
  '1차 측정 및 원시데이터 기록을 수행하였다',
  '중간 결과 검토 회의를 진행하였다',
  '반복 측정으로 재현성 확인 작업을 수행하였다',
  '측정 조건 편차 원인 분석을 수행하였다',
];

for (let s = 0; s < COUNT; s++) {
  const rng = makeRng(SEED + s * 7919);
  const t = synthProject(rng);
  const dirName = `가상문서_${t.org.replace(/[()\s(주)]/g, '')}_${t.code}`;
  const dir = join(ROOT, '가상문서', dirName);
  mkdirSync(dir, { recursive: true });

  /* ① 연구개발계획서 DOCX + ② 성능지표 XLSX (정답 공유) */
  writeFileSync(join(dir, '연구개발계획서.docx'), synthPlanDocx(rng, t).bytes);
  writeFileSync(join(dir, '성능지표.xlsx'), synthKpiXlsx(rng, t).bytes);

  /* ③ 실험일지 TXT — 첫 스프린트(시작 2주) 기간의 활동 기록.
     연구노트의 증거 후보 추출기가 측정·진술로 분류할 수 있는 형태 */
  const logLines = [`[실험일지] ${t.title}`, `작성: ${t.pi}`, ''];
  const usedDates = [];
  for (let d = 0; d < 10; d++) {
    const date = addDays(t.period.start, d + rint(rng, 0, 1));
    usedDates.push(date);
    logLines.push(`${date} — ${pick(rng, ACTIVITIES)}`);
    if (t.kpis.length && d % 3 === 2) {
      const k = pick(rng, t.kpis);
      let near = k.direction === 'lower' ? k.target * (1 + rng() * 0.3) : k.target * (0.7 + rng() * 0.25);
      if (/^(건|회|명|개|편|차|번)$/.test(k.unit || '')) near = Math.max(0, Math.round(near));
      else near = Math.round(near * 10) / 10;
      if ((k.unit || '') === '%') near = Math.min(100, near);
      logLines.push(`${date} — ${k.name} ${near}${k.unit} 측정 결과를 기록하였다 (표준 조건)`);
    }
  }
  writeFileSync(join(dir, '실험일지_1주차.txt'), logLines.join('\n'), 'utf-8');

  /* ④ 측정데이터 CSV */
  const csvRows = ['날짜,지표,값,단위,측정조건'];
  for (const k of t.kpis) {
    for (let i = 0; i < rint(rng, 2, 4); i++) {
      const date = pick(rng, usedDates);
      let v = k.direction === 'lower' ? k.target * (1 + rng() * 0.4) : k.target * (0.65 + rng() * 0.3);
      if (/^(건|회|명|개|편|차|번)$/.test(k.unit || '')) v = Math.max(0, Math.round(v));
      else v = Math.round(v * 10) / 10;
      if ((k.unit || '') === '%') v = Math.min(100, v);
      csvRows.push(`${date},${k.name},${v},${k.unit},표준 조건 ${i + 1}차`);
    }
  }
  writeFileSync(join(dir, '측정데이터.csv'), csvRows.join('\n'), 'utf-8');

  /* ⑤ 사용법 안내 */
  writeFileSync(join(dir, '사용법.txt'), `═══ 가상 테스트 문서 세트 — 사용 순서 ═══

가상 회사  : ${t.org}
가상 과제  : ${t.title}
과제번호   : ${t.code}
연구기간   : ${t.period.start} ~ ${t.period.end} (${t.period.months}개월)
WP ${t.wps.length}개 · 지표 ${t.kpis.length}개 · 시드 ${SEED + s * 7919} (같은 시드로 재생성 가능)

① 시스템 첫 화면(온보딩)에서 업로드:
   → 연구개발계획서.docx + 성능지표.xlsx
   → 심층 분석 후 위 과제 정보가 그대로 추출되는지 확인하십시오.

② 시스템 생성 후, 플래너에서 첫 스프린트(S01)를 클릭해 노트를 열고:
   → 실험일지_1주차.txt 와 측정데이터.csv 를 점선 상자에 **끌어다 놓기**
     (클릭해서 선택해도 됩니다)
   → "분석할까요?" 라고 물어보면 [지금 분석·집필] 선택
     · 파일을 더 올리려면 [추가 작업 계속] → 준비 후 [분석 시작하기] 버튼
   → 시스템이 수행내용·결과데이터·해석을 자동 집필하고 게이트 검증까지
     수행합니다 (전 문장 [E#] 인용 부착).
   ※ 주의: 기록 날짜가 노트의 작성기간 안에 있어야 채택됩니다.
     날짜가 다른 기간이면 시스템이 올바른 기간의 노트를 찾아
     "해당 노트에 자동 집필할까요?" 라고 물어봅니다.
   ※ 문장을 직접 쓰고 싶으면 [수동 등재 (후보 선택)] 를 사용하십시오.

③ 게이트 결과 G1~G4 전 통과 확인
   (일부러 [E#] 없는 문장을 추가해 보면 G1 이 차단하는 것을 볼 수 있습니다)

④ 기여자 서명 → 다른 이름으로 최종 승인 → 확정(sealed)
   (작성자 본인 이름으로 승인하면 교차 승인 원칙에 의해 차단됩니다)

⑤ 설정 → [해시 체인 검증] 으로 기록 무결성 확인

※ 초기화: 설정 → [시스템 초기화] 후 다른 가상 세트로 다시 테스트
`, 'utf-8');

  console.log(`생성: 가상문서/${dirName}/  (${t.org} · ${t.title.slice(0, 30)}…)`);
}
console.log(`\n${COUNT}개 세트 완료 — 시스템 첫 화면에 끌어다 놓고 테스트하십시오.`);
