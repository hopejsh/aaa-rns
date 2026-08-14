/* ════════════════════════════════════════════════════════════════
 * AAA-RNS · core/backup.js
 * Developed by Seung Ho Jung · v2.0 · Apache-2.0 © 2026
 * 백업·아카이브 — 무결성 검증이 내장된 보관 체계
 *
 *  ① 전체 백업(.zip)  — 저장소의 모든 기록(연구노트·증거원장·업로드
 *     원본 포함)을 하나의 ZIP 으로 묶는다. 매니페스트에 파일별
 *     SHA-256 을 기록해, 복원 시 단 1바이트의 손상도 탐지한다.
 *  ② 복원              — 전 파일 무결성 검증을 먼저 통과해야만
 *     기록을 쓴다 (손상 백업이면 아무것도 변경하지 않는다).
 *  ③ 확정 아카이브     — 노트가 확정(sealed)될 때마다 원본 JSON 과
 *     정본 DOCX 를 archive/<연도>/ 에 자동 보관한다.
 *     아카이브는 앱이 다시 읽지 않는 일방향 보관본으로,
 *     운영 데이터가 손상되어도 확정 기록은 남는다.
 * ════════════════════════════════════════════════════════════════ */

import { zipBuild, docxBuild, noteToDocxBlocks } from './docgen.js';
import { readZip } from './parsers.js';
import { sha256 } from './util.js';

const TE = new TextEncoder();
const TD = new TextDecoder();

/** 저장소 전체 키 나열 — FsStore 는 디렉토리('/'로 끝남)를 재귀 탐색 */
export async function walkStore(store, prefix = '') {
  const out = [];
  for (const k of await store.list(prefix)) {
    if (k.endsWith('/')) out.push(...await walkStore(store, k));
    else out.push(k);
  }
  return out;
}

/**
 * 전체 백업 ZIP 생성.
 * @returns {{bytes: Uint8Array, manifest: object}}
 */
export async function buildBackupZip(store) {
  const keys = await walkStore(store);
  const files = [];
  const seen = new Set();
  for (const k of keys) {
    /* LocalStore 는 바이너리를 '<경로>:b64' 키로 보관한다 */
    const isB64 = k.endsWith(':b64');
    const path = isB64 ? k.slice(0, -4) : k;
    if (seen.has(path)) continue;
    seen.add(path);
    if (isB64) {
      const b = await store.getBytes(path);
      if (b && b.length) files.push({ path, kind: 'bin', data: b });
      continue;
    }
    /* JSON 우선, 실패하면 바이너리 — 저장소 구현별 예외 차이를 흡수한다 */
    let j = null;
    try { j = await store.getJSON(path); } catch { j = null; }
    if (j !== null) { files.push({ path, kind: 'json', data: TE.encode(JSON.stringify(j)) }); continue; }
    let b = null;
    try { b = await store.getBytes(path); } catch { b = null; }
    if (b && b.length) files.push({ path, kind: 'bin', data: b });
  }

  const manifest = {
    product: 'AAA-RNS', version: '2.0', developer: 'Seung Ho Jung',
    exported_at: new Date().toISOString(),
    files: [],
  };
  for (const f of files) {
    manifest.files.push({ path: f.path, kind: f.kind, bytes: f.data.length, sha256: await sha256(f.data) });
  }
  const entries = files.map(f => ({ name: f.path, data: f.data }));
  entries.push({ name: 'backup_manifest.json', data: JSON.stringify(manifest, null, 1) });
  return { bytes: zipBuild(entries), manifest };
}

/**
 * 백업 ZIP 복원.
 * 전 파일의 SHA-256 검증을 먼저 통과해야 기록을 시작한다 —
 * 손상된 백업이면 저장소는 한 바이트도 변경되지 않는다.
 */
export async function restoreBackupZip(store, zipBytes) {
  const zmap = await readZip(zipBytes);
  const mfLoader = zmap.get('backup_manifest.json');
  if (!mfLoader) throw new Error('backup_manifest.json 이 없습니다 — AAA-RNS 백업 파일이 아닙니다');
  const manifest = JSON.parse(TD.decode(await mfLoader()));
  if (!Array.isArray(manifest.files)) throw new Error('매니페스트 형식 오류');

  /* ① 전 파일 무결성 검증 */
  const loaded = [];
  for (const f of manifest.files) {
    const loader = zmap.get(f.path);
    if (!loader) throw new Error(`백업 손상: '${f.path}' 항목 누락`);
    const data = await loader();
    if (await sha256(data) !== f.sha256) throw new Error(`백업 손상: '${f.path}' 해시 불일치`);
    loaded.push({ ...f, data });
  }
  /* ② 검증 통과 후에만 복원 */
  for (const f of loaded) {
    if (f.kind === 'json') await store.putJSON(f.path, JSON.parse(TD.decode(f.data)));
    else await store.putBytes(f.path, f.data);
  }
  return { files: loaded.length, exported_at: manifest.exported_at, product: manifest.product };
}

/**
 * 확정(sealed) 노트의 영구 보관 — archive/<연도>/<노트번호>.{json,docx}
 * 실패(용량 제한 등)해도 확정 자체는 유효하므로 조용히 넘어가되 결과를 반환한다.
 */
export async function archiveSealedNote(store, note, ledger) {
  const year = String(note.period && note.period.end ? note.period.end : '0000').slice(0, 4);
  const base = `archive/${year}/${note.note_id}`;
  const result = { json: false, docx: false, base };
  try { await store.putJSON(base + '.json', note); result.json = true; } catch { /* 보관 실패 허용 */ }
  try {
    const docx = docxBuild(noteToDocxBlocks(note, ledger), { title: note.note_id });
    await store.putBytes(base + '.docx', docx);
    result.docx = true;
  } catch { /* 보관 실패 허용 */ }
  return result;
}
