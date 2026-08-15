/* ════════════════════════════════════════════════════════════════
 * AAA-RNS · core/timestamp.js
 * Developed by Seung Ho Jung · v2.1 · Apache-2.0 © 2026
 * RFC-3161 시점인증 — 봉인 해시를 공인 TSA 가 서명한 시각에 결박한다
 *
 * 왜 필요한가
 * ─────────────────────────────────────────────────────────────
 * 지금까지 확정 시각은 기기 시계였다 — 시계를 돌릴 수 있는 사람의
 * 정직만큼만 믿을 수 있다. 이 모듈은 확정 직후 봉인 해시(내용이 아니라
 * 해시만)를 TSA 에 보내고, "이 해시가 이 시각에 존재했다"는 TSA 의
 * 전자서명(토큰)을 노트 옆에 저장한다. 토큰은 TSA 의 키로 서명되어
 * 있어 기록 보유자가 위조할 수 없다 — 체인의 머리를 기록 보유자의
 * 통제 밖에 고정하는 첫 장치다.
 *
 * 설계 원칙 (컴플라이언스 매트릭스 로드맵 5번을 그대로 구현)
 * ─────────────────────────────────────────────────────────────
 *  · 기본 꺼짐. 설정에서 켠다.
 *  · 전송되는 것은 SHA-256 해시 32바이트뿐이다. 본문·제목·이름 등
 *    어떤 내용도 나가지 않는다.
 *  · 오프라인이거나 TSA 가 죽어 있으면 조용히 로컬 시계로 강등한다.
 *    시점인증은 확정의 전제조건이 절대 아니다 — 에어갭 기계에서
 *    제품이 멈추면 이 제품을 고른 이유가 사라진다.
 *
 * 검증의 정직한 경계
 * ─────────────────────────────────────────────────────────────
 * 앱 안에서 하는 검증은 ① 토큰 구조 해석 ② messageImprint 가 봉인
 * 해시와 일치 ③ genTime 추출까지다. TSA 서명 자체의 완전한 암호학적
 * 검증(CMS SignedData, X.509 사슬)은 앱이 하지 않으며, 감사자가
 * openssl 로 독립 수행한다:
 *   openssl ts -verify -digest <seal_hash> -in token.tsr \
 *              -CAfile cacert.pem -untrusted tsa.crt
 * 반쪽짜리 검증기를 넣고 "검증된다"고 말하는 것보다, 경계를 긋고
 * 표준 도구에 넘기는 쪽이 이 제품의 원칙에 맞다.
 * ════════════════════════════════════════════════════════════════ */

import { hexToBytes, b64u, unb64u } from './signing.js';

/* ── 기본 TSA — 무료 공개 서비스. 설정에서 바꿀 수 있으나 CSP 가
     허용하는 호스트여야 한다(index.html 참조). ── */
export const DEFAULT_TSA = 'https://freetsa.org/tsr';

/* ══════════════════════════════════════════════════════════
 * DER 최소 인코더 — TimeStampReq 하나를 만들 만큼만
 * ══════════════════════════════════════════════════════════ */
function derLen(n) {
  if (n < 0x80) return [n];
  const bytes = [];
  while (n > 0) { bytes.unshift(n & 0xff); n >>= 8; }
  return [0x80 | bytes.length, ...bytes];
}
const der = (tag, body) => new Uint8Array([tag, ...derLen(body.length), ...body]);
const derSeq = (...parts) => {
  const body = concat(...parts);
  return der(0x30, body);
};
function concat(...arrs) {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

/* SHA-256 AlgorithmIdentifier: OID 2.16.840.1.101.3.4.2.1 + NULL */
const SHA256_ALGID = new Uint8Array([
  0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00,
]);

/**
 * TimeStampReq ::= SEQUENCE {
 *   version 1, messageImprint { SHA-256, OCTET STRING(32) },
 *   nonce INTEGER, certReq TRUE }
 * certReq TRUE 로 TSA 인증서를 토큰에 포함시킨다 — 몇 KB 커지지만
 * 수년 뒤 오프라인 검증 때 인증서를 따로 구하러 다니지 않게 된다.
 */
export function buildTsq(sealHashHex, nonceBytes) {
  const hash = hexToBytes(sealHashHex);
  if (hash.length !== 32) throw new Error('SHA-256 해시(64 hex)가 아닙니다');
  const nonce = nonceBytes || crypto.getRandomValues(new Uint8Array(8));
  const nonceInt = nonce[0] & 0x80 ? concat(new Uint8Array([0]), nonce) : nonce; // 양수 보장
  return derSeq(
    der(0x02, new Uint8Array([1])),                       // version 1
    derSeq(SHA256_ALGID, der(0x04, hash)),                // messageImprint
    der(0x02, nonceInt),                                  // nonce
    new Uint8Array([0x01, 0x01, 0xff]),                   // certReq TRUE
  );
}

/* ══════════════════════════════════════════════════════════
 * DER 최소 해독기 — TSR 에서 필요한 것만 걷는다
 * ══════════════════════════════════════════════════════════ */
export function derWalk(bytes, offset = 0) {
  const tag = bytes[offset];
  let i = offset + 1, len = bytes[i++];
  if (len & 0x80) {
    const n = len & 0x7f; len = 0;
    for (let k = 0; k < n; k++) len = (len << 8) | bytes[i++];
  }
  return { tag, start: i, end: i + len, header: offset };
}

/** SEQUENCE/SET 내부의 자식 TLV 목록 */
function children(bytes, node) {
  const out = [];
  let o = node.start;
  while (o < node.end) {
    const c = derWalk(bytes, o);
    out.push(c);
    o = c.end;
  }
  return out;
}

/** 깊이 우선으로 특정 OID(eContentType id-ct-TSTInfo 1.2.840.113549.1.9.16.1.4)를 찾는다 */
const OID_TSTINFO = new Uint8Array([0x06, 0x0b, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x10, 0x01, 0x04]);

function findTstInfo(bytes) {
  /* SignedData 안에서 id-ct-TSTInfo OID 바로 뒤 [0] EXPLICIT 안의
     OCTET STRING 이 TSTInfo DER 이다. OID 바이트열을 직접 스캔한다 —
     구조 전체를 해석하는 것보다 짧고, 오프셋 검증은 뒤의 파싱이 한다. */
  outer:
  for (let i = 0; i <= bytes.length - OID_TSTINFO.length; i++) {
    for (let k = 0; k < OID_TSTINFO.length; k++) {
      if (bytes[i + k] !== OID_TSTINFO[k]) continue outer;
    }
    let o = i + OID_TSTINFO.length;
    const ctx = derWalk(bytes, o);                 // [0] EXPLICIT
    if ((ctx.tag & 0xe0) !== 0xa0) continue;
    const oct = derWalk(bytes, ctx.start);         // OCTET STRING
    if (oct.tag !== 0x04) continue;
    return bytes.slice(oct.start, oct.end);
  }
  return null;
}

/** GeneralizedTime "YYYYMMDDHHMMSS[.f]Z" → ISO 8601 */
export function generalizedTimeToIso(s) {
  const m = String(s).match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.\d+)?Z$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

/**
 * TSR 해석. 반환:
 *  { status, statusOk, imprintHex, genTimeIso, serialHex, tokenBytes }
 * imprint 일치 여부는 호출측이 봉인 해시와 대조한다.
 */
export function parseTsr(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const root = derWalk(b, 0);
  if (root.tag !== 0x30) throw new Error('TSR: SEQUENCE 아님');
  const [statusInfo, ...rest] = children(b, root);
  const statusNode = children(b, statusInfo)[0];
  const status = b[statusNode.start];                     // 0 granted, 1 grantedWithMods
  const statusOk = status === 0 || status === 1;
  if (!statusOk || !rest.length) return { status, statusOk, imprintHex: null, genTimeIso: null, serialHex: null, tokenBytes: null };

  const tokenNode = rest[0];                              // ContentInfo (timeStampToken)
  const tokenBytes = b.slice(tokenNode.header, tokenNode.end);
  const tst = findTstInfo(b);
  if (!tst) throw new Error('TSR: TSTInfo 를 찾지 못했습니다');

  /* TSTInfo ::= SEQ { version, policy OID, messageImprint SEQ{alg, OCTET},
                       serialNumber INTEGER, genTime GeneralizedTime, ... } */
  const ti = derWalk(tst, 0);
  const kids = children(tst, ti);
  const imprintSeq = kids[2];
  const impKids = children(tst, imprintSeq);
  const impOct = impKids[1];
  const imprintHex = [...tst.slice(impOct.start, impOct.end)]
    .map(x => x.toString(16).padStart(2, '0')).join('');
  const serial = kids[3];
  const serialHex = [...tst.slice(serial.start, serial.end)]
    .map(x => x.toString(16).padStart(2, '0')).join('');
  const gen = kids[4];
  if (gen.tag !== 0x18) throw new Error('TSR: genTime(GeneralizedTime) 위치가 예상과 다릅니다');
  const genTimeIso = generalizedTimeToIso(new TextDecoder().decode(tst.slice(gen.start, gen.end)));
  return { status, statusOk, imprintHex, genTimeIso, serialHex, tokenBytes };
}

/* ══════════════════════════════════════════════════════════
 * 왕복 — 확정 직후 호출된다. 어떤 실패도 던지지 않는다.
 * ══════════════════════════════════════════════════════════ */
export async function obtainTimestamp(sealHashHex, tsaUrl = DEFAULT_TSA, timeoutMs = 8000) {
  try {
    const tsq = buildTsq(sealHashHex);
    /* 브라우저에서는 로컬 서버의 /tsa 프록시를 부른다. 공개 TSA 는 CORS
       헤더를 주지 않아 페이지가 직접 호출할 수 없고(실측: preflight 403),
       프록시 덕에 CSP 도 connect-src 'self' 그대로다. Node(시뮬레이션)는
       CORS 가 없으므로 TSA 를 직접 부른다. */
    const target = (typeof window !== 'undefined') ? '/tsa' : tsaUrl;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const resp = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/timestamp-query' },
      body: tsq,
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return { ok: false, reason: `TSA HTTP ${resp.status}` };
    const tsr = new Uint8Array(await resp.arrayBuffer());
    const parsed = parseTsr(tsr);
    if (!parsed.statusOk) return { ok: false, reason: `TSA 거절 status=${parsed.status}` };
    const want = String(sealHashHex).replace(/^sha256:/, '').toLowerCase();
    if (parsed.imprintHex !== want) {
      /* TSA 가 다른 해시에 서명했다 — 저장하면 오히려 반증 자료가 된다 */
      return { ok: false, reason: 'messageImprint 불일치' };
    }
    return {
      ok: true,
      tsa: tsaUrl,
      gen_time: parsed.genTimeIso,
      serial: parsed.serialHex,
      imprint: `sha256:${parsed.imprintHex}`,
      token_b64: b64u(tsr),                 // 전체 TSR 보존 — openssl 독립 검증용
      obtained_at: new Date().toISOString(),
    };
  } catch (e) {
    return { ok: false, reason: e.name === 'AbortError' ? '시간 초과' : String(e.message || e) };
  }
}

/** 저장된 토큰을 다시 해석해 봉인 해시와 대조한다 (앱 내 구조 검증).
 *  완전한 서명 검증은 openssl 경로를 안내한다 — 모듈 머리 주석 참조. */
export function verifyStoredTimestamp(rec, sealHashHex) {
  if (!rec || !rec.token_b64) return { ok: false, reason: '토큰 없음' };
  try {
    const parsed = parseTsr(unb64u(rec.token_b64));
    if (!parsed.statusOk) return { ok: false, reason: 'status 비정상' };
    const want = String(sealHashHex).replace(/^sha256:/, '').toLowerCase();
    if (parsed.imprintHex !== want) return { ok: false, reason: 'imprint 가 봉인 해시와 다름' };
    return { ok: true, gen_time: parsed.genTimeIso, serial: parsed.serialHex };
  } catch (e) {
    return { ok: false, reason: String(e.message || e) };
  }
}
