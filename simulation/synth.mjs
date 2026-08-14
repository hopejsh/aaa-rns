/* ════════════════════════════════════════════════════════════════
 * AAA-RNS · simulation/synth.mjs
 * Developed by Seung Ho Jung · v2.0 · Apache-2.0 © 2026
 * 합성 시나리오 생성기 — 시드 기반 재현 가능
 *
 * 실제 회사들이 올릴 법한 연구 문서(DOCX/XLSX/CSV/TXT)를
 * "정답(ground truth)과 함께" 생성한다. 시뮬레이션은 생성된
 * 문서를 실제 파서·분석기에 통과시켜 정답 대비 검증한다.
 * ════════════════════════════════════════════════════════════════ */

import { docxBuild, xlsxBuild } from '../js/core/docgen.js';

/* ── 시드 RNG (mulberry32) ─────────────────────────────── */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export const rint = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
export const chance = (rng, p) => rng() < p;

/* ── 어휘 (금지 표현·날짜 패턴과 충돌하지 않는 안전 어휘) ── */
const DOMAINS_WORDS = {
  bio: ['균주 배양', '단백질 정제', '유전자 발현 분석', '세포 독성 시험', '항체 생산', '발효 공정'],
  ai: ['모델 학습', '데이터 전처리', '특징 추출', '하이퍼파라미터 탐색', '추론 파이프라인 구축', '데이터셋 라벨링'],
  materials: ['시편 제작', '박막 증착', '내열성 시험', '표면 처리', '조성 분석', '촉매 합성'],
  energy: ['전지 셀 조립', '충방전 시험', '전해질 배합', '열관리 설계', '출력 특성 측정', '수명 평가'],
  manufacturing: ['공정 라인 셋업', '금형 설계', '불량 원인 분석', '자동화 지그 제작', '치수 검사', '조립 공정 검증'],
};
const ORG_NAMES = ['한빛테크(주)', '(주)미래소재연구소', '그린바이오텍', '(주)스마트팩토리솔루션', '대한정밀화학', '이노베이스랩', '(주)퀀텀머티리얼즈'];
const AGENCIES = ['산업통상자원부', '과학기술정보통신부', '중소벤처기업부', '보건복지부', ''];
const NAMES = ['김민준', '이서연', '박도윤', '최지우', '정하준', '강수아', '조은우', '윤지호', '임서준', '한예린'];
const KPI_DEFS = [
  ['예측 정확도', '%', [80, 99], 'higher'], ['공정 수율', '%', [70, 98], 'higher'],
  ['처리 지연시간', 'ms', [10, 500], 'lower'], ['불량률', '%', [1, 8], 'lower'],
  ['시제품 제작', '건', [1, 12], 'higher'], ['특허 출원', '건', [1, 5], 'higher'],
  ['에너지 효율', '%', [60, 95], 'higher'], ['내구 수명', '시간', [500, 20000], 'higher'],
];

export function synthProject(rng) {
  const domain = pick(rng, Object.keys(DOMAINS_WORDS));
  const year = rint(rng, 2024, 2030);
  const startMonth = rint(rng, 1, 12);
  const months = rint(rng, 6, 60);
  const start = `${year}-${String(startMonth).padStart(2, '0')}-01`;
  // 종료 = 시작 + months - 1개월의 말일
  const em = startMonth - 1 + months - 1;
  const ey = year + Math.floor(em / 12), emm = (em % 12) + 1;
  const lastDay = new Date(Date.UTC(ey, emm, 0)).getUTCDate();
  const end = `${ey}-${String(emm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const wpCount = rint(rng, 2, 8);
  const wps = [];
  for (let i = 1; i <= wpCount; i++) {
    wps.push({ num: i, name: pick(rng, DOMAINS_WORDS[domain]) + ' ' + pick(rng, ['체계 구축', '기술 확보', '고도화', '검증', '최적화']) });
  }
  const kpiCount = rint(rng, 1, 5);
  const kpis = [];
  const used = new Set();
  for (let i = 0; i < kpiCount; i++) {
    const def = pick(rng, KPI_DEFS);
    if (used.has(def[0])) continue;
    used.add(def[0]);
    kpis.push({ name: def[0], unit: def[1], target: rint(rng, def[2][0], def[2][1]), direction: def[3] });
  }
  const code = `${pick(rng, ['RS', 'IR', 'TD', 'NR'])}-${year}-${rint(rng, 1000000, 99999999)}`;
  return {
    domain,
    title: `${pick(rng, ['지능형', '차세대', '고효율', '친환경', '초정밀'])} ${pick(rng, DOMAINS_WORDS[domain]).split(' ')[0]} ${pick(rng, ['플랫폼', '시스템', '공정 기술', '통합 솔루션'])} 개발`,
    code,
    org: pick(rng, ORG_NAMES),
    agency: pick(rng, AGENCIES),
    period: { start, end, months },
    wps, kpis,
    pi: pick(rng, NAMES),
    members: [...new Set([pick(rng, NAMES), pick(rng, NAMES), pick(rng, NAMES)])],
  };
}

/** 정답이 알려진 합성 연구계획서 DOCX. */
export function synthPlanDocx(rng, truth = null) {
  const t = truth || synthProject(rng);
  const blocks = [
    { type: 'h1', text: '연구개발계획서' },
    { text: `과제명: ${t.title}` },
    { text: `과제번호: ${t.code}` },
    ...(t.agency ? [{ text: `전문기관: ${t.agency}` }] : []),
    { text: `주관연구개발기관: ${t.org}` },
    { text: `연구개발기간: ${t.period.start} ~ ${t.period.end} (${t.period.months}개월)` },
    { text: `연구책임자: ${t.pi}` },
    { type: 'h2', text: '연구개발 내용' },
    ...t.wps.map(w => ({ text: `WP${w.num}: ${w.name}` })),
    { type: 'h2', text: '성능지표' },
    { type: 'table', rows: [
      ['성능지표', '단위', '목표치'],
      ...t.kpis.map(k => [k.name, k.unit, String(k.target)]),
    ] },
    { type: 'h2', text: '참여 인력' },
    { type: 'table', rows: [
      ['성명', '역할'],
      [t.pi, '연구책임자'],
      ...t.members.map(m => [m, '참여연구원']),
    ] },
  ];
  return { bytes: docxBuild(blocks, { title: t.title }), truth: t };
}

/** 정답이 알려진 합성 지표 XLSX. */
export function synthKpiXlsx(rng, truth = null) {
  const t = truth || synthProject(rng);
  return {
    bytes: xlsxBuild([
      { name: '성능지표', rows: [
        ['평가항목', '단위', '최종 목표'],
        ...t.kpis.map(k => [k.name, k.unit, k.target]),
      ] },
      { name: '일정', rows: [
        ['WP', '내용', '시작', '종료'],
        ...t.wps.map(w => [`WP${w.num}`, w.name, t.period.start, t.period.end]),
      ] },
    ]),
    truth: t,
  };
}

/** parsers 를 우회한 "파싱 결과" 형태의 합성 문서 — 분석기 대량 시험용(빠름). */
export function synthParsedDoc(rng, truth = null) {
  const t = truth || synthProject(rng);
  const paragraphs = [
    '연구개발계획서',
    `과제명: ${t.title}`,
    `과제번호: ${t.code}`,
    `주관연구개발기관: ${t.org}`,
    `연구개발기간: ${t.period.start} ~ ${t.period.end}`,
    `연구책임자: ${t.pi}`,
    ...t.wps.map(w => `WP${w.num}: ${w.name}`),
  ];
  if (t.agency) paragraphs.splice(3, 0, `전문기관: ${t.agency}`);
  const tables = [[
    ['성능지표', '단위', '목표치'],
    ...t.kpis.map(k => [k.name, k.unit, String(k.target)]),
  ]];
  return {
    doc: {
      ok: true, name: 'synthetic_plan.docx', ext: 'docx', size: 1000, kind: 'docx',
      text: paragraphs.join('\n'), paragraphs, tables, sheets: [], meta: {}, warnings: [], sha256: 'f'.repeat(64),
    },
    truth: t,
  };
}

/* ── 적대적 문서: 실제 회사 문서의 형식 다양성 재현 ─────────
 * 라벨 표기·구분자·날짜 형식·표 헤더가 제각각이고
 * 노이즈 문단이 섞인 문서에서도 정답을 추출해야 한다. */
const NOISE_LINES = [
  '본 자료의 무단 배포를 금한다.', '별첨 문서를 참조하라.', '내부 검토용 초안임을 밝힌다.',
  '관련 회의록은 별도 보관한다.', '세부 사항은 협의를 통해 확정한다.', '이하 여백.',
  '문의처는 행정 담당 부서이다.', '보안 등급 분류 대상이다.',
];

function fmtDateVariant(rng, iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const v = rint(rng, 0, 2);
  if (v === 0) return iso;
  if (v === 1) return `${y}.${m}.${d}`;
  return `${y}년 ${m}월 ${d}일`;
}

export function synthAdversarialDoc(rng, truth = null) {
  const t = truth || synthProject(rng);
  const sep = pick(rng, [': ', ' : ', ' - ', ' ']);
  const titleLabel = pick(rng, ['과제명', '연구개발과제명', '사업명']);
  const codeLabel = pick(rng, ['과제번호', '공고번호', '과제 번호']);
  const orgLabel = pick(rng, ['주관연구개발기관', '주관기관', '수행기관']);
  const perLabel = pick(rng, ['연구개발기간', '수행기간', '총 연구기간', '연구 기간']);
  const rangeSep = pick(rng, [' ~ ', '~', ' ∼ ', ' – ']);
  const wpStyle = rint(rng, 0, 2);

  const core = [
    `${titleLabel}${sep}${t.title}`,
    `${codeLabel}${sep}${t.code}`,
    `${orgLabel}${sep}${t.org}`,
    `${perLabel}${sep}${fmtDateVariant(rng, t.period.start)}${rangeSep}${fmtDateVariant(rng, t.period.end)}`,
    `연구책임자${sep}${t.pi}`,
    ...t.wps.map(w =>
      wpStyle === 0 ? `WP${w.num}: ${w.name}` :
      wpStyle === 1 ? `WP ${w.num}. ${w.name}` : `WP-${w.num} ${w.name}`),
  ];
  // 노이즈 문단을 무작위 위치에 삽입
  const paragraphs = ['연구개발계획서'];
  for (const line of core) {
    if (chance(rng, 0.4)) paragraphs.push(pick(rng, NOISE_LINES));
    paragraphs.push(line);
  }
  if (chance(rng, 0.5)) paragraphs.push(pick(rng, NOISE_LINES));

  // KPI 표: 헤더 변형 + '이상/이하' 접미사 + 단위 열 유무
  const nameHdr = pick(rng, ['성능지표', '평가지표', '지표명', '평가 항목']);
  const targetHdr = pick(rng, ['목표치', '최종 목표', '목표값']);
  const hasUnitCol = chance(rng, 0.6);
  const suffixMode = rint(rng, 0, 2); // 0: 숫자만, 1: "92 이상", 2: "92% 이상"(단위 인라인)
  const header = hasUnitCol ? [nameHdr, '단위', targetHdr] : [nameHdr, targetHdr];
  const kpiRows = t.kpis.map(k => {
    const sfx = k.direction === 'lower' ? '이하' : '이상';
    const target = suffixMode === 0 ? String(k.target)
      : suffixMode === 1 ? `${k.target} ${sfx}`
      : `${k.target}${k.unit} ${sfx}`;
    return hasUnitCol ? [k.name, k.unit, target] : [k.name, target];
  });
  const tables = [[header, ...kpiRows]];

  return {
    doc: {
      ok: true, name: 'adversarial_plan.docx', ext: 'docx', size: 2000, kind: 'docx',
      text: paragraphs.join('\n'), paragraphs, tables, sheets: [], meta: {}, warnings: [], sha256: 'e'.repeat(64),
    },
    truth: t,
    meta: { hasUnitCol, suffixMode, wpStyle },
  };
}

/* ── 파일 손상기 (퍼저) ─────────────────────────────────── */
export function corrupt(rng, bytes) {
  const b = bytes.slice();
  const mode = rint(rng, 0, 3);
  if (mode === 0) {                                   // 무작위 바이트 뒤집기
    const n = rint(rng, 1, Math.min(64, b.length));
    for (let i = 0; i < n; i++) b[rint(rng, 0, b.length - 1)] = rint(rng, 0, 255);
  } else if (mode === 1) {                            // 잘라내기
    return b.subarray(0, rint(rng, 0, b.length - 1));
  } else if (mode === 2) {                            // 머리 자르기
    return b.subarray(rint(rng, 1, Math.max(1, b.length - 1)));
  } else {                                            // 중간 삭제
    const cut = rint(rng, 1, Math.max(1, Math.floor(b.length / 2)));
    const at = rint(rng, 0, b.length - cut);
    const out = new Uint8Array(b.length - cut);
    out.set(b.subarray(0, at));
    out.set(b.subarray(at + cut), at);
    return out;
  }
  return b;
}

export function randomBytes(rng, n) {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = rint(rng, 0, 255);
  return b;
}

/* ── 합성 PDF: 텍스트 레이어 + ToUnicode CMap(한글) ────────
 * 파서의 PDF 경로를 검증하기 위한 최소 유효 PDF.
 * ASCII 는 리터럴 (…) Tj, 한글은 <hex> Tj + bfchar 매핑. */
const HANGUL_POOL = '한글연구보고서결과분석시험자료검증';

export function synthPdf(rng) {
  const ascii = `Plan ${rint(rng, 2024, 2030)} section ${rint(rng, 1, 99)}`;
  const hangulLen = rint(rng, 2, 6);
  let hangul = '';
  const codes = [];
  for (let i = 0; i < hangulLen; i++) {
    const ch = HANGUL_POOL[rint(rng, 0, HANGUL_POOL.length - 1)];
    hangul += ch;
    codes.push(0x0101 + i);            // 2바이트 코드 (>0xff — CID 폰트 관례)
  }
  const bfchars = codes.map((c, i) =>
    `<${c.toString(16).padStart(4, '0')}> <${hangul.charCodeAt(i).toString(16).padStart(4, '0')}>`).join('\n');
  const cmap = `/CIDInit /ProcSet findresource begin
begincmap
1 begincodespacerange <0000> <ffff> endcodespacerange
${codes.length} beginbfchar
${bfchars}
endbfchar
endcmap
end`;
  const hexStr = codes.map(c => c.toString(16).padStart(4, '0')).join('');
  const content = `BT /F1 12 Tf 72 720 Td (${ascii}) Tj T* <${hexStr}> Tj ET`;
  const objs = [
    `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`,
    `2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj`,
    `3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R /MediaBox [0 0 612 792] >> endobj`,
    `4 0 obj << /Type /Font /Subtype /Type0 /BaseFont /SynthKR /ToUnicode 6 0 R >> endobj`,
    `5 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
    `6 0 obj << /Length ${cmap.length} >> stream\n${cmap}\nendstream endobj`,
  ];
  const pdf = `%PDF-1.4\n${objs.join('\n')}\ntrailer << /Root 1 0 R >>\n%%EOF`;
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return { bytes, ascii, hangul };
}

/* ── 합성 HWPX ─────────────────────────────────────────── */
export function synthHwpxEntries(rng, zipBuildFn) {
  const paras = [];
  const cnt = rint(rng, 1, 6);
  for (let i = 0; i < cnt; i++) paras.push(`한글 문단 ${i} 내용 검증`);
  const cell = `표셀 ${rint(rng, 0, 99)}`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?><hs:sec xmlns:hp="x" xmlns:hs="y">` +
    paras.map(p => `<hp:p><hp:run><hp:t>${p}</hp:t></hp:run></hp:p>`).join('') +
    `<hp:tbl><hp:tr><hp:tc><hp:t>${cell}</hp:t></hp:tc><hp:tc><hp:t>둘째셀</hp:t></hp:tc></hp:tr></hp:tbl></hs:sec>`;
  const bytes = zipBuildFn([
    { name: 'mimetype', data: 'application/hwp+zip' },
    { name: 'Contents/section0.xml', data: xml },
  ]);
  return { bytes, paras, cell };
}

/* ── EUC-KR 고정 시료 (인코딩 폴백 검증) ───────────────────
 * TextEncoder 는 UTF-8 전용이므로 알려진 EUC-KR 바이트를 직접 사용 */
export const EUCKR_SAMPLES = [
  { bytes: [0xC7, 0xD1, 0xB1, 0xDB], text: '한글' },
  { bytes: [0xBF, 0xAC, 0xB1, 0xB8], text: '연구' },
  { bytes: [0xBA, 0xB8, 0xB0, 0xED, 0xBC, 0xAD], text: '보고서' },
  { bytes: [0xB0, 0xE1, 0xB0, 0xFA], text: '결과' },
];

/* ── 노트·게이트 시나리오 ───────────────────────────────── */
const SAFE_VERBS = ['수행하였다', '완료하였다', '측정하였다', '기록하였다', '분석하였다', '확보하였다'];
const SAFE_SUBJECTS = ['1차 배양 실험을', '데이터 정제 작업을', '장비 교정을', '시편 3종 제작을', '설계 검토 회의를', '중간 결과 정리를'];

/** 증거 인용이 완비된 안전한 서술 문장 생성. */
export function cleanSentence(rng, evidenceId) {
  return `${pick(rng, SAFE_SUBJECTS)} ${pick(rng, SAFE_VERBS)} [${evidenceId}].`;
}

export const VIOLATION_TYPES = [
  'missing_citation',   // G1-미매핑
  'ghost_evidence',     // G1-증거부재
  'forbidden_word',     // G1-금지표현
  'metric_no_evidence', // G1-측정증거없음
  'percent_range',      // G3-범위
  'bad_value',          // G3-값형식
  'count_fraction',     // G3-계수형식
  'unit_mismatch',      // G3-단위불일치
  'false_achieved',     // G3-달성표기오류
  'self_review',        // G4-자기점검
  'missing_author',     // G4-작성자
  'bad_period',         // G4-작성기간
  'att_no_hash',        // G4-첨부해시
  'period_overlap',     // G2-기간중복
  'metric_contradict',  // G2-수치모순
];

export const VIOLATION_TO_CHECK = {
  missing_citation: 'G1-미매핑', ghost_evidence: 'G1-증거부재', forbidden_word: 'G1-금지표현',
  metric_no_evidence: 'G1-측정증거없음', percent_range: 'G3-범위', bad_value: 'G3-값형식',
  count_fraction: 'G3-계수형식', unit_mismatch: 'G3-단위불일치', false_achieved: 'G3-달성표기오류',
  self_review: 'G4-자기점검', missing_author: 'G4-작성자', bad_period: 'G4-작성기간',
  att_no_hash: 'G4-첨부해시', period_overlap: 'G2-기간중복', metric_contradict: 'G2-수치모순',
};
