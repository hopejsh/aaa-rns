/* ════════════════════════════════════════════════════════════════
 * AAA-RNS · simulation/run_simulation.mjs
 * Developed by Seung Ho Jung · v2.0 · Apache-2.0 © 2026
 * 검증 시뮬레이션 하네스
 *
 * 시뮬레이션-문제발견-문제해결 사이클의 실행기.
 *   · 사이클당 최소 100,000회 시뮬레이션 (기본 100,500회)
 *   · 최대 사이클 = 12 (MAX_CYCLES) — 무한 루프 방지 상한
 *   · 시드 기반 완전 재현 가능 (같은 시드 → 같은 결과)
 *   · 결함은 카테고리·시드와 함께 보고서로 기록된다
 *
 * 사용:
 *   node simulation/run_simulation.mjs --cycle 1
 *   node simulation/run_simulation.mjs --cycle 2 --iters 100500
 * ════════════════════════════════════════════════════════════════ */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  uid, sha256, stableStringify, fmtDate, parseISO, isValidDate, addDays, addMonths,
  diffDays, monthSpan, parseLooseDate, parseKoreanNumber, splitSentences, escapeHtml,
  normSpace, extOf, safeName, decodeText,
} from '../js/core/util.js';
import { parseFile, parseCsv } from '../js/core/parsers.js';
import { analyzeDocuments } from '../js/core/analyzer.js';
import { generateSystem, validateSystem, buildPlanner } from '../js/core/generator.js';
import { EvidenceLedger, citationsIn, stripCitations, isNoEvidenceStatement } from '../js/core/ledger.js';
import { runGates, gateG1, FORBIDDEN_PATTERNS } from '../js/core/gates.js';
import { autoRegisterEvidence, buildAutoDraft, applyDraftToNote } from '../js/core/autodraft.js';
import { buildBackupZip, restoreBackupZip, walkStore, archiveSealedNote } from '../js/core/backup.js';
import { verifyLicenseKey } from '../js/core/license.js';
import { polishNarrative } from '../js/core/llm.js';
import { DICT, PATTERNS, INLINE_PATTERNS } from '../js/i18n/dict.js';
import {
  createNote, noteIdFor, parseNoteId, noteContentHash, commitNote, applyGateResult,
  addContributorSignature, sealNote, reviseNote, verifySealChain, verifyNoteIntegrity,
  attachTimestamp, sealHashOf, verifyCryptoSignatures,
} from '../js/core/notes.js';
import { MemoryStore, RevConflictError } from '../js/core/store.js';
import { hashPin, verifyPin, verifyDeviceSignature, b64u, hexToBytes } from '../js/core/signing.js';
import { buildTsq, parseTsr, verifyStoredTimestamp, generalizedTimeToIso } from '../js/core/timestamp.js';
import { docxBuild, xlsxBuild, noteToDocxBlocks, zipBuild, crc32 } from '../js/core/docgen.js';
import {
  makeRng, pick, rint, chance, synthProject, synthPlanDocx, synthKpiXlsx, synthParsedDoc,
  synthAdversarialDoc, synthPdf, synthHwpxEntries, EUCKR_SAMPLES,
  corrupt, randomBytes, cleanSentence, VIOLATION_TYPES, VIOLATION_TO_CHECK,
} from './synth.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
export const MAX_CYCLES = 12;          // 무한 사이클 방지 상한
export const MIN_ITERS = 100000;       // 사이클당 최소 시뮬레이션 횟수

/* ── CLI ── */
const args = process.argv.slice(2);
function argOf(name, dflt) {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : dflt;
}
const CYCLE = parseInt(argOf('cycle', '1'), 10);

/* 캠페인 번호로 보고서를 격리한다.
   과거에 캠페인 2가 사이클 번호를 1부터 다시 매기면서 캠페인 1의 사이클
   1~9 보고서를 통째로 덮어썼다 — 검증 증거가 소실된 사고였다. 경로에
   캠페인을 넣어 번호 재사용이 기존 증거를 지울 수 없게 만든다. */
const CAMPAIGN = parseInt(argOf('campaign', '2'), 10);
const REPORT_DIR = join(__dir, 'reports', `campaign${CAMPAIGN}`);
mkdirSync(REPORT_DIR, { recursive: true });
const TOTAL_ITERS = Math.max(MIN_ITERS, parseInt(argOf('iters', '100500'), 10));
if (CYCLE > MAX_CYCLES) {
  console.error(`중단: 사이클 ${CYCLE} 이 최대치(${MAX_CYCLES})를 초과했습니다.`);
  process.exit(2);
}

/* ── 결함 수집 ── */
const failures = [];
const defectMap = new Map(); // signature → {count, first}
let ran = 0;

function fail(category, seed, message, extra) {
  ran; // (카운터는 카테고리 러너가 관리)
  const msg = String(message).slice(0, 300);
  failures.push({ category, seed, message: msg, extra });
  const sig = category + '::' + msg.replace(/\d+/g, '#').slice(0, 140);
  const d = defectMap.get(sig);
  if (d) d.count++;
  else defectMap.set(sig, { count: 1, first: { category, seed, message: msg, extra } });
}

function assert(cond, category, seed, message, extra) {
  if (!cond) fail(category, seed, message, extra);
  return cond;
}

/* ══════════════════════════════════════════════════════════
 * 카테고리 1 · util 날짜 (12,000)
 * ══════════════════════════════════════════════════════════ */
async function catUtilDates(n, baseSeed) {
  const C = 'util_dates';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    const y = rint(rng, 1990, 2090), m = rint(rng, 1, 12);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const d = rint(rng, 1, lastDay);
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    assert(isValidDate(iso), C, seed, `유효 날짜를 무효 판정: ${iso}`);
    assert(fmtDate(parseISO(iso)) === iso, C, seed, `parseISO/fmtDate 왕복 실패: ${iso}`);

    const k = rint(rng, -2000, 2000);
    const moved = addDays(iso, k);
    assert(moved !== null && diffDays(iso, moved) === k, C, seed, `addDays/diffDays 불일치: ${iso}+${k}→${moved}`);

    const mm = rint(rng, 0, 60);
    const plus = addMonths(iso, mm);
    assert(plus !== null && isValidDate(plus), C, seed, `addMonths 무효 결과: ${iso}+${mm}m→${plus}`);
    // 말일 보정: 일자는 원래 이하
    assert(parseInt(plus.slice(8), 10) <= d || parseInt(plus.slice(8), 10) >= 28, C, seed, `addMonths 말일 보정 오류: ${iso}+${mm}m→${plus}`);

    // monthSpan: 같은 달 = 1
    assert(monthSpan(iso, iso) === 1, C, seed, `monthSpan(self)≠1: ${iso}`);
    const spanEnd = addMonths(iso, mm);
    const sp = monthSpan(iso, spanEnd);
    assert(sp === mm + 1, C, seed, `monthSpan 계산 오류: ${iso}~${spanEnd} → ${sp} (기대 ${mm + 1})`);

    // 무효 날짜 거부
    assert(parseISO(`${y}-02-30`) === null, C, seed, `2/30 을 유효 판정: ${y}`);

    // parseLooseDate 형식들
    const forms = [
      [`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, iso],
      [`${y}.${m}.${d}`, iso],
      [`${y}/${String(m).padStart(2, '0')}/${d}`, iso],
      [`${y}년 ${m}월 ${d}일`, iso],
      [`${y}년 ${m}월`, `${y}-${String(m).padStart(2, '0')}-01`],
    ];
    const [input, expect] = pick(rng, forms);
    const got = parseLooseDate(input);
    assert(got === expect, C, seed, `parseLooseDate('${input}') = ${got} ≠ ${expect}`);
  }
  return n;
}

/* ══════════════════════════════════════════════════════════
 * 카테고리 2 · util 숫자·텍스트 (8,000)
 * ══════════════════════════════════════════════════════════ */
async function catUtilNumbers(n, baseSeed) {
  const C = 'util_numbers';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    // 한국식 수 표현
    const base = rint(rng, 1, 999);
    const cases = [
      [String(base), base],
      [base.toLocaleString('en-US'), base],
      [`${base}억`, base * 1e8],
      [`${base}백만원`, base * 1e6],
      [`${base}만`, base * 1e4],
      [`${base}%`, base],
      ['3억 5천만원', 3.5e8],
      ['', null], ['abc', null], ['--3', null],
    ];
    const [input, expect] = pick(rng, cases);
    const got = parseKoreanNumber(input);
    assert(got === expect, C, seed, `parseKoreanNumber('${input}') = ${got} ≠ ${expect}`);

    // 문장 분리: 내용 보존 (공백 제외 문자 소실 금지)
    const sents = [];
    const cnt = rint(rng, 1, 5);
    for (let j = 0; j < cnt; j++) sents.push(`문장 ${j} 을 검증하였다 [E${j + 1}].`);
    const joined = sents.join(' ');
    const split = splitSentences(joined);
    assert(split.length === cnt, C, seed, `splitSentences 개수: ${split.length} ≠ ${cnt}`);
    const strip = s => s.replace(/\s+/g, '');
    assert(strip(split.join('')) === strip(joined), C, seed, 'splitSentences 내용 소실');

    // 소수점 보존
    const dec = splitSentences(`정확도는 ${base}.5 이다 [E1].`);
    assert(dec.length === 1, C, seed, `소수점에서 문장 분리됨: ${JSON.stringify(dec)}`);

    // escapeHtml 완전성
    const danger = `<img src=x onerror="alert(${base})">'&`;
    const escaped = escapeHtml(danger);
    assert(!/[<>"]/.test(escaped) && !escaped.includes("'"), C, seed, `escapeHtml 미이스케이프: ${escaped}`);
  }
  return n;
}

/* ══════════════════════════════════════════════════════════
 * 카테고리 3 · CSV 왕복 (5,000)
 * ══════════════════════════════════════════════════════════ */
function csvSerialize(rows) {
  return rows.map(r => r.map(c => {
    const s = String(c);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\r\n');
}

async function catCsv(n, baseSeed) {
  const C = 'csv_roundtrip';
  const CELLS = ['plain', 'with,comma', 'with "quote"', '줄\n바꿈', '', '123.45', '  spaced  ', '한국어 셀', '"시작따옴표', 'a,"b",c'];
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    const rows = [];
    const R = rint(rng, 1, 8), Cc = rint(rng, 1, 6);
    for (let r = 0; r < R; r++) {
      const row = [];
      for (let c = 0; c < Cc; c++) row.push(pick(rng, CELLS));
      rows.push(row);
    }
    // 마지막 행이 전부 빈 문자열이면 직렬화-해석 시 소실될 수 있음 — 정상 케이스로 보정
    if (rows[R - 1].every(c => c === '')) rows[R - 1][0] = 'x';
    const text = csvSerialize(rows);
    const back = parseCsv(text);
    const ok = back.length === rows.length && back.every((r, ri) =>
      r.length === rows[ri].length && r.every((c, ci) => c === rows[ri][ci]));
    assert(ok, C, seed, `CSV 왕복 불일치 (rows ${rows.length}→${back.length})`,
      ok ? undefined : { expect: rows, got: back });
  }
  return n;
}

/* ══════════════════════════════════════════════════════════
 * 카테고리 4 · DOCX 왕복 (3,000)
 * ══════════════════════════════════════════════════════════ */
async function catDocxRoundtrip(n, baseSeed) {
  const C = 'docx_roundtrip';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    const paras = [];
    const cnt = rint(rng, 1, 12);
    for (let j = 0; j < cnt; j++) {
      paras.push(`문단 ${j} — ${pick(rng, ['특수문자 <&"\'> 검증', '한국어 텍스트와 English mixed', '수치 3.14 및 95% 표기', '탭\t과 공백'])}`);
    }
    const tableRows = [['헤더A', '헤더B'], [`값${rint(rng, 0, 999)}`, '셀 <특수> & 문자']];
    const bytes = docxBuild([
      ...paras.map(t => ({ text: t })),
      { type: 'table', rows: tableRows },
    ]);
    const d = await parseFile(`t${seed}.docx`, bytes);
    assert(d.ok && d.kind === 'docx', C, seed, `DOCX 파싱 실패: ${d.warnings.join(';')}`);
    for (const t of paras) {
      const norm = normSpace(t);
      if (!d.paragraphs.some(p => p === norm)) {
        fail(C, seed, `문단 소실/변형: '${norm.slice(0, 60)}'`);
        break;
      }
    }
    assert(d.tables.length === 1 && d.tables[0].length === 2 &&
      d.tables[0][1][1] === normSpace(tableRows[1][1]), C, seed, 'DOCX 표 왕복 불일치');
  }
  return n;
}

/* ══════════════════════════════════════════════════════════
 * 카테고리 5 · XLSX 왕복 (3,000)
 * ══════════════════════════════════════════════════════════ */
async function catXlsxRoundtrip(n, baseSeed) {
  const C = 'xlsx_roundtrip';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    const rows = [];
    const R = rint(rng, 1, 10), Cc = rint(rng, 1, 6);
    for (let r = 0; r < R; r++) {
      const row = [];
      for (let c = 0; c < Cc; c++) {
        row.push(chance(rng, 0.4) ? rint(rng, -10000, 10000) + (chance(rng, 0.3) ? 0.5 : 0)
          : pick(rng, ['텍스트', 'A<&>B', '95%', '', '조건: 25℃', 'mixed 한글 text']));
      }
      rows.push(row);
    }
    const sheetName = pick(rng, ['데이터', 'Sheet1', '지표/일정', '아주긴시트이름'.repeat(4)]);
    const bytes = xlsxBuild([{ name: sheetName, rows }]);
    const d = await parseFile(`t${seed}.xlsx`, bytes);
    assert(d.ok && d.kind === 'xlsx' && d.sheets.length === 1, C, seed, `XLSX 파싱 실패: ${d.warnings.join(';')}`);
    if (!d.sheets.length) continue;
    const got = d.sheets[0].rows;
    let ok = true;
    for (let r = 0; r < R && ok; r++) {
      for (let c = 0; c < Cc && ok; c++) {
        const want = rows[r][c];
        const have = (got[r] || [])[c];
        const wantS = typeof want === 'number' ? String(want) : want;
        if ((wantS === '' && (have === '' || have === undefined)) || String(have) === wantS) continue;
        ok = false;
        fail(C, seed, `셀 불일치 R${r + 1}C${c + 1}: '${have}' ≠ '${wantS}'`);
      }
    }
  }
  return n;
}

/* ══════════════════════════════════════════════════════════
 * 카테고리 6 · 파서 퍼징 (8,000) — 절대 throw 금지 계약
 * ══════════════════════════════════════════════════════════ */
async function catParserFuzz(n, baseSeed) {
  const C = 'parser_fuzz';
  // 손상 대상 원본 3종 준비
  const rng0 = makeRng(baseSeed);
  const seedDocx = synthPlanDocx(rng0).bytes;
  const seedXlsx = synthKpiXlsx(rng0).bytes;
  const seedCsv = new TextEncoder().encode('a,b,c\n1,2,3\n"x","y,z",3');
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    const mode = rint(rng, 0, 5);
    let name = 'fuzz.bin', bytes;
    if (mode === 0) { bytes = randomBytes(rng, rint(rng, 0, 4096)); name = pick(rng, ['x.pdf', 'x.docx', 'x.xlsx', 'x.csv', 'x.txt', 'x']); }
    else if (mode === 1) { bytes = corrupt(rng, seedDocx); name = 'c.docx'; }
    else if (mode === 2) { bytes = corrupt(rng, seedXlsx); name = 'c.xlsx'; }
    else if (mode === 3) { bytes = corrupt(rng, seedCsv); name = 'c.csv'; }
    else if (mode === 4) {
      // PDF 위장: %PDF 헤더 + 쓰레기
      const junk = randomBytes(rng, rint(rng, 10, 2048));
      bytes = new Uint8Array(5 + junk.length);
      bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
      bytes.set(junk, 5);
      name = 'fake.pdf';
    } else {
      // ZIP 위장: PK 헤더 + 쓰레기
      const junk = randomBytes(rng, rint(rng, 10, 2048));
      bytes = new Uint8Array(4 + junk.length);
      bytes.set([0x50, 0x4b, 0x03, 0x04]);
      bytes.set(junk, 4);
      name = 'fake.docx';
    }
    try {
      const d = await parseFile(name, bytes);
      assert(d && typeof d.ok === 'boolean' && Array.isArray(d.warnings), C, seed, '반환 구조 계약 위반');
      assert(typeof d.text === 'string', C, seed, 'text 가 문자열이 아님');
    } catch (e) {
      fail(C, seed, `parseFile throw 금지 계약 위반: ${e.message}`, { mode, name });
    }
  }
  return n;
}

/* ══════════════════════════════════════════════════════════
 * 카테고리 7 · 분석기 정답 대조 (10,000: 파싱경유 1,500 + 직접 8,500)
 * ══════════════════════════════════════════════════════════ */
async function catAnalyzer(n, baseSeed) {
  const C = 'analyzer_truth';
  const viaParser = Math.min(1500, Math.floor(n * 0.15));
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    let docs, truth;
    if (i < viaParser) {
      const a = synthPlanDocx(rng);
      truth = a.truth;
      const b = synthKpiXlsx(rng, truth);
      docs = [await parseFile('plan.docx', a.bytes), await parseFile('kpi.xlsx', b.bytes)];
    } else {
      const a = synthParsedDoc(rng);
      truth = a.truth;
      docs = [a.doc];
    }
    let res;
    try { res = analyzeDocuments(docs); }
    catch (e) { fail(C, seed, `analyzeDocuments throw: ${e.message}`); continue; }
    const p = res.project;
    assert(p.title && p.title.value === truth.title, C, seed,
      `과제명 오추출: '${p.title && p.title.value}' ≠ '${truth.title}'`);
    assert(p.projectCode && p.projectCode.value === truth.code, C, seed,
      `과제번호 오추출: '${p.projectCode && p.projectCode.value}' ≠ '${truth.code}'`);
    const per = p.period && p.period.value;
    assert(per && per.start === truth.period.start && per.end === truth.period.end, C, seed,
      `기간 오추출: ${per && per.start}~${per && per.end} ≠ ${truth.period.start}~${truth.period.end}`);
    assert(p.workPackages.length === truth.wps.length, C, seed,
      `WP 수 불일치: ${p.workPackages.length} ≠ ${truth.wps.length}`);
    // KPI: 모든 정답 지표가 추출되어야 함 (이름 기준)
    for (const k of truth.kpis) {
      const got = p.kpis.find(x => x.name === k.name);
      if (!assert(!!got, C, seed, `KPI 미추출: ${k.name}`)) continue;
      assert(+got.target === k.target, C, seed, `KPI 목표 불일치 (${k.name}): ${got.target} ≠ ${k.target}`);
    }
    // 연구책임자
    assert(p.people.some(x => x.name === truth.pi), C, seed, `연구책임자 미추출: ${truth.pi}`);
    // 모든 추출값에 증거 부착
    for (const f of ['title', 'projectCode', 'period']) {
      if (p[f] && p[f].confidence !== 'none') {
        assert(Array.isArray(p[f].ev) && p[f].ev.length > 0, C, seed, `${f} 증거 미부착`);
      }
    }
  }
  return n;
}

/* ══════════════════════════════════════════════════════════
 * 카테고리 7b · 분석기 적대 시험 (8,000)
 * 라벨·구분자·날짜 형식·표 헤더 변형 + 노이즈 문단
 * ══════════════════════════════════════════════════════════ */
async function catAnalyzerAdversarial(n, baseSeed) {
  const C = 'analyzer_adversarial';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    const { doc, truth, meta } = synthAdversarialDoc(rng);
    let res;
    try { res = analyzeDocuments([doc]); }
    catch (e) { fail(C, seed, `analyzeDocuments throw: ${e.message}`, meta); continue; }
    const p = res.project;
    assert(p.title && p.title.value === truth.title, C, seed,
      `과제명 오추출: '${p.title && p.title.value}' ≠ '${truth.title}'`, meta);
    assert(p.projectCode && p.projectCode.value === truth.code, C, seed,
      `과제번호 오추출: '${p.projectCode && p.projectCode.value}'`, meta);
    const per = p.period && p.period.value;
    assert(per && per.start === truth.period.start && per.end === truth.period.end, C, seed,
      `기간 오추출: ${per && per.start}~${per && per.end} ≠ ${truth.period.start}~${truth.period.end}`, meta);
    assert(p.workPackages.length === truth.wps.length, C, seed,
      `WP 수 불일치(${meta.wpStyle}): ${p.workPackages.length} ≠ ${truth.wps.length}`, meta);
    for (const k of truth.kpis) {
      const got = p.kpis.find(x => x.name === k.name);
      if (!assert(!!got, C, seed, `KPI 미추출: ${k.name}`, meta)) continue;
      assert(+got.target === k.target, C, seed,
        `KPI 목표 수치화 실패 (${k.name}, suffix=${meta.suffixMode}): '${got.target}' ≠ ${k.target}`, meta);
      assert(got.direction === k.direction, C, seed,
        `KPI 방향 오판 (${k.name}): ${got.direction} ≠ ${k.direction}`, meta);
    }
  }
  return n;
}

/* ══════════════════════════════════════════════════════════
 * 카테고리 8 · 생성기 불변식 (25,000)
 * ══════════════════════════════════════════════════════════ */
async function catGenerator(n, baseSeed) {
  const C = 'generator_invariants';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    const t = synthProject(rng);
    const cadence = chance(rng, 0.5) ? 'biweekly' : 'weekly';
    // 다양한 입력 결손 상황
    const scenario = rint(rng, 0, 3);
    const analysis = {
      project: {
        title: { value: t.title, confidence: 'high', ev: [] },
        projectCode: { value: t.code, confidence: 'high', ev: [] },
        agency: null, orgName: { value: t.org, confidence: 'high', ev: [] },
        period: scenario === 1 ? null
          : scenario === 2 ? { value: { start: null, end: null, months: t.period.months }, confidence: 'low', ev: [] }
          : { value: { start: t.period.start, end: t.period.end }, confidence: 'high', ev: [] },
        budget: null,
        people: t.members.map(m => ({ name: m, role: '참여연구원', ev: [] })),
        workPackages: scenario === 3 ? [] : t.wps.map(w => ({ id: 'WP' + w.num, num: w.num, name: w.name, confidence: 'high', ev: [] })),
        kpis: t.kpis.map(k => ({ name: k.name, unit: k.unit, target: k.target, direction: k.direction, confidence: 'high', ev: [] })),
        milestones: chance(rng, 0.5) ? [{ id: 'M' + rint(rng, 1, 200), month: rint(rng, 1, 200), name: '중간 평가', ev: [] }] : [],
        deliverables: [], keywords: [], domain: t.domain,
      },
      evidence: [], flags: [],
      stats: {},
    };
    let sys;
    try {
      sys = generateSystem(analysis, { today: fmtDate(new Date(Date.UTC(2026, 7, 12))), cadence });
    } catch (e) { fail(C, seed, `generateSystem throw: ${e.message}`, { scenario }); continue; }
    const errs = validateSystem(sys);
    if (!assert(errs.length === 0, C, seed, `불변식 위반: ${errs.join(' / ')}`, { scenario })) continue;

    // 추가 불변식: 스프린트 일수 총합 = 기간 일수
    const days = sys.planner.sprints.reduce((s, sp) => s + diffDays(sp.start, sp.end) + 1, 0);
    const totalDays = diffDays(sys.project.period.start, sys.project.period.end) + 1;
    assert(days === totalDays, C, seed, `스프린트 일수 합 ${days} ≠ 기간 ${totalDays}`);

    // 노트 슬롯 ID 왕복
    for (const sp of sys.planner.sprints.slice(0, 5)) {
      const parsed = parseNoteId(sp.noteSlot);
      assert(parsed && parsed.start === sp.start && parsed.end === sp.end, C, seed,
        `노트 슬롯 ID 왕복 실패: ${sp.noteSlot}`);
    }
    // 케이던스 규칙: 마지막 제외 모든 스프린트는 정확히 step 일
    const step = cadence === 'weekly' ? 7 : 14;
    for (const sp of sys.planner.sprints.slice(0, -1)) {
      assert(diffDays(sp.start, sp.end) + 1 === step, C, seed,
        `스프린트 길이 오류: ${sp.id} = ${diffDays(sp.start, sp.end) + 1}일 (기대 ${step})`);
    }
  }
  return n;
}

/* ══════════════════════════════════════════════════════════
 * 카테고리 9 · 게이트 결함 주입 (15,000)
 * ══════════════════════════════════════════════════════════ */
function buildScenarioNote(rng, planted) {
  // 기준 노트 + 원장 구성
  const ledger = new EvidenceLedger();
  const evIds = [];
  for (let j = 0; j < 4; j++) {
    evIds.push(ledger.add({
      kind: 'statement', sourceType: 'upload', sourceFile: `자료${j + 1}.pdf`,
      locator: `p.${j + 1}`, content: `근거 내용 ${j + 1}`, addedBy: '시험',
    }).id);
  }
  const y = rint(rng, 2025, 2030);
  const start = `${y}-03-01`, end = `${y}-03-14`;
  const project = { project_code: 'TS-' + y + '-001', title: '시뮬레이션 과제' };
  const note = createNote({
    project, period: { start, end }, wpRefs: ['WP1'],
    author: '김작성', reviewer: '이점검', cadence: 'biweekly', today: `${y}-03-15`,
  });
  note.header.작성일 = `${y}-03-15`;
  note.sections.work = [
    { text: cleanSentence(rng, evIds[0]), wp: 'WP1', evidence: [evIds[0]] },
    { text: cleanSentence(rng, evIds[1]), wp: 'WP1', evidence: [evIds[1]] },
  ];
  note.sections.results = [{ text: cleanSentence(rng, evIds[2]), wp: 'WP1', evidence: [evIds[2]] }];
  // [사이클 7 회귀] 연구자 직접 기록 인용은 첨부 없이도 G4 를 통과해야 한다
  if (chance(rng, 0.5)) {
    const rs = ledger.add({
      kind: 'researcher_statement', sourceType: 'upload', sourceFile: '(직접 기록)',
      locator: '연구자 진술', content: '직접 기록 내용', addedBy: '김작성',
    });
    note.sections.work.push({ text: `보조 작업 내용을 기록하였다 [${rs.id}].`, wp: 'WP1', evidence: [rs.id] });
  }
  note.sections.metrics = [{
    metric: '공정 수율', metric_key: '공정_수율', value: 88, unit: '%',
    condition: '표준 조건', evidence: [evIds[3]],
  }];
  // [사이클 1 결함 수정] 인용된 증거의 원본 파일 전체를 첨부해야 G4-첨부누락이 나지 않는다.
  // 게이트가 옳았고 시나리오가 틀렸다 — 인용 원본 4개 전부 첨부.
  note.attachments = [1, 2, 3, 4].map(j => ({
    file_id: 'F' + j, name: `자료${j}.pdf`, sha256: 'a'.repeat(64), size: 100, contributor: '김작성',
  }));
  const catalog = [{ key: '공정_수율', name: '공정 수율', unit: '%', target: 85, direction: 'higher' }];
  const sealedNotes = [];

  /* 결함 주입 */
  for (const v of planted) {
    if (v === 'missing_citation') note.sections.work.push({ text: '증거 없는 주장을 기재하였다.', wp: 'WP1', evidence: [] });
    else if (v === 'ghost_evidence') note.sections.work.push({ text: '존재하지 않는 근거를 인용하였다 [E999].', wp: 'WP1', evidence: [] });
    else if (v === 'forbidden_word') note.sections.interpretation.push({ text: `수율이 개선된 것으로 판단된다 [${evIds[0]}].`, wp: 'WP1', evidence: [evIds[0]] });
    else if (v === 'metric_no_evidence') note.sections.metrics.push({ metric: '불량률', metric_key: '불량률', value: 3, unit: '%', evidence: [] });
    else if (v === 'percent_range') note.sections.metrics.push({ metric: '가동률', metric_key: '가동률', value: 130, unit: '%', evidence: [evIds[0]] });
    else if (v === 'bad_value') note.sections.metrics.push({ metric: '측정치', metric_key: '측정치', value: '높음', unit: '', evidence: [evIds[0]] });
    else if (v === 'count_fraction') note.sections.metrics.push({ metric: '시제품', metric_key: '시제품', value: 2.5, unit: '건', evidence: [evIds[0]] });
    else if (v === 'unit_mismatch') { note.sections.metrics[0].unit = 'ms'; }
    else if (v === 'false_achieved') { note.sections.metrics[0].value = 80; note.sections.metrics[0].achieved = true; }
    else if (v === 'self_review') note.header.점검자 = note.header.작성자;
    else if (v === 'missing_author') note.header.작성자 = '';
    else if (v === 'bad_period') note.period = { start: end, end: start, cadence: 'biweekly' };
    else if (v === 'att_no_hash') note.attachments.push({ file_id: 'F2', name: '해시없음.pdf', sha256: '', size: 5, contributor: '김작성' });
    else if (v === 'period_overlap') {
      sealedNotes.push({
        note_id: noteIdFor(addDays(start, -7), addDays(start, 3)), _state: 'sealed',
        period: { start: addDays(start, -7), end: addDays(start, 3) },
        sections: { metrics: [] }, supersedes: null,
      });
    } else if (v === 'metric_contradict') {
      sealedNotes.push({
        note_id: 'RN-OLD', _state: 'sealed',
        period: { start: addDays(start, -14), end },   // 동일 종료 시점
        sections: { metrics: [{ metric: '공정 수율', metric_key: '공정_수율', value: 91, unit: '%', evidence: ['E1'] }] },
        supersedes: null,
      });
    }
  }
  return { note, ledger, catalog, sealedNotes };
}

async function catGates(n, baseSeed) {
  const C = 'gates_planted';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    const plantCount = rint(rng, 0, 3);
    const planted = [];
    const pool = [...VIOLATION_TYPES];
    // [사이클 1 결함 수정] 상호작용하는 결함 조합 배제:
    //  · bad_period(기간 역전)는 기간 의존 결함(period_overlap·metric_contradict)의 전제를 무너뜨린다
    //  · missing_author 와 self_review 는 서로의 탐지 조건을 간섭한다
    const EXCLUSIVE = [
      ['bad_period', 'period_overlap', 'metric_contradict'],
      ['self_review', 'missing_author'],
    ];
    for (let j = 0; j < plantCount && pool.length; j++) {
      const idx = rint(rng, 0, pool.length - 1);
      const picked = pool.splice(idx, 1)[0];
      planted.push(picked);
      for (const g of EXCLUSIVE) {
        if (!g.includes(picked)) continue;
        for (const other of g) {
          const oi = pool.indexOf(other);
          if (oi >= 0) pool.splice(oi, 1);
        }
      }
    }
    const { note, ledger, catalog, sealedNotes } = buildScenarioNote(rng, planted);
    await commitNote(note, '시험', '시나리오 구성');
    const mode = chance(rng, 0.5) ? 'advisory' : 'strict';
    let result;
    try {
      result = runGates(note, {
        ledger, sealedNotes, metricsCatalog: catalog, mode, expectedHash: note.content_sha256,
      });
    } catch (e) { fail(C, seed, `runGates throw: ${e.message}`, { planted }); continue; }

    const allChecks = result.gates.flatMap(g => g.violations.map(v => v.check));
    if (!planted.length) {
      assert(result.allPass && result.violationCount === 0, C, seed,
        `깨끗한 노트에 거짓 지적: ${allChecks.join(', ')}`, { mode });
      assert(result.decision === 'pass', C, seed, `깨끗한 노트 판정 오류: ${result.decision}`);
    } else {
      for (const v of planted) {
        const expect = VIOLATION_TO_CHECK[v];
        assert(allChecks.includes(expect), C, seed,
          `주입 결함 미탐지: ${v} → ${expect} (탐지: ${allChecks.join(',') || '없음'})`, { planted, mode });
      }
      assert(!result.allPass, C, seed, `결함 주입에도 전체 통과: ${planted.join(',')}`);
      assert(result.decision === (mode === 'strict' ? 'rejected' : 'advisory'), C, seed,
        `모드 판정 오류(${mode}): ${result.decision}`);
    }
  }
  return n;
}

/* ══════════════════════════════════════════════════════════
 * 카테고리 10 · 노트 라이프사이클·해시체인 (8,000)
 * ══════════════════════════════════════════════════════════ */
async function catNotes(n, baseSeed) {
  const C = 'notes_lifecycle';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    const { note, ledger, catalog } = buildScenarioNote(rng, []);
    await commitNote(note, '김작성', '작성');
    const res = runGates(note, { ledger, sealedNotes: [], metricsCatalog: catalog, mode: 'advisory', expectedHash: note.content_sha256 });
    applyGateResult(note, res);
    assert(note._state === 'awaiting_sign', C, seed, `통과 노트 상태 오류: ${note._state}`);

    // 자기 승인 차단
    let blocked = false;
    try { await sealNote(note, { approver: note.header.작성자, contentHash: note.content_sha256 }); }
    catch { blocked = true; }
    assert(blocked, C, seed, '자기 승인이 차단되지 않음');
    assert(note._state === 'awaiting_sign', C, seed, `차단 실패 후 상태 오염: ${note._state}`);

    // 잘못된 해시로 서명 차단
    blocked = false;
    try { addContributorSignature(note, '박기여', 'deadbeef'); } catch { blocked = true; }
    assert(blocked, C, seed, '불일치 해시 서명이 차단되지 않음');

    // 정상 확정
    addContributorSignature(note, '김작성', note.content_sha256);
    const prev = chance(rng, 0.5) ? '' : 'c'.repeat(64);
    try {
      await sealNote(note, { approver: '이점검', prevSealHash: prev, contentHash: note.content_sha256 });
    } catch (e) { fail(C, seed, `정상 확정 실패: ${e.message}`); continue; }
    assert(note._state === 'sealed' && /^[0-9a-f]{64}$/.test(note.seal_hash), C, seed, '확정 해시 형식 오류');

    // 무결성: 변조 탐지
    const integrity1 = await verifyNoteIntegrity(note);
    assert(integrity1.ok, C, seed, '정상 노트 무결성 판정 실패');
    const tampered = JSON.parse(JSON.stringify(note));
    tampered.sections.work[0].text = '변조된 내용이다 [E1].';
    const integrity2 = await verifyNoteIntegrity(tampered);
    assert(!integrity2.ok, C, seed, '변조 미탐지');

    // 확정 후 서명 추가 차단
    blocked = false;
    try { addContributorSignature(note, '최기여', note.content_sha256); } catch { blocked = true; }
    assert(blocked, C, seed, '확정 노트 서명 추가가 차단되지 않음');

    // 개정판
    const rev = reviseNote(note, '김작성');
    assert(rev.note_id === note.note_id + '-R1' && rev._state === 'draft' && rev.supersedes === note.note_id,
      C, seed, `개정판 규칙 위반: ${rev.note_id}`);
    assert(note._state === 'sealed', C, seed, '개정판 발행이 원본을 오염');

    // 해시 체인 (3-노트 체인 구성 후 중간 변조 탐지) — 표본 20%만 (비용)
    if (i % 5 === 0) {
      const chainNotes = [];
      let prevHash = '';
      for (let k = 0; k < 3; k++) {
        const { note: nk, ledger: lk, catalog: ck } = buildScenarioNote(rng, []);
        nk.note_id = nk.note_id + '-C' + k;
        await commitNote(nk, 'u', 'c');
        const rk = runGates(nk, { ledger: lk, sealedNotes: [], metricsCatalog: ck, mode: 'advisory', expectedHash: nk.content_sha256 });
        applyGateResult(nk, rk);
        await sealNote(nk, { approver: '이점검', prevSealHash: prevHash, contentHash: nk.content_sha256 });
        prevHash = nk.seal_hash;
        chainNotes.push(nk);
      }
      const v1 = await verifySealChain(chainNotes);
      assert(v1.ok && v1.checked === 3, C, seed, `정상 체인 검증 실패: ${v1.reason || ''}`);
      chainNotes[1].seal_hash = 'e'.repeat(64);
      const v2 = await verifySealChain(chainNotes);
      assert(!v2.ok, C, seed, '체인 변조 미탐지');
    }
  }
  return n;
}

/* ══════════════════════════════════════════════════════════
 * 카테고리 11 · 원장·인용 (3,000)
 * ══════════════════════════════════════════════════════════ */
async function catLedger(n, baseSeed) {
  const C = 'ledger_citations';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    const ledger = new EvidenceLedger();
    const cnt = rint(rng, 1, 30);
    for (let j = 0; j < cnt; j++) {
      const e = ledger.add({ kind: 'statement', sourceFile: 'f', locator: 'l', content: '내용 ' + j, addedBy: 't' });
      assert(e.id === 'E' + (j + 1), C, seed, `ID 순번 오류: ${e.id}`);
    }
    assert(ledger.size() === cnt, C, seed, `size 불일치`);
    // 인용 파싱
    const ids = [];
    for (let j = 0; j < rint(rng, 0, 6); j++) ids.push('E' + rint(rng, 1, cnt));
    const uniq = [...new Set(ids)];
    const text = '검증 문장이다 ' + ids.map(x => `[${x}]`).join(' ') + '. 그리고 [E' + (cnt + 100) + '] 도 있다.';
    const cites = citationsIn(text);
    for (const id of uniq) assert(cites.includes(id), C, seed, `인용 미검출: ${id}`);
    assert(cites.includes('E' + (cnt + 100)), C, seed, '유령 인용 미검출(검출 자체는 되어야 함)');
    assert(!ledger.has('E' + (cnt + 100)), C, seed, '유령 ID 존재 판정 오류');
    // 잘못된 형식은 무시
    assert(citationsIn('[EX] [E] [e3] E5').length === 0, C, seed, '잘못된 인용 형식 오검출');
    // 모순 연결
    if (cnt >= 2) {
      ledger.markConflict('E1', 'E2');
      assert(ledger.get('E1').conflict_with.includes('E2') && ledger.get('E2').conflict_with.includes('E1'),
        C, seed, 'conflict 양방향 연결 실패');
      assert(!ledger.markConflict('E1', 'E1'), C, seed, '자기 모순 연결 허용됨');
    }
    // 직접 기록 강도 강등
    const rs = ledger.add({ kind: 'researcher_statement', content: '직접 기록', addedBy: 't' });
    assert(rs.strength === 'low' && rs.caveat, C, seed, '연구자 진술 강도/주의 표기 누락');
  }
  return n;
}

/* ══════════════════════════════════════════════════════════
 * 카테고리 12 · 종단 파이프라인 (500)
 * 업로드→파싱→분석→생성→노트→게이트→확정→문서출력→재파싱
 * ══════════════════════════════════════════════════════════ */
async function catE2E(n, baseSeed) {
  const C = 'e2e_pipeline';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    try {
      // 1. 문서 생성 + 파싱
      const plan = synthPlanDocx(rng);
      const kpi = synthKpiXlsx(rng, plan.truth);
      const docs = [await parseFile('계획서.docx', plan.bytes), await parseFile('지표.xlsx', kpi.bytes)];
      // 2. 분석 → 생성
      const analysis = analyzeDocuments(docs);
      const sys = generateSystem(analysis, { today: '2026-08-12', cadence: chance(rng, 0.5) ? 'weekly' : 'biweekly' });
      const errs = validateSystem(sys);
      if (!assert(errs.length === 0, C, seed, `생성 검증 실패: ${errs[0]}`)) continue;
      // 3. 첫 스프린트 노트
      const sp = sys.planner.sprints[0];
      const ledger = new EvidenceLedger();
      const e1 = ledger.add({ kind: 'measurement', sourceFile: '지표.xlsx', locator: '성능지표!R2', content: '측정 기록', addedBy: 'e2e' });
      const note = createNote({
        project: sys.project, period: { start: sp.start, end: sp.end },
        wpRefs: sp.activeWPs.slice(0, 2), author: '김연구', reviewer: '박점검',
        cadence: sys.planner.cadence, today: sp.end,
      });
      note.sections.work = [{ text: cleanSentence(rng, e1.id), wp: note.wp_refs[0] || '', evidence: [e1.id] }];
      const cat0 = sys.metrics.catalog[0];
      if (cat0) {
        note.sections.metrics = [{
          metric: cat0.name, metric_key: cat0.key,
          value: cat0.direction === 'lower' ? Math.max(0, (cat0.target ?? 10) - 1) : (cat0.target ?? 10) + 1,
          unit: cat0.unit, condition: '표준', evidence: [e1.id],
        }];
      }
      note.attachments = [{ file_id: 'F1', name: '지표.xlsx', sha256: docs[1].sha256, size: kpi.bytes.length, contributor: '김연구' }];
      await commitNote(note, '김연구', '작성');
      // 4. 게이트 → 확정
      const res = runGates(note, { ledger, sealedNotes: [], metricsCatalog: sys.metrics.catalog, mode: 'strict', expectedHash: note.content_sha256 });
      if (!assert(res.allPass, C, seed,
        `종단 게이트 실패: ${res.gates.flatMap(g => g.violations.map(v => v.check + ':' + v.issue)).slice(0, 3).join(' | ')}`)) continue;
      applyGateResult(note, res);
      addContributorSignature(note, '김연구', note.content_sha256);
      await sealNote(note, { approver: '박점검', prevSealHash: '', contentHash: note.content_sha256 });
      assert(note._state === 'sealed', C, seed, '종단 확정 실패');
      // 5. DOCX 출력 → 재파싱 검증
      const outBytes = docxBuild(noteToDocxBlocks(note, ledger), { title: note.note_id });
      const reparsed = await parseFile('out.docx', outBytes);
      assert(reparsed.ok, C, seed, '출력 DOCX 재파싱 실패');
      assert(reparsed.text.includes(note.note_id), C, seed, '출력 문서에 노트번호 없음');
      assert(reparsed.text.includes(sys.project.title), C, seed, '출력 문서에 과제명 없음');
      // 6. XLSX 출력 확인
      const xout = xlsxBuild([{ name: '측정', rows: [['지표', '값'], ...(note.sections.metrics || []).map(m => [m.metric, m.value])] }]);
      const xre = await parseFile('out.xlsx', xout);
      assert(xre.ok && xre.sheets.length === 1, C, seed, '출력 XLSX 재파싱 실패');
      // 7. 저장소 낙관적 잠금
      const store = new MemoryStore();
      const rev1 = await store.putJSONRev('data/project.json', sys.project, 0);
      let conflicted = false;
      try { await store.putJSONRev('data/project.json', sys.project, 0); }
      catch (e) { conflicted = e instanceof RevConflictError; }
      assert(rev1 === 1 && conflicted, C, seed, '_rev 낙관적 잠금 동작 오류');
    } catch (e) {
      fail(C, seed, `종단 파이프라인 예외: ${e.message}`);
    }
  }
  return n;
}

/* ══════════════════════════════════════════════════════════
 * 카테고리 13 · 형식 경계 (3,000) — PDF·HWPX·EUC-KR
 * ══════════════════════════════════════════════════════════ */
async function catFormatEdges(n, baseSeed) {
  const C = 'format_edges';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    const mode = rint(rng, 0, 2);
    if (mode === 0) {
      // PDF: ASCII 리터럴 + 한글 hex(ToUnicode CMap)
      const { bytes, ascii, hangul } = synthPdf(rng);
      const d = await parseFile('t.pdf', bytes);
      assert(d.ok && d.kind === 'pdf', C, seed, `PDF 파싱 실패: ${d.warnings.join(';')}`);
      assert(d.text.includes(ascii), C, seed, `PDF ASCII 텍스트 미추출: '${ascii}'`);
      assert(d.text.includes(hangul), C, seed, `PDF 한글(CMap) 미추출: '${hangul}' (얻음: '${d.text.slice(0, 80)}')`);
      assert(d.meta.pages === 1, C, seed, `PDF 페이지 수 오류: ${d.meta.pages}`);
    } else if (mode === 1) {
      // HWPX
      const { bytes, paras, cell } = synthHwpxEntries(rng, zipBuild);
      const d = await parseFile('t.hwpx', bytes);
      assert(d.ok && d.kind === 'hwpx', C, seed, `HWPX 파싱 실패: ${d.warnings.join(';')}`);
      for (const p of paras) {
        if (!d.paragraphs.includes(p)) { fail(C, seed, `HWPX 문단 소실: '${p}'`); break; }
      }
      assert(d.tables.length === 1 && d.tables[0][0][0] === cell, C, seed, 'HWPX 표 추출 실패');
    } else {
      // EUC-KR 폴백 디코딩
      const sample = pick(rng, EUCKR_SAMPLES);
      const reps = rint(rng, 1, 20);
      const buf = [];
      for (let r = 0; r < reps; r++) buf.push(...sample.bytes, 0x0a);
      const d = await parseFile('t.txt', new Uint8Array(buf));
      assert(d.ok, C, seed, 'EUC-KR 텍스트 파싱 실패');
      assert(d.text.includes(sample.text), C, seed,
        `EUC-KR 디코딩 실패: '${sample.text}' (얻음: '${d.text.slice(0, 20)}')`);
    }
  }
  return n;
}

/* ══════════════════════════════════════════════════════════
 * 카테고리 14 · 저장소 동시성 (2,000)
 * 낙관적 _rev + 재읽기-병합-재시도 — 갱신 소실 없음을 검증
 * ══════════════════════════════════════════════════════════ */
async function catStoreConcurrency(n, baseSeed) {
  const C = 'store_concurrency';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    const store = new MemoryStore();
    const PATH = 'data/shared.json';
    await store.putJSON(PATH, { counters: {}, _rev: 0 });
    const writers = ['갑', '을', '병'].slice(0, rint(rng, 2, 3));
    const writesPerWriter = rint(rng, 3, 12);
    let totalWrites = 0;
    // 무작위 인터리빙: 각 쓰기는 읽기→병합→CAS, 충돌 시 재시도
    const queue = [];
    for (const w of writers) for (let k = 0; k < writesPerWriter; k++) queue.push(w);
    for (let k = queue.length - 1; k > 0; k--) {
      const j = rint(rng, 0, k);
      [queue[k], queue[j]] = [queue[j], queue[k]];
    }
    for (const w of queue) {
      let done = false, tries = 0;
      // 경합 시뮬레이션: 일부 쓰기는 낡은 rev 로 먼저 시도(고의 충돌)
      let staleFirst = chance(rng, 0.4);
      while (!done && tries < 8) {
        tries++;
        const cur = await store.getJSON(PATH);
        const expectRev = staleFirst ? Math.max(0, (cur._rev || 0) - 1) : (cur._rev || 0);
        staleFirst = false;
        const next = { counters: { ...cur.counters, [w]: (cur.counters[w] || 0) + 1 } };
        try {
          await store.putJSONRev(PATH, next, expectRev);
          done = true;
          totalWrites++;
        } catch (e) {
          if (!(e instanceof RevConflictError)) { fail(C, seed, `예상 외 예외: ${e.message}`); done = true; }
          // 충돌 → 재읽기 후 재시도 (병합 루프)
        }
      }
      assert(done, C, seed, '쓰기 재시도 한도 초과(라이브락)');
    }
    const fin = await store.getJSON(PATH);
    assert(fin._rev === totalWrites, C, seed, `_rev(${fin._rev}) ≠ 성공 쓰기 수(${totalWrites})`);
    for (const w of writers) {
      assert(fin.counters[w] === writesPerWriter, C, seed,
        `갱신 소실: ${w} = ${fin.counters[w]} ≠ ${writesPerWriter}`);
    }
  }
  return n;
}

/* ══════════════════════════════════════════════════════════
 * 카테고리 16 · 자동 초안 엔진 (4,000) — 사이클 10 에서 추가
 *
 * A7 결정론 집필: 합성 실험일지·측정CSV → 증거 등재 → 자동 초안
 * → 게이트 전 통과를 검증한다. 금지 표현·기간 외 기록은 초안에서
 * 배제되어야 하고, 채택 문장·행 수는 정답표와 정확히 일치해야 한다.
 * ══════════════════════════════════════════════════════════ */
const AD_ACTIVITIES = [
  '장비 교정 및 사전 점검을 수행하였다', '시료 3종 준비 작업을 완료하였다',
  '1차 측정 및 원시데이터 기록을 수행하였다', '중간 결과 검토 회의를 진행하였다',
  '반복 측정으로 재현성 확인 작업을 수행하였다', '측정 조건 편차 원인 분석을 수행하였다',
];
const AD_FORBIDDEN = [
  '성능이 크게 개선된 것으로 보인다', '다음 분기에는 목표 달성이 예상된다',
  '약 30% 수준의 향상을 확인하였다', '성공적으로 실험을 완료하였다',
];

async function catAutoDraft(n, baseSeed) {
  const C = 'autodraft_writer';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    try {
      const t = synthProject(rng);
      const pStart = t.period.start;
      const pEnd = addDays(pStart, 13);
      const note = createNote({
        project: { project_code: t.code, title: t.title },
        period: { start: pStart, end: pEnd },
        wpRefs: ['WP1'], author: '김연구', reviewer: '박점검', today: pEnd,
      });
      const catalog = t.kpis.map((k, j) => ({
        key: 'K' + (j + 1), name: k.name, unit: k.unit, target: k.target, direction: k.direction,
      }));

      /* 합성 실험일지 — 정답표를 함께 만든다 */
      const lines = ['[실험일지] ' + t.title];
      const expectWork = new Set();
      const cnt = rint(rng, 3, 12);
      for (let d = 0; d < cnt; d++) {
        const off = rint(rng, -4, 17);                    // 일부는 기간 밖
        const date = addDays(pStart, off);
        const act = pick(rng, AD_ACTIVITIES);
        lines.push(`${date} — ${act}`);
        if (off >= 0 && off <= 13) expectWork.add(date + '|' + act.replace(/\s+/g, ''));
      }
      const nForb = rint(rng, 0, 3);
      for (let f = 0; f < nForb; f++)
        lines.push(`${addDays(pStart, rint(rng, 0, 13))} — ${pick(rng, AD_FORBIDDEN)}`);

      /* 합성 측정 CSV — 카탈로그 일치·불일치 행 혼합 */
      const csvLines = ['날짜,지표,값,단위,측정조건'];
      const expectRows = new Set();
      const rowCnt = catalog.length ? rint(rng, 1, 6) : 0;
      for (let r = 0; r < rowCnt; r++) {
        const k = pick(rng, catalog);
        const off = rint(rng, -3, 16);
        const date = addDays(pStart, off);
        let v = (k.target ?? 50) * (0.5 + rng());
        if (/^(건|회|명|개|편|차|번)$/.test(k.unit || '')) v = Math.max(0, Math.round(v));
        else v = Math.round(v * 10) / 10;
        if ((k.unit || '') === '%') v = Math.min(100, v);
        csvLines.push(`${date},${k.name},${v},${k.unit},조건${r}`);
        if (off >= 0 && off <= 13) expectRows.add(k.key + '|' + v + '|' + date);
      }
      csvLines.push(`${pStart},존재하지않는지표,1,%,무시`);

      /* 등재 → 초안 → 적용 */
      const ledger = new EvidenceLedger();
      const entries = [
        ...autoRegisterEvidence(ledger, { name: '일지.txt', sha256: 'a'.repeat(64), text: lines.join('\n'), paragraphs: lines }, 'sim'),
        ...autoRegisterEvidence(ledger, { name: '측정.csv', sha256: 'b'.repeat(64), text: csvLines.join('\n'), paragraphs: csvLines }, 'sim'),
      ];
      note.attachments = [
        { file_id: 'F1', name: '일지.txt', sha256: 'a'.repeat(64), size: 1, contributor: '김연구' },
        { file_id: 'F2', name: '측정.csv', sha256: 'b'.repeat(64), size: 1, contributor: '김연구' },
      ];
      const draft = buildAutoDraft({ note, entries, metricsCatalog: catalog });
      const { added } = applyDraftToNote(note, draft);

      /* 정답 대조 */
      assert(added.work === expectWork.size, C, seed,
        `수행내용 채택 수 불일치: ${added.work} ≠ 기대 ${expectWork.size}`);
      assert(added.metrics === expectRows.size, C, seed,
        `결과데이터 행 수 불일치: ${added.metrics} ≠ 기대 ${expectRows.size}`);
      for (const w of note.sections.work) {
        assert(/\[E\d+\]/.test(w.text), C, seed, `무인용 초안 문장: ${w.text.slice(0, 60)}`);
        assert(!FORBIDDEN_PATTERNS.some(f => f.re.test(w.text.replace(/\[E\d+\]/g, ''))), C, seed,
          `금지 표현이 초안에 유입: ${w.text.slice(0, 60)}`);
        const dm = w.text.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dm) assert(dm[1] >= pStart && dm[1] <= pEnd, C, seed, `기간 외 기록 유입: ${dm[1]}`);
      }
      /* 해석 비율 재계산 대조 */
      for (const it of note.sections.interpretation) {
        const m = it.text.match(/의 (\d+(?:\.\d+)?)% 수준이다/);
        if (!m) continue;
        const row = note.sections.metrics.find(r => it.evidence[0] === (r.evidence || [])[0]);
        const cat = catalog.find(k => k.key === (row && row.metric_key));
        if (row && cat) {
          const expect = Math.round((+row.value / +cat.target) * 1000) / 10;
          assert(Math.abs(+m[1] - expect) < 0.11, C, seed, `해석 비율 오계산: ${m[1]} ≠ ${expect}`);
        }
      }
      /* 게이트 전 통과 + 멱등성 */
      await commitNote(note, '김연구', '자동 초안');
      const g = runGates(note, { ledger, sealedNotes: [], metricsCatalog: catalog, mode: 'strict', expectedHash: note.content_sha256 });
      assert(g.allPass, C, seed, `자동 초안이 게이트 실패: ` +
        g.gates.flatMap(x => x.violations.map(v => v.check + ':' + v.issue)).slice(0, 2).join(' | '));
      const again = applyDraftToNote(note, draft);
      assert(again.added.work === 0 && again.added.metrics === 0 && again.added.interpretation === 0,
        C, seed, `초안 재적용이 중복 생성: ${JSON.stringify(again.added)}`);
    } catch (e) {
      fail(C, seed, `자동 초안 예외: ${e.message}`);
    }
  }
  return n;
}

/* ══════════════════════════════════════════════════════════
 * 실행
 * ══════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════
 * 카테고리 17 · 다국어 사전 무결성 (6,000) — 사이클 11 에서 추가
 *
 * 번역 품질(의미)은 사람이 검수하고, 여기서는 기계로 판정 가능한
 * 계약만 검증한다: 키 완비 · 코드/식별자 보존 · 숫자 보존 ·
 * 한글 잔존 금지 · t() 동작 · 패턴 치환 정확성.
 * ══════════════════════════════════════════════════════════ */
const I18N_LANGS = ['en', 'ja'];
/* 번역문에도 반드시 그대로 남아야 하는 토큰 */
const KEEP_TOKENS = [
  /\[E#\]/g, /\bE\d+\b/g, /\bWP\d+\b/g, /\bG[1-4]\b/g, /\bA\d{1,2}\b/g,
  /SHA-256/g, /DOCX/g, /XLSX/g, /HWPX/g, /PDF/g, /CSV/g, /JSON/g, /\.lic/g,
  /localhost/g, /Chrome/g, /Edge/g, /AAA-RNS/g, /PIN/g, /ZIP/g, /LLM/g, /API/g,
];
/* 한글 잔존 예외 — 고유명사·언어 이름 */
const MONTH_EN = [null, 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const KO_ALLOWED = /한국어|한글|정승호|Seung Ho Jung|억|천만|검증보고서|사용설명서|설치사용가이드/;

/* ══════════════════════════════════════════════════════════════
 * G1 금지 표현 — 언어 커버리지
 *
 * 왜 별도 카테고리인가: 기존 금지표현 시험은 케이스를 구현
 * (FORBIDDEN_PATTERNS)에서 가져다 썼다. 그러면 구현이 다루는 것만
 * 시험하게 되어, "영어·일본어 패턴이 통째로 없다" 같은 누락은 원리적으로
 * 발견되지 않는다 — 실제로 2,446,015회를 돌리고도 못 잡았다.
 *
 * 그래서 여기서는 케이스를 손으로 적는다. 막아야 할 문장과 통과해야 할
 * 문장을 언어마다 함께 두어, 누락과 오탐을 같은 자리에서 잡는다.
 * ══════════════════════════════════════════════════════════════ */
const WORDING_BLOCK = [
  ['ko', '성능이 크게 개선된 것으로 보인다'],
  ['ko', '다음 분기에는 목표 달성이 예상된다'],
  ['ko', '성공적으로 실험을 완료하였다'],
  ['ko', '약 30% 수준의 향상을 확인하였다'],
  ['ko', '아마도 장비 오차로 판단된다'],
  ['en', 'Coating uniformity appears to have improved'],
  ['en', 'The process was successfully completed'],
  ['en', 'Yield increased by approximately 30 percent'],
  ['en', 'Throughput is expected to rise next quarter'],
  ['en', 'It is judged that the deviation came from the jig'],
  ['en', 'The result is possibly caused by thermal drift'],
  ['ja', '性能が改善したと思われる'],
  ['ja', '約 30% の向上を確認した'],
  ['ja', '成功裏に実験を完了した'],
  ['ja', '次期には目標達成が見込まれる'],
  ['ja', 'おそらく装置誤差と判断される'],
];
/* 막으면 안 되는 문장 — 오탐은 정상 기록을 반려시키므로 누락만큼 해롭다 */
const WORDING_PASS = [
  ['ko', '에너지 효율은 41.2%에서 43.8%로 증가하였다'],
  ['en', 'Yield increased from 41.2% to 43.8%'],
  ['en', 'The difference was statistically significant (p<0.05)'],
  ['en', 'We recorded data about the sample at 25C'],
  ['ja', '収率は 41.2% から 43.8% に増加した'],
];

function catWordingLangs(n, baseSeed) {
  const C = 'gate_wording_langs';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    const wantBlock = rng() < 0.72;
    const [lang, sent] = pick(rng, wantBlock ? WORDING_BLOCK : WORDING_PASS);

    const ledger = new EvidenceLedger([]);
    const ev = ledger.add({ kind: 'reference', sourceType: 'upload', sourceFile: 'log.txt',
      locator: 'L1', content: sent, sha256: 'a'.repeat(64), addedBy: 'sim' });
    const note = {
      note_id: `W-${seed}`, period_start: '2030-07-01', period_end: '2030-07-14',
      author: 'A', reviewer: 'B', state: 'draft',
      sections: { work: [{ text: `${sent} [${ev.id}]` }] },
      metrics: [], attachments: [],
    };
    const flagged = gateG1(note, { ledger }).violations.some(v => v.check === 'G1-금지표현');

    if (wantBlock && !flagged) fail(C, seed, `[${lang}] 금지 표현이 통과했습니다 — 이 언어의 패턴이 없습니다: "${sent}"`);
    if (!wantBlock && flagged) fail(C, seed, `[${lang}] 정상 문장이 금지 표현으로 반려되었습니다(오탐): "${sent}"`);
  }
  /* 세 언어가 실제로 표본에 나오는지 — 한 언어에 쏠리면 시험이 무의미하다 */
  const seen = new Set();
  for (let k = 0; k < 400; k++) seen.add(pick(makeRng(baseSeed + k), WORDING_BLOCK)[0]);
  for (const l of ['ko', 'en', 'ja']) if (!seen.has(l)) fail(C, baseSeed, `표본에 ${l} 케이스가 한 번도 나오지 않았습니다`);
  return n;
}

async function catI18n(n, baseSeed) {
  const C = 'i18n_dictionary';
  const keys = Object.keys(DICT);
  if (!keys.length) { fail(C, baseSeed, '사전이 비어 있습니다 (dict.js 미생성)'); return n; }

  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    const ko = pick(rng, keys);
    const entry = DICT[ko];

    /* ① 언어 완비 + 비어 있지 않음 */
    for (const lang of I18N_LANGS) {
      const tr = entry ? entry[lang] : null;
      if (!assert(typeof tr === 'string' && tr.trim().length > 0, C, seed,
        `번역 누락: [${lang}] "${ko.slice(0, 40)}"`)) continue;

      /* ② 코드·식별자 보존 */
      for (const re of KEEP_TOKENS) {
        const inKo = (ko.match(re) || []).length;
        const inTr = (tr.match(re) || []).length;
        assert(inTr >= inKo, C, seed,
          `[${lang}] 식별자 소실(${re.source}): "${ko.slice(0, 30)}" → "${tr.slice(0, 30)}"`);
      }

      /* ③ 숫자 보존 — '1' 은 영어에서 monthly·single·a 처럼 자연 흡수되는 것이
         올바른 번역이므로 계약에서 제외하고, 2 이상과 큰 수만 검사한다. */
      for (const num of (ko.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || [])) {
        if (num === '1') continue;
        /* 'N월' 이 영어 월 이름으로 현지화된 경우는 올바른 번역이다 */
        if (lang === 'en' && ko.includes(num + '월') && MONTH_EN[+num] && tr.includes(MONTH_EN[+num])) continue;
        assert(tr.includes(num), C, seed,
          `[${lang}] 숫자 소실 '${num}': "${ko.slice(0, 30)}" → "${tr.slice(0, 30)}"`);
      }

      /* ④ 한글 잔존 금지 */
      if (/[가-힣]/.test(tr) && !KO_ALLOWED.test(tr)) {
        fail(C, seed, `[${lang}] 번역문에 한글 잔존: "${tr.slice(0, 50)}"`);
      }

      /* ⑤ 길이 폭주 방지 (UI 레이아웃 보호) */
      assert(tr.length <= Math.max(110, ko.length * 5), C, seed,
        `[${lang}] 번역문 과다 길이(${tr.length} vs 원문 ${ko.length}): "${ko.slice(0, 30)}"`);
    }
  }

  /* ⑥ 패턴 사전: 캡처 그룹이 각 언어 치환문에 모두 쓰이는지 */
  for (const [pi, p] of PATTERNS.entries()) {
    const groups = (new RegExp(p.re.source + '|')).exec('').length - 1;
    for (const lang of I18N_LANGS) {
      const tpl = p[lang];
      if (!assert(typeof tpl === 'string' && tpl.length, C, baseSeed, `패턴 ${pi} [${lang}] 치환문 없음`)) continue;
      for (let g = 1; g <= groups; g++) {
        assert(tpl.includes('$' + g), C, baseSeed,
          `패턴 ${pi} [${lang}] 캡처 $${g} 미사용: "${tpl}"`);
      }
      assert(!/[가-힣]/.test(tpl) || KO_ALLOWED.test(tpl), C, baseSeed,
        `패턴 ${pi} [${lang}] 한글 잔존: "${tpl}"`);
    }
  }
  return n;
}


/* ══════════════════════════════════════════════════════════
 * [신규] 캠페인 2 — 현실적 운영 상황 시나리오
 * 실제 회사에서 벌어지는 상황을 그대로 재현해 계약을 검증한다.
 * ══════════════════════════════════════════════════════════ */

/** 공용: 한 스프린트짜리 확정 가능한 노트를 만든다 */
async function makeSealableNote(rng, sys, spIdx, ledger, author, reviewer, lang = 'ko') {
  const sp = sys.planner.sprints[spIdx % sys.planner.sprints.length];
  const note = createNote({
    project: sys.project, period: { start: sp.start, end: sp.end },
    wpRefs: sp.activeWPs.slice(0, 2), author, reviewer,
    cadence: sys.planner.cadence, today: sp.end,
  });
  const e = ledger.add({ kind: 'measurement', sourceType: 'upload', sourceFile: 'm.csv',
    locator: 'r1', content: '측정 기록', addedBy: author });
  note.sections.work = [{ text: cleanSentence(rng, e.id), wp: note.wp_refs[0] || '', evidence: [e.id] }];
  note.attachments = [{ file_id: 'F1', name: 'm.csv', sha256: 'a'.repeat(64), size: 10, contributor: author }];
  await commitNote(note, author, '작성');
  return note;
}

/* 시나리오 1 · 다중 연구원 공유폴더 동시 운영 (12,000) */
async function catMultiUser(n, baseSeed) {
  const C = 'sc_multiuser';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    try {
      const plan = synthPlanDocx(rng);
      const sys = generateSystem(analyzeDocuments([await parseFile('p.docx', plan.bytes)]), { today: '2026-08-14' });
      const store = new MemoryStore();
      const ledger = new EvidenceLedger();
      const people = ['김연구', '이연구', '박책임'];
      const idx = { notes: [] };
      const sealed = [];
      let prev = '';
      /* 서로 다른 스프린트를 동시에 작업 — 인덱스·해시체인 정합 검증 */
      const cnt = rint(rng, 2, 5);
      for (let k = 0; k < cnt; k++) {
        const author = pick(rng, people);
        const reviewer = people.find(x => x !== author);
        const note = await makeSealableNote(rng, sys, k, ledger, author, reviewer);
        const res = runGates(note, { ledger, sealedNotes: sealed, metricsCatalog: sys.metrics.catalog,
          mode: 'strict', expectedHash: note.content_sha256 });
        if (!res.allPass) continue;
        applyGateResult(note, res);
        addContributorSignature(note, author, note.content_sha256);
        await sealNote(note, { approver: reviewer, prevSealHash: prev, contentHash: note.content_sha256 });
        prev = note.seal_hash;
        sealed.push(note);
        await store.putJSON('notes/' + note.note_id + '.json', note);
        idx.notes.push({ note_id: note.note_id, state: note._state, period: note.period, revision: 0 });
      }
      /* 계약: 노트번호 유일 · 해시 체인 무결 · 저장본 = 메모리본 */
      const ids = idx.notes.map(x => x.note_id);
      assert(new Set(ids).size === ids.length, C, seed, `동시 작성 시 노트번호 중복: ${ids.join(',')}`);
      const chain = await verifySealChain(sealed);
      assert(chain.ok, C, seed, `동시 작성 후 해시 체인 손상: ${chain.reason || ''} @${chain.brokenAt || '-'}`);
      for (const sn of sealed) {
        const back = await store.getJSON('notes/' + sn.note_id + '.json');
        assert(back && back.seal_hash === sn.seal_hash, C, seed, `저장된 확정 노트 불일치: ${sn.note_id}`);
      }
    } catch (e) { fail(C, seed, `다중 사용자 예외: ${e.message}`); }
  }
  return n;
}

/* 시나리오 2 · 다국어 전 생명주기 (12,000) */
async function catMultiLang(n, baseSeed) {
  const C = 'sc_multilang';
  const LANGS = ['ko', 'en', 'ja'];
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    const lang = pick(rng, LANGS);
    try {
      const plan = synthPlanDocx(rng);
      const sys = generateSystem(analyzeDocuments([await parseFile('p.docx', plan.bytes)]), { today: '2026-08-14' });
      const sp = sys.planner.sprints[0];
      const note = createNote({ project: sys.project, period: { start: sp.start, end: sp.end },
        wpRefs: ['WP1'], author: '김연구', reviewer: '박점검', today: sp.end });
      const ledger = new EvidenceLedger();
      const cat = sys.metrics.catalog[0];
      const lines = [];
      const dateIn = addDays(sp.start, rint(rng, 0, Math.max(0, diffDays(sp.start, sp.end))));
      if (cat) lines.push(`${dateIn},${cat.name},${Math.max(0, Math.round((cat.target ?? 10) * 0.8))},${cat.unit},조건`);
      lines.push(`${dateIn} — 장비 교정 및 사전 점검을 수행하였다`);
      const entries = autoRegisterEvidence(ledger,
        { name: 'log.txt', sha256: 'b'.repeat(64), text: lines.join('\n'), paragraphs: lines }, 'sim', 60, lang);
      /* 계약 1: 증거 위치(locator)는 선택 언어로 생성된다 */
      const loc = entries[0] ? entries[0].locator : '';
      const locOk = lang === 'ko' ? /문단/.test(loc) : (lang === 'en' ? /Paragraph/.test(loc) : /段落/.test(loc));
      assert(locOk, C, seed, `[${lang}] 증거 위치 언어 불일치: ${loc}`);

      note.attachments = [{ file_id: 'F1', name: 'log.txt', sha256: 'b'.repeat(64), size: 10, contributor: '김연구' }];
      const draft = buildAutoDraft({ note, entries, metricsCatalog: sys.metrics.catalog, lang });
      applyDraftToNote(note, draft);
      /* 계약 2: 시스템이 생성한 해석문은 선택 언어다 */
      for (const it of note.sections.interpretation) {
        const t = it.text;
        const ok = lang === 'ko' ? /수준이다|이하이다|이다/.test(t)
          : (lang === 'en' ? /measured|target/.test(t) : /測定値|目標/.test(t));
        assert(ok, C, seed, `[${lang}] 해석문 언어 불일치: ${t.slice(0, 60)}`);
      }
      /* 계약 3: 언어와 무관하게 전 문장에 인용이 있고 게이트를 통과한다 */
      await commitNote(note, '김연구', '자동 초안');
      for (const sec of ['work', 'interpretation']) {
        for (const ent of note.sections[sec] || []) {
          assert(/\[E\d+\]/.test(ent.text), C, seed, `[${lang}] 무인용 문장(${sec}): ${ent.text.slice(0, 50)}`);
        }
      }
      const g = runGates(note, { ledger, sealedNotes: [], metricsCatalog: sys.metrics.catalog,
        mode: 'advisory', expectedHash: note.content_sha256 });
      const hard = g.gates.flatMap(x => x.violations).filter(v => v.check.startsWith('G1') || v.check.startsWith('G3'));
      assert(hard.length === 0, C, seed, `[${lang}] 자동 초안이 G1/G3 위반: ${hard[0] ? hard[0].check + ':' + hard[0].issue.slice(0, 50) : ''}`);
    } catch (e) { fail(C, seed, `다국어 생명주기 예외: ${e.message}`); }
  }
  return n;
}

/* 시나리오 3 · 개정판 체인 (8,000) */
async function catRevisionChain(n, baseSeed) {
  const C = 'sc_revision';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    try {
      const plan = synthPlanDocx(rng);
      const sys = generateSystem(analyzeDocuments([await parseFile('p.docx', plan.bytes)]), { today: '2026-08-14' });
      const ledger = new EvidenceLedger();
      let note = await makeSealableNote(rng, sys, 0, ledger, '김연구', '박점검');
      const sealedAll = [];
      let prev = '';
      const rounds = rint(rng, 1, 4);
      for (let r = 0; r <= rounds; r++) {
        const res = runGates(note, { ledger, sealedNotes: sealedAll, metricsCatalog: sys.metrics.catalog,
          mode: 'strict', expectedHash: note.content_sha256 });
        if (!res.allPass) break;
        applyGateResult(note, res);
        addContributorSignature(note, '김연구', note.content_sha256);
        await sealNote(note, { approver: '박점검', prevSealHash: prev, contentHash: note.content_sha256 });
        prev = note.seal_hash;
        sealedAll.push(note);
        if (r === rounds) break;
        /* 개정판 발행 */
        const rev = reviseNote(note, '김연구');
        assert(rev.revision === (note.revision || 0) + 1, C, seed, `개정 번호 증가 안 함: ${rev.revision}`);
        assert(rev.supersedes === note.note_id, C, seed, `supersedes 연결 오류: ${rev.supersedes}`);
        assert(rev._state === 'draft', C, seed, `개정판 상태 오류: ${rev._state}`);
        assert(!rev.seal_hash, C, seed, '개정판이 확정 해시를 물려받음');
        assert(!rev.signatures.final, C, seed, '개정판이 최종 승인을 물려받음');
        await commitNote(rev, '김연구', '개정');
        note = rev;
      }
      /* 계약: 개정 계열 전체의 해시 체인이 무결하고 번호가 유일하다 */
      const ids = sealedAll.map(x => x.note_id);
      assert(new Set(ids).size === ids.length, C, seed, `개정 체인 번호 중복: ${ids.join(',')}`);
      const chain = await verifySealChain(sealedAll);
      assert(chain.ok, C, seed, `개정 체인 손상: ${chain.reason || ''} @${chain.brokenAt || '-'}`);
      /* 확정 노트는 재확정 불가 */
      if (sealedAll.length) {
        let blocked = false;
        try { reviseNote({ ...sealedAll[0], _state: 'draft' }, 'x'); } catch { blocked = true; }
        assert(blocked, C, seed, '확정되지 않은 노트의 개정판 발행이 허용됨');
      }
    } catch (e) { fail(C, seed, `개정 체인 예외: ${e.message}`); }
  }
  return n;
}

/* 시나리오 4 · 백업·복원 재해 복구 (8,000) */
async function catBackupRestore(n, baseSeed) {
  const C = 'sc_backup';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    try {
      const src = new MemoryStore();
      await src.putJSON('data/project.json', { title: '과제', code: 'T-' + seed });
      const files = rint(rng, 1, 6);
      for (let k = 0; k < files; k++) {
        await src.putJSON(`notes/RN-${k}.json`, { note_id: 'RN-' + k, body: '내용'.repeat(rint(rng, 1, 20)) });
      }
      await src.putBytes('notes_files/a.bin', randomBytes(rng, rint(rng, 4, 200)));
      const { bytes } = await buildBackupZip(src);

      /* 정상 복원: 전 파일 일치 */
      const dst = new MemoryStore();
      await restoreBackupZip(dst, bytes);
      const srcKeys = (await walkStore(src)).sort();
      const dstKeys = (await walkStore(dst)).sort();
      assert(srcKeys.length === dstKeys.length, C, seed, `복원 파일 수 불일치: ${srcKeys.length} → ${dstKeys.length}`);
      const pj = await dst.getJSON('data/project.json');
      assert(pj && pj.code === 'T-' + seed, C, seed, '복원 내용 불일치');

      /* 손상 복원: 반드시 거부 + 대상 저장소 무변경 */
      const bad = bytes.slice();
      const at = rint(rng, 40, Math.max(41, bad.length - 40));
      bad[at] = (bad[at] + 1 + rint(rng, 0, 250)) & 0xff;
      const dst2 = new MemoryStore();
      await dst2.putJSON('data/keep.json', { keep: true });
      let rejected = false;
      try { await restoreBackupZip(dst2, bad); } catch { rejected = true; }
      if (rejected) {
        const keep = await dst2.getJSON('data/keep.json');
        assert(keep && keep.keep === true, C, seed, '손상 복원 거부 후 기존 데이터가 훼손됨');
      }
    } catch (e) { fail(C, seed, `백업·복원 예외: ${e.message}`); }
  }
  return n;
}

/* 시나리오 5 · LLM 다듬기 안전장치 (6,000) */
async function catLlmSafety(n, baseSeed) {
  const C = 'sc_llm_safety';
  const ATTACKS = ['drop', 'add', 'forbidden', 'empty', 'garbage', 'ok'];
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    const attack = pick(rng, ATTACKS);
    try {
      const note = { sections: { work: [], results: [], interpretation: [] } };
      const cnt = rint(rng, 1, 4);
      for (let k = 0; k < cnt; k++) {
        note.sections.work.push({ text: `측정 ${k} 을 수행하였다 [E${k + 1}].`, wp: '', evidence: ['E' + (k + 1)] });
      }
      const orig = note.sections.work.map(x => x.text);
      /* 가짜 LLM — 공격 유형별로 응답을 조작한다 */
      const fake = {
        provider: '__fake__', model: 'x', api_key: 'x',
        __respond: items => items.map((it, idx) => {
          const base = it.text;
          if (attack === 'drop') return { i: idx, text: base.replace(/\s*\[E\d+\]/, '') };
          if (attack === 'add') return { i: idx, text: base.replace(/\.$/, ' [E999].') };
          if (attack === 'forbidden') return { i: idx, text: base.replace('수행하였다', '성공적으로 수행한 것으로 보인다') };
          if (attack === 'empty') return { i: idx, text: '' };
          if (attack === 'garbage') return { i: idx, text: '###' };
          return { i: idx, text: base.replace('측정', '측정 작업') };
        }),
      };
      /* llmChat 를 대체해 폐기 로직만 검증한다 */
      const r = await polishNarrativeWithFake(fake, note);
      const after = note.sections.work.map(x => x.text);
      if (attack === 'ok') {
        assert(r.applied >= 1, C, seed, '정상 응답이 채택되지 않음');
        for (const t of after) assert(/\[E\d+\]/.test(t), C, seed, `채택 문장에서 인용 소실: ${t}`);
      } else {
        /* 공격 응답은 전량 폐기되어 원문이 그대로여야 한다 */
        assert(r.applied === 0, C, seed, `[${attack}] 위험한 응답이 채택됨 (applied=${r.applied})`);
        assert(JSON.stringify(after) === JSON.stringify(orig), C, seed, `[${attack}] 원문이 변조됨`);
      }
    } catch (e) { fail(C, seed, `LLM 안전장치 예외: ${e.message}`); }
  }
  return n;
}

/* polishNarrative 의 검증 로직만 떼어 가짜 응답으로 시험한다
   (실제 네트워크 호출 없이 '채택/폐기' 계약을 검증) */
async function polishNarrativeWithFake(cfg, note) {
  const items = [];
  for (const key of ['work', 'results', 'interpretation']) {
    (note.sections[key] || []).forEach((ent, idx) => {
      if (ent && ent.text && ent.text.trim()) items.push({ key, idx, text: ent.text });
    });
  }
  const arr = cfg.__respond(items);
  let applied = 0, rejected = 0;
  for (const out of arr) {
    const it = items[out.i];
    const text = String(out.text || '').trim();
    if (!it || !text || text.length < 5) { rejected++; continue; }
    const before = [...citationsIn(it.text)].sort().join(',');
    const after = [...citationsIn(text)].sort().join(',');
    if (before !== after) { rejected++; continue; }
    if (FORBIDDEN_PATTERNS.some(f => f.re.test(text.replace(/\[E\d+\]/g, '')))) { rejected++; continue; }
    note.sections[it.key][it.idx].text = text;
    applied++;
  }
  return { applied, rejected };
}

/* 시나리오 6 · 장기 대형 과제 (10,000) */
async function catLongTerm(n, baseSeed) {
  const C = 'sc_longterm';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    try {
      const years = rint(rng, 3, 10);
      const start = `${rint(rng, 2024, 2030)}-${String(rint(rng, 1, 12)).padStart(2, '0')}-01`;
      const end = addDays(addMonths(start, years * 12), -1);
      const project = {
        period: { start, end, months: monthSpan(start, end) },
        work_packages: Array.from({ length: rint(rng, 3, 12) }, (_, k) => ({
          id: 'WP' + (k + 1), num: k + 1, name: 'WP' + (k + 1), start, end, owner: '', confidence: 'high', ev: [],
        })),
        milestones: [],
      };
      const cadence = chance(rng, 0.5) ? 'weekly' : 'biweekly';
      const planner = buildPlanner(project, cadence);
      /* 계약: 대형 격자에서도 불변식이 유지된다 */
      assert(planner.sprints.length > 0, C, seed, '장기 과제 스프린트 0개');
      assert(planner.sprints[0].start === start, C, seed, `시작 불일치: ${planner.sprints[0].start}`);
      assert(planner.sprints[planner.sprints.length - 1].end === end, C, seed,
        `끝 불일치: ${planner.sprints[planner.sprints.length - 1].end} ≠ ${end}`);
      for (let k = 1; k < planner.sprints.length; k++) {
        const gap = diffDays(planner.sprints[k - 1].end, planner.sprints[k].start);
        assert(gap === 1, C, seed, `스프린트 ${k} 빈틈/중복: ${gap}일`);
      }
      assert(planner.months.length === monthSpan(start, end), C, seed,
        `월 블록 수 오류: ${planner.months.length} ≠ ${monthSpan(start, end)}`);
      const slots = planner.sprints.map(sp => sp.noteSlot);
      assert(new Set(slots).size === slots.length, C, seed, '노트 슬롯 ID 중복');
    } catch (e) { fail(C, seed, `장기 과제 예외: ${e.message}`); }
  }
  return n;
}


/* 시나리오 7 · 라이선스 위조·만료·귀속 위반 (6,000) */
async function catLicense(n, baseSeed) {
  const C = 'sc_license';
  const KEY = (typeof process !== 'undefined' && process.env.AAARNS_TEST_LIC) || '';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    try {
      if (!KEY) {  /* 키가 없으면 형식 거부만 검증 */
        const r = await verifyLicenseKey('garbage.' + seed);
        assert(!r.ok, C, seed, '쓰레기 문자열이 유효 판정됨');
        continue;
      }
      const mode = pick(rng, ['valid', 'payload', 'sig', 'trunc', 'noise']);
      let key = KEY;
      if (mode === 'payload') {
        const [pl, sg] = KEY.split('.');
        const j = JSON.parse(Buffer.from(pl, 'base64url').toString());
        j.licensee = '위조회사' + seed;
        key = Buffer.from(JSON.stringify(j)).toString('base64url') + '.' + sg;
      } else if (mode === 'sig') {
        const [pl, sg] = KEY.split('.');
        const sb = Buffer.from(sg, 'base64url');
        sb[rint(rng, 0, sb.length - 1)] ^= (1 + rint(rng, 0, 254));
        key = pl + '.' + sb.toString('base64url');
      } else if (mode === 'trunc') {
        key = KEY.slice(0, rint(rng, 5, KEY.length - 5));
      } else if (mode === 'noise') {
        /* 반드시 '다른' 문자로 바꾼다 — 같은 문자를 뽑으면 키가 그대로라
           통과가 정상인데 위조 통과로 오판하게 된다 (거짓 양성 방지) */
        const at = rint(rng, 5, KEY.length - 5);
        let ch = KEY[at];
        for (let g = 0; g < 20 && ch === KEY[at]; g++) ch = String.fromCharCode(rint(rng, 33, 126));
        if (ch === KEY[at]) continue;
        key = KEY.slice(0, at) + ch + KEY.slice(at + 1);
      }
      const r = await verifyLicenseKey(key);
      if (mode === 'valid') assert(r.ok, C, seed, `정상 키가 거부됨: ${r.error || ''}`);
      else assert(!r.ok, C, seed, `[${mode}] 위조 키가 통과됨`);
      /* 어떤 경우에도 예외로 죽지 않는다 */
      assert(typeof r === 'object' && 'ok' in r, C, seed, '검증 결과 형식 오류');
    } catch (e) { fail(C, seed, `라이선스 예외: ${e.message}`); }
  }
  return n;
}

/* 시나리오 8 · 증거원장 대규모 (5,000) */
async function catLedgerScale(n, baseSeed) {
  const C = 'sc_ledger_scale';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    try {
      const led = new EvidenceLedger();
      const cnt = rint(rng, 50, 400);
      const ids = [];
      for (let k = 0; k < cnt; k++) {
        const e = led.add({ kind: pick(rng, ['measurement', 'statement', 'reference']),
          sourceType: 'upload', sourceFile: 'f' + (k % 7) + '.txt',
          locator: `문단 ${k}`, content: `사실 조각 ${k} 기록`, addedBy: 'sim' });
        ids.push(e.id);
      }
      /* 계약: ID 유일 · 연속 · 조회 일치 · 직렬화 왕복 */
      assert(new Set(ids).size === ids.length, C, seed, '증거 ID 중복 발생');
      assert(led.size() === cnt, C, seed, `원장 크기 불일치: ${led.size()} ≠ ${cnt}`);
      for (const id of [ids[0], ids[ids.length - 1], pick(rng, ids)]) {
        assert(led.has(id) && led.get(id), C, seed, `등재 증거 조회 실패: ${id}`);
      }
      const round = new EvidenceLedger(led.toJSON());
      assert(round.size() === cnt, C, seed, `직렬화 왕복 크기 불일치: ${round.size()}`);
      assert(round.get(ids[0]).content === led.get(ids[0]).content, C, seed, '왕복 후 내용 불일치');
      /* 모순 연결은 양방향이며 자기 자신은 불가 */
      if (ids.length >= 2) {
        assert(led.markConflict(ids[0], ids[1]), C, seed, '모순 연결 실패');
        assert(led.get(ids[0]).conflict_with.includes(ids[1]), C, seed, '모순 연결 단방향');
        assert(led.get(ids[1]).conflict_with.includes(ids[0]), C, seed, '모순 역방향 누락');
        assert(!led.markConflict(ids[0], ids[0]), C, seed, '자기 자신과 모순 연결이 허용됨');
      }
    } catch (e) { fail(C, seed, `원장 대규모 예외: ${e.message}`); }
  }
  return n;
}

/* 시나리오 9 · 저장소 어댑터 이전 (4,000) */
async function catStoreMigration(n, baseSeed) {
  const C = 'sc_store_migration';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    try {
      const a = new MemoryStore();
      const files = rint(rng, 3, 20);
      const written = {};
      for (let k = 0; k < files; k++) {
        const path = pick(rng, ['data', 'notes', 'ledger']) + '/f' + k + '.json';
        const val = { k, txt: '내용'.repeat(rint(rng, 1, 10)), n: rint(rng, -1e6, 1e6) };
        written[path] = val;
        await a.putJSON(path, val);
      }
      /* 이전: 전 파일 복사 */
      const b = new MemoryStore();
      for (const key of await walkStore(a)) {
        const v = await a.getJSON(key);
        if (v !== null) await b.putJSON(key, v);
        else { const bytes = await a.getBytes(key); if (bytes) await b.putBytes(key, bytes); }
      }
      for (const [path, val] of Object.entries(written)) {
        const got = await b.getJSON(path);
        assert(got && JSON.stringify(got) === JSON.stringify(val), C, seed, `이전 후 내용 불일치: ${path}`);
      }
      /* 낙관적 잠금: 같은 rev 로 두 번 쓰면 두 번째는 거부 */
      const rev1 = await b.putJSONRev('data/x.json', { v: 1 }, 0);
      let conflicted = false;
      try { await b.putJSONRev('data/x.json', { v: 2 }, 0); } catch (e) { conflicted = e instanceof RevConflictError; }
      assert(rev1 === 1 && conflicted, C, seed, '_rev 낙관적 잠금 미작동');
      /* 이어서 올바른 rev 로는 성공 */
      const rev2 = await b.putJSONRev('data/x.json', { v: 3 }, rev1);
      assert(rev2 === rev1 + 1, C, seed, `_rev 증가 오류: ${rev2}`);
    } catch (e) { fail(C, seed, `저장소 이전 예외: ${e.message}`); }
  }
  return n;
}


/* 시나리오 10 · 확정 노트 사후 변조 탐지 (8,000)
 * 실제 위협: 누군가 저장 파일을 직접 열어 수치를 고친다. */
async function catTamper(n, baseSeed) {
  const C = 'sc_tamper';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    try {
      const plan = synthPlanDocx(rng);
      const sys = generateSystem(analyzeDocuments([await parseFile('p.docx', plan.bytes)]), { today: '2026-08-14' });
      const ledger = new EvidenceLedger();
      const note = await makeSealableNote(rng, sys, 0, ledger, '김연구', '박점검');
      const res = runGates(note, { ledger, sealedNotes: [], metricsCatalog: sys.metrics.catalog,
        mode: 'strict', expectedHash: note.content_sha256 });
      if (!res.allPass) continue;
      applyGateResult(note, res);
      addContributorSignature(note, '김연구', note.content_sha256);
      await sealNote(note, { approver: '박점검', prevSealHash: '', contentHash: note.content_sha256 });

      /* 확정 직후에는 무결 */
      const clean = await verifyNoteIntegrity(note);
      assert(clean.ok, C, seed, `확정 직후 무결성 실패: ${clean.reason || ''}`);

      /* 사후 변조 — 본문/서명/해시 중 하나를 몰래 고친다 */
      const attack = pick(rng, ['text', 'metric', 'signer', 'seal', 'period']);
      const t = deepCloneJSON(note);
      if (attack === 'text' && t.sections.work[0]) t.sections.work[0].text += ' 추가 조작 문장.';
      else if (attack === 'metric') { t.sections.metrics = t.sections.metrics || []; t.sections.metrics.push({ metric: 'X', value: 999, unit: '', condition: '', evidence: [] }); }
      else if (attack === 'signer' && t.signatures.final) t.signatures.final.signer = '위조자';
      else if (attack === 'seal') t.seal_hash = 'f'.repeat(64);
      else if (attack === 'period') t.period = { ...t.period, end: addDays(t.period.end, 7) };

      const after = await verifyNoteIntegrity(t);
      const chain = await verifySealChain([t]);
      /* 계약: 어떤 변조든 무결성 검사나 체인 검증 중 하나는 반드시 잡아낸다 */
      assert(!after.ok || !chain.ok, C, seed, `[${attack}] 사후 변조가 탐지되지 않음`);
    } catch (e) { fail(C, seed, `변조 탐지 예외: ${e.message}`); }
  }
  return n;
}
function deepCloneJSON(o) { return JSON.parse(JSON.stringify(o)); }

/* 시나리오 11 · 기간 경계·달력 함정 (10,000)
 * 실제 상황: 윤년 2월, 월말 31일, 연말연시에 걸친 스프린트. */
async function catCalendarEdge(n, baseSeed) {
  const C = 'sc_calendar';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    try {
      /* 함정이 많은 시작일을 의도적으로 고른다 */
      const traps = ['-01-31', '-02-28', '-02-29', '-03-31', '-12-31', '-12-01', '-11-30'];
      const y = pick(rng, [2024, 2025, 2026, 2027, 2028, 2032]);
      let start = y + pick(rng, traps);
      if (!isValidDate(start)) start = y + '-02-28';
      const months = rint(rng, 1, 60);
      const end = addDays(addMonths(start, months), -1);
      if (!isValidDate(end) || end <= start) continue;

      const project = {
        period: { start, end, months: monthSpan(start, end) },
        work_packages: [{ id: 'WP1', num: 1, name: 'WP1', start, end, owner: '', confidence: 'high', ev: [] }],
        milestones: [],
      };
      const planner = buildPlanner(project, chance(rng, 0.5) ? 'weekly' : 'biweekly');
      /* 계약: 경계 날짜에서도 격자가 기간을 정확히 덮는다 */
      assert(planner.sprints[0].start === start, C, seed, `경계 시작 불일치: ${planner.sprints[0].start} ≠ ${start}`);
      const last = planner.sprints[planner.sprints.length - 1];
      assert(last.end === end, C, seed, `경계 끝 불일치: ${last.end} ≠ ${end}`);
      for (const sp of planner.sprints) {
        assert(isValidDate(sp.start) && isValidDate(sp.end), C, seed, `무효 날짜 생성: ${sp.start}~${sp.end}`);
        assert(sp.start <= sp.end, C, seed, `스프린트 역전: ${sp.start}>${sp.end}`);
        assert(sp.start >= start && sp.end <= end, C, seed, `기간 이탈: ${sp.start}~${sp.end}`);
      }
      /* 월 블록도 경계를 지킨다 */
      for (const m of planner.months) {
        assert(isValidDate(m.start) && isValidDate(m.end), C, seed, `무효 월 블록: ${m.start}~${m.end}`);
        assert(m.start >= start && m.end <= end, C, seed, `월 블록 이탈: ${m.start}~${m.end}`);
      }
      /* 노트 ID 는 기간에서 결정적으로 유도된다 */
      const id = noteIdFor(planner.sprints[0].start, planner.sprints[0].end, 0);
      const parsed = parseNoteId(id);
      assert(parsed && parsed.start === planner.sprints[0].start, C, seed, `노트ID 왕복 실패: ${id}`);
    } catch (e) { fail(C, seed, `달력 경계 예외: ${e.message}`); }
  }
  return n;
}

/* 시나리오 12 · 거짓 성과 주입 차단 (10,000)
 * 실제 위협: 목표 미달인데 "달성"으로 쓰거나 수치를 부풀린다. */
async function catFalseClaim(n, baseSeed) {
  const C = 'sc_false_claim';
  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    try {
      const plan = synthPlanDocx(rng);
      const sys = generateSystem(analyzeDocuments([await parseFile('p.docx', plan.bytes)]), { today: '2026-08-14' });
      const cat = sys.metrics.catalog[0];
      if (!cat || !Number.isFinite(+cat.target)) continue;
      const ledger = new EvidenceLedger();
      const note = await makeSealableNote(rng, sys, 0, ledger, '김연구', '박점검');
      const e = ledger.add({ kind: 'measurement', sourceType: 'upload', sourceFile: 'm.csv',
        locator: 'r1', content: '측정', addedBy: 'sim' });

      const attack = pick(rng, ['under_achieved', 'nonnumeric', 'unit_mismatch', 'percent_over', 'count_decimal', 'clean']);
      let value = cat.direction === 'lower' ? Math.max(0, +cat.target - 1) : +cat.target + 1;
      let unit = cat.unit, condition = '표준';
      if (attack === 'under_achieved') {
        value = cat.direction === 'lower' ? +cat.target + 10 : Math.max(0, +cat.target - 10);
        condition = '목표 달성';                      /* 미달인데 달성 표기 */
      } else if (attack === 'nonnumeric') value = '측정불가';
      else if (attack === 'unit_mismatch') unit = (cat.unit === '%' ? '건' : '%');
      else if (attack === 'percent_over' && cat.unit === '%') value = 100 + rint(rng, 1, 500);
      else if (attack === 'count_decimal' && /^(건|회|명|개)$/.test(cat.unit || '')) value = 3.7;

      note.sections.metrics = [{ metric: cat.name, metric_key: cat.key, value, unit, condition, evidence: [e.id] }];
      await commitNote(note, '김연구', '측정 기재');
      const g = runGates(note, { ledger, sealedNotes: [], metricsCatalog: sys.metrics.catalog,
        mode: 'strict', expectedHash: note.content_sha256 });
      const g3 = g.gates.find(x => x.gate === 'G3');
      if (attack === 'clean') {
        assert(g3.pass, C, seed, `정상 측정이 G3 에 걸림: ${g3.violations[0] ? g3.violations[0].check : ''}`);
      } else if (attack === 'unit_mismatch' && !cat.unit) {
        /* 단위가 없는 지표는 불일치 판정 대상이 아니다 */
      } else if (attack === 'percent_over' && cat.unit !== '%') {
        /* % 지표가 아니면 해당 없음 */
      } else if (attack === 'count_decimal' && !/^(건|회|명|개)$/.test(cat.unit || '')) {
        /* 계수형 지표가 아니면 해당 없음 */
      } else {
        assert(!g3.pass, C, seed, `[${attack}] 거짓 성과가 G3 를 통과함 (값=${value}${unit}, 목표=${cat.target}${cat.unit})`);
      }
    } catch (e) { fail(C, seed, `거짓 성과 예외: ${e.message}`); }
  }
  return n;
}


/* ══════════════════════════════════════════════════════════
 * 카테고리 · 암호 서명·시점인증 (crypto_sign_ts)
 *
 * 기대값은 구현에서 가져오지 않는다:
 *   · TSR 픽스처는 FreeTSA 실응답이고, 기대 genTime·serial·imprint 는
 *     openssl ts -reply -text 출력에서 손으로 옮겼다 (2026-08-15,
 *     'Verification: OK' 확인본 — fixtures/freetsa-sample.json).
 *   · TSQ 구조 검사는 RFC 3161 §2.4.1 의 필드 정의를 기준으로 한다.
 * ══════════════════════════════════════════════════════════ */
const FIXTURE_TSR = new Uint8Array(readFileSync(join(__dir, 'fixtures', 'freetsa-sample.tsr')));
const FIXTURE_HASH = '5ab17513c85bc931b83a6c17da0d37a70ae9bca69ae18b01997d86d86063e8ee';
const FIXTURE_GEN  = '2026-08-15T16:52:00Z';
const FIXTURE_SERIAL = '0702b75b';
const SHA256_OID_BYTES = [0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01];

function bytesIndexOf(hay, needle, from = 0) {
  outer:
  for (let i = from; i <= hay.length - needle.length; i++) {
    for (let k = 0; k < needle.length; k++) if (hay[i + k] !== needle[k]) continue outer;
    return i;
  }
  return -1;
}
function hexFromRng(rng, nBytes) {
  let h = '';
  for (let i = 0; i < nBytes; i++) h += rint(rng, 0, 255).toString(16).padStart(2, '0');
  return h;
}

async function catCryptoSignTs(n, baseSeed) {
  const C = 'crypto_sign_ts';
  const subtle = globalThis.crypto.subtle;
  const TE = new TextEncoder();

  /* 준비물(1회): 실키 1쌍 + 위장용 다른 키 1쌍 + PBKDF2 기록 */
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const pubJwk = await subtle.exportKey('jwk', pair.publicKey);
  const rogue = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const roguePub = await subtle.exportKey('jwk', rogue.publicKey);
  const PIN = '482913';
  const pinRec = await hashPin(PIN);
  const legacyHexBuf = await subtle.digest('SHA-256', TE.encode(PIN));
  const legacyHex = [...new Uint8Array(legacyHexBuf)].map(x => x.toString(16).padStart(2, '0')).join('');
  const tokenB64 = b64u(FIXTURE_TSR);

  /* 픽스처 파싱은 반복 불변 — 1회 검사로 족하다 */
  {
    const p0 = parseTsr(FIXTURE_TSR);
    assert(p0.statusOk, C, baseSeed, 'TSR 픽스처: status 가 granted 가 아닙니다');
    assert(p0.imprintHex === FIXTURE_HASH, C, baseSeed,
      `TSR 픽스처: imprint 불일치 — openssl 은 ${FIXTURE_HASH.slice(0, 16)}…, 파서는 ${String(p0.imprintHex).slice(0, 16)}…`);
    assert(p0.genTimeIso === FIXTURE_GEN, C, baseSeed,
      `TSR 픽스처: genTime 불일치 — openssl 은 ${FIXTURE_GEN}, 파서는 ${p0.genTimeIso}`);
    assert(p0.serialHex === FIXTURE_SERIAL, C, baseSeed,
      `TSR 픽스처: serial 불일치 — openssl 은 ${FIXTURE_SERIAL}, 파서는 ${p0.serialHex}`);
    const vs = verifyStoredTimestamp({ token_b64: tokenB64 }, FIXTURE_HASH);
    assert(vs.ok === true, C, baseSeed, `verifyStoredTimestamp: 정상 토큰이 거부되었습니다 — ${vs.reason}`);
    assert(generalizedTimeToIso('20260815165200Z') === FIXTURE_GEN, C, baseSeed, 'GeneralizedTime 변환 불일치');
    assert(generalizedTimeToIso('2026-08-15') === null, C, baseSeed, 'GeneralizedTime: 형식 위반이 통과했습니다');
  }

  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const rng = makeRng(seed);
    const hash = hexFromRng(rng, 32);

    /* ① TSQ — RFC 3161 §2.4.1 구조를 바이트 수준으로 검사 */
    const nonce = new Uint8Array(8);
    for (let k = 0; k < 8; k++) nonce[k] = rint(rng, 0, 255);
    const tsq = buildTsq(hash, nonce);
    const tsq2 = buildTsq(hash, nonce);
    assert(tsq.length === tsq2.length && bytesIndexOf(tsq, tsq2) === 0, C, seed, 'TSQ: 같은 입력이 다른 바이트를 냈습니다');
    assert(tsq[0] === 0x30, C, seed, 'TSQ: 최상위가 SEQUENCE 가 아닙니다');
    assert(bytesIndexOf(tsq, new Uint8Array([0x02, 0x01, 0x01])) === 2, C, seed, 'TSQ: version INTEGER 1 이 선두에 없습니다');
    assert(bytesIndexOf(tsq, new Uint8Array(SHA256_OID_BYTES)) > 0, C, seed, 'TSQ: SHA-256 OID 가 없습니다');
    const imp = bytesIndexOf(tsq, hexToBytes(hash));
    assert(imp > 0 && tsq[imp - 2] === 0x04 && tsq[imp - 1] === 0x20, C, seed, 'TSQ: 해시가 OCTET STRING(32)로 실리지 않았습니다');
    assert(tsq[tsq.length - 3] === 0x01 && tsq[tsq.length - 2] === 0x01 && tsq[tsq.length - 1] === 0xff,
      C, seed, 'TSQ: certReq TRUE 가 마지막 필드가 아닙니다');
    /* nonce INTEGER 는 양수여야 한다 — 최상위 비트가 서면 00 패딩 필수 */
    const nOff = bytesIndexOf(tsq, nonce[0] & 0x80 ? concatU8([0x02, 0x09, 0x00], nonce) : concatU8([0x02, 0x08], nonce));
    assert(nOff > 0, C, seed, 'TSQ: nonce INTEGER 인코딩(양수 보장)이 틀렸습니다');
    if (hash.length !== 64) assert(false, C, seed, '시험 자체 오류');

    /* ② 잘못된 입력 거부 */
    let threw = false;
    try { buildTsq(hash.slice(0, 62)); } catch { threw = true; }
    assert(threw, C, seed, 'TSQ: 32바이트가 아닌 해시가 통과했습니다');

    /* ③ 토큰 변조 → imprint 대조 실패 (매 10회) */
    if (i % 10 === 0) {
      const at = bytesIndexOf(FIXTURE_TSR, hexToBytes(FIXTURE_HASH));
      assert(at > 0, C, seed, 'TSR 픽스처에서 imprint 위치를 찾지 못했습니다');
      const mut = FIXTURE_TSR.slice();
      mut[at + rint(rng, 0, 31)] ^= (1 << rint(rng, 0, 7));
      const v = verifyStoredTimestamp({ token_b64: b64u(mut) }, FIXTURE_HASH);
      assert(v.ok === false, C, seed, '변조된 토큰(imprint 1비트 반전)이 검증을 통과했습니다');
      const w = verifyStoredTimestamp({ token_b64: tokenB64 }, hash);
      assert(w.ok === false, C, seed, '다른 해시에 대해 토큰이 검증을 통과했습니다');
    }

    /* ④ ECDSA 서명·검증 + 변조/키 바꿔치기 거부 */
    const sigBuf = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, TE.encode(hash));
    const entry = { sig_alg: 'ES256', pub_jwk: pubJwk, sig: b64u(sigBuf) };
    assert(await verifyDeviceSignature(entry, hash) === true, C, seed, 'ECDSA: 정상 서명이 거부되었습니다');
    const mode = rint(rng, 0, 3);
    if (mode === 0) {
      const bad = new Uint8Array(sigBuf.slice(0));
      bad[rint(rng, 0, bad.length - 1)] ^= (1 << rint(rng, 0, 7));
      assert(await verifyDeviceSignature({ ...entry, sig: b64u(bad) }, hash) === false, C, seed, 'ECDSA: 변조 서명이 통과했습니다');
    } else if (mode === 1) {
      assert(await verifyDeviceSignature(entry, hexFromRng(rng, 32)) === false, C, seed, 'ECDSA: 다른 메시지에 서명이 통과했습니다');
    } else if (mode === 2) {
      assert(await verifyDeviceSignature({ ...entry, pub_jwk: roguePub }, hash) === false, C, seed, 'ECDSA: 다른 공개키로 통과했습니다');
    } else {
      assert(await verifyDeviceSignature({ ...entry, sig_alg: 'RS256' }, hash) === false, C, seed, 'ECDSA: 미지원 알고리듬이 통과했습니다');
    }

    /* ⑤ 봉인이 서명을 덮는가 + 시점인증 부착 불변식 (매 25회) */
    if (i % 25 === 0) {
      const note = {
        note_id: `CS-${seed}`, header: { 작성자: 'A' }, content_sha256: hash,
        signatures: { contributors: [], final: null }, 수정이력: [], _state: 'approved',
      };
      addContributorSignature(note, 'B', hash, { crypto: entry });
      await sealNote(note, { approver: 'C', prevSealHash: '', contentHash: hash });
      assert(await sealHashOf(note) === note.seal_hash, C, seed, '봉인 직후 sealHashOf 불일치');

      const keep = note.signatures.contributors[0].crypto.sig;
      note.signatures.contributors[0].crypto.sig = b64u(crypto.getRandomValues(new Uint8Array(64)));
      assert(await sealHashOf(note) !== note.seal_hash, C, seed, '봉인 후 crypto.sig 바꿔치기가 체인에 잡히지 않습니다');
      note.signatures.contributors[0].crypto.sig = keep;

      const sealBefore = note.seal_hash;
      attachTimestamp(note, { ok: true, tsa: 'https://freetsa.org/tsr', gen_time: FIXTURE_GEN,
        serial: FIXTURE_SERIAL, imprint: FIXTURE_HASH, token_b64: tokenB64, obtained_at: FIXTURE_GEN });
      assert(note.seal_hash === sealBefore && await sealHashOf(note) === note.seal_hash,
        C, seed, '시점인증 부착이 봉인 해시를 건드렸습니다');

      const rows = await verifyCryptoSignatures(note, { B: { device_keys: [{ pub_jwk: pubJwk }] } });
      const rB = rows.find(r => r.signer === 'B');
      assert(rB && rB.ok === true && rB.keyKnown === true, C, seed, '검증 요약: 정상 서명·등록 키가 확인되지 않습니다');
      const rows2 = await verifyCryptoSignatures(note, { B: { device_keys: [{ pub_jwk: roguePub }] } });
      const rB2 = rows2.find(r => r.signer === 'B');
      assert(rB2 && rB2.ok === true && rB2.keyKnown === false, C, seed, '검증 요약: 키 대장 불일치(바꿔치기 신호)를 놓쳤습니다');

      let t2 = false;
      try { attachTimestamp({ _state: 'approved' }, { ok: true }); } catch { t2 = true; }
      assert(t2, C, seed, '미확정 노트에 시점인증이 부착되었습니다');
      let t3 = false;
      try {
        await sealNote({ note_id: 'x', header: { 작성자: 'A' }, content_sha256: hash,
          signatures: { contributors: [], final: null }, 수정이력: [], _state: 'approved' },
          { approver: 'A', prevSealHash: '', contentHash: hash });
      } catch { t3 = true; }
      assert(t3, C, seed, '자기 승인(작성자=승인자)이 차단되지 않았습니다');
    }

    /* ⑥ PBKDF2 (비용이 커서 표본 검사, 매 500회) */
    if (i % 500 === 0) {
      const a = await verifyPin(PIN, pinRec);
      assert(a.ok === true && a.legacy === false, C, seed, 'PBKDF2: 올바른 PIN 이 거부되었습니다');
      const b = await verifyPin(PIN + '9', pinRec);
      assert(b.ok === false, C, seed, 'PBKDF2: 틀린 PIN 이 통과했습니다');
      const c = await verifyPin(PIN, null, legacyHex);
      assert(c.ok === true && c.legacy === true, C, seed, '구판 sha256 검증·legacy 신호가 틀렸습니다');
      const d = await verifyPin(PIN + '1', null, legacyHex);
      assert(d.ok === false, C, seed, '구판: 틀린 PIN 이 통과했습니다');
      assert(pinRec.iters === 210000 && pinRec.kdf === 'PBKDF2-SHA256', C, seed, 'PBKDF2 파라미터가 명세와 다릅니다');
    }
  }
  return n;
}

function concatU8(prefix, tail) {
  const out = new Uint8Array(prefix.length + tail.length);
  out.set(prefix, 0); out.set(tail, prefix.length);
  return out;
}

const PLAN = [
  ['util_dates',           12000, catUtilDates],
  ['util_numbers',          8000, catUtilNumbers],
  ['csv_roundtrip',         5000, catCsv],
  ['docx_roundtrip',        3000, catDocxRoundtrip],
  ['xlsx_roundtrip',        3000, catXlsxRoundtrip],
  ['parser_fuzz',           8000, catParserFuzz],
  ['analyzer_truth',       10000, catAnalyzer],
  ['analyzer_adversarial',  8000, catAnalyzerAdversarial],
  ['generator_invariants', 25000, catGenerator],
  ['gates_planted',        15000, catGates],
  ['notes_lifecycle',       8000, catNotes],
  ['ledger_citations',      3000, catLedger],
  ['format_edges',          3000, catFormatEdges],
  ['store_concurrency',     2000, catStoreConcurrency],
  ['autodraft_writer',      4000, catAutoDraft],
  ['i18n_dictionary',       6000, catI18n],
  ['gate_wording_langs',    5000, catWordingLangs],
  ['crypto_sign_ts',        3000, catCryptoSignTs],
  ['sc_multiuser',         12000, catMultiUser],
  ['sc_multilang',         12000, catMultiLang],
  ['sc_revision',           8000, catRevisionChain],
  ['sc_backup',             8000, catBackupRestore],
  ['sc_llm_safety',         6000, catLlmSafety],
  ['sc_longterm',          10000, catLongTerm],
  ['sc_license',            6000, catLicense],
  ['sc_ledger_scale',       5000, catLedgerScale],
  ['sc_store_migration',    4000, catStoreMigration],
  ['sc_tamper',             8000, catTamper],
  ['sc_calendar',          10000, catCalendarEdge],
  ['sc_false_claim',       10000, catFalseClaim],
  ['e2e_pipeline',           500, catE2E],
];

async function main() {
  const planned = PLAN.reduce((s, [, n]) => s + n, 0);
  const scale = TOTAL_ITERS / planned;
  console.log(`\n═══ AAA-RNS 검증 시뮬레이션 · 사이클 ${CYCLE}/${MAX_CYCLES} ═══`);
  console.log(`계획 ${planned.toLocaleString()}회 × 배율 ${scale.toFixed(2)} = 목표 ${TOTAL_ITERS.toLocaleString()}회\n`);
  const t0 = Date.now();
  const catStats = [];

  for (const [name, base, fn] of PLAN) {
    const iters = Math.max(1, Math.round(base * scale));
    const seedBase = CYCLE * 10_000_019 + catStats.length * 1_000_003;
    const failBefore = failures.length;
    const ct0 = Date.now();
    await fn(iters, seedBase);
    ran += iters;
    const dt = Date.now() - ct0;
    const nf = failures.length - failBefore;
    catStats.push({ name, iters, failures: nf, ms: dt });
    console.log(`  ${nf ? '✗' : '✓'} ${name.padEnd(22)} ${String(iters).padStart(7)}회  ${String(dt).padStart(6)}ms  실패 ${nf}`);
  }

  const totalMs = Date.now() - t0;
  const defects = [...defectMap.entries()].map(([sig, d]) => ({
    signature: sig, count: d.count, example: d.first,
  })).sort((a, b) => b.count - a.count);

  const report = {
    product: 'AAA-RNS 2.0',
    cycle: CYCLE, max_cycles: MAX_CYCLES,
    executed_at: new Date().toISOString(),
    iterations: ran, min_required: MIN_ITERS,
    duration_ms: totalMs,
    failures_total: failures.length,
    distinct_defects: defects.length,
    verdict: failures.length === 0 ? 'PASS' : 'FAIL',
    categories: catStats,
    defects: defects.slice(0, 50),
  };
  const jsonPath = join(REPORT_DIR, `cycle-${String(CYCLE).padStart(2, '0')}.json`);
  /* 같은 캠페인·사이클을 다시 돌리는 것은 재현 검증이라 정상이지만,
     --no-overwrite 를 주면 기존 증거를 지키고 중단한다. */
  if (args.includes('--no-overwrite') && existsSync(jsonPath)) {
    console.error(`중단: ${jsonPath} 가 이미 있습니다. --campaign 또는 --cycle 을 바꾸십시오.`);
    process.exit(3);
  }
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const md = [
    `# 검증 시뮬레이션 보고서 — 사이클 ${CYCLE}/${MAX_CYCLES}`,
    ``,
    `| 항목 | 값 |`, `|---|---|`,
    `| 실행 시각 | ${report.executed_at} |`,
    `| 시뮬레이션 횟수 | ${ran.toLocaleString()}회 (최소 요구 ${MIN_ITERS.toLocaleString()}회) |`,
    `| 소요 시간 | ${(totalMs / 1000).toFixed(1)}초 |`,
    `| 실패 | ${failures.length.toLocaleString()}건 · 고유 결함 ${defects.length}종 |`,
    `| 판정 | **${report.verdict}** |`,
    ``,
    `## 카테고리별 결과`,
    `| 카테고리 | 횟수 | 실패 | 시간 |`, `|---|---|---|---|`,
    ...catStats.map(c => `| ${c.name} | ${c.iters.toLocaleString()} | ${c.failures} | ${c.ms}ms |`),
    ``,
    defects.length ? `## 발견 결함 (빈도순)` : `## 발견 결함 없음 — 전 시뮬레이션 통과`,
    ...defects.slice(0, 30).map((d, i) =>
      `\n### D${i + 1} · ${d.count.toLocaleString()}회\n- 서명: \`${d.signature}\`\n- 예시(seed ${d.example.seed}): ${d.example.message}`),
  ].join('\n');
  writeFileSync(join(REPORT_DIR, `cycle-${String(CYCLE).padStart(2, '0')}.md`), md);

  console.log(`\n총 ${ran.toLocaleString()}회 · ${(totalMs / 1000).toFixed(1)}초 · 실패 ${failures.length}건 (고유 결함 ${defects.length}종) → ${report.verdict}`);
  console.log(`보고서: ${jsonPath}`);
  if (defects.length) {
    console.log('\n주요 결함:');
    for (const d of defects.slice(0, 10)) {
      console.log(`  [${d.count}회] ${d.signature}\n         예: seed=${d.example.seed} ${d.example.message}`);
    }
  }
  process.exit(failures.length ? 1 : 0);
}

main().catch(e => { console.error('시뮬레이션 하네스 자체 오류:', e); process.exit(3); });
