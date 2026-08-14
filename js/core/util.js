/* ════════════════════════════════════════════════════════════════
 * AAA-RNS · core/util.js
 * Developed by Seung Ho Jung · v2.0 · Apache-2.0 © 2026
 * 공통 유틸리티 — 브라우저·Node 겸용 (외부 의존성 없음)
 *
 * 설계 원칙
 *  · 모든 난수는 주입 가능한 RNG를 거친다 → 시뮬레이션에서 재현 가능
 *  · 날짜는 항상 'YYYY-MM-DD' 문자열로 다룬다 (시간대 함정 회피)
 *  · 해시는 WebCrypto SHA-256 (브라우저·Node 26 공통 지원)
 * ════════════════════════════════════════════════════════════════ */

/* ── ID 생성 ─────────────────────────────────────────────── */
let _rng = Math.random;
let _seq = 0;

/** 시뮬레이션 재현성을 위해 RNG를 교체할 수 있다. */
export function setRng(fn) { _rng = fn || Math.random; }

/** 짧은 고유 ID. prefix + base36 시각 + 난수 4자 + 시퀀스. */
export function uid(prefix = 'id') {
  _seq = (_seq + 1) % 1296;
  const t = Date.now().toString(36);
  const r = Math.floor(_rng() * 1679616).toString(36).padStart(4, '0');
  return `${prefix}_${t}${r}${_seq.toString(36).padStart(2, '0')}`;
}

/* ── 해시 ────────────────────────────────────────────────── */
const _te = new TextEncoder();

/** SHA-256 → hex 문자열. 입력은 string 또는 Uint8Array. */
export async function sha256(data) {
  const bytes = typeof data === 'string' ? _te.encode(data) : data;
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 안정적 JSON 직렬화(키 정렬) — 해시 대상 만들 때 사용. */
export function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const keys = Object.keys(v).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}

/* ── 날짜 ────────────────────────────────────────────────── */
const DAY_MS = 86400000;

/** Date → 'YYYY-MM-DD' (로컬 아님, UTC 기준 캘린더 연산 전용). */
export function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' → Date(UTC 자정). 잘못된 형식이면 null. */
export function parseISO(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  // 2026-02-31 같은 오버플로 거부: 되돌려 비교
  if (fmtDate(d) !== s) return null;
  return d;
}

/** 유효한 'YYYY-MM-DD'인지. */
export function isValidDate(s) { return parseISO(s) !== null; }

/** 날짜 문자열에 일수 더하기. */
export function addDays(iso, n) {
  const d = parseISO(iso);
  if (!d) return null;
  return fmtDate(new Date(d.getTime() + n * DAY_MS));
}

/** 개월 더하기(말일 보정: 1/31 +1개월 → 2/28). */
export function addMonths(iso, n) {
  const d = parseISO(iso);
  if (!d) return null;
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  const t = new Date(Date.UTC(y, m + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return fmtDate(t);
}

/** 두 날짜의 일수 차 (b - a). */
export function diffDays(a, b) {
  const da = parseISO(a), db = parseISO(b);
  if (!da || !db) return null;
  return Math.round((db.getTime() - da.getTime()) / DAY_MS);
}

/** 두 날짜 사이의 개월 수(시작 월 포함, 올림). 예: 2026-07-01~2028-12-31 → 30 */
export function monthSpan(a, b) {
  const da = parseISO(a), db = parseISO(b);
  if (!da || !db || db < da) return null;
  const m = (db.getUTCFullYear() - da.getUTCFullYear()) * 12 + (db.getUTCMonth() - da.getUTCMonth());
  return m + 1;
}

/**
 * 자유 형식 한국어/영문 날짜 표현 → 'YYYY-MM-DD'.
 * 지원: 2026-07-01 · 2026.7.1 · 2026/07/01 · 2026년 7월 1일 · 20260701 · 2026년 7월(→1일)
 * 실패 시 null.
 */
export function parseLooseDate(s) {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  let m = t.match(/^(\d{4})[.\-\/년]\s*(\d{1,2})[.\-\/월]\s*(\d{1,2})\s*일?\.?$/);
  if (m) return _mk(m[1], m[2], m[3]);
  m = t.match(/^(\d{4})[.\-\/년]\s*(\d{1,2})\s*월?\.?$/);
  if (m) return _mk(m[1], m[2], 1);
  m = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return _mk(m[1], m[2], m[3]);
  return null;
}
function _mk(y, mo, d) {
  const iso = `${y}-${String(+mo).padStart(2, '0')}-${String(+d).padStart(2, '0')}`;
  return isValidDate(iso) ? iso : null;
}

/* ── 숫자 ────────────────────────────────────────────────── */

/**
 * 한국식 금액/수치 문자열 → 숫자.
 * 지원: "1,234" · "1234.5" · "3억 5천만원" · "120백만원" · "45%" · "1.2억"
 * 실패 시 null.
 */
export function parseKoreanNumber(s) {
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  if (typeof s !== 'string') return null;
  let t = s.trim().replace(/,/g, '');
  if (!t) return null;
  // 단위 계수
  let mult = 1;
  const unitMap = [[/조/, 1e12], [/억/, 1e8], [/천만/, 1e7], [/백만/, 1e6], [/십만/, 1e5], [/만/, 1e4], [/천(?!만)/, 1e3]];
  // "3억 5천만원" 같은 복합 표현
  const compound = t.match(/^(\d+(?:\.\d+)?)\s*억\s*(\d+(?:\.\d+)?)\s*천만\s*원?$/);
  if (compound) return (+compound[1]) * 1e8 + (+compound[2]) * 1e7;
  for (const [re, m] of unitMap) {
    if (re.test(t)) { mult = m; t = t.replace(re, ''); break; }
  }
  t = t.replace(/원|won|krw/gi, '').replace(/%$/, '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  const n = parseFloat(t) * mult;
  return Number.isFinite(n) ? n : null;
}

/** 반올림(유효 자릿수 유지용). */
export function round(n, digits = 2) {
  const p = Math.pow(10, digits);
  return Math.round((n + Number.EPSILON) * p) / p;
}

/* ── 텍스트 ──────────────────────────────────────────────── */

/** 공백 정규화: 연속 공백 1칸, 트림. */
export function normSpace(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

/** HTML 이스케이프 — 저장형 XSS 차단의 최전선. */
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * 문장 분리(한국어·영문 겸용). 서술문 게이트 검사(G1)의 기본 단위.
 * 마침표·물음표·느낌표 + 한국어 종결(다.) 기준. 소수점(3.5)은 보존.
 */
export function splitSentences(text) {
  if (!text) return [];
  const out = [];
  let buf = '';
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    buf += s[i];
    if (/[.!?]/.test(s[i])) {
      const prev = s[i - 1], next = s[i + 1];
      // 소수점(1.5) · 축약(e.g.) · 버전(v1.2) 내부의 점은 통과
      if (s[i] === '.' && /\d/.test(prev || '') && /\d/.test(next || '')) continue;
      if (next && !/[\s\n"')\]]/.test(next)) continue;
      const t = buf.trim();
      if (t) out.push(t);
      buf = '';
    } else if (s[i] === '\n') {
      const t = buf.trim();
      if (t) out.push(t);
      buf = '';
    }
  }
  const t = buf.trim();
  if (t) out.push(t);
  return out;
}

/** 파일명에서 확장자(소문자, 점 제외). */
export function extOf(name) {
  const m = String(name ?? '').match(/\.([A-Za-z0-9]+)$/);
  return m ? m[1].toLowerCase() : '';
}

/** 파일명 안전화 — 경로 분리자·제어문자 제거. */
export function safeName(name) {
  return String(name ?? '').replace(/[\/\\:*?"<>|\x00-\x1f]/g, '_').slice(0, 180) || '_';
}

/** 깊은 복제 (JSON 안전 데이터 전용). */
export function deepClone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

/** 바이트 → 사람이 읽는 크기. */
export function fmtBytes(n) {
  if (!Number.isFinite(n)) return '-';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
  return (n / 1073741824).toFixed(2) + ' GB';
}

/* ── 텍스트 디코딩 (UTF-8 우선, EUC-KR 폴백) ───────────────── */
export function decodeText(bytes) {
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return utf8;
  } catch {
    try { return new TextDecoder('euc-kr').decode(bytes); }
    catch { return new TextDecoder('utf-8').decode(bytes); } // 손실 허용 최후 폴백
  }
}
