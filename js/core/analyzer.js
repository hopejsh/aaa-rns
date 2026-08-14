/* ════════════════════════════════════════════════════════════════
 * AAA-RNS · core/analyzer.js
 * Developed by Seung Ho Jung · v2.0 · Apache-2.0 © 2026
 * 문서 심층 분석기 — 업로드 문서(파싱 결과) → 프로젝트 모델
 *
 * 어떤 회사의 어떤 연구 문서든 받아 과제 구조를 추출한다:
 *   과제명·과제번호·기관·기간·예산·인력·WP·KPI·마일스톤·산출물
 *
 * 원칙 (기존 AAA-RNS의 A1 과제기획관 + A5 시점판별 원칙 승계):
 *  · 모든 추출값에는 증거(문서·위치·인용)가 붙는다
 *  · 확신이 낮은 값은 flags 로 표시해 사용자 확인을 요구한다
 *  · 임의 보정 금지 — 원문에 없는 것은 만들지 않는다
 *  · 절대 throw 하지 않는다 (손상 입력도 flags 로 보고)
 * ════════════════════════════════════════════════════════════════ */

import {
  normSpace, parseLooseDate, parseKoreanNumber, monthSpan,
  isValidDate, addMonths, fmtDate,
} from './util.js';
import { excelSerialToISO } from './parsers.js';

/* ══════════════════════════════════════════════════════════
 * 진입점
 * ══════════════════════════════════════════════════════════ */

/**
 * @param {ParsedDoc[]} docs  parsers.parseFile 결과 배열
 * @returns {{project, evidence, flags, stats}}
 */
export function analyzeDocuments(docs) {
  const ctx = new Ctx(docs || []);
  try {
    extractTitle(ctx);
    extractProjectCode(ctx);
    extractOrgs(ctx);
    extractPeriod(ctx);
    extractBudget(ctx);
    extractPeople(ctx);
    extractWorkPackages(ctx);
    extractKpis(ctx);
    extractMilestones(ctx);
    extractDeliverables(ctx);
    extractKeywords(ctx);
    applyDefaults(ctx);
  } catch (e) {
    ctx.flag('system', '분석 중 내부 오류: ' + (e && e.message ? e.message : e), '문서를 다시 업로드하거나 다른 형식으로 시도하십시오.');
  }
  return ctx.result();
}

/* ══════════════════════════════════════════════════════════
 * 분석 컨텍스트
 * ══════════════════════════════════════════════════════════ */
class Ctx {
  constructor(docs) {
    this.docs = docs.filter(d => d && d.ok);
    this.badDocs = docs.filter(d => d && !d.ok);
    this.evidence = [];       // {id, docName, loc, quote, sha256}
    this.flags = [];          // {field, issue, suggestion}
    this.p = {                // project model (값은 {value, confidence, ev:[]})
      title: null, projectCode: null, agency: null, orgName: null,
      period: null, budget: null,
      people: [], workPackages: [], kpis: [], milestones: [],
      deliverables: [], keywords: [], domain: null,
    };
    // 텍스트 라인 인덱스: [{doc, di, li, text}]
    this.lines = [];
    this.docs.forEach((d, di) => {
      const src = d.paragraphs && d.paragraphs.length ? d.paragraphs : String(d.text || '').split(/\n/);
      src.forEach((t, li) => {
        const s = normSpace(t);
        if (s) this.lines.push({ doc: d, di, li, text: s });
      });
    });
    // 표 통합: docx tables + xlsx/csv sheets → {doc, name, rows}
    this.tables = [];
    this.docs.forEach(d => {
      (d.tables || []).forEach((rows, ti) => this.tables.push({ doc: d, name: `표${ti + 1}`, rows }));
      (d.sheets || []).forEach(s => this.tables.push({ doc: d, name: s.name, rows: s.rows }));
    });
    this.badDocs.forEach(d => {
      this.flag('입력파일', `'${d.name}' 파싱 실패: ${(d.warnings || []).join('; ') || '알 수 없는 오류'}`,
        'PDF/DOCX/XLSX/HWPX/CSV/TXT 형식인지 확인하십시오. 이 파일은 첨부 원본으로만 보존됩니다.');
    });
    if (!this.docs.length) this.flag('입력파일', '분석 가능한 문서가 없습니다.', '연구계획서·제안서·일정표 등 텍스트가 있는 문서를 업로드하십시오.');
  }

  ev(doc, loc, quote) {
    const id = 'E' + (this.evidence.length + 1);
    this.evidence.push({
      id, docName: doc ? doc.name : '(기본값)', loc: String(loc || ''),
      quote: String(quote || '').slice(0, 300), sha256: doc ? doc.sha256 : '',
    });
    return id;
  }

  flag(field, issue, suggestion) {
    this.flags.push({ field, issue, suggestion: suggestion || '' });
  }

  set(field, value, confidence, evIds) {
    this.p[field] = { value, confidence, ev: evIds || [] };
  }

  result() {
    return {
      project: this.p,
      evidence: this.evidence,
      flags: this.flags,
      stats: {
        docsTotal: this.docs.length + this.badDocs.length,
        docsParsed: this.docs.length,
        lines: this.lines.length,
        tables: this.tables.length,
        evidenceCount: this.evidence.length,
      },
    };
  }
}

/* ══════════════════════════════════════════════════════════
 * 라벨-값 추출 공통기 — "라벨: 값" · "라벨 값" · 표의 인접 셀
 * ══════════════════════════════════════════════════════════ */
function findLabeled(ctx, labelRe, valueRe = null) {
  const hits = [];
  // 1) 본문 라인: "라벨 : 값" 또는 "라벨 값"
  for (const L of ctx.lines) {
    const m = L.text.match(labelRe);
    if (!m) continue;
    let rest = L.text.slice(m.index + m[0].length).replace(/^[\s:：·\-–|]+/, '').trim();
    if (valueRe) {
      const vm = rest.match(valueRe) || L.text.match(valueRe);
      if (vm) hits.push({ value: vm[1] !== undefined ? vm[1] : vm[0], doc: L.doc, loc: `문단${L.li + 1}`, quote: L.text, score: 2 });
    } else if (rest.length >= 2) {
      hits.push({ value: rest, doc: L.doc, loc: `문단${L.li + 1}`, quote: L.text, score: 2 });
    }
  }
  // 2) 표: 라벨 셀의 오른쪽/아래 셀
  for (const T of ctx.tables) {
    const rows = T.rows || [];
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cell = normSpace(row[c]);
        if (!cell || !labelRe.test(cell)) continue;
        const candidates = [row[c + 1], (rows[r + 1] || [])[c]];
        for (const cand of candidates) {
          const v = normSpace(cand);
          if (!v) continue;
          if (valueRe) {
            const vm = v.match(valueRe);
            if (vm) hits.push({ value: vm[1] !== undefined ? vm[1] : vm[0], doc: T.doc, loc: `${T.name}!R${r + 1}`, quote: `${cell} → ${v}`, score: 3 });
          } else {
            hits.push({ value: v, doc: T.doc, loc: `${T.name}!R${r + 1}`, quote: `${cell} → ${v}`, score: 3 });
          }
        }
      }
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits;
}

/* ══════════════════════════════════════════════════════════
 * 개별 추출기
 * ══════════════════════════════════════════════════════════ */

function extractTitle(ctx) {
  const hits = findLabeled(ctx, /(?:연구개발\s*과제명|과제명|사업명|프로젝트명|연구\s*제목|Project\s*Title)/i);
  const good = hits.find(h => h.value.length >= 4 && h.value.length <= 200 && !/^[\d.\-\s]+$/.test(h.value));
  if (good) {
    ctx.set('title', good.value, 'high', [ctx.ev(good.doc, good.loc, good.quote)]);
    return;
  }
  // 폴백 1: 문서 메타 title
  for (const d of ctx.docs) {
    if (d.meta && d.meta.title && d.meta.title.length >= 4) {
      ctx.set('title', d.meta.title, 'medium', [ctx.ev(d, '문서 메타데이터', d.meta.title)]);
      ctx.flag('과제명', '본문에서 과제명을 찾지 못해 문서 메타데이터 제목을 사용했습니다.', '설정에서 과제명을 확인·수정하십시오.');
      return;
    }
  }
  // 폴백 2: 첫 문서의 첫 유의미 문단
  const first = ctx.lines.find(L => L.text.length >= 8 && L.text.length <= 120);
  if (first) {
    ctx.set('title', first.text, 'low', [ctx.ev(first.doc, `문단${first.li + 1}`, first.text)]);
    ctx.flag('과제명', '과제명 라벨을 찾지 못해 첫 문단을 임시 사용했습니다.', '설정에서 과제명을 반드시 확인하십시오.');
  }
}

function extractProjectCode(ctx) {
  const labeled = findLabeled(ctx, /(?:과제\s*번호|공고\s*번호|협약\s*번호|과제코드|Project\s*(?:No|Number|Code))/i,
    /([A-Z]{1,6}[-_]?\d{2,4}[-_]?\d{2,}[-_A-Z0-9]*|\d{4}[-_]\d{3,}[-_A-Z0-9]*)/);
  if (labeled.length) {
    const h = labeled[0];
    ctx.set('projectCode', h.value, 'high', [ctx.ev(h.doc, h.loc, h.quote)]);
    return;
  }
  // 일반 스캔: RS-2026-25551575 류 패턴
  for (const L of ctx.lines) {
    const m = L.text.match(/\b([A-Z]{2,4}-\d{4}-\d{4,})\b/);
    if (m) {
      ctx.set('projectCode', m[1], 'medium', [ctx.ev(L.doc, `문단${L.li + 1}`, L.text)]);
      return;
    }
  }
  ctx.flag('과제번호', '과제번호를 찾지 못했습니다.', '설정에서 직접 입력하거나, 정부과제가 아니면 사내 관리번호를 부여하십시오.');
}

function extractOrgs(ctx) {
  const agency = findLabeled(ctx, /(?:전문기관|부처|주관\s*부처|발주처|지원기관|Funding\s*Agency)/i);
  const aGood = agency.find(h => h.value.length >= 2 && h.value.length <= 60);
  if (aGood) ctx.set('agency', aGood.value, 'high', [ctx.ev(aGood.doc, aGood.loc, aGood.quote)]);
  else {
    // 알려진 부처명 직접 스캔
    const AGENCIES = /(산업통상자원부|과학기술정보통신부|중소벤처기업부|보건복지부|교육부|환경부|해양수산부|농림축산식품부|국토교통부|방위사업청|식품의약품안전처|한국연구재단|한국산업기술기획평가원|한국산업기술진흥원|정보통신기획평가원)/;
    for (const L of ctx.lines) {
      const m = L.text.match(AGENCIES);
      if (m) { ctx.set('agency', m[1], 'medium', [ctx.ev(L.doc, `문단${L.li + 1}`, L.text)]); break; }
    }
  }
  const org = findLabeled(ctx, /(?:주관연구개발기관|주관기관|수행기관|주관\s*연구기관|기관명|회사명|Organization|Company)/i);
  const oGood = org.find(h => h.value.length >= 2 && h.value.length <= 60 && !/기관명|회사명/.test(h.value));
  if (oGood) ctx.set('orgName', oGood.value, 'high', [ctx.ev(oGood.doc, oGood.loc, oGood.quote)]);
  else ctx.flag('수행기관', '수행기관명을 찾지 못했습니다.', '설정에서 회사/기관명을 입력하십시오.');
}

const DATE_TOKEN = /(\d{4}\s*[.\-\/년]\s*\d{1,2}(?:\s*[.\-\/월]\s*\d{1,2})?\s*일?\.?)/;
const RANGE_RE = new RegExp(DATE_TOKEN.source + '\\s*[~∼–—-]\\s*' + DATE_TOKEN.source);

function extractPeriod(ctx) {
  const candidates = [];
  // 라벨 근처의 날짜 범위 우선
  for (const L of ctx.lines) {
    const m = L.text.match(RANGE_RE);
    if (!m) continue;
    const start = parseLooseDate(m[1]);
    let end = parseLooseDate(m[2]);
    if (!start || !end) continue;
    // "2026년 7월 ~ 2028년 12월" → 종료는 말일 보정
    if (/^\d{4}\s*[.\-\/년]\s*\d{1,2}\s*월?\.?$/.test(normSpace(m[2]))) {
      const next = addMonths(end, 1);
      if (next) { const d = new Date(next + 'T00:00:00Z'); d.setUTCDate(0); end = fmtDate(d); }
    }
    if (end <= start) continue;
    const labeled = /(?:연구개발\s*기간|수행\s*기간|사업\s*기간|연구\s*기간|총\s*기간|과제\s*기간)/.test(L.text);
    candidates.push({ start, end, doc: L.doc, loc: `문단${L.li + 1}`, quote: L.text, score: labeled ? 3 : 1 });
  }
  // 표 셀에서도 탐색
  for (const T of ctx.tables) {
    (T.rows || []).forEach((row, r) => (row || []).forEach(cell => {
      const m = normSpace(cell).match(RANGE_RE);
      if (!m) return;
      const start = parseLooseDate(m[1]), end = parseLooseDate(m[2]);
      if (start && end && end > start) {
        candidates.push({ start, end, doc: T.doc, loc: `${T.name}!R${r + 1}`, quote: normSpace(cell), score: 2 });
      }
    }));
  }
  if (candidates.length) {
    candidates.sort((a, b) => b.score - a.score || (monthSpan(a.start, a.end) < monthSpan(b.start, b.end) ? 1 : -1));
    const c = candidates[0];
    const months = monthSpan(c.start, c.end);
    ctx.set('period', { start: c.start, end: c.end, months }, c.score >= 3 ? 'high' : 'medium',
      [ctx.ev(c.doc, c.loc, c.quote)]);
    return;
  }
  // 개월 수만이라도
  for (const L of ctx.lines) {
    const m = L.text.match(/(?:기간|총)\D{0,10}(\d{1,3})\s*개월/);
    if (m) {
      const months = parseInt(m[1], 10);
      if (months >= 1 && months <= 120) {
        ctx.set('period', { start: null, end: null, months }, 'low', [ctx.ev(L.doc, `문단${L.li + 1}`, L.text)]);
        ctx.flag('연구기간', `기간 ${months}개월만 확인되고 시작·종료일을 찾지 못했습니다.`, '설정에서 시작일을 지정하십시오.');
        return;
      }
    }
  }
  ctx.flag('연구기간', '연구기간을 찾지 못했습니다.', '설정에서 시작일과 종료일을 지정하십시오. 미지정 시 다음 달 1일부터 24개월로 가정합니다.');
}

function extractBudget(ctx) {
  const hits = findLabeled(ctx, /(?:총\s*연구개발비|총\s*사업비|정부지원\s*연구개발비|총\s*예산|연구개발비|Total\s*Budget)/i,
    /([\d,.]+\s*(?:조|억|천만|백만|십만|만|천)?\s*원|[\d,]+(?:\.\d+)?)/);
  for (const h of hits) {
    const n = parseKoreanNumber(h.value);
    if (n !== null && n > 0) {
      ctx.set('budget', { total: n, display: h.value.trim() }, 'medium', [ctx.ev(h.doc, h.loc, h.quote)]);
      return;
    }
  }
}

const KOREAN_NAME = /([가-힣]{2,4})/;
function extractPeople(ctx) {
  const people = [];
  const seen = new Set();
  const push = (name, role, doc, loc, quote, conf) => {
    const key = name + '|' + role;
    if (seen.has(key) || name.length < 2) return;
    // 흔한 비인명 어휘 배제
    if (/^(과제|연구|책임|담당|소속|성명|이름|기관|참여|구분|합계|내용)$/.test(name)) return;
    seen.add(key);
    people.push({ name, role, confidence: conf, ev: [ctx.ev(doc, loc, quote)] });
  };
  const ROLE_RE = /(연구\s*책임자|총괄\s*책임자|과제\s*책임자|연구개발과제책임자|참여\s*연구원|연구원|책임연구원|선임연구원|PI|Principal\s*Investigator)/;
  for (const L of ctx.lines) {
    const rm = L.text.match(ROLE_RE);
    if (!rm) continue;
    const after = L.text.slice(rm.index + rm[0].length).replace(/^[\s:：·\-|()]+/, '');
    const nm = after.match(KOREAN_NAME);
    if (nm) push(nm[1], normSpace(rm[1]), L.doc, `문단${L.li + 1}`, L.text, 'medium');
  }
  // 표 기반: 헤더에 성명/이름 열이 있는 표
  for (const T of ctx.tables) {
    const rows = T.rows || [];
    if (!rows.length) continue;
    const header = (rows[0] || []).map(c => normSpace(c));
    const nameCol = header.findIndex(h => /성명|이름|Name/i.test(h));
    const roleCol = header.findIndex(h => /역할|구분|직위|담당|Role/i.test(h));
    if (nameCol < 0) continue;
    for (let r = 1; r < Math.min(rows.length, 200); r++) {
      const name = normSpace((rows[r] || [])[nameCol]);
      const role = roleCol >= 0 ? normSpace((rows[r] || [])[roleCol]) : '참여연구원';
      const nm = name.match(/^[가-힣]{2,4}$/);
      if (nm) push(name, role || '참여연구원', T.doc, `${T.name}!R${r + 1}`, `${name} / ${role}`, 'high');
    }
  }
  ctx.p.people = people.slice(0, 100);
  if (!people.length) ctx.flag('연구인력', '연구책임자·참여연구원을 찾지 못했습니다.', '설정 > 사용자 관리에서 직접 추가하십시오.');
}

function extractWorkPackages(ctx) {
  const wps = [];
  const seen = new Set();
  const push = (num, name, doc, loc, quote, conf) => {
    const id = 'WP' + num;
    if (seen.has(id)) return;
    if (!name || name.length < 2) return;
    seen.add(id);
    wps.push({ id, num, name: name.slice(0, 160), confidence: conf, ev: [ctx.ev(doc, loc, quote)] });
  };
  // 1) 명시적 WP 표기
  for (const L of ctx.lines) {
    const m = L.text.match(/\bWP\s*[-.]?\s*(\d{1,2})\s*[:.．)\]〕】\-–]?\s*(.+)/i);
    if (m && +m[1] >= 1 && +m[1] <= 40) push(+m[1], normSpace(m[2]), L.doc, `문단${L.li + 1}`, L.text, 'high');
  }
  // 2) 표에서 WP 열 탐지
  for (const T of ctx.tables) {
    const rows = T.rows || [];
    if (rows.length < 2) continue;
    const header = (rows[0] || []).map(c => normSpace(c));
    const wpCol = header.findIndex(h => /^WP$|워크패키지|세부과제|작업패키지/i.test(h));
    const nameCol = header.findIndex(h => /명칭|과제명|내용|업무|Task|이름/i.test(h));
    if (wpCol < 0) continue;
    for (let r = 1; r < Math.min(rows.length, 300); r++) {
      const cell = normSpace((rows[r] || [])[wpCol]);
      const m = cell.match(/(?:WP\s*[-.]?\s*)?(\d{1,2})/i);
      if (!m) continue;
      const name = nameCol >= 0 ? normSpace((rows[r] || [])[nameCol]) : cell.replace(/WP\s*\d+\s*/i, '');
      if (+m[1] >= 1 && +m[1] <= 40) push(+m[1], name || cell, T.doc, `${T.name}!R${r + 1}`, cell + (name ? ' / ' + name : ''), 'high');
    }
  }
  // 3) 세부과제 표기 (제1세부, 1세부과제)
  if (!wps.length) {
    for (const L of ctx.lines) {
      const m = L.text.match(/제?\s*(\d{1,2})\s*세부(?:과제)?\s*[:.\-–)\]]?\s*(.{2,120})/);
      if (m) push(+m[1], normSpace(m[2]), L.doc, `문단${L.li + 1}`, L.text, 'medium');
    }
  }
  // 4) "연구내용/추진내용" 섹션의 번호 목록
  if (!wps.length) {
    let inSection = false, count = 0;
    for (const L of ctx.lines) {
      if (/(연구개발\s*내용|연구\s*내용|추진\s*내용|주요\s*연구|수행\s*내용)/.test(L.text)) { inSection = true; count = 0; continue; }
      if (inSection) {
        const m = L.text.match(/^[○●◦·\-–]?\s*(\d{1,2})[.)]\s*(.{4,120})$/);
        if (m && +m[1] === count + 1) { count = +m[1]; push(count, normSpace(m[2]), L.doc, `문단${L.li + 1}`, L.text, 'low'); }
        else if (count >= 2 && L.text.length > 4 && !m) inSection = false;
      }
    }
  }
  wps.sort((a, b) => a.num - b.num);
  ctx.p.workPackages = wps.slice(0, 40);
  if (!wps.length) {
    ctx.flag('WP', '워크패키지(세부과제)를 찾지 못했습니다.',
      '기본 WP 3개(기획·수행·정리)로 시작하며, 설정에서 실제 구조로 수정할 수 있습니다.');
  }
}

const UNIT_RE = /^(%|점|건|회|배|개|명|초|ms|s|분|시간|일|kg|g|mg|㎍|L|mL|㎖|ppm|GHz|MHz|Mbps|Gbps|TOPS|FLOPS|AUROC|AUC|F1|dB|℃|°C|mm|cm|m|㎛|nm|원|억원|백만원|건\/년|편|%p)$/i;
const LOWER_BETTER = /(오류|에러|error|손실|loss|지연|latency|시간|비용|cost|결함|불량|brier|rmse|mae|편차|소비|전력)/i;

function extractKpis(ctx) {
  const kpis = [];
  const seen = new Set();
  const push = (name, unit, target, doc, loc, quote, conf, dirHint) => {
    const key = normSpace(name).toLowerCase();
    if (!key || key.length < 2 || seen.has(key)) return;
    seen.add(key);
    kpis.push({
      id: 'K' + (kpis.length + 1),
      name: normSpace(name).slice(0, 120),
      unit: unit ? normSpace(unit).slice(0, 20) : '',
      target: target,
      // 방향: 원문의 '이상/이하' 표기가 이름 추정보다 우선한다
      direction: dirHint || (LOWER_BETTER.test(name) ? 'lower' : 'higher'),
      confidence: conf,
      ev: [ctx.ev(doc, loc, quote)],
    });
  };
  // 목표 셀 수치화: "92% 이상" · "151ms 이하" · "5건 이상" 처럼
  // 단위가 인라인으로 붙은 표기에서도 수치와 단위를 분리한다.
  // (시뮬레이션 사이클 3에서 발견된 결함 수정)
  const parseTargetCell = (raw) => {
    const cleaned = raw.replace(/(이상|이하|초과|미만|↑|↓)/g, '').trim();
    let target = parseKoreanNumber(cleaned);
    let inlineUnit = '';
    if (target === null) {
      const nm = cleaned.match(/-?\d[\d,]*(?:\.\d+)?/);
      if (nm) {
        const n = parseFloat(nm[0].replace(/,/g, ''));
        if (Number.isFinite(n)) {
          target = n;
          inlineUnit = normSpace(cleaned.slice(nm.index + nm[0].length)).slice(0, 10);
        }
      }
    } else if (/%\s*$/.test(cleaned)) {
      inlineUnit = '%';
    }
    const dirHint = /이하|미만/.test(raw) ? 'lower' : /이상|초과/.test(raw) ? 'higher' : null;
    return { target, inlineUnit, dirHint };
  };
  // 표 기반이 가장 신뢰도 높음: 헤더에 지표/단위/목표 조합
  for (const T of ctx.tables) {
    const rows = T.rows || [];
    if (rows.length < 2) continue;
    // 헤더 행 탐색(상위 3행 안에서)
    let hRow = -1, cols = null;
    for (let r = 0; r < Math.min(3, rows.length); r++) {
      const h = (rows[r] || []).map(c => normSpace(c));
      const nameCol = h.findIndex(x => /(성능\s*지표|평가\s*지표|지표명?|평가\s*항목|항목명?|KPI)/i.test(x));
      const targetCol = h.findIndex(x => /(목표치?|목표값|달성\s*목표|최종\s*목표|Target)/i.test(x));
      if (nameCol >= 0 && targetCol >= 0) {
        const unitCol = h.findIndex(x => /^단위$|Unit/i.test(x));
        hRow = r; cols = { nameCol, targetCol, unitCol };
        break;
      }
    }
    if (hRow < 0) continue;
    for (let r = hRow + 1; r < Math.min(rows.length, 200); r++) {
      const row = rows[r] || [];
      const name = normSpace(row[cols.nameCol]);
      const rawTarget = normSpace(row[cols.targetCol]);
      if (!name || !rawTarget) continue;
      if (/합계|소계|비고/.test(name)) continue;
      const { target, inlineUnit, dirHint } = parseTargetCell(rawTarget);
      const unit = cols.unitCol >= 0 ? normSpace(row[cols.unitCol]) : inlineUnit;
      push(name, unit, target !== null ? target : rawTarget, T.doc, `${T.name}!R${r + 1}`,
        `${name} / 목표 ${rawTarget}`, 'high', dirHint);
    }
  }
  // 본문 기반: "지표명 목표 90% 이상" 류
  for (const L of ctx.lines) {
    const m = L.text.match(/([가-힣A-Za-z0-9()\s]{2,40}?)\s*(?:목표|달성치|기준)\s*[:：]?\s*([\d,.]+)\s*(%|점|건|회|초|ms|[가-힣]{0,3})\s*(이상|이하)?/);
    if (m) {
      const t = parseKoreanNumber(m[2]);
      if (t !== null) push(m[1], m[3], t, L.doc, `문단${L.li + 1}`, L.text, 'medium');
    }
  }
  ctx.p.kpis = kpis.slice(0, 60);
  if (!kpis.length) ctx.flag('성능지표', '성능지표(KPI)를 찾지 못했습니다.', '지표는 설정 > 지표 관리에서 추가할 수 있습니다. 지표 없이도 연구노트 작성은 가능합니다.');
}

function extractMilestones(ctx) {
  const ms = [];
  const seen = new Set();
  for (const L of ctx.lines) {
    // "M6", "M18" 마일스톤 표기 또는 "1단계 평가", "연차 평가"
    let m = L.text.match(/(?:마일스톤|Milestone)\s*[:：]?\s*M?(\d{1,3})\s*[:.\-–]?\s*(.{0,100})/i);
    if (!m) m = L.text.match(/\bM(\d{1,3})\s*(?:마일스톤|평가|점검)\s*[:.\-–]?\s*(.{0,100})/);
    if (m) {
      const month = parseInt(m[1], 10);
      if (month >= 1 && month <= 120 && !seen.has('M' + month)) {
        seen.add('M' + month);
        ms.push({ id: 'M' + month, month, name: normSpace(m[2]) || `M${month} 마일스톤`, ev: [ctx.ev(L.doc, `문단${L.li + 1}`, L.text)] });
      }
      continue;
    }
    const step = L.text.match(/(\d)\s*단계\s*(평가|완료|목표)\s*[:.\-–]?\s*(.{0,80})/);
    if (step && !seen.has('단계' + step[1])) {
      seen.add('단계' + step[1]);
      ms.push({ id: 'S' + step[1], month: null, name: normSpace(`${step[1]}단계 ${step[2]} ${step[3]}`), ev: [ctx.ev(L.doc, `문단${L.li + 1}`, L.text)] });
    }
  }
  ms.sort((a, b) => (a.month || 999) - (b.month || 999));
  ctx.p.milestones = ms.slice(0, 20);
}

function extractDeliverables(ctx) {
  const out = [];
  const seen = new Set();
  let inSection = false;
  for (const L of ctx.lines) {
    if (/(주요\s*)?(산출물|결과물|Deliverables?)\s*(목록|리스트)?\s*[:：]?\s*$/.test(L.text) ||
        /^(산출물|결과물)$/.test(L.text)) { inSection = true; continue; }
    if (inSection) {
      const m = L.text.match(/^[○●◦·\-–—\d.)\s]*(.{3,120})$/);
      if (m && L.text.length <= 140) {
        const name = normSpace(m[1]);
        if (!seen.has(name) && !/^(구분|번호|비고)/.test(name)) {
          seen.add(name);
          out.push({ name, ev: [ctx.ev(L.doc, `문단${L.li + 1}`, L.text)] });
        }
        if (out.length >= 30) break;
      } else inSection = false;
    }
    // 인라인: "산출물: X, Y, Z"
    const inline = L.text.match(/(?:산출물|결과물)\s*[:：]\s*(.{3,200})/);
    if (inline) {
      inline[1].split(/[,、·]/).map(normSpace).filter(s => s.length >= 2).forEach(name => {
        if (!seen.has(name) && out.length < 30) { seen.add(name); out.push({ name, ev: [ctx.ev(L.doc, `문단${L.li + 1}`, L.text)] }); }
      });
    }
  }
  ctx.p.deliverables = out;
}

const STOPWORDS = new Set([
  '연구', '개발', '과제', '사업', '기술', '시스템', '수행', '결과', '내용', '목표', '계획',
  '통해', '위한', '위해', '대한', '있는', '있다', '한다', '된다', '하는', '되는', '경우',
  '이상', '이하', '기반', '관련', '주요', '단계', '기간', '방법', '활용', '제시', '구축',
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'are', 'was', 'were',
]);

function extractKeywords(ctx) {
  const freq = new Map();
  const explicit = findLabeled(ctx, /(?:키워드|중심어|Keywords?)/i);
  if (explicit.length) {
    const kws = explicit[0].value.split(/[,、;·]/).map(normSpace).filter(s => s.length >= 2).slice(0, 12);
    if (kws.length >= 2) {
      ctx.p.keywords = kws;
      guessDomain(ctx, kws.join(' '));
      return;
    }
  }
  for (const L of ctx.lines.slice(0, 4000)) {
    const words = L.text.match(/[가-힣]{2,8}|[A-Za-z]{3,20}/g) || [];
    for (const w of words) {
      const k = w.toLowerCase();
      if (STOPWORDS.has(k) || STOPWORDS.has(w)) continue;
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  const top = [...freq.entries()].filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w);
  ctx.p.keywords = top;
  guessDomain(ctx, top.join(' ') + ' ' + ctx.lines.slice(0, 200).map(L => L.text).join(' '));
}

const DOMAINS = [
  ['bio', /(미생물|균주|세포|유전자|단백질|임상|바이오|의약|신약|항체|백신|프로바이오틱스|장내|생물)/],
  ['ai', /(인공지능|머신러닝|딥러닝|AI|신경망|학습모델|LLM|알고리즘|데이터셋)/i],
  ['materials', /(소재|재료|화합물|촉매|고분자|나노|반도체|박막|코팅)/],
  ['energy', /(에너지|배터리|전지|수소|태양광|풍력|전력|충전)/],
  ['manufacturing', /(제조|공정|생산|설비|가공|금형|로봇|자동화)/],
  ['ict', /(통신|네트워크|보안|클라우드|플랫폼|소프트웨어|SW|IoT|센서)/i],
];
function guessDomain(ctx, text) {
  let best = null, bestN = 0;
  for (const [name, re] of DOMAINS) {
    const n = (text.match(new RegExp(re.source, re.flags.replace('g', '') + 'g')) || []).length;
    if (n > bestN) { best = name; bestN = n; }
  }
  ctx.p.domain = bestN >= 2 ? best : 'general';
}

/* ══════════════════════════════════════════════════════════
 * 기본값 적용 — 빠진 필수 필드를 안전한 가정으로 채우고 flag
 * ══════════════════════════════════════════════════════════ */
function applyDefaults(ctx) {
  const p = ctx.p;
  if (!p.title) {
    ctx.set('title', '신규 연구 프로젝트', 'none', [ctx.ev(null, '', '기본값')]);
    ctx.flag('과제명', '과제명이 없어 임시 이름을 부여했습니다.', '설정에서 과제명을 입력하십시오.');
  }
  // 기간: 시작 or 종료 결손 보정
  if (!p.period || !p.period.value.start || !p.period.value.end) {
    const months = p.period && p.period.value.months ? p.period.value.months : 24;
    // 결정성: 문서 메타의 created 우선, 없으면 '다음 달 1일' (호출측에서 today 주입 가능하도록 여기선 표식만)
    const start = p.period && p.period.value.start ? p.period.value.start : null;
    ctx.set('period', { start, end: null, months, needsStart: !start }, p.period ? p.period.confidence : 'none',
      p.period ? p.period.ev : [ctx.ev(null, '', '기본값 ' + months + '개월')]);
  } else {
    const v = p.period.value;
    if (isValidDate(v.start) && isValidDate(v.end) && v.start >= v.end) {
      ctx.flag('연구기간', `추출된 기간이 비정상입니다(시작 ${v.start} ≥ 종료 ${v.end}).`, '설정에서 기간을 수정하십시오.');
      ctx.set('period', { start: v.start, end: null, months: 24, needsStart: false }, 'low', p.period.ev);
    }
  }
  if (!p.workPackages.length) {
    p.workPackages = [
      { id: 'WP1', num: 1, name: '연구 기획 및 설계', confidence: 'none', ev: [] },
      { id: 'WP2', num: 2, name: '연구 수행 및 데이터 확보', confidence: 'none', ev: [] },
      { id: 'WP3', num: 3, name: '결과 분석 및 정리', confidence: 'none', ev: [] },
    ];
  }
}

/* ══════════════════════════════════════════════════════════
 * 표 날짜 도우미 (일정표 셀에 Excel 시리얼이 온 경우)
 * ══════════════════════════════════════════════════════════ */
export function cellToDate(v) {
  const s = normSpace(v);
  const iso = parseLooseDate(s);
  if (iso) return iso;
  const n = parseFloat(s);
  if (Number.isFinite(n)) return excelSerialToISO(n);
  return null;
}
