/* ════════════════════════════════════════════════════════════════
 * AAA-RNS · core/signing.js
 * Developed by Seung Ho Jung · v2.1 · Apache-2.0 © 2026
 * 암호 서명 — 기기 키(ECDSA P-256) 기본 + 패스키(WebAuthn) 선택
 *
 * 무엇을 바꾸는가
 * ─────────────────────────────────────────────────────────────
 * 지금까지의 "서명"은 이름 문자열이었다 — 폴더에 쓸 수 있는 사람은
 * 누구든 아무 이름이나 적을 수 있었다. 이 모듈은 서명을 키에 결박한다.
 *
 *  · A(기본) — 기기 키. WebCrypto 로 추출 불가(non-extractable) ECDSA
 *    P-256 키쌍을 만들어 IndexedDB 에 보관한다. 개인키는 API 로도 꺼낼
 *    수 없고, 서명은 그 브라우저 프로필 안에서만 만들어진다.
 *  · B(선택) — 패스키. WebAuthn 플랫폼 인증기(Touch ID 등)로 서명한다.
 *    "가진 것(기기) + 아는 것/생체" 두 요소가 서명마다 개입한다.
 *
 * 정직한 한계 — 이 모듈이 주지 않는 것
 * ─────────────────────────────────────────────────────────────
 *  · 신원 보증이 아니다. 키가 "그 사람" 것임을 보증하는 제3자
 *    (전자서명법상 인증사업자)는 여기 없다. 키 생성 시점의 이름은
 *    자기 주장이다. 이 모듈이 증명하는 것은 "같은 키가 서명했다"와
 *    "서명 이후 내용이 변하지 않았다"까지다.
 *  · 폴더 접근 통제가 아니다. 기록을 읽는 데는 여전히 OS 권한만 있으면
 *    된다. 이 모듈은 서명 위조의 비용을 올릴 뿐이다.
 *
 * Node 호환: WebCrypto(sign/verify/PBKDF2)는 Node 18+ 전역 crypto 로
 * 동일하게 동작한다. IndexedDB 는 브라우저 전용이므로 키 보관 함수만
 * 브라우저를 요구하고, 순수 암호 함수는 시뮬레이션에서 그대로 시험한다.
 * ════════════════════════════════════════════════════════════════ */

const subtle = globalThis.crypto.subtle;
const TE = new TextEncoder();

/* ── 공용 유틸 ── */
export function b64u(buf) {
  const b = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const raw = atob(s);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
export function hexToBytes(hex) {
  const h = String(hex).replace(/^sha256:/, '');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/* ══════════════════════════════════════════════════════════
 * PIN — PBKDF2 (솔트 없는 sha256 대체)
 *
 * 왜: 4~6자리 PIN 의 솔트 없는 sha256 은 폴더를 읽을 수 있는 사람이
 * 초 단위로 역산한다. PBKDF2 도 짧은 PIN 자체를 구하지는 못하지만
 * (탐색 공간이 작다), 사전 계산 테이블을 무효화하고 시도당 비용을
 * 21만 배 올린다. PIN 이 접근 통제가 아니라는 사실은 변하지 않으며,
 * 그 사실은 SECURITY.md 에 그대로 남는다.
 * ══════════════════════════════════════════════════════════ */
export const PIN_KDF = { name: 'PBKDF2', hash: 'SHA-256', iterations: 210000 };

export async function hashPin(pin, saltB64u) {
  const salt = saltB64u ? unb64u(saltB64u) : crypto.getRandomValues(new Uint8Array(16));
  const key = await subtle.importKey('raw', TE.encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', hash: PIN_KDF.hash, iterations: PIN_KDF.iterations, salt }, key, 256);
  return { kdf: 'PBKDF2-SHA256', iters: PIN_KDF.iterations, salt: b64u(salt), hash: b64u(bits) };
}

/** 구판(솔트 없는 sha256)과 신판을 모두 검사한다. 구판이 맞으면
 *  호출측이 즉시 신판으로 재저장하는 것을 전제로 legacy 플래그를 준다. */
export async function verifyPin(pin, rec, legacySha256Hex) {
  if (rec && rec.kdf === 'PBKDF2-SHA256') {
    const again = await hashPin(pin, rec.salt);
    return { ok: again.hash === rec.hash, legacy: false };
  }
  if (legacySha256Hex) {
    const d = await subtle.digest('SHA-256', TE.encode(String(pin)));
    const hex = [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join('');
    return { ok: hex === legacySha256Hex, legacy: true };
  }
  return { ok: false, legacy: false };
}

/* ══════════════════════════════════════════════════════════
 * A. 기기 키 — ECDSA P-256, 추출 불가, IndexedDB 보관
 *
 * 개인키는 extractable:false 로 만들어 IndexedDB 에 CryptoKey 객체
 * 그대로 넣는다(구조화 복제). 어떤 API 로도 바이트를 꺼낼 수 없고,
 * 공유폴더로도 나가지 않는다 — 기기 키는 기기에 남는 것이 요점이다.
 * 공개키(JWK)만 사용자 기록(data/users.json)에 실려 팀이 검증한다.
 * ══════════════════════════════════════════════════════════ */
const DB_NAME = 'aaarns-keys', DB_STORE = 'device-keys';

function idb() {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open(DB_NAME, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore(DB_STORE);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}
function idbGet(db, k) {
  return new Promise((res, rej) => {
    const rq = db.transaction(DB_STORE).objectStore(DB_STORE).get(k);
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
  });
}
function idbPut(db, k, v) {
  return new Promise((res, rej) => {
    const rq = db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(v, k);
    rq.onsuccess = () => res(); rq.onerror = () => rej(rq.error);
  });
}

export const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' };
export const ECDSA_SIGN = { name: 'ECDSA', hash: 'SHA-256' };

/** 사용자별 기기 키를 만들거나 가져온다. 반환: { pubJwk, created } */
export async function ensureDeviceKey(userName) {
  const db = await idb();
  const k = `u:${userName}`;
  let rec = await idbGet(db, k);
  let created = false;
  if (!rec) {
    const pair = await subtle.generateKey(ECDSA, /* extractable */ false, ['sign', 'verify']);
    const pubJwk = await subtle.exportKey('jwk', pair.publicKey);
    rec = { priv: pair.privateKey, pubJwk, created_at: new Date().toISOString() };
    await idbPut(db, k, rec);
    created = true;
  }
  return { pubJwk: rec.pubJwk, created };
}

export async function deviceKeyInfo(userName) {
  try {
    const db = await idb();
    const rec = await idbGet(db, `u:${userName}`);
    return rec ? { pubJwk: rec.pubJwk, created_at: rec.created_at } : null;
  } catch { return null; }
}

/** 기기 키로 서명. 대상은 항상 문자열(본문 해시)의 UTF-8 바이트다. */
export async function signWithDeviceKey(userName, message) {
  const db = await idb();
  const rec = await idbGet(db, `u:${userName}`);
  if (!rec) return null;
  const sig = await subtle.sign(ECDSA_SIGN, rec.priv, TE.encode(String(message)));
  return { sig_alg: 'ES256', pub_jwk: rec.pubJwk, sig: b64u(sig) };
}

/** 서명 검증 — 저장된 공개키가 아니라 서명 객체가 실은 공개키로 검증하되,
 *  호출측은 사용자 기록의 공개키와 일치하는지도 대조해야 한다(키 바꿔치기 탐지). */
export async function verifyDeviceSignature(entry, message) {
  if (!entry || entry.sig_alg !== 'ES256' || !entry.pub_jwk || !entry.sig) return false;
  try {
    const pub = await subtle.importKey('jwk', entry.pub_jwk, ECDSA, false, ['verify']);
    return await subtle.verify(ECDSA_SIGN, pub, unb64u(entry.sig), TE.encode(String(message)));
  } catch { return false; }
}

/** 공개키 지문 — 사람이 대조할 짧은 표기 (JWK 정규화 후 SHA-256 앞 8바이트) */
export async function keyFingerprint(pubJwk) {
  const s = `${pubJwk.kty}|${pubJwk.crv}|${pubJwk.x}|${pubJwk.y}`;
  const d = await subtle.digest('SHA-256', TE.encode(s));
  return [...new Uint8Array(d)].slice(0, 8).map(x => x.toString(16).padStart(2, '0')).join(':');
}

/* ══════════════════════════════════════════════════════════
 * B. 패스키 — WebAuthn 플랫폼 인증기
 *
 * 등록: navigator.credentials.create() → attestationObject(CBOR) 에서
 *       COSE 공개키를 꺼내 JWK 로 보관한다.
 * 서명: navigator.credentials.get({ challenge: 본문해시 바이트 }) —
 *       인증기가 생체/기기 PIN 을 요구하고, 서명은
 *       authenticatorData ‖ SHA-256(clientDataJSON) 을 덮는다.
 *       clientDataJSON.challenge 가 우리 해시와 일치하는지가
 *       "무엇에 서명했는가"를 결정한다.
 *
 * 검증 수학은 브라우저 없이도 돌아가야 시뮬레이션이 시험할 수 있으므로
 * verifyWebAuthnAssertion 은 순수 함수로 둔다.
 * ══════════════════════════════════════════════════════════ */

/* CBOR 최소 해독기 — attestationObject 해석에 필요한 만큼만.
   (uint, bytes, text, array, map, tagged 무시) */
export function cborDecode(bytes) {
  let i = 0;
  function item() {
    const ib = bytes[i++], major = ib >> 5, info = ib & 31;
    let n = info;
    if (info === 24) n = bytes[i++];
    else if (info === 25) { n = (bytes[i] << 8) | bytes[i + 1]; i += 2; }
    else if (info === 26) { n = (bytes[i] << 24 | bytes[i + 1] << 16 | bytes[i + 2] << 8 | bytes[i + 3]) >>> 0; i += 4; }
    else if (info > 26) throw new Error('CBOR: 지원하지 않는 길이');
    switch (major) {
      case 0: return n;
      case 1: return -1 - n;
      case 2: { const v = bytes.slice(i, i + n); i += n; return v; }
      case 3: { const v = new TextDecoder().decode(bytes.slice(i, i + n)); i += n; return v; }
      case 4: { const a = []; for (let k = 0; k < n; k++) a.push(item()); return a; }
      case 5: { const m = new Map(); for (let k = 0; k < n; k++) { const key = item(); m.set(key, item()); } return m; }
      case 6: return item();               // 태그는 벗기고 내용만
      default: throw new Error('CBOR: 지원하지 않는 형');
    }
  }
  return item();
}

/** attestationObject → { credId, pubJwk } (ES256 만 받는다) */
export function parseAttestation(attObjBytes) {
  const att = cborDecode(new Uint8Array(attObjBytes));
  const authData = att.get('authData');
  // authData: rpIdHash(32) flags(1) counter(4) [AAGUID(16) credIdLen(2) credId cosePub]
  if (!(authData[32] & 0x40)) throw new Error('attestation 에 자격증명 데이터가 없습니다');
  let o = 37 + 16;
  const credLen = (authData[o] << 8) | authData[o + 1]; o += 2;
  const credId = authData.slice(o, o + credLen); o += credLen;
  const cose = cborDecode(authData.slice(o));
  if (cose.get(3) !== -7) throw new Error('ES256(-7) 자격증명만 지원합니다');
  const pubJwk = { kty: 'EC', crv: 'P-256', x: b64u(cose.get(-2)), y: b64u(cose.get(-3)) };
  return { credId: b64u(credId), pubJwk };
}

/** 패스키 등록 (브라우저 전용). 반환 정보는 사용자 기록에 저장한다. */
export async function enrollPasskey(userName) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'AAA-RNS' },
      user: { id: TE.encode(userName), name: userName, displayName: userName },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60000,
    },
  });
  const { credId, pubJwk } = parseAttestation(cred.response.attestationObject);
  return { cred_id: credId, pub_jwk: pubJwk, enrolled_at: new Date().toISOString() };
}

/** 패스키로 본문 해시에 서명 (브라우저 전용) */
export async function signWithPasskey(passkeyRec, contentHashHex) {
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: hexToBytes(contentHashHex),
      allowCredentials: [{ type: 'public-key', id: unb64u(passkeyRec.cred_id) }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
  const r = assertion.response;
  return {
    sig_alg: 'WebAuthn-ES256',
    cred_id: passkeyRec.cred_id,
    authenticator_data: b64u(r.authenticatorData),
    client_data_json: b64u(r.clientDataJSON),
    sig: b64u(r.signature),
  };
}

/* WebAuthn 의 ECDSA 서명은 ASN.1 DER (r,s) 이고 WebCrypto verify 는
   원시 P1363 (r‖s 64바이트) 을 기대한다. 변환이 없으면 전부 실패한다. */
export function derSigToP1363(der) {
  const b = der instanceof Uint8Array ? der : new Uint8Array(der);
  if (b[0] !== 0x30) throw new Error('DER 서명이 아닙니다');
  let i = 2;
  if (b[1] & 0x80) i += (b[1] & 0x7f);
  function int() {
    if (b[i++] !== 0x02) throw new Error('DER INTEGER 아님');
    let len = b[i++];
    let v = b.slice(i, i + len); i += len;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);   // 선행 0 제거
    if (v.length > 32) throw new Error('정수가 32바이트를 넘습니다');
    const out = new Uint8Array(32); out.set(v, 32 - v.length);
    return out;
  }
  const r = int(), s = int();
  const out = new Uint8Array(64); out.set(r, 0); out.set(s, 32);
  return out;
}

/** 패스키 서명 검증 — 순수 함수 (Node 시뮬레이션에서도 동작).
 *  검사 순서가 곧 위협 모델이다:
 *   ① challenge == 본문 해시 (무엇에 서명했는가)
 *   ② type == webauthn.get (등록 응답 재사용 차단)
 *   ③ 서명이 authData‖SHA-256(clientDataJSON) 을 실제로 덮는가 */
export async function verifyWebAuthnAssertion(entry, contentHashHex, pubJwk) {
  try {
    const cdjBytes = unb64u(entry.client_data_json);
    const cdj = JSON.parse(new TextDecoder().decode(cdjBytes));
    if (cdj.type !== 'webauthn.get') return false;
    if (cdj.challenge !== b64u(hexToBytes(contentHashHex))) return false;
    const authData = unb64u(entry.authenticator_data);
    const cdjHash = new Uint8Array(await subtle.digest('SHA-256', cdjBytes));
    const signed = new Uint8Array(authData.length + 32);
    signed.set(authData, 0); signed.set(cdjHash, authData.length);
    const pub = await subtle.importKey('jwk', pubJwk, ECDSA, false, ['verify']);
    let raw;
    try { raw = derSigToP1363(unb64u(entry.sig)); }
    catch { raw = unb64u(entry.sig); }            // 이미 P1363 인 인증기도 있다
    return await subtle.verify(ECDSA_SIGN, pub, raw, signed);
  } catch { return false; }
}
