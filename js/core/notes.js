/* ════════════════════════════════════════════════════════════════
 * AAA-RNS · core/notes.js
 * Developed by Seung Ho Jung · v2.0 · Apache-2.0 © 2026
 * 연구노트 라이프사이클
 *
 * 상태 기계 (기존 AAA-RNS 7상태 승계):
 *   empty → queued → draft → (advisory | rejected) → awaiting_sign → sealed
 *   sealed 는 불변 — 수정은 개정판(-R1, -R2 …) 발행으로만
 *
 * 무결성:
 *   content_sha256 = sha256(stableStringify({sections, period, wp_refs}))
 *   seal_hash      = sha256(content_sha256 + prev_seal_hash)   ← 해시 체인
 * ════════════════════════════════════════════════════════════════ */

import { sha256, stableStringify, isValidDate, deepClone } from './util.js';

export const NOTE_STATES = ['empty', 'queued', 'draft', 'advisory', 'rejected', 'awaiting_sign', 'sealed'];

/** 노트 ID 규칙: RN-{시작YYYYMMDD}-{종료YYYYMMDD}[-R{n}] */
export function noteIdFor(start, end, revision = 0) {
  const s = String(start || '').replace(/-/g, '');
  const e = String(end || '').replace(/-/g, '');
  return `RN-${s}-${e}` + (revision > 0 ? `-R${revision}` : '');
}

/** 노트 ID 해석 → {start, end, revision} 또는 null */
export function parseNoteId(id) {
  const m = String(id || '').match(/^RN-(\d{8})-(\d{8})(?:-R(\d+))?$/);
  if (!m) return null;
  const f = s => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  const start = f(m[1]), end = f(m[2]);
  if (!isValidDate(start) || !isValidDate(end)) return null;
  return { start, end, revision: m[3] ? parseInt(m[3], 10) : 0 };
}

/* ══════════════════════════════════════════════════════════
 * 생성
 * ══════════════════════════════════════════════════════════ */

/**
 * 새 노트(초안 이전의 빈 구조) 생성.
 * @param {object} o {project, period:{start,end}, wpRefs:[], author, reviewer, cadence, today}
 */
export function createNote(o) {
  const period = { start: o.period.start, end: o.period.end, cadence: o.cadence || 'biweekly' };
  const today = o.today || new Date().toISOString().slice(0, 10);
  return {
    schema_version: '2.0',
    note_id: noteIdFor(period.start, period.end, 0),
    revision: 0,
    supersedes: null,
    period,
    wp_refs: Array.isArray(o.wpRefs) ? [...o.wpRefs] : [],
    header: {
      과제번호: o.project ? o.project.project_code : '',
      과제명: o.project ? o.project.title : '',
      작성자: o.author || '',
      점검자: o.reviewer || '',
      작성일: today,
      점검일: '',
    },
    sections: {
      goal: [],            // {text, wp}
      work: [],            // {text, wp, evidence[]}
      results: [],         // {text, wp, evidence[]}
      metrics: [],         // {metric, metric_key, value, unit, condition, target, direction, achieved, evidence[], change_reason?}
      interpretation: [],  // {text, wp, evidence[]}
      next_plan: [],       // {text, wp, evidence[]}
    },
    attachments: [],       // {file_id, name, sha256, size, contributor}
    수정이력: [],           // {at, by, what}
    _state: 'draft',
    검증모드: 'advisory',
    _gate_summary: null,
    content_sha256: '',
    seal_hash: '',
    signatures: { contributors: [], final: null },
  };
}

/* ══════════════════════════════════════════════════════════
 * 해시
 * ══════════════════════════════════════════════════════════ */

/** 본문 해시 — 서명 대상이자 변조 검증 기준. */
export async function noteContentHash(note) {
  return sha256(stableStringify({
    sections: note.sections, period: note.period, wp_refs: note.wp_refs,
  }));
}

/** 본문 해시 갱신 + 수정이력 기록. */
export async function commitNote(note, by, what) {
  note.content_sha256 = await noteContentHash(note);
  note.수정이력.push({ at: new Date().toISOString(), by: String(by || 'system'), what: String(what || '내용 수정') });
  return note;
}

/* ══════════════════════════════════════════════════════════
 * 상태 전이
 * ══════════════════════════════════════════════════════════ */

const TRANSITIONS = {
  empty: ['queued', 'draft'],
  queued: ['draft', 'empty'],
  draft: ['advisory', 'rejected', 'awaiting_sign', 'draft'],
  advisory: ['awaiting_sign', 'draft'],
  rejected: ['draft'],
  awaiting_sign: ['sealed', 'draft'],
  sealed: [],   // 불변 — 개정판 발행만
};

export function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

/** 게이트 결과 적용 → 상태 전이. */
export function applyGateResult(note, gateResult) {
  note._gate_summary = {
    at: new Date().toISOString(),
    mode: gateResult.mode,
    allPass: gateResult.allPass,
    violationCount: gateResult.violationCount,
    gates: gateResult.gates.map(g => ({ gate: g.gate, pass: g.pass, violations: g.violations })),
  };
  note.검증모드 = gateResult.mode;
  if (gateResult.decision === 'pass') note._state = 'awaiting_sign';
  else if (gateResult.decision === 'advisory') note._state = 'advisory';
  else note._state = 'rejected';
  return note;
}

/* ══════════════════════════════════════════════════════════
 * 서명·확정
 * ══════════════════════════════════════════════════════════ */

/** 기여자 서명 추가. 확정 노트에는 불가. */
export function addContributorSignature(note, signer, contentHash) {
  if (note._state === 'sealed') throw new Error('확정된 노트에는 서명을 추가할 수 없습니다.');
  if (contentHash !== note.content_sha256) throw new Error('서명 대상 해시가 현재 본문과 다릅니다.');
  if (note.signatures.contributors.some(s => s.signer === signer)) return note; // 멱등
  note.signatures.contributors.push({
    signer, stage: 'contributor', content_sha256: contentHash,
    signed_at: new Date().toISOString(),
  });
  return note;
}

/**
 * 최종 승인 + 확정(seal). 해시 체인 연결.
 * @returns {Promise<note>} — 실패 시 throw (호출측이 사용자에게 표면화)
 */
export async function sealNote(note, o) {
  const { approver, prevSealHash = '', contentHash, allowAdvisory = true } = o || {};
  if (note._state === 'sealed') throw new Error('이미 확정된 노트입니다.');
  if (!approver) throw new Error('최종 승인자가 없습니다.');
  if (contentHash !== note.content_sha256) throw new Error('승인 대상 해시가 현재 본문과 다릅니다.');
  if (note._state === 'rejected') throw new Error('반려 상태의 노트는 확정할 수 없습니다.');
  if (note._state === 'advisory' && !allowAdvisory) throw new Error('권고 지적이 남아 있어 확정할 수 없습니다(strict).');
  if (note._state === 'draft') throw new Error('게이트 검증을 먼저 실행하십시오.');
  // 자기 승인 금지: 승인자가 유일 작성자인 경우 차단 (공동작성 예외는 호출측 정책)
  if (note.header.작성자 && note.header.작성자 === approver && !o.selfApprovalAllowed) {
    throw new Error('작성자 본인은 최종 승인할 수 없습니다(교차 승인 원칙).');
  }
  note.signatures.final = {
    signer: approver, stage: 'final_approval', content_sha256: contentHash,
    signed_at: new Date().toISOString(),
  };
  /* 확정 해시는 본문뿐 아니라 '누가 서명했는가'까지 덮는다.
     서명자 이름이 봉인 밖에 있으면 확정 후 승인자를 바꿔치기해도
     탐지되지 않는다 — 감사 대응 시스템에서 치명적인 공백이다.
     seal_algo 로 판을 표시해 기존 확정 노트(v1)는 그대로 검증된다. */
  const sigDigest = await sha256(stableStringify(note.signatures || {}));
  note.seal_algo = 'v2';
  note.signatures_sha256 = sigDigest;
  note.seal_hash = await sha256(note.content_sha256 + sigDigest + String(prevSealHash));
  note.prev_seal_hash = String(prevSealHash);
  note._state = 'sealed';
  note.수정이력.push({ at: new Date().toISOString(), by: approver, what: '최종 승인·확정(sealed)' });
  return note;
}

/* ══════════════════════════════════════════════════════════
 * 개정판 발행 — sealed 불변 원칙의 유일한 수정 경로
 * ══════════════════════════════════════════════════════════ */
export function reviseNote(sealedNote, by) {
  if (sealedNote._state !== 'sealed') throw new Error('확정된 노트만 개정판을 발행할 수 있습니다.');
  const rev = deepClone(sealedNote);
  rev.revision = (sealedNote.revision || 0) + 1;
  rev.note_id = noteIdFor(sealedNote.period.start, sealedNote.period.end, rev.revision);
  rev.supersedes = sealedNote.note_id;
  rev._state = 'draft';
  rev._gate_summary = null;
  rev.seal_hash = '';
  rev.prev_seal_hash = '';
  rev.signatures = { contributors: [], final: null };   // 최종 승인은 새로
  rev.수정이력 = [...sealedNote.수정이력, {
    at: new Date().toISOString(), by: String(by || 'system'),
    what: `개정판 발행 (${sealedNote.note_id} → ${rev.note_id})`,
  }];
  return rev;
}

/* ══════════════════════════════════════════════════════════
 * 해시 체인 검증 — 감사 대응
 * ══════════════════════════════════════════════════════════ */

/**
 * 확정 노트 목록(확정 순)을 받아 체인 무결성을 검증한다.
 * @returns {Promise<{ok, brokenAt:null|string, checked:number}>}
 */
export async function verifySealChain(sealedNotes) {
  let prev = '';
  let checked = 0;
  for (const n of sealedNotes) {
    if (n._state !== 'sealed') continue;
    const expect = await sealHashOf(n);
    if (expect !== n.seal_hash) {
      return { ok: false, brokenAt: n.note_id, checked,
        reason: n.seal_algo === 'v2' ? 'seal_hash 불일치(본문 또는 서명 변조)' : 'seal_hash 불일치' };
    }
    if (String(n.prev_seal_hash || '') !== prev) {
      return { ok: false, brokenAt: n.note_id, checked, reason: '체인 연결 불일치' };
    }
    prev = n.seal_hash;
    checked++;
  }
  return { ok: true, brokenAt: null, checked };
}

/** 본문 위·변조 검증: 저장된 해시 vs 재계산. */
/** 확정 해시 재계산 — 저장된 다이제스트를 신뢰하지 않고 실제 서명에서 다시 만든다 */
export async function sealHashOf(note) {
  const prev = String(note.prev_seal_hash || '');
  if (note.seal_algo === 'v2') {
    const sigDigest = await sha256(stableStringify(note.signatures || {}));
    return sha256(note.content_sha256 + sigDigest + prev);
  }
  return sha256(note.content_sha256 + prev);   // v1(기존 확정 노트) 하위 호환
}

export async function verifyNoteIntegrity(note) {
  const now = await noteContentHash(note);
  const contentOk = now === note.content_sha256;
  let sealOk = true, reason = '';
  if (note._state === 'sealed') {
    sealOk = (await sealHashOf(note)) === note.seal_hash;
    if (!sealOk) reason = '확정 해시 불일치 — 본문 또는 서명이 변조되었습니다.';
  }
  if (!contentOk) reason = '본문 해시 불일치 — 내용이 변조되었습니다.';
  return { ok: contentOk && sealOk, stored: note.content_sha256, computed: now, reason };
}
