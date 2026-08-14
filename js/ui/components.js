/* ════════════════════════════════════════════════════════════════
 * AAA-RNS · ui/components.js
 * Developed by Seung Ho Jung · v2.0 · Apache-2.0 © 2026
 * UI 기본 도구 — DOM 헬퍼·아이콘·토스트·모달·차트(자체 SVG)
 * ════════════════════════════════════════════════════════════════ */

import { escapeHtml } from '../core/util.js';

export const esc = escapeHtml;

/** DOM 요소 생성 헬퍼. el('div', {class:'card', onclick:fn}, [children|html]) */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of Array.isArray(children) ? children : [children]) {
    if (c === null || c === undefined) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function qs(sel, root = document) { return root.querySelector(sel); }

/* ── 아이콘 (인라인 SVG — 이모지 대신 절제된 라인 아이콘) ── */
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  planner: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18"/>',
  note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
  ledger: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h6"/>',
  metrics: '<path d="M3 3v18h18"/><path d="M7 14l4-5 3 3 5-7"/>',
  agents: '<circle cx="12" cy="7" r="4"/><path d="M5.5 21a7 7 0 0 1 13 0"/><path d="M19 8l2 2-2 2M5 8l-2 2 2 2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  roadmap: '<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M12 19h4.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H12"/>',
  refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
};

export function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

/* ── 토스트 ─────────────────────────────────────────────── */
export function toast(msg, kind = 'ok', ms = 4200) {
  let host = qs('#toast');
  if (!host) { host = el('div', { id: 'toast' }); document.body.appendChild(host); }
  const t = el('div', { class: 'tst ' + kind, html: esc(msg) });
  host.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .25s'; setTimeout(() => t.remove(), 260); }, ms);
}

/* ── 모달 ───────────────────────────────────────────────── */
let _modalStack = [];

export function openModal({ title, body, foot, wide, onClose }) {
  const mask = el('div', { class: 'mask on' });
  const modal = el('div', { class: 'modal' + (wide ? ' wide' : '') });
  const head = el('div', { class: 'mHead' }, [
    el('div', { class: 't', html: esc(title) }),
    el('button', { class: 'x', html: '&times;', onclick: () => closeModal(mask) }),
  ]);
  const bodyEl = el('div', { class: 'mBody' });
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body) bodyEl.appendChild(body);
  modal.appendChild(head);
  modal.appendChild(bodyEl);
  if (foot) {
    const footEl = el('div', { class: 'mFoot' });
    (Array.isArray(foot) ? foot : [foot]).forEach(b => footEl.appendChild(b));
    modal.appendChild(footEl);
  }
  mask.appendChild(modal);
  mask.addEventListener('click', e => { if (e.target === mask) closeModal(mask); });
  mask._onClose = onClose;
  document.body.appendChild(mask);
  _modalStack.push(mask);
  return { mask, body: bodyEl };
}

export function closeModal(mask) {
  const m = mask || _modalStack[_modalStack.length - 1];
  if (!m) return;
  _modalStack = _modalStack.filter(x => x !== m);
  if (m._onClose) try { m._onClose(); } catch { /* noop */ }
  m.remove();
}

export function confirmModal(title, message, okLabel = '확인') {
  return new Promise(resolve => {
    const ok = el('button', { class: 'btn p', html: esc(okLabel), onclick: () => { done(true); } });
    const cancel = el('button', { class: 'btn', html: '취소', onclick: () => { done(false); } });
    const { mask } = openModal({ title, body: `<div class="sm">${esc(message)}</div>`, foot: [cancel, ok], onClose: () => resolve(false) });
    function done(v) { mask._onClose = null; closeModal(mask); resolve(v); }
  });
}

/* ── 파일 다운로드 ──────────────────────────────────────── */
export function downloadBytes(name, bytes, mime = 'application/octet-stream') {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 400);
}

export function downloadText(name, text, mime = 'text/plain;charset=utf-8') {
  downloadBytes(name, new TextEncoder().encode(text), mime);
}

/* ── 파일 선택/드롭 → {name, bytes} 배열 ─────────────────── */
export function pickFiles(accept, multiple = true) {
  return new Promise(resolve => {
    const input = el('input', { type: 'file', accept: accept || '', style: 'display:none' });
    if (multiple) input.multiple = true;
    input.addEventListener('change', async () => {
      resolve(await readFileList(input.files));
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  });
}

export async function readFileList(fileList) {
  const out = [];
  for (const f of fileList) {
    out.push({ name: f.name, size: f.size, mtime: f.lastModified, bytes: new Uint8Array(await f.arrayBuffer()) });
  }
  return out;
}

/* ══════════════════════════════════════════════════════════
 * 자체 SVG 차트 — 외부 라이브러리 없음
 * ══════════════════════════════════════════════════════════ */

/**
 * 라인 차트: 목표(점선 계단) vs 실측(실선). 보간·외삽 금지 —
 * 없는 데이터는 그리지 않는다 (기존 AAA-RNS 원칙 승계).
 * @param {object} o {width, height, months, target, actuals:[{m, value}], direction}
 */
export function lineChart(o) {
  const W = o.width || 300, H = o.height || 90;
  const padL = 34, padR = 8, padT = 8, padB = 18;
  const iw = W - padL - padR, ih = H - padT - padB;
  const months = Math.max(1, o.months || 12);

  const vals = (o.actuals || []).map(a => +a.value).filter(Number.isFinite);
  if (Number.isFinite(+o.target)) vals.push(+o.target);
  if (!vals.length) {
    return `<svg width="${W}" height="${H}"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="11" fill="var(--fg3)">데이터 없음</text></svg>`;
  }
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const span = hi - lo;
  lo -= span * 0.12; hi += span * 0.12;

  const X = m => padL + (Math.min(Math.max(m, 1), months) - 1) / Math.max(1, months - 1) * iw;
  const Y = v => padT + (1 - (v - lo) / (hi - lo)) * ih;

  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  // 축·눈금
  s += `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" stroke="var(--line)" />`;
  s += `<line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="var(--line)" />`;
  for (const v of [lo + (hi - lo) * .08, (lo + hi) / 2, hi - (hi - lo) * .08]) {
    s += `<text x="${padL - 4}" y="${Y(v) + 3}" text-anchor="end" font-size="8.5" fill="var(--fg3)">${fmtTick(v)}</text>`;
  }
  s += `<text x="${padL}" y="${H - 4}" font-size="8.5" fill="var(--fg3)">M1</text>`;
  s += `<text x="${W - padR}" y="${H - 4}" text-anchor="end" font-size="8.5" fill="var(--fg3)">M${months}</text>`;
  // 목표선
  if (Number.isFinite(+o.target)) {
    s += `<line x1="${padL}" y1="${Y(+o.target)}" x2="${W - padR}" y2="${Y(+o.target)}" stroke="var(--warn)" stroke-dasharray="4 3" stroke-width="1.2"/>`;
  }
  // 실측
  const pts = (o.actuals || []).filter(a => Number.isFinite(+a.value) && Number.isFinite(+a.m))
    .sort((a, b) => a.m - b.m);
  if (pts.length) {
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.m).toFixed(1)},${Y(+p.value).toFixed(1)}`).join(' ');
    s += `<path d="${path}" fill="none" stroke="var(--acc)" stroke-width="1.8"/>`;
    for (const p of pts) s += `<circle cx="${X(p.m).toFixed(1)}" cy="${Y(+p.value).toFixed(1)}" r="2.6" fill="var(--acc)"/>`;
  }
  s += '</svg>';
  return s;
}

function fmtTick(v) {
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (Math.abs(v) >= 1e4) return (v / 1e3).toFixed(0) + 'k';
  return Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1);
}

/**
 * 간단 간트: WP 막대 (SVG).
 * @param {object} o {wps:[{id,name,start,end}], period:{start,end}, today, onLabel?}
 */
export function ganttSvg(o) {
  const rows = o.wps || [];
  const labelW = 190, trackW = 720, rowH = 30, headH = 26;
  const W = labelW + trackW + 14, H = headH + rows.length * rowH + 10;
  const t0 = Date.parse(o.period.start), t1 = Date.parse(o.period.end) + 86400000;
  const span = Math.max(1, t1 - t0);
  const X = iso => labelW + Math.min(1, Math.max(0, (Date.parse(iso) - t0) / span)) * trackW;

  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="var(--sans)">`;
  // 월 눈금
  const d0 = new Date(t0);
  let cur = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), 1));
  let mi = 0;
  while (cur.getTime() < t1 && mi < 130) {
    const x = X(cur.toISOString().slice(0, 10));
    if (x >= labelW) {
      s += `<line x1="${x}" y1="${headH}" x2="${x}" y2="${H - 8}" stroke="var(--line2)"/>`;
      if (mi % 2 === 0) s += `<text x="${x + 2}" y="${headH - 8}" font-size="9" fill="var(--fg3)">${cur.getUTCFullYear()}.${String(cur.getUTCMonth() + 1).padStart(2, '0')}</text>`;
    }
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    mi++;
  }
  rows.forEach((w, i) => {
    const y = headH + i * rowH;
    s += `<text x="4" y="${y + rowH / 2 + 4}" font-size="11.5" fill="var(--fg)" font-weight="600">${esc(w.id)}</text>`;
    s += `<text x="46" y="${y + rowH / 2 + 4}" font-size="10.5" fill="var(--fg2)">${esc(String(w.name).slice(0, 18))}</text>`;
    const x1 = X(w.start), x2 = Math.max(X(w.end), x1 + 4);
    const color = ['var(--y1)', 'var(--y2)', 'var(--y3)'][i % 3];
    s += `<rect x="${x1}" y="${y + 7}" width="${x2 - x1}" height="${rowH - 15}" rx="4" fill="${color}" opacity="0.78"/>`;
  });
  // 오늘선
  if (o.today) {
    const xt = X(o.today);
    if (xt > labelW && xt < W - 10) {
      s += `<line x1="${xt}" y1="${headH - 4}" x2="${xt}" y2="${H - 8}" stroke="var(--bad)" stroke-width="1.4" stroke-dasharray="3 3"/>`;
    }
  }
  s += '</svg>';
  return s;
}
