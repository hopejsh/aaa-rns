/* ════════════════════════════════════════════════════════════════
 * AAA-RNS · core/generator.js
 * 시스템 생성기 — 프로젝트 모델 → 맞춤 자동화 시스템 구성
 *
 * analyzer 가 추출한 프로젝트 모델을 받아, 기존 AAA-RNS 와 동일한
 * 골격의 운영 시스템을 회사·과제에 맞게 조립한다:
 *   · project.json   (과제 구조 확정본)
 *   · planner        (격주/주간 스프린트 + 월 블록 + 노트 슬롯)
 *   · metrics        (지표 카탈로그 + 실측 누적 구조)
 *   · noteTemplate   (전자연구노트 요건 필드)
 *   · agents         (A0~A25 에이전트 프롬프트 변수 주입)
 *   · config         (운영 설정)
 *
 * 불변식 (시뮬레이션이 검증하는 계약):
 *  I1. 스프린트는 기간 전체를 빈틈·중복 없이 덮는다
 *  I2. 모든 스프린트: start ≤ end, 기간 밖으로 나가지 않는다
 *  I3. 월 블록 수 = monthSpan(start, end)
 *  I4. 노트 슬롯은 스프린트와 1:1, ID 유일
 *  I5. 마일스톤 날짜는 기간 안에 있다 (밖이면 flag 후 경계로 클립)
 *  I6. 지표 카탈로그 key 유일
 * ════════════════════════════════════════════════════════════════ */

import {
  addDays, addMonths, diffDays, monthSpan, isValidDate, fmtDate, parseISO,
} from './util.js';

export const AGENT_ROSTER = [
  { id: 'A0',  layer: 'L0 총괄', name: '연구총괄 오케스트레이터', en: 'Chief R&D Orchestrator', lead: true,
    role: '작업패킷 파이프라인 구동과 게이트 판정 집행. 재작업 3회 초과 시 사람에게 에스컬레이션.' },
  { id: 'A1',  layer: 'L1 기획', name: '과제기획관', en: 'Project Architect', lead: true,
    role: 'L1 리드. 업로드 문서에서 WP·KPI·일정·산출물을 추출해 project.json을 유지. 원문 모순은 보정하지 않고 기록. ProjectFrame 패킷 발신.' },
  { id: 'A2',  layer: 'L1 기획', name: '일정설계관', en: 'Sprint Planner',
    role: '연구기간을 스프린트·월 블록으로 분해하고 노트 슬롯을 생성.' },
  { id: 'A3',  layer: 'L1 기획', name: '자원·리스크 관리관', en: 'Resource & Risk Officer',
    role: '담당자 부하와 일정 임계경로 지연을 감시.' },
  { id: 'A4', layer: 'L1 기획', name: '지표설계관', en: 'KPI Architect',
    role: '지표 카탈로그의 유일한 편집자 — 지표별 단위·방향(높을수록/낮을수록)·목표·측정 프로토콜을 설계하고 metrics.json 카탈로그를 유지.' },
  { id: 'A5', layer: 'L1 기획', name: '규정·양식관', en: 'Compliance Profile Officer',
    role: '전자연구노트 규정 프로파일(필수 필드·서명 단계·페이지 규칙)을 관리해 G4 규정 검토관의 판정 기준을 공급.' },
  { id: 'A6',  layer: 'L2 수집', name: '수집·정규화 에이전트', en: 'Ingestion Normalizer',
    role: '업로드 파일 파싱, SHA-256 해시·메타데이터 추출. 원본 불변형.' },
  { id: 'A7',  layer: 'L2 수집', name: '시점 판별 에이전트', en: 'Temporal Resolver',
    role: '자료의 해당 기간을 추론하되, 반드시 사용자 확인을 받아 확정.' },
  { id: 'A8',  layer: 'L2 수집', name: '증거원장 관리관', en: 'Evidence Ledger Keeper', lead: true,
    role: 'L2 리드. 모든 사실 조각에 증거ID [E#] 부여·등재 — 원장의 유일한 편집자. EvidenceBundle 패킷 발신.' },
  { id: 'A9', layer: 'L2 수집', name: '문서판별관', en: 'Document Triage',
    role: '업로드 파일의 유형(계획서·일지·측정표·스캔본)과 품질을 판별해 알맞은 파서·추출 경로로 라우팅.' },
  { id: 'A10', layer: 'L2 수집', name: '표·수치 추출관', en: 'Table & Measurement Extractor',
    role: '표 구조와 측정값·단위를 정밀 추출하고 한국식 수 표현(억·천만·%)을 정규화. 값 변조 금지 — 원문 그대로.' },
  { id: 'A11', layer: 'L2 수집', name: '모순 감시관', en: 'Conflict Scout',
    role: '등재 전 증거의 중복·상충 후보를 탐지해 conflict_with/corroborates 연결을 제안. 판정은 사람의 몫.' },
  { id: 'A12',  layer: 'L3 집필', name: '연구노트 집필 에이전트', en: 'Research Note Writer', lead: true,
    role: 'L3 리드. 증거원장만 읽고 서술 — 모든 문장에 [E#] 부착, 증거 없으면 "해당 기간 증거 없음" 기재. DraftNote 패킷 발신.' },
  { id: 'A13',  layer: 'L3 집필', name: '데이터 구조화 에이전트', en: 'Data Structurer',
    role: '원본 수치를 지표 카탈로그에 매핑해 metrics 실측치로 누적.' },
  { id: 'A14',  layer: 'L3 집필', name: 'WP 정합성 에이전트', en: 'WP Alignment',
    role: '노트 내용을 WP·스프린트에 연결. 계획 외 활동은 별도 표기.' },
  { id: 'A15', layer: 'L3 집필', name: '섹션구성관', en: 'Note Outliner',
    role: '증거를 수행내용·결과데이터·해석 섹션에 배치 설계 — 날짜는 기간 검사, 측정은 카탈로그 매칭, 서술은 문장 요건 검사.' },
  { id: 'A16', layer: 'L3 집필', name: '문체·용어관', en: 'Style & Terminology Editor',
    role: '과거시제 사실 서술 문체와 용어 일관성 유지. LLM 다듬기 실행 시에도 인용 [E#] 불변·금지 표현 배제를 강제.' },
  { id: 'A17', layer: 'L3 집필', name: '인용무결성관', en: 'Citation Steward',
    role: '전 문장의 [E#] 부착·실재를 게이트 제출 전에 자가검사(G1 프리플라이트). 무인용 문장은 집필로 되돌린다.' },
  { id: 'A18', layer: 'L4 검증', name: '사실검증관 (G1)', en: 'Fact Verifier', lead: true,
    role: '모든 문장의 [E#] 실재·인용 일치를 대조. 미매핑 문장 적발 시 FAIL.' },
  { id: 'A19', layer: 'L4 검증', name: '종단 정합성 감사관 (G2)', en: 'Longitudinal Consistency Auditor',
    role: '확정된 과거 노트 전체와 대조해 수치 역전·상태 역행을 차단.' },
  { id: 'A20', layer: 'L4 검증', name: '수치·단위 감사관 (G3)', en: 'Numeric Auditor',
    role: '합계·비율 재계산, 단위 표기, 목표 대비 방향성 검사.' },
  { id: 'A21', layer: 'L4 검증', name: '규정 준수 검토관 (G4)', en: 'Compliance Reviewer',
    role: '전자연구노트 필수 요건(번호·기간·작성자·페이지·해시 등) 충족 확인.' },
  { id: 'A22', layer: 'L5 출력', name: '문서 생성 에이전트', en: 'Document Renderer', lead: true,
    role: '게이트 통과 노트를 정본 DOCX·실무 DOCX·데이터 XLSX로 렌더링.' },
  { id: 'A23', layer: 'L5 출력', name: '지표·시각화 에이전트', en: 'Metrics & Viz',
    role: '실측치를 목표와 대비해 대시보드 시계열 공급.' },
  { id: 'A24', layer: 'L6 기억', name: 'MATM 사서', en: 'Transactive Memory Librarian', lead: true,
    role: '누가 무엇을 아는지 디렉토리를 유지하고 인출 요청을 라우팅.' },
  { id: 'A25', layer: 'L6 기억', name: '감사추적 기록관', en: 'Audit Trail Keeper',
    role: '모든 게이트 판정·반려·확인 응답을 시각순 기록.' },
];

export const NOTE_REQUIRED_FIELDS = [
  '과제번호', '과제명', '연구노트번호', '작성기간', '작성자', '점검자',
  '작성일', '점검일', '페이지번호', 'WP연계', '수행내용', '결과데이터',
  '해석', '차기계획', '첨부원본목록', '증거ID', '수정이력', '해시',
];

/* ══════════════════════════════════════════════════════════
 * 진입점
 * ══════════════════════════════════════════════════════════ */

/**
 * @param {object} analysis  analyzer.analyzeDocuments 결과
 * @param {object} opts { today:'YYYY-MM-DD', cadence:'biweekly'|'weekly', orgName?, systemName? }
 * @returns {{config, project, planner, metrics, agents, flags}}
 */
export function generateSystem(analysis, opts = {}) {
  const flags = [...(analysis.flags || [])];
  const p = analysis.project || {};
  const today = isValidDate(opts.today) ? opts.today : fmtDate(new Date());
  const cadence = opts.cadence === 'weekly' ? 'weekly' : 'biweekly';

  /* ── 1. 기간 확정 ── */
  const period = resolvePeriod(p.period, today, flags);

  /* ── 2. 프로젝트 확정본 ── */
  const val = f => (p[f] && p[f].value !== undefined ? p[f].value : null);
  const conf = f => (p[f] ? p[f].confidence : 'none');
  const evs = f => (p[f] && p[f].ev ? p[f].ev : []);

  const orgName = opts.orgName || val('orgName') || '(기관명 미입력)';
  const title = opts.title || val('title') || '신규 연구 프로젝트';

  const project = {
    schema_version: '2.0',
    generated_at: today,
    title, title_confidence: conf('title'), title_ev: evs('title'),
    project_code: opts.projectCode || val('projectCode') || autoCode(today),
    agency: val('agency') || '',
    org_name: orgName,
    period,
    budget: val('budget') || null,
    people: (p.people || []).map(x => ({ name: x.name, role: x.role, ev: x.ev || [] })),
    work_packages: normalizeWPs(p.workPackages || [], period, flags),
    milestones: normalizeMilestones(p.milestones || [], period, flags),
    kpis: normalizeKpis(p.kpis || [], flags),
    deliverables: (p.deliverables || []).map(d => ({ name: d.name, ev: d.ev || [] })),
    keywords: p.keywords || [],
    domain: p.domain || 'general',
    source_flags: flags.map(f => ({ ...f })),
  };

  /* ── 3. 플래너: 스프린트 + 월 블록 + 노트 슬롯 ── */
  const planner = buildPlanner(project, cadence);

  /* ── 4. 지표 구조 ── */
  const metrics = {
    schema_version: '2.0',
    catalog: project.kpis.map(k => ({
      key: k.key, name: k.name, unit: k.unit, target: k.target,
      direction: k.direction, source: 'analyzer',
    })),
    actuals: [],   // {key, value, date, noteId, ev}
  };

  /* ── 5. 에이전트 인스턴스화 변수 ── */
  const agents = {
    roster: AGENT_ROSTER.map(a => ({ ...a })),
    variables: {
      PROJECT_TITLE: project.title,
      PROJECT_CODE: project.project_code,
      ORG_NAME: project.org_name,
      AGENCY: project.agency || '(해당 없음)',
      PERIOD_START: project.period.start,
      PERIOD_END: project.period.end,
      PERIOD_MONTHS: String(project.period.months),
      WP_LIST: project.work_packages.map(w => `${w.id} ${w.name}`).join('; ') || '(없음)',
      KPI_LIST: project.kpis.map(k => `${k.name}(${k.unit || '-'}, 목표 ${k.target ?? '-'})`).join('; ') || '(없음)',
      DOMAIN: project.domain,
    },
  };

  /* ── 6. 운영 설정 ── */
  const config = {
    schema_version: '2.0',
    system_name: opts.systemName || `${orgName} 연구노트 자동화 시스템`,
    product: 'AAA-RNS',
    app: {
      version: '2.0',
      author: 'Seung Ho Jung (S.H.JUNG)',
      author_ko: '정승호',
      released: '2026-08-12',
      description: 'AI Agent-driven Autonomous Research Notebook System — 일반화 에디션',
    },
    project_code: project.project_code,
    note: {
      default_cadence: cadence,
      allowed_cadence: ['biweekly', 'weekly'],
      output_formats: ['docx_official', 'docx_worklog', 'xlsx'],
      official_template_standard: '국가연구개발사업 연구노트 관리 지침 기반 전자연구노트 요건',
      required_fields: [...NOTE_REQUIRED_FIELDS],
      signature: { required: true, stages: ['contributor', 'final_approval'], seal_requires_final_signature: true },
    },
    factcheck: {
      policy: 'ZERO_HALLUCINATION',
      rule: '연구노트의 모든 서술 문장은 증거원장 증거ID [E#] 1개 이상에 매핑되어야 한다.',
      gates: ['G1_증거매핑', 'G2_과거노트정합성', 'G3_수치단위감사', 'G4_지침준수'],
      pass_condition: 'G1~G4 전부 PASS',
      on_fail: '_REVIEW/ 로 반려 + 반려사유서 생성',
    },
    gates: { mode_default: 'advisory' },
    paths: {
      project: 'data/project.json', planner: 'data/planner.json',
      notes_index: 'data/notes_index.json', metrics: 'data/metrics.json',
      users: 'data/users.json', notes_dir: 'notes', inbox: '_INBOX',
      review: '_REVIEW', matm: 'matm', exports: 'exports',
    },
    ui: { default_theme: 'institutional' },
  };

  return { config, project, planner, metrics, agents, flags };
}

/* ══════════════════════════════════════════════════════════
 * 기간 확정
 * ══════════════════════════════════════════════════════════ */
function resolvePeriod(periodField, today, flags) {
  const v = periodField && periodField.value ? periodField.value : {};
  let { start, end, months } = v;
  if (!isValidDate(start)) start = null;
  if (!isValidDate(end)) end = null;

  if (start && end && end > start) {
    return { start, end, months: monthSpan(start, end), source: 'extracted' };
  }
  if (start && Number.isFinite(months) && months >= 1) {
    const e = addDays(addMonths(start, Math.min(months, 120)), -1);
    return { start, end: e, months: Math.min(months, 120), source: 'start+months' };
  }
  // 시작일 미상 → 다음 달 1일
  const t = parseISO(today) || new Date();
  const nextMonth = fmtDate(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 1)));
  const m = Number.isFinite(months) && months >= 1 && months <= 120 ? Math.floor(months) : 24;
  const e = addDays(addMonths(nextMonth, m), -1);
  flags.push({
    field: '연구기간',
    issue: `기간이 확정되지 않아 ${nextMonth} 시작 ${m}개월로 가정했습니다.`,
    suggestion: '설정 > 과제 정보에서 실제 기간으로 수정하십시오.',
  });
  return { start: nextMonth, end: e, months: m, source: 'default' };
}

function autoCode(today) {
  return 'PRJ-' + today.slice(0, 4) + '-' + today.slice(5, 7) + today.slice(8, 10);
}

/* ══════════════════════════════════════════════════════════
 * WP · 마일스톤 · KPI 정규화
 * ══════════════════════════════════════════════════════════ */
function normalizeWPs(wps, period, flags) {
  const seen = new Set();
  const out = [];
  for (const w of wps) {
    const num = Number.isFinite(w.num) ? w.num : parseInt(String(w.id || '').replace(/\D/g, ''), 10);
    if (!Number.isFinite(num) || num < 1 || num > 99) continue;
    const id = 'WP' + num;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id, num,
      name: String(w.name || id).slice(0, 160),
      start: isValidDate(w.start) ? clampDate(w.start, period) : period.start,
      end: isValidDate(w.end) ? clampDate(w.end, period) : period.end,
      owner: w.owner || '',
      confidence: w.confidence || 'none',
      ev: w.ev || [],
    });
  }
  out.sort((a, b) => a.num - b.num);
  if (!out.length) {
    out.push(
      { id: 'WP1', num: 1, name: '연구 기획 및 설계', start: period.start, end: period.end, owner: '', confidence: 'none', ev: [] },
      { id: 'WP2', num: 2, name: '연구 수행 및 데이터 확보', start: period.start, end: period.end, owner: '', confidence: 'none', ev: [] },
      { id: 'WP3', num: 3, name: '결과 분석 및 정리', start: period.start, end: period.end, owner: '', confidence: 'none', ev: [] },
    );
  }
  return out;
}

function clampDate(d, period) {
  if (d < period.start) return period.start;
  if (d > period.end) return period.end;
  return d;
}

function normalizeMilestones(ms, period, flags) {
  const out = [];
  const seen = new Set();
  for (const m of ms) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    let date = null;
    if (Number.isFinite(m.month) && m.month >= 1) {
      if (m.month > period.months) {
        flags.push({ field: '마일스톤', issue: `${m.id}(${m.month}개월차)가 연구기간(${period.months}개월)을 벗어나 기간 말로 조정했습니다.`, suggestion: '설정에서 마일스톤 시점을 확인하십시오.' });
        date = period.end;
      } else {
        date = addDays(addMonths(period.start, m.month), -1); // 해당 월의 말일 경계
        if (!date || date > period.end) date = period.end;
      }
    }
    out.push({ id: m.id, name: String(m.name || m.id).slice(0, 120), month: m.month ?? null, date, ev: m.ev || [] });
  }
  return out.slice(0, 24);
}

function normalizeKpis(kpis, flags) {
  const seen = new Set();
  const out = [];
  for (const k of kpis) {
    const key = kpiKey(k.name, seen);
    seen.add(key);
    let target = k.target;
    if (typeof target === 'string') {
      const n = parseFloat(String(target).replace(/[^\d.\-]/g, ''));
      target = Number.isFinite(n) ? n : null;
    }
    if (target !== null && !Number.isFinite(target)) target = null;
    out.push({
      key, name: String(k.name).slice(0, 120), unit: String(k.unit || '').slice(0, 20),
      target, direction: k.direction === 'lower' ? 'lower' : 'higher',
      confidence: k.confidence || 'none', ev: k.ev || [],
    });
  }
  return out.slice(0, 60);
}

function kpiKey(name, seen) {
  let base = String(name || 'kpi').toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'kpi';
  let key = base, i = 2;
  while (seen.has(key)) key = base + '_' + (i++);
  return key;
}

/* ══════════════════════════════════════════════════════════
 * 플래너 생성 — 스프린트·월 블록·노트 슬롯
 * ══════════════════════════════════════════════════════════ */
export function buildPlanner(project, cadence = 'biweekly') {
  const { start, end, months } = project.period;
  const stepDays = cadence === 'weekly' ? 7 : 14;

  /* 스프린트: 기간 전체를 빈틈 없이 커버 (I1·I2) */
  const sprints = [];
  let cursor = start;
  let n = 0;
  const totalDays = diffDays(start, end) + 1;
  const maxSprints = Math.ceil(totalDays / stepDays) + 2; // 안전 상한
  while (cursor <= end && n < maxSprints) {
    n += 1;
    let sEnd = addDays(cursor, stepDays - 1);
    if (sEnd > end) sEnd = end;
    const id = 'S' + String(n).padStart(2, '0');
    sprints.push({
      id, seq: n, start: cursor, end: sEnd,
      activeWPs: project.work_packages
        .filter(w => !(w.end < cursor || w.start > sEnd))
        .map(w => w.id),
      noteSlot: 'RN-' + cursor.replace(/-/g, '') + '-' + sEnd.replace(/-/g, ''),
    });
    cursor = addDays(sEnd, 1);
  }

  /* 월 블록 (I3) */
  const monthBlocks = [];
  for (let i = 0; i < months; i++) {
    const mStart = addMonths(start, i);
    let mEnd = addDays(addMonths(start, i + 1), -1);
    if (mEnd > end) mEnd = end;
    if (mStart > end) break;
    monthBlocks.push({
      id: 'M' + (i + 1), seq: i + 1, start: mStart, end: mEnd,
      milestones: project.milestones.filter(m => m.month === i + 1).map(m => m.id),
    });
  }

  return {
    schema_version: '2.0',
    cadence, period: { start, end, months },
    sprints, months: monthBlocks,
    stats: { sprintCount: sprints.length, monthCount: monthBlocks.length },
  };
}

/* ══════════════════════════════════════════════════════════
 * 생성 결과 자가검증 — 시뮬레이션·온보딩 공용
 * ══════════════════════════════════════════════════════════ */
export function validateSystem(sys) {
  const errors = [];
  const { project, planner, metrics } = sys;

  if (!project || !planner || !metrics) return ['생성 결과 구조 결손'];

  const { start, end, months } = project.period || {};
  if (!isValidDate(start) || !isValidDate(end)) errors.push('기간 날짜 형식 오류');
  else {
    if (start > end) errors.push('기간 역전: ' + start + ' > ' + end);
    if (monthSpan(start, end) !== months) errors.push(`개월 수 불일치: 저장 ${months} ≠ 계산 ${monthSpan(start, end)}`);
  }

  // I1·I2: 스프린트 연속 커버
  const sp = planner.sprints || [];
  if (!sp.length) errors.push('스프린트 없음');
  else {
    if (sp[0].start !== start) errors.push('첫 스프린트가 기간 시작과 다름');
    if (sp[sp.length - 1].end !== end) errors.push('마지막 스프린트가 기간 종료와 다름');
    for (let i = 0; i < sp.length; i++) {
      const s = sp[i];
      if (s.start > s.end) errors.push(`${s.id} 시작>종료`);
      if (s.start < start || s.end > end) errors.push(`${s.id} 기간 이탈`);
      if (i > 0 && addDays(sp[i - 1].end, 1) !== s.start) errors.push(`${sp[i - 1].id}→${s.id} 사이 공백/중복`);
    }
    // I4: 슬롯 유일성
    const slots = new Set(sp.map(s => s.noteSlot));
    if (slots.size !== sp.length) errors.push('노트 슬롯 ID 중복');
    const ids = new Set(sp.map(s => s.id));
    if (ids.size !== sp.length) errors.push('스프린트 ID 중복');
  }

  // I3: 월 블록
  const mb = planner.months || [];
  if (isValidDate(start) && isValidDate(end) && mb.length !== monthSpan(start, end)) {
    errors.push(`월 블록 수 불일치: ${mb.length} ≠ ${monthSpan(start, end)}`);
  }

  // I5: 마일스톤 범위
  for (const m of project.milestones || []) {
    if (m.date && (m.date < start || m.date > end)) errors.push(`마일스톤 ${m.id} 기간 이탈: ${m.date}`);
  }

  // I6: 지표 key 유일
  const keys = (metrics.catalog || []).map(k => k.key);
  if (new Set(keys).size !== keys.length) errors.push('지표 key 중복');

  // WP 범위
  for (const w of project.work_packages || []) {
    if (w.start < start || w.end > end) errors.push(`${w.id} 기간 이탈`);
    if (w.start > w.end) errors.push(`${w.id} 시작>종료`);
  }

  return errors;
}
