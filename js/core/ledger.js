/* ════════════════════════════════════════════════════════════════
 * AAA-RNS · core/ledger.js
 * Developed by Seung Ho Jung · v2.0 · Apache-2.0 © 2026
 * 증거원장 (Evidence Ledger) — 무증거 무기재의 물리적 기반
 *
 * 원칙 (기존 AAA-RNS 승계):
 *  · 인정 증거 소스 3종: 업로드 원본 / 확정 과거 노트 / project.json
 *  · 1증거 = 1주장. 모순값은 둘 다 등재하고 conflict_with 로 연결
 *  · 직접 기록(researcher_statement)은 strength:'low' + 대조불가 표기
 *  · 원장 항목은 수정하지 않는다 — 정정은 새 항목 + supersedes
 * ════════════════════════════════════════════════════════════════ */

import { normSpace } from './util.js';

export const EVIDENCE_KINDS = ['measurement', 'statement', 'decision', 'schedule', 'reference', 'researcher_statement'];
export const EVIDENCE_SOURCES = ['upload', 'sealed_note', 'project'];

export class EvidenceLedger {
  constructor(entries = []) {
    this.entries = [];
    this.byId = new Map();
    for (const e of entries) this._insert(e);
  }

  _insert(e) {
    if (!e || !e.id) return;
    this.entries.push(e);
    this.byId.set(e.id, e);
  }

  /** 다음 증거 ID. */
  nextId() { return 'E' + (this.entries.length + 1); }

  /**
   * 증거 등재.
   * @param {object} o {kind, sourceType, sourceFile, locator, content, value?, unit?, strength?, addedBy, sha256?}
   * @returns {object} 등재된 항목
   */
  add(o) {
    const kind = EVIDENCE_KINDS.includes(o.kind) ? o.kind : 'statement';
    const entry = {
      id: this.nextId(),
      kind,
      strength: o.strength === 'low' || kind === 'researcher_statement' ? 'low' : 'high',
      source_type: EVIDENCE_SOURCES.includes(o.sourceType) ? o.sourceType : 'upload',
      source_file: String(o.sourceFile || ''),
      locator: String(o.locator || ''),
      content: normSpace(o.content).slice(0, 500),
      value: o.value !== undefined ? o.value : null,
      unit: o.unit ? String(o.unit).slice(0, 20) : '',
      sha256: o.sha256 || '',
      added_by: String(o.addedBy || 'system'),
      added_at: o.addedAt || new Date().toISOString(),
      conflict_with: [],
      corroborates: [],
      caveat: kind === 'researcher_statement' ? '연구자 직접 기록 — 원본 대조 불가' : '',
    };
    this._insert(entry);
    return entry;
  }

  get(id) { return this.byId.get(id) || null; }
  has(id) { return this.byId.has(id); }
  size() { return this.entries.length; }

  /** 두 증거를 모순 관계로 연결(양방향). 판정은 G3 또는 사람의 몫. */
  markConflict(idA, idB) {
    const a = this.get(idA), b = this.get(idB);
    if (!a || !b || idA === idB) return false;
    if (!a.conflict_with.includes(idB)) a.conflict_with.push(idB);
    if (!b.conflict_with.includes(idA)) b.conflict_with.push(idA);
    return true;
  }

  /** 동일 사실의 상호 확인 관계 연결. */
  markCorroborates(idA, idB) {
    const a = this.get(idA), b = this.get(idB);
    if (!a || !b || idA === idB) return false;
    if (!a.corroborates.includes(idB)) a.corroborates.push(idB);
    if (!b.corroborates.includes(idA)) b.corroborates.push(idA);
    return true;
  }

  toJSON() { return this.entries.map(e => ({ ...e })); }
}

/* ══════════════════════════════════════════════════════════
 * 인용 도구 — 본문 ↔ 원장 매핑
 * ══════════════════════════════════════════════════════════ */

const CITE_RE = /\[E(\d{1,5})\]/g;

/** 텍스트에 인용된 증거ID 목록 (중복 제거, 등장 순). */
export function citationsIn(text) {
  const out = [];
  const seen = new Set();
  let m;
  CITE_RE.lastIndex = 0;
  const s = String(text ?? '');
  while ((m = CITE_RE.exec(s))) {
    const id = 'E' + parseInt(m[1], 10);
    if (!seen.has(id)) { seen.add(id); out.push(id); }
  }
  return out;
}

/** 인용 표기를 제거한 순수 본문. */
export function stripCitations(text) {
  return String(text ?? '').replace(CITE_RE, '').replace(/\s{2,}/g, ' ').trim();
}

/** "증거 없음" 정형 문구인가 — G1 면제 대상. */
export function isNoEvidenceStatement(sentence) {
  return /해당\s*기간\s*(관련\s*)?증거(\s*자료)?\s*없음/.test(String(sentence ?? ''));
}
