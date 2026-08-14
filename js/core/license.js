/* ════════════════════════════════════════════════════════════════
 * AAA-RNS · core/license.js
 * Developed by Seung Ho Jung · v2.0 · Apache-2.0 © 2026
 * 오프라인 라이선스 검증 — 설치 등록 인증
 *
 * 동작 원리 (인증 서버 없음 — 완전 오프라인 원칙 유지):
 *   · 개발자가 개인키(비공개, tools/make_license.mjs)로 라이선스
 *     페이로드에 전자서명(ECDSA P-256)해 키 문자열을 발급한다.
 *   · 앱은 여기 내장된 공개키로 서명을 검증한다 — 위조 불가.
 *   · 라이선스는 최초 온보딩 시 프로젝트(과제번호)에 귀속되어
 *     설치본당 1개 프로젝트 제한을 집행한다 (app.js).
 *
 * 키 형식: base64url(JSON 페이로드) + "." + base64url(서명)
 * 페이로드: { v, licensee, email, edition, max_projects, issued, expires, nonce }
 *
 * 정직한 한계: 소스가 공개된 로컬 앱이므로 코드를 수정하는 사람까지
 * 막지는 못한다. 이 장치의 목적은 ① 정식 발급처 확인 ② 무단 복제·
 * 전용의 차단이 아니라 명백화 ③ 사용 조건(1프로젝트)의 계약적 집행이다.
 * ════════════════════════════════════════════════════════════════ */

/* 발급 도구(tools/make_license.mjs)가 최초 실행 시 여기에 공개키를 주입한다 */
export const LICENSE_PUBLIC_JWK = {"key_ops":["verify"],"ext":true,"kty":"EC","x":"vL9YqucoyrAPvD833RdBZWVTbpuDLjXaRRPW-mCMOf4","y":"miuje1nOUhtOcZ5H30nMXquGSR2UtFACMMI820iAqZg","crv":"P-256"};

const TE = new TextEncoder();
const TD = new TextDecoder();

function b64uToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 키 문자열 분해 (형식 오류 시 throw) */
export function parseLicenseKey(str) {
  const s = String(str || '').trim().replace(/\s+/g, '');
  const dot = s.indexOf('.');
  if (dot < 1 || dot === s.length - 1) throw new Error('라이선스 키 형식이 아닙니다');
  const payloadB64 = s.slice(0, dot);
  let payload;
  try { payload = JSON.parse(TD.decode(b64uToBytes(payloadB64))); }
  catch { throw new Error('라이선스 키 형식이 아닙니다'); }
  return { payload, payloadB64, sigBytes: b64uToBytes(s.slice(dot + 1)), raw: s };
}

/**
 * 서명·필드·만료 검증.
 * @returns {Promise<{ok:boolean, payload?:object, license_id?:string, error?:string}>}
 */
export async function verifyLicenseKey(str, todayStr) {
  if (!LICENSE_PUBLIC_JWK) return { ok: false, error: '이 빌드에는 발급 공개키가 없습니다 (tools/make_license.mjs 최초 실행 필요)' };
  let p;
  try { p = parseLicenseKey(str); }
  catch (e) { return { ok: false, error: e.message }; }
  try {
    const key = await crypto.subtle.importKey('jwk', LICENSE_PUBLIC_JWK,
      { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' },
      key, p.sigBytes, TE.encode(p.payloadB64));
    if (!valid) return { ok: false, error: '서명이 유효하지 않습니다 — 정식 발급 키가 아닙니다' };
  } catch {
    return { ok: false, error: '서명 검증 실패 (키 손상)' };
  }
  const pl = p.payload;
  if (pl.v !== 1 || !pl.licensee || !Number.isFinite(pl.max_projects)) {
    return { ok: false, error: '라이선스 내용이 올바르지 않습니다' };
  }
  const now = todayStr || new Date().toISOString().slice(0, 10);
  if (pl.expires && now > pl.expires) {
    return { ok: false, expired: true, payload: pl, error: `라이선스가 만료되었습니다 (만료일 ${pl.expires})` };
  }
  /* 키 ID — 서명의 해시 앞 12자리 (표시·귀속용) */
  const buf = await crypto.subtle.digest('SHA-256', p.sigBytes);
  const license_id = [...new Uint8Array(buf)].slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join('');
  return { ok: true, payload: pl, license_id };
}
