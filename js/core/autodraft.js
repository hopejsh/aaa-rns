/* ════════════════════════════════════════════════════════════════
 * AAA-RNS · core/autodraft.js
 * Developed by Seung Ho Jung · v2.0 · Apache-2.0 © 2026
 * 자동 초안 엔진 — A12 집필 에이전트의 결정론 구현
 *
 * 업로드 파일에서 등재된 증거만으로 연구노트 초안을 자동 작성한다.
 * LLM 없이 동작하며, "거짓을 쓸 수 없는 시스템" 원칙을 그대로 따른다:
 *
 *   · 문장은 증거 원문에서만 나온다 — 창작·요약·추정 없음
 *   · 모든 초안 문장은 [E#] 인용을 갖고 나온다 (G1 통과 형태)
 *   · 금지 표현이 포함된 원문은 초안에서 제외한다 (증거로는 유지)
 *   · 노트 기간 밖의 날짜가 명시된 기록은 제외한다 (G2 보호)
 *   · 해석은 측정값·목표의 산술 비교 사실만 서술한다 — 달성 판정 없음
 *
 * 한계(정직한 고지): 결정론 엔진은 원문을 재배열할 뿐 문장을 새로
 * 쓰지 못한다. 자연스러운 서술 생성은 LLM 엔진 연동 시 A12 프롬프트
 * (agents/prompts/A12_*.md)가 담당하며, 그 경우에도 게이트가 결과를
 * 다시 검증한다.
 * ════════════════════════════════════════════════════════════════ */

import { FORBIDDEN_PATTERNS } from './gates.js';
import { isValidDate, normSpace } from './util.js';

/* 증거 후보 추출 — 노트 편집기와 자동 초안이 공유하는 단일 구현 */
export function extractCandidates(doc, max = 80) {
  const lines = (doc.paragraphs && doc.paragraphs.length ? doc.paragraphs : String(doc.text || '').split('\n'))
    .map(normSpace).filter(Boolean);
  const cands = [];
  for (const [i, ln] of lines.entries()) {
    if (cands.length >= max) break;
    if (ln.length < 6) continue;
    const isMeasure = /\d+(\.\d+)?\s*(%|점|건|회|초|ms|kg|mg|℃|°C|mm|명|개)/.test(ln);
    cands.push({ idx: i, text: ln.slice(0, 200), kind: isMeasure ? 'measurement' : 'statement' });
  }
  cands.sort((a, b) => (b.kind === 'measurement') - (a.kind === 'measurement'));
  return cands;
}

/* 파싱된 문서의 모든 후보를 증거원장에 일괄 등재 */
export function autoRegisterEvidence(ledger, doc, user, max = 60, lang = 'ko') {
  const out = [];
  const G = gen(lang);
  for (const cd of extractCandidates(doc).slice(0, max)) {
    out.push(ledger.add({
      kind: cd.kind, sourceType: 'upload', sourceFile: doc.name,
      locator: G.locator(cd.idx + 1), content: cd.text, sha256: doc.sha256, addedBy: user,
    }));
  }
  return out;
}


/* ── 시스템이 '생성'하는 기록 문장의 언어 틀 ───────────────────────
 * 원칙: 증거에서 인용한 문장(수행 내용)은 원문 그대로 둔다 — 번역하면
 * 기록의 원본성이 깨진다. 반면 해석·측정조건·증거 위치처럼 시스템이
 * 직접 작문하는 문장은 사용자의 작업 언어로 생성한다.
 * 표시 시점에 번역하지 않고 '생성 시점'에 확정하는 이유: 확정된 기록은
 * 해시로 봉인되므로, 나중에 화면에서 바꾸면 원문과 어긋나기 때문이다.
 * ──────────────────────────────────────────────────────────── */
const GEN = {
  ko: {
    lower: (n, v, t, e) => `지표 '${n}' 측정값은 ${v}, 목표는 ${t} 이하이다 [${e}].`,
    ratio: (n, v, t, r, e) => `지표 '${n}' 측정값 ${v} 은 목표 ${t} 의 ${r}% 수준이다 [${e}].`,
    plain: (n, v, t, e) => `지표 '${n}' 측정값은 ${v}, 목표는 ${t} 이다 [${e}].`,
    condition: d => `${d} 측정`,
    locator: i => `문단 ${i}`,
  },
  en: {
    lower: (n, v, t, e) => `Metric '${n}' measured ${v}; the target is ${t} or lower [${e}].`,
    ratio: (n, v, t, r, e) => `Metric '${n}' measured ${v}, which is ${r}% of the ${t} target [${e}].`,
    plain: (n, v, t, e) => `Metric '${n}' measured ${v}; the target is ${t} [${e}].`,
    condition: d => `Measured ${d}`,
    locator: i => `Paragraph ${i}`,
  },
  ja: {
    lower: (n, v, t, e) => `指標「${n}」の測定値は ${v}、目標は ${t} 以下です [${e}]。`,
    ratio: (n, v, t, r, e) => `指標「${n}」の測定値 ${v} は、目標 ${t} の ${r}% の水準です [${e}]。`,
    plain: (n, v, t, e) => `指標「${n}」の測定値は ${v}、目標は ${t} です [${e}]。`,
    condition: d => `${d} 測定`,
    locator: i => `段落${i}`,
  },
};
const gen = lang => GEN[lang] || GEN.ko;

const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})\s*[—–\-:,.]?\s*/;
const SENTENCE_END = /(다|료|음|됨)\.?$/;
const ESC_RE = /[.*+?^${}()|[\]\\]/g;

/**
 * 증거 항목들로부터 노트 초안을 만든다.
 * @param {object} p { note, entries, metricsCatalog }
 *   entries: EvidenceLedger.add 가 반환한 항목 배열 (이번 초안의 재료)
 * @returns {{ work, metrics, interpretation, stats }}
 */
export function buildAutoDraft({ note, entries = [], metricsCatalog = [], lang = 'ko' }) {
  const G = gen(lang);
  const period = (note && note.period) || {};
  const wp = (note && note.wp_refs && note.wp_refs[0]) || '';
  const inPeriod = d => !isValidDate(d) || !isValidDate(period.start) || !isValidDate(period.end)
    || (d >= period.start && d <= period.end);

  const work = [], rows = [], interpretation = [];
  const stats = { skippedForbidden: 0, skippedOffPeriod: 0, skippedNonSentence: 0 };
  const seenSent = new Set(), seenRow = new Set();

  const pushRow = (cat, v, date, condition, id) => {
    const rk = cat.key + '|' + v + '|' + (date || '');
    if (seenRow.has(rk)) return;
    seenRow.add(rk);
    rows.push({
      metric: cat.name, metric_key: cat.key, value: v, unit: cat.unit || '',
      condition: condition || (date ? G.condition(date) : ''), evidence: [id],
    });
  };

  for (const e of entries) {
    const raw = String(e.content || '').trim();

    /* CSV 측정행 (날짜,지표,값,단위,조건) */
    const csv = raw.split(',');
    if (csv.length >= 4 && isValidDate(csv[0].trim())) {
      const date = csv[0].trim();
      if (!inPeriod(date)) { stats.skippedOffPeriod++; continue; }
      const name = (csv[1] || '').trim();
      const cat = metricsCatalog.find(k => name === k.name || name.includes(k.name) || k.name.includes(name));
      const v = Number(csv[2]);
      if (cat && Number.isFinite(v)) { pushRow(cat, v, date, (csv[4] || '').trim(), e.id); continue; }
    }

    const dm = raw.match(DATE_PREFIX);
    const date = dm ? dm[1] : null;
    const body = raw.replace(DATE_PREFIX, '').trim();
    if (date && !inPeriod(date)) { stats.skippedOffPeriod++; continue; }

    /* 측정 문장 → 지표 카탈로그 매칭 시 결과데이터 행 */
    if (e.kind === 'measurement') {
      for (const cat of metricsCatalog) {
        if (!cat.name || !body.includes(cat.name)) continue;
        const re = cat.unit
          ? new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + String(cat.unit).replace(ESC_RE, '\\$&'))
          : /(\d+(?:\.\d+)?)/;
        const m = body.match(re);
        if (m) { pushRow(cat, Number(m[1]), date, '', e.id); break; }
      }
    }

    /* 서술 문장 → 수행 내용 (끝의 괄호 주석은 종결어미 판정에서 제외) */
    const bodyCore = body.replace(/\s*\([^)]*\)\.?$/, '');
    if (bodyCore.length < 10 || body.startsWith('[') || !SENTENCE_END.test(bodyCore)) { stats.skippedNonSentence++; continue; }
    if (FORBIDDEN_PATTERNS.some(f => f.re.test(body))) { stats.skippedForbidden++; continue; }
    /* 같은 활동이라도 날짜가 다르면 별개의 수행 기록이다 */
    const key = (date || '') + '|' + body.replace(/\s+/g, '');
    if (seenSent.has(key)) continue;
    seenSent.add(key);
    work.push({
      text: (date ? date + ' ' : '') + body.replace(/\.$/, '') + ` [${e.id}].`,
      wp, evidence: [e.id],
    });
  }

  /* 해석 — 지표별 마지막 측정값과 목표의 산술 비교 (사실만, 판정 없음) */
  const latest = new Map();
  for (const r of rows) latest.set(r.metric_key, r);
  for (const r of latest.values()) {
    const cat = metricsCatalog.find(k => k.key === r.metric_key);
    if (!cat || !Number.isFinite(+cat.target)) continue;
    const u = cat.unit || '';
    let text;
    const V = `${r.value}${u}`, T = `${cat.target}${u}`, E = r.evidence[0];
    if (cat.direction === 'lower') {
      text = G.lower(cat.name, V, T, E);
    } else {
      const ratio = Math.round((+r.value / +cat.target) * 1000) / 10;
      text = ratio <= 200 ? G.ratio(cat.name, V, T, ratio, E) : G.plain(cat.name, V, T, E);
    }
    interpretation.push({ text, wp, evidence: [...r.evidence] });
  }

  return { work, metrics: rows, interpretation, stats };
}

/**
 * 초안을 노트에 적용한다. 사용자가 이미 쓴 내용은 절대 지우지 않고,
 * 같은 내용이 이미 있으면 중복 추가하지 않는다.
 * @returns {{added: {work:number, metrics:number, interpretation:number}}}
 */
export function applyDraftToNote(note, draft) {
  const added = { work: 0, metrics: 0, interpretation: 0 };
  const norm = t => String(t || '').replace(/\[E\d{1,5}\]/g, '').replace(/\s+/g, '');

  for (const [key, items] of [['work', draft.work], ['interpretation', draft.interpretation]]) {
    if (!Array.isArray(note.sections[key])) note.sections[key] = [];
    const seen = new Set(note.sections[key].map(x => norm(x.text)));
    for (const it of items) {
      if (seen.has(norm(it.text))) continue;
      note.sections[key].push({ text: it.text, wp: it.wp || '', evidence: [...it.evidence] });
      seen.add(norm(it.text));
      added[key === 'work' ? 'work' : 'interpretation']++;
    }
    /* 빈 자리 표시용 공백 항목 제거 */
    note.sections[key] = note.sections[key].filter(x => x.text || note.sections[key].length === 1);
  }

  if (!Array.isArray(note.sections.metrics)) note.sections.metrics = [];
  const seenR = new Set(note.sections.metrics.map(r => `${r.metric_key || r.metric}|${r.value}|${r.condition || ''}`));
  for (const r of draft.metrics) {
    const rk = `${r.metric_key}|${r.value}|${r.condition || ''}`;
    if (seenR.has(rk)) continue;
    note.sections.metrics.push({ ...r });
    seenR.add(rk);
    added.metrics++;
  }
  note.sections.metrics = note.sections.metrics.filter(r => r.metric || note.sections.metrics.length === 1);
  return { added };
}
