/* ════════════════════════════════════════════════════════════════
 * AAA-RNS · core/parsers.js
 * Developed by Seung Ho Jung · v2.0 · Apache-2.0 © 2026
 * 문서 파서 — PDF · DOCX · XLSX · HWPX · CSV · TXT/MD
 *
 * 외부 라이브러리 없음. ZIP 해제는 브라우저/Node 표준
 * DecompressionStream 을 사용한다. 인터넷·CDN 이 전혀 필요 없다.
 *
 * 계약(중요):
 *  · parseFile() 은 절대 throw 하지 않는다. 손상 파일·위장 확장자·
 *    빈 파일 전부 { ok:false, warnings:[...] } 로 정상 반환한다.
 *  · 추출 실패는 시스템 실패가 아니다 — 증거 없는 파일로 취급된다.
 * ════════════════════════════════════════════════════════════════ */

import { sha256, decodeText, extOf, normSpace } from './util.js';

/* ── 안전 한도 (zip 폭탄·메모리 고갈 방지) ─────────────────── */
const MAX_ENTRY_BYTES = 256 * 1024 * 1024;   // 엔트리당 압축해제 상한
const MAX_TOTAL_BYTES = 512 * 1024 * 1024;   // 문서당 압축해제 총합 상한
const MAX_SHEET_CELLS = 2_000_000;           // 시트당 셀 상한

/* ══════════════════════════════════════════════════════════
 * 공통 진입점
 * ══════════════════════════════════════════════════════════ */

/**
 * 파일 1개 파싱.
 * @param {string} name  파일명
 * @param {Uint8Array|ArrayBuffer} data
 * @returns {Promise<ParsedDoc>}
 */
export async function parseFile(name, data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const base = {
    ok: false, name: String(name ?? ''), ext: extOf(name), size: bytes.length,
    kind: 'unknown', text: '', paragraphs: [], tables: [], sheets: [],
    meta: {}, warnings: [], sha256: '',
  };
  try { base.sha256 = await sha256(bytes); } catch { /* hash 실패는 치명 아님 */ }

  if (!bytes.length) { base.warnings.push('빈 파일'); return base; }

  // 확장자가 아니라 시그니처(매직 바이트)로 실제 형식을 판정한다.
  const sig = sniff(bytes);
  try {
    if (sig === 'zip')  return await parseZipDoc(base, bytes);
    if (sig === 'pdf')  return await parsePdf(base, bytes);
    if (sig === 'hwp5') { base.kind = 'hwp'; base.warnings.push('HWP 5.0(바이너리) 형식은 지원하지 않습니다. HWPX 또는 PDF로 저장해 업로드하십시오.'); return base; }
    // 텍스트 계열
    return parseTextual(base, bytes);
  } catch (e) {
    base.warnings.push('파싱 실패: ' + (e && e.message ? e.message : String(e)));
    return base;
  }
}

/** 여러 파일 병렬 파싱. */
export async function parseFiles(files) {
  return Promise.all(files.map(f => parseFile(f.name, f.bytes)));
}

/* ── 매직 바이트 스니핑 ─────────────────────────────────── */
function sniff(b) {
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5 || b[2] === 7)) return 'zip';
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf'; // %PDF
  if (b.length >= 8 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return 'hwp5'; // CFB(구형 doc/hwp/xls)
  return 'text';
}

/* ══════════════════════════════════════════════════════════
 * 압축 해제 (표준 DecompressionStream)
 * ══════════════════════════════════════════════════════════ */
async function decompress(bytes, format) {
  const ds = new DecompressionStream(format);
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  if (buf.byteLength > MAX_ENTRY_BYTES) throw new Error('압축 해제 크기 초과');
  return new Uint8Array(buf);
}

/* ══════════════════════════════════════════════════════════
 * ZIP 컨테이너 (DOCX·XLSX·HWPX 공통)
 * ══════════════════════════════════════════════════════════ */

/**
 * ZIP 중앙 디렉토리를 해석해 엔트리 맵을 만든다.
 * (backup.js 의 백업 복원도 이 구현을 공유한다)
 * @returns {Promise<Map<string, () => Promise<Uint8Array>>>} 이름 → 지연 로더
 */
export async function readZip(bytes) {
  // EOCD(0x06054b50)를 뒤에서부터 스캔 (코멘트 최대 65535B)
  const n = bytes.length;
  let eocd = -1;
  const scanFrom = Math.max(0, n - 65557);
  for (let i = n - 22; i >= scanFrom; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP EOCD 없음(손상 파일)');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = dv.getUint16(eocd + 10, true);
  const cdOfs = dv.getUint32(eocd + 16, true);
  if (cdOfs >= n) throw new Error('ZIP 중앙 디렉토리 위치 오류');

  const entries = new Map();
  let p = cdOfs;
  let totalDeclared = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > n || dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const usize = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const cmtLen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const nameBytes = bytes.subarray(p + 46, p + 46 + nameLen);
    const name = new TextDecoder('utf-8').decode(nameBytes);
    totalDeclared += usize;
    if (totalDeclared > MAX_TOTAL_BYTES) throw new Error('ZIP 총 크기 상한 초과');
    if (usize <= MAX_ENTRY_BYTES && lho < n) {
      entries.set(name, makeLoader(bytes, dv, lho, method, csize));
    }
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return entries;
}

function makeLoader(bytes, dv, lho, method, csize) {
  return async () => {
    if (dv.getUint32(lho, true) !== 0x04034b50) throw new Error('ZIP 로컬 헤더 손상');
    const nameLen = dv.getUint16(lho + 26, true);
    const extraLen = dv.getUint16(lho + 28, true);
    const start = lho + 30 + nameLen + extraLen;
    const raw = bytes.subarray(start, start + csize);
    if (method === 0) return raw.slice();
    if (method === 8) return decompress(raw, 'deflate-raw');
    throw new Error('지원하지 않는 압축 방식: ' + method);
  };
}

async function zipText(entries, name) {
  const loader = entries.get(name);
  if (!loader) return null;
  return decodeText(await loader());
}

/* ══════════════════════════════════════════════════════════
 * XML 미니 도우미 (정규식 기반 — OOXML 텍스트 추출 전용)
 * ══════════════════════════════════════════════════════════ */
export function xmlDecode(s) {
  return String(s ?? '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
function safeChar(code) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try { return String.fromCodePoint(code); } catch { return ''; }
}

/** <tag ...>내용</tag> 전부 추출(비탐욕). */
function xmlAll(xml, tag) {
  const re = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + tag + '>', 'g');
  const out = []; let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

/* ══════════════════════════════════════════════════════════
 * ZIP 기반 문서: DOCX · XLSX · HWPX
 * ══════════════════════════════════════════════════════════ */
async function parseZipDoc(base, bytes) {
  let entries;
  try { entries = await readZip(bytes); }
  catch (e) { base.warnings.push('ZIP 해석 실패: ' + e.message); return base; }

  if (entries.has('word/document.xml')) return parseDocx(base, entries);
  if (entries.has('xl/workbook.xml')) return parseXlsx(base, entries);
  for (const k of entries.keys()) {
    if (/^Contents\/section\d+\.xml$/.test(k)) return parseHwpx(base, entries);
  }
  base.warnings.push('알 수 없는 ZIP 문서 형식(word/·xl/·Contents/ 없음)');
  return base;
}

/* ── DOCX ───────────────────────────────────────────────── */
async function parseDocx(base, entries) {
  base.kind = 'docx';
  const xml = await zipText(entries, 'word/document.xml');
  if (!xml) { base.warnings.push('word/document.xml 없음'); return base; }

  // 표를 먼저 분리 추출 (본문 문단과 중복 방지 위해 표 내부는 표시)
  for (const tbl of xmlAll(xml, 'w:tbl')) {
    const rows = [];
    for (const tr of xmlAll(tbl, 'w:tr')) {
      const cells = xmlAll(tr, 'w:tc').map(tc => cellText(tc));
      if (cells.length) rows.push(cells);
    }
    if (rows.length) base.tables.push(rows);
  }
  // 문단 (표 내부 문단 포함 — 전체 텍스트 검색용으로는 무해)
  const bodyNoTables = xml.replace(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g, 'TBL');
  for (const p of xmlAll(bodyNoTables, 'w:p')) {
    const t = cellText(p);
    if (t) base.paragraphs.push(t);
  }
  base.text = base.paragraphs.join('\n') + (base.tables.length
    ? '\n' + base.tables.map(rows => rows.map(r => r.join('\t')).join('\n')).join('\n')
    : '');

  // 메타데이터
  const core = await zipText(entries, 'docProps/core.xml');
  if (core) {
    base.meta.title = pick(core, 'dc:title');
    base.meta.creator = pick(core, 'dc:creator');
    base.meta.created = pick(core, 'dcterms:created');
    base.meta.modified = pick(core, 'dcterms:modified');
  }
  base.ok = true;
  if (!base.text.trim()) base.warnings.push('텍스트 없음(이미지 전용 문서일 수 있음)');
  return base;
}

function cellText(fragment) {
  // w:t 텍스트 + 탭/줄바꿈 요소
  const parts = [];
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g;
  let m;
  while ((m = re.exec(fragment))) {
    if (m[1] !== undefined) parts.push(xmlDecode(m[1]));
    else if (m[0].startsWith('<w:tab')) parts.push('\t');
    else parts.push('\n');
  }
  return normSpace(parts.join(''));
}
function pick(xml, tag) {
  const v = xmlAll(xml, tag)[0];
  return v !== undefined ? normSpace(xmlDecode(v)) : undefined;
}

/* ── XLSX ───────────────────────────────────────────────── */
async function parseXlsx(base, entries) {
  base.kind = 'xlsx';
  const wb = await zipText(entries, 'xl/workbook.xml');
  if (!wb) { base.warnings.push('xl/workbook.xml 없음'); return base; }

  // 시트 목록: name + r:id
  const sheetDefs = [];
  const reSheet = /<sheet\s[^>]*?\/?>/g;
  let sm;
  while ((sm = reSheet.exec(wb))) {
    const tag = sm[0];
    const name = attr(tag, 'name');
    const rid = attr(tag, 'r:id');
    if (name) sheetDefs.push({ name: xmlDecode(name), rid });
  }
  // rId → 파일 경로
  const rels = await zipText(entries, 'xl/_rels/workbook.xml.rels');
  const ridMap = {};
  if (rels) {
    const reRel = /<Relationship\s[^>]*?\/?>/g;
    let rm;
    while ((rm = reRel.exec(rels))) {
      const id = attr(rm[0], 'Id'), target = attr(rm[0], 'Target');
      if (id && target) ridMap[id] = target.replace(/^\/?(xl\/)?/, 'xl/');
    }
  }
  // 공유 문자열
  const shared = [];
  const ss = await zipText(entries, 'xl/sharedStrings.xml');
  if (ss) {
    for (const si of xmlAll(ss, 'si')) {
      const ts = xmlAll(si, 't').map(xmlDecode);
      shared.push(ts.join(''));
    }
  }

  let idx = 0;
  for (const def of sheetDefs) {
    idx += 1;
    const path = (def.rid && ridMap[def.rid]) || `xl/worksheets/sheet${idx}.xml`;
    const xml = await zipText(entries, path);
    if (!xml) { base.warnings.push(`시트 파일 없음: ${path}`); continue; }
    base.sheets.push({ name: def.name, rows: sheetRows(xml, shared, base.warnings) });
  }

  base.text = base.sheets.map(s =>
    `[시트: ${s.name}]\n` + s.rows.map(r => r.map(c => c ?? '').join('\t')).join('\n')
  ).join('\n\n');
  base.ok = true;
  if (!base.sheets.length) base.warnings.push('읽을 수 있는 시트 없음');
  return base;
}

function attr(tag, name) {
  const m = tag.match(new RegExp('(?:^|\\s)' + name.replace(':', '\\:') + '="([^"]*)"'));
  return m ? m[1] : undefined;
}

function colIndex(ref) {
  // "BC12" → 열 54 (0기준)
  let c = 0;
  for (let i = 0; i < ref.length; i++) {
    const ch = ref.charCodeAt(i);
    if (ch >= 65 && ch <= 90) c = c * 26 + (ch - 64);
    else break;
  }
  return c - 1;
}

function sheetRows(xml, shared, warnings) {
  const rows = [];
  let cellCount = 0;
  const reRow = /<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = reRow.exec(xml))) {
    const rowTag = rm[0].slice(0, rm[0].indexOf('>') + 1);
    const rIdx = parseInt(attr(rowTag, 'r') || (rows.length + 1), 10) - 1;
    if (rIdx < 0 || rIdx > 1_048_575) continue;
    const cells = [];
    const reCell = /<c(\s[^>]*)?(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    while ((cm = reCell.exec(rm[1]))) {
      const attrs = cm[1] || '';
      const inner = cm[2] || '';
      const ref = attr('<c' + attrs + '>', 'r');
      const type = attr('<c' + attrs + '>', 't');
      const ci = ref ? colIndex(ref) : cells.length;
      if (ci < 0 || ci > 16383) continue;
      let val = '';
      if (type === 's') {
        const v = xmlAll(inner, 'v')[0];
        const si = v !== undefined ? parseInt(v, 10) : -1;
        val = shared[si] !== undefined ? shared[si] : '';
      } else if (type === 'inlineStr') {
        val = xmlAll(inner, 't').map(xmlDecode).join('');
      } else if (type === 'str' || type === undefined || type === 'n' || type === 'b' || type === 'e') {
        const v = xmlAll(inner, 'v')[0];
        val = v !== undefined ? xmlDecode(v) : '';
      }
      cells[ci] = val;
      cellCount++;
      if (cellCount > MAX_SHEET_CELLS) { warnings.push('시트 셀 상한 초과 — 일부 생략'); return rows; }
    }
    // 희소 배열 → 빈 문자열 채움
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = '';
    rows[rIdx] = cells;
  }
  // 중간 빈 행 채움
  for (let i = 0; i < rows.length; i++) if (rows[i] === undefined) rows[i] = [];
  return rows;
}

/** Excel 날짜 시리얼 → ISO (1900 체계). 그럴듯한 범위만 변환, 아니면 null. */
export function excelSerialToISO(n) {
  if (!Number.isFinite(n) || n < 20000 || n > 80000) return null; // 1954~2118 범위만
  const ms = Math.round((n - 25569) * 86400000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/* ── HWPX ───────────────────────────────────────────────── */
async function parseHwpx(base, entries) {
  base.kind = 'hwpx';
  const sections = [...entries.keys()].filter(k => /^Contents\/section\d+\.xml$/.test(k)).sort();
  for (const sec of sections) {
    const xml = await zipText(entries, sec);
    if (!xml) continue;
    // 표 추출
    for (const tbl of xmlAll(xml, 'hp:tbl')) {
      const rows = [];
      for (const tr of xmlAll(tbl, 'hp:tr')) {
        const cells = xmlAll(tr, 'hp:tc').map(tc => normSpace(xmlAll(tc, 'hp:t').map(xmlDecode).join(' ')));
        if (cells.length) rows.push(cells);
      }
      if (rows.length) base.tables.push(rows);
    }
    const noTables = xml.replace(/<hp:tbl(?:\s[^>]*)?>[\s\S]*?<\/hp:tbl>/g, '');
    for (const p of xmlAll(noTables, 'hp:p')) {
      const t = normSpace(xmlAll(p, 'hp:t').map(xmlDecode).join(' '));
      if (t) base.paragraphs.push(t);
    }
  }
  base.text = base.paragraphs.join('\n') + (base.tables.length
    ? '\n' + base.tables.map(rows => rows.map(r => r.join('\t')).join('\n')).join('\n') : '');
  base.ok = true;
  if (!base.text.trim()) base.warnings.push('텍스트 없음');
  return base;
}

/* ══════════════════════════════════════════════════════════
 * PDF — 자체 텍스트 추출기
 *  · FlateDecode 스트림 해제(DecompressionStream 'deflate')
 *  · ToUnicode CMap(bfchar/bfrange) 해석 → 한글 CID 폰트 대응
 *  · 콘텐츠 스트림의 Tj/TJ/'/" 연산자에서 문자열 수집
 * 완전한 PDF 렌더러가 아니다 — 텍스트 레이어 추출 전용.
 * ══════════════════════════════════════════════════════════ */
async function parsePdf(base, bytes) {
  base.kind = 'pdf';
  const latin = latin1(bytes);

  // 1) 객체 수집: "N G obj ... endobj"
  const objects = new Map(); // num → {dict, streamRange}
  const reObj = /(\d+)\s+(\d+)\s+obj\b/g;
  let om;
  while ((om = reObj.exec(latin))) {
    const num = parseInt(om[1], 10);
    const start = om.index + om[0].length;
    const end = latin.indexOf('endobj', start);
    if (end < 0) continue;
    const body = latin.slice(start, end);
    const streamPos = body.indexOf('stream');
    let dict = body, streamRange = null;
    if (streamPos >= 0) {
      dict = body.slice(0, streamPos);
      let dataStart = start + streamPos + 6;
      if (latin[dataStart] === '\r') dataStart++;
      if (latin[dataStart] === '\n') dataStart++;
      const streamEnd = latin.indexOf('endstream', dataStart);
      if (streamEnd > dataStart) streamRange = [dataStart, streamEnd];
    }
    objects.set(num, { dict, streamRange });
    reObj.lastIndex = end + 6;
  }
  if (!objects.size) { base.warnings.push('PDF 객체를 찾지 못함(암호화·손상 가능)'); return base; }
  if (/\/Encrypt\b/.test(latin)) { base.warnings.push('암호화된 PDF — 텍스트 추출 불가'); return base; }

  // 2) 스트림 해제 도우미
  async function getStream(num) {
    const o = objects.get(num);
    if (!o || !o.streamRange) return null;
    let raw = bytes.subarray(o.streamRange[0], o.streamRange[1]);
    // endstream 직전 EOL 제거
    let end = raw.length;
    while (end > 0 && (raw[end - 1] === 10 || raw[end - 1] === 13)) end--;
    raw = raw.subarray(0, end);
    if (/\/FlateDecode\b/.test(o.dict)) {
      try { return await decompress(raw, 'deflate'); }
      catch { try { return await decompress(raw, 'deflate-raw'); } catch { return null; } }
    }
    if (/\/(DCTDecode|JPXDecode|CCITTFaxDecode)\b/.test(o.dict)) return null; // 이미지
    return raw.slice();
  }

  // 3) ToUnicode CMap 수집: 폰트 객체번호 → code→문자 맵
  const fontCmaps = new Map();
  for (const [num, o] of objects) {
    const m = o.dict.match(/\/ToUnicode\s+(\d+)\s+\d+\s+R/);
    if (!m) continue;
    const cs = await getStream(parseInt(m[1], 10));
    if (cs) {
      const cmap = parseCMap(latin1(cs));
      if (cmap.size) fontCmaps.set(num, cmap);
    }
  }
  // 리소스의 폰트 이름 → 폰트 객체번호 (모든 Resources 딕셔너리 통합 — 근사)
  const fontNameMap = new Map();
  const reFontDict = /\/Font\s*<<([\s\S]*?)>>/g;
  let fm;
  while ((fm = reFontDict.exec(latin))) {
    const reEntry = /\/(\w+)\s+(\d+)\s+\d+\s+R/g;
    let em;
    while ((em = reEntry.exec(fm[1]))) {
      if (!fontNameMap.has(em[1])) fontNameMap.set(em[1], parseInt(em[2], 10));
    }
  }

  // 4) 콘텐츠 스트림에서 텍스트 추출
  const chunks = [];
  let pages = 0;
  for (const [num, o] of objects) {
    if (!o.streamRange) continue;
    // 콘텐츠 후보: 이미지/폰트/CMap 스트림 제외
    if (/\/(Subtype)\s*\/(Image|Type1C|CIDFontType0C|OpenType)\b/.test(o.dict)) continue;
    if (/\/ToUnicode\b|\bbegincmap\b/.test(o.dict)) continue;
    const data = await getStream(num);
    if (!data) continue;
    const s = latin1(data);
    if (!/\b(Tj|TJ|Tf|BT)\b/.test(s)) continue;
    const t = extractContentText(s, fontNameMap, fontCmaps);
    if (t.trim()) chunks.push(t);
  }
  pages = (latin.match(/\/Type\s*\/Page\b(?!s)/g) || []).length;
  base.meta.pages = pages || undefined;

  // 메타데이터 (Info 딕셔너리)
  const info = latin.match(/\/Title\s*\(([^)]*)\)/);
  if (info) base.meta.title = normSpace(pdfDecodeLiteral(info[1]));

  base.text = chunks.join('\n');
  base.paragraphs = base.text.split(/\n+/).map(normSpace).filter(Boolean);
  base.ok = true;
  if (!base.text.trim()) base.warnings.push('PDF 텍스트 레이어 없음(스캔본이거나 특수 인코딩) — 이 파일은 첨부 증거로만 사용됩니다.');
  return base;
}

function latin1(bytes) {
  let s = '';
  const CHUNK = 32768;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return s;
}

/** CMap의 bfchar/bfrange → Map<codeInt, string> */
function parseCMap(s) {
  const map = new Map();
  const reChar = /beginbfchar([\s\S]*?)endbfchar/g;
  let m;
  while ((m = reChar.exec(s))) {
    const re = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
    let p;
    while ((p = re.exec(m[1]))) {
      map.set(parseInt(p[1], 16), hexToStr(p[2]));
    }
  }
  const reRange = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((m = reRange.exec(s))) {
    const re = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]+)>|\[([\s\S]*?)\])/g;
    let p;
    while ((p = re.exec(m[1]))) {
      const lo = parseInt(p[1], 16), hi = parseInt(p[2], 16);
      if (hi - lo > 65535) continue;
      if (p[3] !== undefined) {
        const baseHex = p[3];
        const width = baseHex.length;
        const baseVal = parseInt(baseHex.slice(-4) || baseHex, 16);
        const basePrefix = width > 4 ? baseHex.slice(0, -4) : '';
        for (let c = lo; c <= hi; c++) {
          const tail = (baseVal + (c - lo)).toString(16).padStart(Math.min(width, 4), '0');
          map.set(c, hexToStr(basePrefix + tail));
        }
      } else if (p[4]) {
        const arr = p[4].match(/<([0-9a-fA-F]+)>/g) || [];
        arr.forEach((h, i) => map.set(lo + i, hexToStr(h.slice(1, -1))));
      }
    }
  }
  return map;
}

function hexToStr(hex) {
  let out = '';
  for (let i = 0; i + 4 <= hex.length; i += 4) {
    const code = parseInt(hex.slice(i, i + 4), 16);
    if (code) out += String.fromCharCode(code);
  }
  if (hex.length % 4 === 2) {
    const code = parseInt(hex.slice(-2), 16);
    if (code) out += String.fromCharCode(code);
  }
  return out;
}

/** 콘텐츠 스트림 → 텍스트 (Tf로 폰트 추적, Tj/TJ/'/" 수집) */
function extractContentText(s, fontNameMap, fontCmaps) {
  const out = [];
  let cur = null; // 현재 폰트의 cmap
  let curSingleByte = true;
  // 토큰 스캔: 문자열/헥스/이름/연산자
  const re = /\/(\w+)\s+[\d.]+\s+Tf|\(((?:\\.|[^\\()])*)\)\s*(Tj|'|")|<([0-9a-fA-F\s]+)>\s*(Tj|'|")|\[((?:[^\[\]\\]|\\.)*?)\]\s*TJ|(T\*|Td|TD|ET|BT)/g;
  let m;
  while ((m = re.exec(s))) {
    if (m[1] !== undefined) {                     // Tf — 폰트 전환
      const objNum = fontNameMap.get(m[1]);
      cur = objNum !== undefined ? (fontCmaps.get(objNum) || null) : null;
      curSingleByte = !cur || [...cur.keys()].every(k => k <= 0xff);
    } else if (m[2] !== undefined) {              // (literal) Tj
      out.push(decodeLiteralWith(m[2], cur, curSingleByte));
      if (m[3] === "'" || m[3] === '"') out.push('\n');
    } else if (m[4] !== undefined) {              // <hex> Tj
      out.push(decodeHexWith(m[4].replace(/\s+/g, ''), cur, curSingleByte));
    } else if (m[6] !== undefined) {              // [ ... ] TJ
      const inner = m[6];
      const reIn = /\(((?:\\.|[^\\()])*)\)|<([0-9a-fA-F\s]+)>/g;
      let im;
      while ((im = reIn.exec(inner))) {
        if (im[1] !== undefined) out.push(decodeLiteralWith(im[1], cur, curSingleByte));
        else out.push(decodeHexWith(im[2].replace(/\s+/g, ''), cur, curSingleByte));
      }
    } else if (m[7]) {                            // 줄바꿈 계열 연산자
      if (m[7] === 'T*' || m[7] === 'Td' || m[7] === 'TD') out.push('\n');
    }
  }
  return out.join('').replace(/\n{3,}/g, '\n\n');
}

function pdfDecodeLiteral(s) {
  const unescaped = s.replace(/\\([nrtbf()\\]|\d{1,3})/g, (_, c) => {
    if (c === 'n') return '\n'; if (c === 'r') return '\r'; if (c === 't') return '\t';
    if (c === 'b') return '\b'; if (c === 'f') return '\f';
    if (c === '(' || c === ')' || c === '\\') return c;
    return String.fromCharCode(parseInt(c, 8) & 0xff);
  });
  // UTF-16BE BOM
  if (unescaped.charCodeAt(0) === 0xfe && unescaped.charCodeAt(1) === 0xff) {
    let out = '';
    for (let i = 2; i + 1 < unescaped.length; i += 2) {
      out += String.fromCharCode((unescaped.charCodeAt(i) << 8) | unescaped.charCodeAt(i + 1));
    }
    return out;
  }
  return unescaped;
}

function decodeLiteralWith(raw, cmap, singleByte) {
  const s = pdfDecodeLiteral(raw);
  if (!cmap) return s;
  if (singleByte) {
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const mapped = cmap.get(s.charCodeAt(i));
      out += mapped !== undefined ? mapped : s[i];
    }
    return out;
  }
  // 다바이트 CMap 폰트가 활성일 때의 리터럴 문자열:
  // 2바이트 코드 해석을 시도하되, 매핑률이 낮으면 ASCII 리터럴로
  // 판단하고 원문을 유지한다. (시뮬레이션 사이클 5에서 발견된
  // 결함 수정 — CMap 폰트 활성 중 ASCII 리터럴이 소실되던 문제)
  let out = '', mapped = 0, total = 0;
  for (let i = 0; i + 1 < s.length; i += 2) {
    total++;
    const code = (s.charCodeAt(i) << 8) | s.charCodeAt(i + 1);
    const m = cmap.get(code);
    if (m !== undefined) { mapped++; out += m; }
  }
  return (total && mapped / total >= 0.5) ? out : s;
}

function decodeHexWith(hex, cmap, singleByte) {
  if (hex.length % 2) hex += '0';
  if (cmap && !singleByte) {
    let out = '';
    for (let i = 0; i + 4 <= hex.length; i += 4) {
      const code = parseInt(hex.slice(i, i + 4), 16);
      const mapped = cmap.get(code);
      out += mapped !== undefined ? mapped : '';
    }
    return out;
  }
  let out = '';
  for (let i = 0; i + 2 <= hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16);
    const mapped = cmap ? cmap.get(code) : undefined;
    out += mapped !== undefined ? mapped : String.fromCharCode(code);
  }
  return out;
}

/* ══════════════════════════════════════════════════════════
 * 텍스트 계열: CSV · TXT · MD
 * ══════════════════════════════════════════════════════════ */
function parseTextual(base, bytes) {
  const text = decodeText(bytes);
  if (base.ext === 'csv' || looksLikeCsv(text)) {
    base.kind = 'csv';
    const rows = parseCsv(text);
    base.sheets.push({ name: base.name.replace(/\.[^.]+$/, '') || 'CSV', rows });
    base.text = rows.map(r => r.join('\t')).join('\n');
  } else {
    base.kind = 'text';
    base.text = text;
    base.paragraphs = text.split(/\r?\n/).map(normSpace).filter(Boolean);
  }
  base.ok = true;
  if (!base.text.trim()) base.warnings.push('내용이 비어 있음');
  return base;
}

function looksLikeCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 10);
  if (lines.length < 2) return false;
  const counts = lines.map(l => (l.match(/,/g) || []).length);
  return counts[0] >= 1 && counts.every(c => c === counts[0]);
}

/** RFC4180 준수 CSV 파서(따옴표·이스케이프·개행 처리). */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  const s = String(text ?? '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}
