/* ════════════════════════════════════════════════════════════════
 * AAA-RNS · core/gates.js
 * Developed by Seung Ho Jung · v2.0 · Apache-2.0 © 2026
 * 검증 게이트 — P 사전점검(결정론) + G1~G4 게이트(결정론 코어)
 *
 * 기존 AAA-RNS 의 P1~P10 결정론 점검과 G1~G4 게이트를
 * LLM 없이도 동작하는 결정론 코어로 일반화했다.
 * (LLM 엔진이 연결되면 G1·G2 의 의미론 검사를 보강할 수 있으나,
 *  기록 차단 권한은 항상 이 결정론 코어가 가진다.)
 *
 *  G1 증거매핑     — 모든 서술 문장에 실재하는 [E#], 금지 표현 차단
 *  G2 과거정합성   — 확정 노트와의 기간 중복·수치 모순·상태 역행 차단
 *  G3 수치단위감사 — 값 유형·단위·범위·방향성·달성 표기 검사
 *  G4 지침준수     — 전자연구노트 필수 요건 충족 확인
 *
 * 판정 모드:
 *  · advisory(기본): 지적이 있어도 저장 — 「보완하면 좋을 항목」으로 보존
 *  · strict: 지적 1건이라도 있으면 반려(_REVIEW)
 * ════════════════════════════════════════════════════════════════ */

import { splitSentences, isValidDate } from './util.js';
import { citationsIn, isNoEvidenceStatement } from './ledger.js';

/* 금지 표현 — 증거 없는 추정·과장 서술 (기존 P4 승계, 일반화 사전) */
/* 추정·과장 표현 차단.
 *
 * 언어별로 따로 적는다. 제품이 한국어·영어·일본어를 동등하게 지원하는데
 * 이 목록이 한국어뿐이면, G1 은 나머지 두 언어에서 아무 일도 하지 않으면서
 * "추정 표현을 막는다"고 문서에 적혀 있게 된다 — 실제로 그런 상태였다.
 *
 * 오탐을 피하려고 일부러 뺀 것들:
 *  · 영어 "significant(ly)" — 통계적 유의성이라는 정확한 뜻이 있어서,
 *    막으면 정상적인 과학 서술을 반려한다. 한국어 '현저히'와 다르다.
 *  · "about/around/approximately" 는 뒤에 숫자가 올 때만 근사 수치로 본다.
 *    "data about the sample" 은 근사 표현이 아니다.
 */
export const FORBIDDEN_PATTERNS = [
  /* ── 한국어 ── */
  { re: /보인다|보였다/,           why: '추정 표현' },
  { re: /예상된다|예상됨|전망된다/, why: '전망 표현' },
  { re: /성공적으로|괄목할|현저히|획기적/, why: '평가·과장 표현' },
  { re: /대략|대충|어림잡아/,       why: '모호한 수량 표현' },
  { re: /(?:^|[^가-힣])약\s*\d/,    why: '근사 수치 표현("약 N")' },
  { re: /추정된다|추정됨|짐작/,     why: '추정 표현' },
  { re: /아마도?|어쩌면/,           why: '불확실 표현' },
  { re: /것으로\s*판단(?:된다|됨)/, why: '주관 판단 표현' },

  /* ── English ── */
  { re: /\b(?:appears?|seems?|looks?\s+like)\b/i,          why: '추정 표현' },
  { re: /\b(?:expected|anticipated|projected)\s+to\b|\bwill\s+likely\b/i, why: '전망 표현' },
  { re: /\b(?:successfully|remarkabl\w+|dramatic\w*|impressive\w*)\b/i,   why: '평가·과장 표현' },
  { re: /\b(?:roughly|approximately|about|around)\s+\d/i,  why: '모호한 수량 표현' },
  { re: /\b(?:presumabl\w+|we\s+estimate|estimated\s+to\s+be)\b/i,        why: '추정 표현' },
  { re: /\b(?:maybe|perhaps|possibly|probably)\b/i,        why: '불확실 표현' },
  { re: /\bit\s+(?:is|was)\s+(?:judged|considered|believed)\b/i,          why: '주관 판단 표현' },

  /* ── 日本語 ── */
  { re: /と思われる|ように見える|模様である/,   why: '추정 표현' },
  { re: /と予想され|見込まれ|であろう/,         why: '전망 표현' },
  { re: /成功裏に|著しく|飛躍的|画期的/,        why: '평가·과장 표현' },
  { re: /(?:およそ|約|ほぼ)\s*\d/,              why: '모호한 수량 표현' },
  { re: /推定される|と推察/,                    why: '추정 표현' },
  { re: /おそらく|もしかすると/,                why: '불확실 표현' },
  { re: /と判断される|と考えられる/,            why: '주관 판단 표현' },
];

/* 달성 주장 표현 (한국어·영어·일본어). 부정 표현은 별도로 걸러낸다 —
   "미달성"을 달성 주장으로 오인하면 정상 기록이 반려되는 거짓 양성이 된다. */
const ACHIEVED_CLAIM = /달성|목표\s*충족|achiev|target\s*met|goal\s*met|達成/i;
const ACHIEVED_NEGATED = /미달성|미\s*달성|않음|못함|not\s*achiev|un-?achiev|未達成|未達/i;

export const GATE_NAMES = {
  G1: 'G1 증거매핑', G2: 'G2 과거노트정합성', G3: 'G3 수치단위감사', G4: 'G4 지침준수',
};

/* ══════════════════════════════════════════════════════════
 * 진입점
 * ══════════════════════════════════════════════════════════ */

/**
 * @param {object} note        notes.js 의 노트 객체
 * @param {object} ctx {
 *   ledger:        EvidenceLedger,
 *   sealedNotes:   과거 확정 노트 배열,
 *   metricsCatalog:[{key,name,unit,target,direction}],
 *   requiredFields:[...],   // config.note.required_fields
 *   mode:          'advisory'|'strict',
 *   expectedHash:  본문 해시(사전 계산; G4 해시 검사용)
 * }
 * @returns {{gates, allPass, violationCount, decision, mode}}
 */
export function runGates(note, ctx = {}) {
  const mode = ctx.mode === 'strict' ? 'strict' : 'advisory';
  const gates = [
    gateG1(note, ctx),
    gateG2(note, ctx),
    gateG3(note, ctx),
    gateG4(note, ctx),
  ];
  const violationCount = gates.reduce((n, g) => n + g.violations.length, 0);
  const allPass = gates.every(g => g.pass);
  const decision = allPass ? 'pass' : (mode === 'strict' ? 'rejected' : 'advisory');
  return { gates, allPass, violationCount, decision, mode };
}

function V(check, severity, location, issue, action, quote) {
  return {
    check, severity: severity === 'high' ? 'high' : 'normal',
    location: String(location || ''), issue: String(issue || ''),
    required_action: String(action || ''), quote: String(quote || '').slice(0, 200),
  };
}

/* ── 서술 항목 수집: 게이트가 검사할 (섹션, 텍스트, 증거) 목록 ── */
export function narrativeEntries(note) {
  const out = [];
  const secs = note && note.sections ? note.sections : {};
  for (const key of ['work', 'results', 'interpretation', 'next_plan']) {
    const arr = Array.isArray(secs[key]) ? secs[key] : [];
    arr.forEach((entry, i) => {
      if (entry && typeof entry.text === 'string' && entry.text.trim()) {
        out.push({ section: key, index: i, text: entry.text, evidence: entry.evidence || [] });
      }
    });
  }
  return out;
}

export function metricRows(note) {
  const secs = note && note.sections ? note.sections : {};
  return (Array.isArray(secs.metrics) ? secs.metrics : []).filter(r => r && r.metric);
}

/* ══════════════════════════════════════════════════════════
 * G1 — 증거매핑
 * ══════════════════════════════════════════════════════════ */
export function gateG1(note, ctx) {
  const violations = [];
  const ledger = ctx.ledger;
  const entries = narrativeEntries(note);

  for (const ent of entries) {
    const loc = `${sectionLabel(ent.section)} ${ent.index + 1}번 항목`;
    const sentences = splitSentences(ent.text);
    for (const sent of sentences) {
      if (isNoEvidenceStatement(sent)) continue;
      const cites = citationsIn(sent);
      if (!cites.length) {
        violations.push(V('G1-미매핑', 'high', loc,
          '증거ID [E#] 가 없는 서술 문장입니다. 무증거 무기재 원칙 위반.',
          '해당 문장의 근거 자료를 업로드해 증거로 등재하거나 문장을 삭제하십시오.', sent));
        continue;
      }
      for (const id of cites) {
        if (!ledger || !ledger.has(id)) {
          violations.push(V('G1-증거부재', 'high', loc,
            `인용된 ${id} 가 증거원장에 존재하지 않습니다.`,
            '증거ID 를 원장에 실재하는 ID로 수정하십시오.', sent));
        }
      }
      // 금지 표현
      for (const f of FORBIDDEN_PATTERNS) {
        if (f.re.test(sent)) {
          violations.push(V('G1-금지표현', 'normal', loc,
            `${f.why}이 포함되어 있습니다. 증거 기반 사실 서술만 허용됩니다.`,
            '측정값·관찰 사실로 바꾸어 기술하십시오.', sent));
          break;
        }
      }
    }
  }
  // 측정행 증거
  for (const [i, row] of metricRows(note).entries()) {
    const ev = Array.isArray(row.evidence) ? row.evidence : [];
    if (!ev.length) {
      violations.push(V('G1-측정증거없음', 'high', `결과데이터 ${i + 1}행`,
        `측정값 '${row.metric}' 에 증거가 연결되지 않았습니다.`,
        '측정 원본 자료를 업로드해 증거로 연결하십시오.', `${row.metric}=${row.value}`));
    } else {
      for (const id of ev) {
        if (!ctx.ledger || !ctx.ledger.has(id)) {
          violations.push(V('G1-증거부재', 'high', `결과데이터 ${i + 1}행`,
            `인용된 ${id} 가 증거원장에 존재하지 않습니다.`, '증거ID를 확인하십시오.', `${row.metric}=${row.value}`));
        }
      }
    }
  }
  return { gate: 'G1', name: GATE_NAMES.G1, pass: !violations.length, violations };
}

/* ══════════════════════════════════════════════════════════
 * G2 — 과거 노트 정합성
 * ══════════════════════════════════════════════════════════ */
export function gateG2(note, ctx) {
  const violations = [];
  const sealed = Array.isArray(ctx.sealedNotes) ? ctx.sealedNotes : [];
  const p = note && note.period ? note.period : {};

  for (const old of sealed) {
    if (!old || old.note_id === note.note_id) continue;
    const op = old.period || {};
    // 개정 계열은 기간 중복 검사 면제 (같은 기간을 다시 쓰는 것이 목적)
    const isRevisionChain = note.supersedes === old.note_id || old.supersedes === note.note_id;
    if (!isRevisionChain && isValidDate(p.start) && isValidDate(p.end) && isValidDate(op.start) && isValidDate(op.end)) {
      if (!(p.end < op.start || p.start > op.end)) {
        violations.push(V('G2-기간중복', 'high', '작성기간',
          `확정 노트 ${old.note_id} (${op.start}~${op.end}) 와 기간이 겹칩니다.`,
          '기간을 조정하거나, 같은 기간의 기존 노트에 개정판(-R#)을 발행하십시오.',
          `${p.start}~${p.end}`));
      }
    }
    if (note.note_id && old.note_id === note.note_id) {
      violations.push(V('G2-번호중복', 'high', '연구노트번호',
        `확정 노트와 동일한 노트번호입니다: ${note.note_id}`, '노트번호를 변경하십시오.', note.note_id));
    }
  }

  // 수치 모순: 같은 지표를 같은 날짜에 다른 값으로 기록 / 단조 지표 역행
  const myRows = metricRows(note);
  const catalog = new Map((ctx.metricsCatalog || []).map(k => [k.key, k]));
  const oldRowsByKey = new Map();
  for (const old of sealed) {
    for (const r of metricRows(old)) {
      const key = r.metric_key || r.metric;
      if (!oldRowsByKey.has(key)) oldRowsByKey.set(key, []);
      oldRowsByKey.get(key).push({ ...r, _period: old.period, _noteId: old.note_id });
    }
  }
  for (const [i, row] of myRows.entries()) {
    const key = row.metric_key || row.metric;
    const prevs = oldRowsByKey.get(key) || [];
    for (const prev of prevs) {
      const sameDate = prev._period && note.period && prev._period.end === note.period.end;
      if (sameDate && Number.isFinite(+prev.value) && Number.isFinite(+row.value) && +prev.value !== +row.value) {
        violations.push(V('G2-수치모순', 'high', `결과데이터 ${i + 1}행`,
          `지표 '${row.metric}' 이(가) 동일 시점에 확정 노트 ${prev._noteId} 의 값 ${prev.value} 과 다릅니다(현재 ${row.value}).`,
          '실제 값이 바뀐 것이라면 변경 근거 증거를 등재하고 조건(condition)에 사유를 기재하십시오.',
          `${row.metric}: ${prev.value} → ${row.value}`));
      }
      const cat = catalog.get(key);
      if (cat && cat.monotonic && prev._period && note.period && prev._period.end < note.period.start) {
        const worse = cat.direction === 'lower' ? +row.value > +prev.value : +row.value < +prev.value;
        if (Number.isFinite(+prev.value) && Number.isFinite(+row.value) && worse && !row.change_reason) {
          violations.push(V('G2-역행', 'normal', `결과데이터 ${i + 1}행`,
            `누적성 지표 '${row.metric}' 이(가) 과거 확정값(${prev.value})보다 후퇴했습니다(${row.value}).`,
            '역행 사유를 change_reason 에 기재하고 근거 증거를 연결하십시오.',
            `${prev.value} → ${row.value}`));
        }
      }
    }
  }
  return { gate: 'G2', name: GATE_NAMES.G2, pass: !violations.length, violations };
}

/* ══════════════════════════════════════════════════════════
 * G3 — 수치·단위 감사
 * ══════════════════════════════════════════════════════════ */
const COUNT_UNITS = /^(건|회|명|개|편|차|번)$/;

export function gateG3(note, ctx) {
  const violations = [];
  const catalog = new Map((ctx.metricsCatalog || []).map(k => [k.key, k]));

  for (const [i, row] of metricRows(note).entries()) {
    const loc = `결과데이터 ${i + 1}행`;
    const v = +row.value;
    if (row.value === '' || row.value === null || row.value === undefined || !Number.isFinite(v)) {
      violations.push(V('G3-값형식', 'high', loc,
        `지표 '${row.metric}' 의 값이 숫자가 아닙니다: '${row.value}'`,
        '측정값을 숫자로 기재하십시오.', String(row.value)));
      continue;
    }
    const unit = String(row.unit || '');
    if (unit === '%' && (v < 0 || v > 100)) {
      violations.push(V('G3-범위', 'high', loc,
        `백분율 값이 0~100 범위를 벗어났습니다: ${v}%`, '값 또는 단위를 확인하십시오.', `${row.metric}=${v}%`));
    }
    if (COUNT_UNITS.test(unit) && (!Number.isInteger(v) || v < 0)) {
      violations.push(V('G3-계수형식', 'normal', loc,
        `계수 단위(${unit}) 값은 0 이상의 정수여야 합니다: ${v}`, '값을 확인하십시오.', `${row.metric}=${v}${unit}`));
    }
    const cat = catalog.get(row.metric_key || row.metric);
    if (cat) {
      if (cat.unit && unit && cat.unit !== unit) {
        violations.push(V('G3-단위불일치', 'normal', loc,
          `지표 카탈로그 단위(${cat.unit})와 기재 단위(${unit})가 다릅니다.`,
          '단위를 카탈로그와 일치시키거나 변환 근거를 조건에 기재하십시오.', `${row.metric}: ${unit} vs ${cat.unit}`));
      }
      /* P8: 달성 표기 방향성 — 미달인데 '달성'이라 주장하는 거짓 성과 차단.
         구조화된 achieved 플래그뿐 아니라 측정조건에 자유 서술로 적은
         달성 주장도 잡는다. 감사자에게는 둘 다 똑같이 오도적이기 때문이다.
         '미달성/未達成/not achieved' 같은 부정 표현은 주장으로 보지 않는다. */
      if (Number.isFinite(+cat.target)) {
        const cond = String(row.condition || '');
        const claimsAchieved = row.achieved === true || (ACHIEVED_CLAIM.test(cond) && !ACHIEVED_NEGATED.test(cond));
        if (claimsAchieved) {
          const met = cat.direction === 'lower' ? v <= +cat.target : v >= +cat.target;
          if (!met) {
            violations.push(V('G3-달성표기오류', 'high', loc,
              `'달성'으로 표기되었으나 목표(${cat.direction === 'lower' ? '≤' : '≥'}${cat.target}${cat.unit || ''}) 미달입니다: ${v}`,
              '달성 표기를 제거하거나 값을 확인하십시오.', `${row.metric}=${v}${unit || ''} · ${cond}`));
          }
        }
      }
    }
  }

  // 본문 내 백분율 상식 검사 (문장 안의 nnn% > 100 인 순수 비율 언급)
  for (const ent of narrativeEntries(note)) {
    const m = String(ent.text).match(/(\d{3,})(?:\.\d+)?\s*%/);
    if (m && +m[1] > 200) {
      violations.push(V('G3-백분율의심', 'normal', sectionLabel(ent.section),
        `본문에 ${m[0]} 라는 비정상적으로 큰 백분율이 있습니다.`,
        '값이 맞다면 증가율 등 맥락을 명시하고, 오기라면 수정하십시오.', ent.text.slice(0, 120)));
    }
  }
  return { gate: 'G3', name: GATE_NAMES.G3, pass: !violations.length, violations };
}

/* ══════════════════════════════════════════════════════════
 * G4 — 지침 준수 (전자연구노트 필수 요건)
 * ══════════════════════════════════════════════════════════ */
export function gateG4(note, ctx) {
  const violations = [];
  const h = note && note.header ? note.header : {};
  const p = note && note.period ? note.period : {};

  const need = (cond, field, issue, action) => {
    if (!cond) violations.push(V('G4-' + field, 'high', field, issue, action, ''));
  };

  need(!!String(h.과제번호 || '').trim(), '과제번호', '과제번호가 없습니다.', '설정의 과제 정보를 확인하십시오.');
  need(!!String(h.과제명 || '').trim(), '과제명', '과제명이 없습니다.', '설정의 과제 정보를 확인하십시오.');
  need(!!String(note.note_id || '').trim(), '연구노트번호', '연구노트번호가 없습니다.', '노트 슬롯에서 생성하십시오.');
  need(isValidDate(p.start) && isValidDate(p.end) && p.start <= p.end, '작성기간',
    `작성기간이 유효하지 않습니다: ${p.start} ~ ${p.end}`, '기간을 확인하십시오.');
  need(!!String(h.작성자 || '').trim(), '작성자', '작성자가 없습니다.', '작성자를 지정하십시오.');
  need(!!String(h.점검자 || '').trim(), '점검자', '점검자가 없습니다.', '점검자를 지정하십시오.');
  need(isValidDate(h.작성일), '작성일', '작성일이 유효하지 않습니다.', '작성일을 확인하십시오.');

  // 자기 점검 금지 (기존 P6)
  if (h.작성자 && h.점검자 && String(h.작성자).trim() === String(h.점검자).trim()) {
    violations.push(V('G4-자기점검', 'high', '점검자',
      '작성자와 점검자가 동일합니다. 교차 점검 원칙 위반.',
      '다른 구성원을 점검자로 지정하십시오.', String(h.작성자)));
  }

  // 첨부 원본: 각 항목에 SHA-256
  const atts = Array.isArray(note.attachments) ? note.attachments : [];
  for (const [i, a] of atts.entries()) {
    if (!a || !a.sha256 || !/^[0-9a-f]{64}$/.test(a.sha256)) {
      violations.push(V('G4-첨부해시', 'high', `첨부 ${i + 1}`,
        `첨부 '${a && a.name || '?'}' 에 SHA-256 해시가 없습니다.`, '파일을 다시 업로드하십시오.', ''));
    }
  }

  // 인용된 원본이 첨부목록에 있는가 (기존 P10)
  const attNames = new Set(atts.map(a => a && a.name));
  if (ctx.ledger) {
    const cited = new Set();
    for (const ent of narrativeEntries(note)) citationsIn(ent.text).forEach(id => cited.add(id));
    for (const row of metricRows(note)) (row.evidence || []).forEach(id => cited.add(id));
    for (const id of cited) {
      const ev = ctx.ledger.get(id);
      // 연구자 직접 기록(researcher_statement)은 대응하는 원본 파일이
      // 존재하지 않으므로 첨부 요구 대상이 아니다.
      // (브라우저 UI 검증에서 발견된 결함 수정 — 사이클 7)
      if (ev && ev.kind === 'researcher_statement') continue;
      if (ev && ev.source_type === 'upload' && ev.source_file && !attNames.has(ev.source_file)) {
        violations.push(V('G4-첨부누락', 'normal', '첨부원본목록',
          `인용 증거 ${id} 의 원본 '${ev.source_file}' 이 첨부목록에 없습니다.`,
          '해당 원본을 첨부목록에 포함하십시오.', ev.source_file));
      }
    }
  }

  // 수정이력·해시
  need(Array.isArray(note.수정이력), '수정이력', '수정이력 필드가 없습니다.', '시스템 오류 — 노트를 다시 생성하십시오.');
  if (ctx.expectedHash) {
    need(note.content_sha256 === ctx.expectedHash, '해시',
      '본문 해시가 현재 내용과 일치하지 않습니다(변조 또는 저장 오류).',
      '노트를 다시 저장하십시오.');
  } else {
    need(!!note.content_sha256, '해시', '본문 해시가 없습니다.', '노트를 다시 저장하십시오.');
  }

  return { gate: 'G4', name: GATE_NAMES.G4, pass: !violations.length, violations };
}

/* ── 라벨 ── */
export function sectionLabel(key) {
  return ({
    goal: '기간 목표', work: '수행 내용', results: '결과 데이터', metrics: '결과 데이터',
    interpretation: '해석', next_plan: '차기 계획', attachments: '첨부 원본',
  })[key] || key;
}
