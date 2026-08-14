/* ════════════════════════════════════════════════════════════════
 * AAA-RNS · core/store.js
 * Developed by Seung Ho Jung · v2.0 · Apache-2.0 © 2026
 * 저장소 추상화 — 동일 인터페이스의 3개 어댑터
 *
 *  · MemoryStore        시뮬레이션·테스트용
 *  · LocalStore         브라우저 localStorage (개인 모드)
 *  · FsStore            File System Access API (공유폴더 협업 모드)
 *
 * 인터페이스: getJSON / putJSON / list / remove  (모두 async)
 * 경로 규칙: 'data/project.json' 처럼 슬래시 구분 상대 경로
 *
 * 동시성(기존 AAA-RNS 승계): 공유폴더에는 원자적 잠금이 없다.
 * putJSONRev 가 낙관적 _rev 검사(읽기→비교→쓰기)를 수행하고,
 * 경합 감지 시 RevConflictError 를 던진다 — 호출측이 재읽기·병합.
 * ════════════════════════════════════════════════════════════════ */

export class RevConflictError extends Error {
  constructor(path, expected, found) {
    super(`_rev 충돌: ${path} (기대 ${expected}, 실제 ${found})`);
    this.name = 'RevConflictError';
    this.path = path; this.expected = expected; this.found = found;
  }
}

/* ── 공통: 낙관적 _rev 쓰기 ─────────────────────────────── */
async function putJSONRevImpl(store, path, obj, expectedRev) {
  const cur = await store.getJSON(path);
  const curRev = cur && Number.isFinite(cur._rev) ? cur._rev : 0;
  if (expectedRev !== undefined && curRev !== expectedRev) {
    throw new RevConflictError(path, expectedRev, curRev);
  }
  const next = { ...obj, _rev: curRev + 1, _rev_at: new Date().toISOString() };
  await store.putJSON(path, next);
  return next._rev;
}

/* ══════════════════════════════════════════════════════════
 * MemoryStore
 * ══════════════════════════════════════════════════════════ */
export class MemoryStore {
  constructor() { this.map = new Map(); }
  async getJSON(path) {
    const v = this.map.get(path);
    if (v === undefined) return null;
    try { return JSON.parse(v); } catch { return null; }  // 바이너리 마커 등 비JSON 값
  }
  async putJSON(path, obj) { this.map.set(path, JSON.stringify(obj)); }
  async putJSONRev(path, obj, expectedRev) { return putJSONRevImpl(this, path, obj, expectedRev); }
  async list(prefix = '') {
    return [...this.map.keys()].filter(k => k.startsWith(prefix)).sort();
  }
  async remove(path) { this.map.delete(path); }
  async putBytes(path, bytes) { this.map.set(path, 'BIN:' + bytes.length); this._bin = this._bin || new Map(); this._bin.set(path, bytes); }
  async getBytes(path) { return this._bin ? (this._bin.get(path) || null) : null; }
}

/* ══════════════════════════════════════════════════════════
 * LocalStore — localStorage (개인 모드 / FS 미지원 브라우저 폴백)
 * ══════════════════════════════════════════════════════════ */
export class LocalStore {
  constructor(prefix = 'aaarns') { this.prefix = prefix + ':'; }
  _k(path) { return this.prefix + path; }
  async getJSON(path) {
    try {
      const v = localStorage.getItem(this._k(path));
      return v === null ? null : JSON.parse(v);
    } catch { return null; }
  }
  async putJSON(path, obj) {
    localStorage.setItem(this._k(path), JSON.stringify(obj));
  }
  async putJSONRev(path, obj, expectedRev) { return putJSONRevImpl(this, path, obj, expectedRev); }
  async list(prefix = '') {
    const out = [];
    const full = this.prefix + prefix;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(full)) out.push(k.slice(this.prefix.length));
    }
    return out.sort();
  }
  async remove(path) { localStorage.removeItem(this._k(path)); }
  async putBytes(path, bytes) {
    // localStorage 는 바이너리에 부적합 — base64 로 보관 (첨부 원본 소형 파일 한정)
    let bin = '';
    for (let i = 0; i < bytes.length; i += 32768) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    }
    localStorage.setItem(this._k(path) + ':b64', btoa(bin));
  }
  async getBytes(path) {
    const b64 = localStorage.getItem(this._k(path) + ':b64');
    if (!b64) return null;
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
}

/* ══════════════════════════════════════════════════════════
 * FsStore — File System Access API (공유폴더)
 * ══════════════════════════════════════════════════════════ */
export class FsStore {
  /** @param {FileSystemDirectoryHandle} dirHandle */
  constructor(dirHandle) { this.root = dirHandle; }

  async _dir(parts, create) {
    let d = this.root;
    for (const p of parts) d = await d.getDirectoryHandle(p, { create: !!create });
    return d;
  }

  async _fileHandle(path, create) {
    const parts = String(path).split('/').filter(Boolean);
    const name = parts.pop();
    const dir = await this._dir(parts, create);
    return dir.getFileHandle(name, { create: !!create });
  }

  async getJSON(path) {
    try {
      const fh = await this._fileHandle(path, false);
      const f = await fh.getFile();
      const t = await f.text();
      return t ? JSON.parse(t) : null;
    } catch { return null; }
  }

  async putJSON(path, obj) {
    const fh = await this._fileHandle(path, true);
    const w = await fh.createWritable();
    await w.write(JSON.stringify(obj, null, 2));
    await w.close();
  }

  async putJSONRev(path, obj, expectedRev) { return putJSONRevImpl(this, path, obj, expectedRev); }

  async putBytes(path, bytes) {
    const fh = await this._fileHandle(path, true);
    const w = await fh.createWritable();
    await w.write(bytes);
    await w.close();
  }

  async getBytes(path) {
    try {
      const fh = await this._fileHandle(path, false);
      const f = await fh.getFile();
      return new Uint8Array(await f.arrayBuffer());
    } catch { return null; }
  }

  async list(prefix = '') {
    // prefix 는 디렉토리 경로로 해석 — 해당 폴더의 파일명(재귀 1단계) 나열
    const parts = String(prefix).split('/').filter(Boolean);
    let dir;
    try { dir = await this._dir(parts, false); } catch { return []; }
    const out = [];
    for await (const [name, handle] of dir.entries()) {
      if (isJunkName(name)) continue;
      out.push((prefix ? prefix.replace(/\/$/, '') + '/' : '') + name + (handle.kind === 'directory' ? '/' : ''));
    }
    return out.sort();
  }

  async remove(path) {
    const parts = String(path).split('/').filter(Boolean);
    const name = parts.pop();
    try {
      const dir = await this._dir(parts, false);
      await dir.removeEntry(name, { recursive: true });
    } catch { /* 이미 없음 */ }
  }
}

/** 드라이브 충돌 사본·시스템 잡파일 판별 (기존 isJunkName 승계). */
export function isJunkName(name) {
  return /^\./.test(name) ||                       // .DS_Store 등 숨김
    /\s\(\d+\)\.[A-Za-z0-9]+$/.test(name) ||        // "name (1).ext" 충돌 사본
    /^~\$/.test(name) ||                            // Office 임시
    /\.(tmp|crdownload|partial)$/i.test(name);
}
