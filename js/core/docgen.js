/* ════════════════════════════════════════════════════════════════
 * AAA-RNS · core/docgen.js
 * Developed by Seung Ho Jung · v2.0 · Apache-2.0 © 2026
 * 자체 문서 생성기 — DOCX·XLSX (외부 라이브러리 0)
 *
 * 기존 AAA-RNS 의 docxBuild/xlsxBuild 설계 승계:
 *  · STORED(무압축) ZIP 을 바이트 단위로 직접 조립
 *  · 타임스탬프 고정 → 같은 입력이면 같은 바이트(재현 가능 빌드)
 *    — 산출물 해시 검증과 정합
 *  · 인터넷이 끊겨도, 회사망이 CDN 을 막아도 문서가 만들어진다
 * ════════════════════════════════════════════════════════════════ */

/* ── CRC32 ──────────────────────────────────────────────── */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ── ZIP (STORED) ───────────────────────────────────────── */
const TE = new TextEncoder();
const FIXED_TIME = 0x2821;   // 재현 가능 빌드용 고정 DOS 시각
const FIXED_DATE = 0x5821;

/**
 * @param {Array<{name:string, data:Uint8Array|string}>} entries
 * @returns {Uint8Array} ZIP 바이트
 */
export function zipBuild(entries) {
  const files = entries.map(e => ({
    name: TE.encode(e.name),
    data: typeof e.data === 'string' ? TE.encode(e.data) : e.data,
  }));
  let size = 0;
  for (const f of files) size += 30 + f.name.length + f.data.length + 46 + f.name.length;
  size += 22;
  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  let p = 0;
  const central = [];

  for (const f of files) {
    const crc = crc32(f.data);
    const ofs = p;
    dv.setUint32(p, 0x04034b50, true);      // local header
    dv.setUint16(p + 4, 20, true);          // version
    dv.setUint16(p + 6, 0x0800, true);      // UTF-8 flag
    dv.setUint16(p + 8, 0, true);           // STORED
    dv.setUint16(p + 10, FIXED_TIME, true);
    dv.setUint16(p + 12, FIXED_DATE, true);
    dv.setUint32(p + 14, crc, true);
    dv.setUint32(p + 18, f.data.length, true);
    dv.setUint32(p + 22, f.data.length, true);
    dv.setUint16(p + 26, f.name.length, true);
    dv.setUint16(p + 28, 0, true);
    out.set(f.name, p + 30);
    out.set(f.data, p + 30 + f.name.length);
    p += 30 + f.name.length + f.data.length;
    central.push({ f, crc, ofs });
  }

  const cdStart = p;
  for (const { f, crc, ofs } of central) {
    dv.setUint32(p, 0x02014b50, true);
    dv.setUint16(p + 4, 20, true);
    dv.setUint16(p + 6, 20, true);
    dv.setUint16(p + 8, 0x0800, true);
    dv.setUint16(p + 10, 0, true);
    dv.setUint16(p + 12, FIXED_TIME, true);
    dv.setUint16(p + 14, FIXED_DATE, true);
    dv.setUint32(p + 16, crc, true);
    dv.setUint32(p + 20, f.data.length, true);
    dv.setUint32(p + 24, f.data.length, true);
    dv.setUint16(p + 28, f.name.length, true);
    dv.setUint32(p + 42, ofs, true);
    out.set(f.name, p + 46);
    p += 46 + f.name.length;
  }
  const cdSize = p - cdStart;
  dv.setUint32(p, 0x06054b50, true);
  dv.setUint16(p + 8, central.length, true);
  dv.setUint16(p + 10, central.length, true);
  dv.setUint32(p + 12, cdSize, true);
  dv.setUint32(p + 16, cdStart, true);
  return out;
}

/* ── XML 이스케이프 (+제어문자 제거) ─────────────────────── */
export function xe(s) {
  return String(s ?? '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/* ══════════════════════════════════════════════════════════
 * DOCX
 *  블록 모델: {type:'h1'|'h2'|'p'|'small', text}
 *            {type:'table', rows:[[cell,…]], header:true?}
 *            {type:'pagebreak'}
 * ══════════════════════════════════════════════════════════ */

const DOCX_FONT = 'Malgun Gothic';

function runXml(text, opts = {}) {
  const props = [
    `<w:rFonts w:ascii="${DOCX_FONT}" w:eastAsia="${DOCX_FONT}" w:hAnsi="${DOCX_FONT}"/>`,
    opts.bold ? '<w:b/>' : '',
    opts.size ? `<w:sz w:val="${opts.size * 2}"/>` : '',
    opts.color ? `<w:color w:val="${opts.color}"/>` : '',
  ].join('');
  // 줄바꿈 → <w:br/>
  const parts = String(text ?? '').split('\n').map(t => `<w:t xml:space="preserve">${xe(t)}</w:t>`);
  return `<w:r><w:rPr>${props}</w:rPr>${parts.join('<w:br/>')}</w:r>`;
}

export function docxPara(text, opts = {}) {
  const pPr = [
    opts.align ? `<w:jc w:val="${opts.align}"/>` : '',
    opts.spaceAfter !== undefined ? `<w:spacing w:after="${opts.spaceAfter}"/>` : '<w:spacing w:after="120"/>',
  ].join('');
  return `<w:p><w:pPr>${pPr}</w:pPr>${runXml(text, opts)}</w:p>`;
}

export function docxTable(rows, opts = {}) {
  const header = opts.header !== false;
  const trs = rows.map((row, ri) => {
    const tcs = row.map(cell => {
      const bold = header && ri === 0;
      const shd = bold ? '<w:shd w:val="clear" w:fill="F0F2F5"/>' : '';
      return `<w:tc><w:tcPr>${shd}<w:tcMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar></w:tcPr>` +
        `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${runXml(cell, { bold, size: 9.5 })}</w:p></w:tc>`;
    }).join('');
    return `<w:tr>${tcs}</w:tr>`;
  }).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>` +
    `<w:tblBorders><w:top w:val="single" w:sz="4" w:color="999999"/><w:left w:val="single" w:sz="4" w:color="999999"/>` +
    `<w:bottom w:val="single" w:sz="4" w:color="999999"/><w:right w:val="single" w:sz="4" w:color="999999"/>` +
    `<w:insideH w:val="single" w:sz="4" w:color="BBBBBB"/><w:insideV w:val="single" w:sz="4" w:color="BBBBBB"/></w:tblBorders>` +
    `</w:tblPr>${trs}</w:tbl><w:p><w:pPr><w:spacing w:after="60"/></w:pPr></w:p>`;
}

/**
 * @param {Array} blocks 블록 모델 배열
 * @param {object} meta {title, creator}
 * @returns {Uint8Array} .docx 바이트
 */
export function docxBuild(blocks, meta = {}) {
  const body = blocks.map(b => {
    if (!b) return '';
    if (b.type === 'h1') return docxPara(b.text, { bold: true, size: 18, spaceAfter: 240 });
    if (b.type === 'h2') return docxPara(b.text, { bold: true, size: 13, spaceAfter: 160, color: '1F3B63' });
    if (b.type === 'small') return docxPara(b.text, { size: 8, color: '777777' });
    if (b.type === 'table') return docxTable(b.rows, b);
    if (b.type === 'pagebreak') return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    return docxPara(b.text !== undefined ? b.text : String(b), { size: 10.5 });
  }).join('');

  const document =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<w:body>${body}` +
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720"/>` +
    `<w:footerReference w:type="default" r:id="rIdF"/></w:sectPr></w:body></w:document>`;

  const footer =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>` +
    `<w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>` +
    `<w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>` +
    `<w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>` +
    `<w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve"> / </w:t></w:r>` +
    `<w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>` +
    `<w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:instrText xml:space="preserve"> NUMPAGES </w:instrText></w:r>` +
    `<w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;

  const core =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${xe(meta.title || '')}</dc:title><dc:creator>${xe(meta.creator || 'AAA-RNS')}</dc:creator>` +
    `</cp:coreProperties>`;

  return zipBuild([
    { name: '[Content_Types].xml', data:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
      `<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>` +
      `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
      `</Types>` },
    { name: '_rels/.rels', data:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
      `</Relationships>` },
    { name: 'word/_rels/document.xml.rels', data:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rIdF" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>` +
      `</Relationships>` },
    { name: 'word/document.xml', data: document },
    { name: 'word/footer1.xml', data: footer },
    { name: 'docProps/core.xml', data: core },
  ]);
}

/* ══════════════════════════════════════════════════════════
 * XLSX — inlineStr 셀 (sharedStrings 생략으로 단순·견고)
 * ══════════════════════════════════════════════════════════ */

function colRef(i) {
  let s = '';
  i += 1;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - 1 - m) / 26; }
  return s;
}

/**
 * @param {Array<{name:string, rows:Array<Array<string|number>>}>} sheets
 * @returns {Uint8Array} .xlsx 바이트
 */
export function xlsxBuild(sheets) {
  const safe = sheets.length ? sheets : [{ name: 'Sheet1', rows: [] }];
  const sheetXmls = safe.map(sheet => {
    const rowsXml = (sheet.rows || []).map((row, r) => {
      const cells = (row || []).map((v, c) => {
        const ref = colRef(c) + (r + 1);
        if (typeof v === 'number' && Number.isFinite(v)) {
          return `<c r="${ref}"><v>${v}</v></c>`;
        }
        const s = String(v ?? '');
        if (s === '') return '';
        return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xe(s.slice(0, 32000))}</t></is></c>`;
      }).join('');
      return `<row r="${r + 1}">${cells}</row>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`;
  });

  const wbSheets = safe.map((s, i) => {
    const nm = xe(String(s.name || 'Sheet' + (i + 1)).replace(/[\\\/\?\*\[\]:]/g, '_').slice(0, 31) || ('Sheet' + (i + 1)));
    return `<sheet name="${nm}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`;
  }).join('');

  const entries = [
    { name: '[Content_Types].xml', data:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      safe.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
      `</Types>` },
    { name: '_rels/.rels', data:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>` },
    { name: 'xl/workbook.xml', data:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets>${wbSheets}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      safe.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
      `</Relationships>` },
  ];
  sheetXmls.forEach((xml, i) => entries.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: xml }));
  return zipBuild(entries);
}

/* ══════════════════════════════════════════════════════════
 * 연구노트 정본 DOCX 블록 조립
 * ══════════════════════════════════════════════════════════ */
export function noteToDocxBlocks(note, ledger, opts = {}) {
  const b = [];
  const h = note.header || {};
  b.push({ type: 'h1', text: dt('연 구 노 트') });
  b.push({ type: 'table', rows: [
    [dt('과제번호'), h.과제번호 || '', dt('연구노트번호'), note.note_id || ''],
    [dt('과제명'), h.과제명 || '', dt('작성기간'), `${note.period.start} ~ ${note.period.end}`],
    [dt('작성자'), h.작성자 || '', dt('점검자'), h.점검자 || ''],
    [dt('작성일'), h.작성일 || '', dt('점검일'), h.점검일 || '(미점검)'],
    [dt('WP 연계'), (note.wp_refs || []).join(', ') || '-', dt('상태'), stateLabel(note._state)],
  ] });

  const sec = (title, arr, render) => {
    b.push({ type: 'h2', text: title });
    const items = (arr || []).filter(x => x && String(x.text || '').trim());
    if (!items.length) { b.push({ text: dt('해당 기간 관련 증거 자료 없음') }); return; }
    items.forEach(x => render(x));
  };
  const s = note.sections || {};
  sec(dt('1. 기간 목표'), s.goal, x => b.push({ text: '· ' + x.text + (x.wp ? ` (${x.wp})` : '') }));
  sec(dt('2. 수행 내용'), s.work, x => b.push({ text: '· ' + x.text }));
  sec(dt('3. 결과 데이터 (서술)'), s.results, x => b.push({ text: '· ' + x.text }));

  b.push({ type: 'h2', text: dt('4. 결과 데이터 (측정)') });
  const rows = [[dt('지표'), dt('값'), dt('단위'), dt('조건'), dt('목표'), dt('달성'), dt('증거')]];
  for (const m of (s.metrics || [])) {
    rows.push([m.metric, String(m.value ?? ''), m.unit || '', m.condition || '',
      m.target !== undefined && m.target !== null ? String(m.target) : '-',
      m.achieved === true ? '달성' : m.achieved === false ? '미달' : '-',
      (m.evidence || []).join(', ')]);
  }
  if (rows.length === 1) b.push({ text: dt('해당 기간 관련 증거 자료 없음') });
  else b.push({ type: 'table', rows });

  sec(dt('5. 해석'), s.interpretation, x => b.push({ text: '· ' + x.text }));
  sec(dt('6. 차기 계획'), s.next_plan, x => b.push({ text: '· ' + x.text }));

  b.push({ type: 'h2', text: dt('7. 첨부 원본 목록') });
  const atts = note.attachments || [];
  if (!atts.length) b.push({ text: '첨부 없음' });
  else b.push({ type: 'table', rows: [[dt('파일명'), '크기', 'SHA-256'],
    ...atts.map(a => [a.name, String(a.size || ''), (a.sha256 || '').slice(0, 16) + '…'])] });

  if (ledger && ledger.size && ledger.size()) {
    b.push({ type: 'h2', text: dt('8. 증거원장') });
    b.push({ type: 'table', rows: [['ID', '종류', dt('출처'), '위치', dt('내용')],
      ...ledger.entries.slice(0, 500).map(e => [e.id, e.kind, e.source_file, e.locator, e.content])] });
  }

  if (note._gate_summary) {
    b.push({ type: 'h2', text: dt('9. 게이트 판정') });
    b.push({ type: 'table', rows: [['게이트', '판정', '지적 수'],
      ...note._gate_summary.gates.map(g => [g.gate, g.pass ? 'PASS' : '지적', String(g.violations.length)])] });
  }

  b.push({ type: 'h2', text: dt('10. 수정 이력') });
  b.push({ type: 'table', rows: [[dt('시각'), '작업자', dt('내용')],
    ...(note.수정이력 || []).slice(-50).map(r => [r.at, r.by, r.what])] });

  b.push({ type: 'small', text:
    `${dt('본 문서의 무결성은 SHA-256 해시로 검증됩니다 (PKI 신원 증명이 아닙니다).')} ` +
    `${dt('본문 해시')}: ${note.content_sha256 || '-'}` +
    (note.seal_hash ? ` · ${dt('확정 해시')}: ${note.seal_hash}` : '') });
  return b;
}

/* 문서(정본 DOCX·XLSX) 라벨 — UI 언어를 따른다.
   회사 기록의 값 자체(과제명·서술문)는 번역하지 않는다. */
const DOC_I18N = {
  ko: null,  // 원문
  en: {
    '크기': 'Size',
    '단계': 'Stage',
    '서명자': 'Signer',
    '기여자': 'Contributor',
    '최종 승인': 'Final approval',
    '최종 승인 없음': 'No final approval',
    '첨부 없음': 'No attachments',
    '본 문서의 무결성은 SHA-256 해시로 검증됩니다 (PKI 신원 증명이 아닙니다).': "This document's integrity is verified by SHA-256 hash (not a PKI identity proof).",
    '연 구 노 트': 'R E S E A R C H   N O T E', '과제번호': 'Project Code', '과제명': 'Project Title',
    '연구노트번호': 'Note No.', '작성기간': 'Period', '작성자': 'Author', '점검자': 'Reviewer',
    '작성일': 'Date Written', '점검일': 'Date Reviewed', 'WP 연계': 'Work Package', '상태': 'State',
    '1. 기간 목표': '1. Period Goal', '2. 수행 내용': '2. Work Performed',
    '3. 결과 데이터 (서술)': '3. Result Data (Narrative)', '4. 결과 데이터 (측정)': '4. Result Data (Measurements)',
    '5. 해석': '5. Interpretation', '6. 차기 계획': '6. Next Plan', '7. 첨부 원본 목록': '7. Original Attachments',
    '8. 증거원장 발췌': '8. Evidence Ledger Extract', '9. 서명': '9. Signatures', '10. 수정 이력': '10. Revision History',
    '지표': 'Metric', '값': 'Value', '단위': 'Unit', '측정조건': 'Condition', '증거': 'Evidence',
    '파일명': 'File Name', '해시(SHA-256)': 'Hash (SHA-256)', '증거ID': 'Evidence ID', '내용': 'Content',
    '출처': 'Source', '역할': 'Role', '이름': 'Name', '시각': 'Timestamp',
    '해당 기간 관련 증거 자료 없음': 'No supporting evidence for this period',
    '본문 해시': 'Content Hash', '확정 해시': 'Seal Hash', '작성': 'Written', '점검': 'Reviewed',
    '초안': 'Draft', '서명 대기': 'Awaiting Signature', '권고 지적 보유': 'Advisory Findings',
    '확정': 'Sealed', '반려': 'Rejected',
  },
  ja: {
    '크기': 'サイズ',
    '단계': '段階',
    '서명자': '署名者',
    '기여자': '寄与者',
    '최종 승인': '最終承認',
    '최종 승인 없음': '最終承認なし',
    '첨부 없음': '添付なし',
    '본 문서의 무결성은 SHA-256 해시로 검증됩니다 (PKI 신원 증명이 아닙니다).': '本文書の完全性は SHA-256 ハッシュで検証されます（PKI の身元証明ではありません）。',
    '연 구 노 트': '研 究 ノ ー ト', '과제번호': '課題番号', '과제명': '課題名',
    '연구노트번호': '研究ノート番号', '작성기간': '作成期間', '작성자': '作成者', '점검자': '点検者',
    '작성일': '作成日', '점검일': '点検日', 'WP 연계': 'WP 連携', '상태': '状態',
    '1. 기간 목표': '1. 期間目標', '2. 수행 내용': '2. 実施内容',
    '3. 결과 데이터 (서술)': '3. 結果データ（記述）', '4. 결과 데이터 (측정)': '4. 結果データ（測定）',
    '5. 해석': '5. 解釈', '6. 차기 계획': '6. 次期計画', '7. 첨부 원본 목록': '7. 添付原本一覧',
    '8. 증거원장 발췌': '8. 証拠台帳抜粋', '9. 서명': '9. 署名', '10. 수정 이력': '10. 修正履歴',
    '지표': '指標', '값': '値', '단위': '単位', '측정조건': '測定条件', '증거': '証拠',
    '파일명': 'ファイル名', '해시(SHA-256)': 'ハッシュ（SHA-256）', '증거ID': '証拠ID', '내용': '内容',
    '출처': '出典', '역할': '役割', '이름': '氏名', '시각': '時刻',
    '해당 기간 관련 증거 자료 없음': '当該期間に関する証拠資料なし',
    '본문 해시': '本文ハッシュ', '확정 해시': '確定ハッシュ', '작성': '作成', '점검': '点検',
    '초안': '下書き', '서명 대기': '署名待ち', '권고 지적 보유': '推奨指摘あり',
    '확정': '確定', '반려': '差戻し',
  },
};

/** 문서 라벨 번역 (사전에 없으면 원문 유지 — 회사 데이터 보호) */
export function dt(label) {
  const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('aaarns_lang')) || 'ko';
  const map = DOC_I18N[lang];
  if (!map) return label;
  return map[String(label).trim()] || label;
}

export function stateLabel(state) {
  return dt(({
    empty: '빈 슬롯', queued: '생성 대기', draft: '초안', advisory: '권고 지적 보유',
    rejected: '반려', awaiting_sign: '서명 대기', sealed: '확정',
  })[state] || state);
}
