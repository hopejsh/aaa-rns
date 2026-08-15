/* ════════════════════════════════════════════════════════════════
 * AAA-RNS · ui/app.js
 * 메인 애플리케이션 — 온보딩 · 셸 · 뷰 · 노트 워크플로
 *
 * 아키텍처: 서버 없는 로컬/공유폴더 앱.
 *  · 기본 저장소 localStorage → [폴더 연결] 시 File System Access API
 *  · 모든 파싱·분석·생성·검증·문서화가 브라우저 안에서 완결된다
 * ════════════════════════════════════════════════════════════════ */

import { fmtDate, isValidDate, diffDays, addDays, addMonths, fmtBytes, parseLooseDate, sha256 } from '../core/util.js';
import { parseFile } from '../core/parsers.js';
import { analyzeDocuments } from '../core/analyzer.js';
import { generateSystem, validateSystem, buildPlanner, AGENT_ROSTER } from '../core/generator.js';
import { EvidenceLedger, citationsIn } from '../core/ledger.js';
import { runGates } from '../core/gates.js';
import { extractCandidates, autoRegisterEvidence, buildAutoDraft, applyDraftToNote } from '../core/autodraft.js';
import { buildBackupZip, restoreBackupZip, archiveSealedNote } from '../core/backup.js';
import { verifyLicenseKey } from '../core/license.js';
import { EDITION, COMMUNITY_LICENSE, bindsToOneProject } from '../core/edition.js';
import { APP_VERSION, BUILD_DATE, VERIFY_CYCLES, VERIFY_RUNS } from '../core/version.js';
import { hashPin, verifyPin, ensureDeviceKey, deviceKeyInfo, signWithDeviceKey,
         keyFingerprint, enrollPasskey, signWithPasskey } from '../core/signing.js';
import { obtainTimestamp, verifyStoredTimestamp, DEFAULT_TSA } from '../core/timestamp.js';
import { LLM_PROVIDERS, llmTest, polishNarrative } from '../core/llm.js';
import { LANGS, getLang, setLang, initLang, translateDOM, t } from '../i18n/i18n.js';
import {
  createNote, noteContentHash, commitNote, applyGateResult,
  addContributorSignature, sealNote, reviseNote, verifySealChain, verifyNoteIntegrity,
  attachTimestamp, verifyCryptoSignatures,
} from '../core/notes.js';
import { LocalStore, FsStore } from '../core/store.js';
import { docxBuild, xlsxBuild, noteToDocxBlocks, stateLabel, dt } from '../core/docgen.js';
import {
  el, qs, esc, icon, toast, openModal, closeModal, confirmModal,
  downloadBytes, downloadText, pickFiles, readFileList, lineChart, ganttSvg,
} from './components.js';

/* ══════════════════════════════════════════════════════════
 * 전역 상태
 * ══════════════════════════════════════════════════════════ */
const S = {
  store: new LocalStore('aaarns'),
  storeKind: 'local',
  config: null, project: null, planner: null, metrics: null, users: null,
  notesIndex: null,           // {notes:[{note_id,state,period,updated_at}]}
  ledger: new EvidenceLedger(),
  view: 'dashboard',
  currentNoteId: null,
  noteCache: new Map(),
};

const today = () => fmtDate(new Date());

/* ── 감사 기록 ── */
async function audit(action, detail = '') {
  try {
    const log = (await S.store.getJSON('data/audit.json')) || { entries: [] };
    log.entries.push({ at: new Date().toISOString(), user: currentUser(), action, detail: String(detail).slice(0, 200) });
    if (log.entries.length > 2000) log.entries = log.entries.slice(-2000);
    await S.store.putJSON('data/audit.json', log);
  } catch { /* 감사 기록 실패가 작업을 막지는 않는다 */ }
}

function currentUser() {
  return localStorage.getItem('aaarns_user') || '(미지정)';
}

/* ══════════════════════════════════════════════════════════
 * 사용자 세션 — 최초 1회 설정(이름·이메일·PIN·공유폴더) + 역할
 *
 * 첫 등록자가 「책임 데이터 관리자」가 되고, 백업·복원·초기화 등
 * 데이터 관리 기능은 그 사람에게만 보인다.
 * 주의: 로컬 앱 특성상 이것은 운영 정책 통제다 — 강제력 있는 접근
 * 통제는 공유폴더의 OS 권한으로, 변조 탐지는 해시 체인으로 수행된다.
 * ══════════════════════════════════════════════════════════ */
function meUser() { return S.users.users.find(u => u.name === currentUser()) || null; }
function adminUser() { return S.users.users.find(u => u.is_admin) || null; }
function isAdmin() { const m = meUser(); return !!(m && m.is_admin); }

/** PIN 재확인 (파괴적 작업 전) — PBKDF2 대조.
 *  구판(솔트 없는 sha256) 사용자는 성공한 그 자리에서 신판으로 이관한다 —
 *  올바른 PIN 을 아는 순간이 재해시할 수 있는 유일한 순간이기 때문이다. */
function pinConfirm(user, title = 'PIN 확인') {
  return new Promise(resolve => {
    if (!user || (!user.pin_hash && !user.pin)) { resolve(true); return; }
    const body = el('div');
    body.innerHTML = `<div class="sm mb8">${esc(user.name)} 님의 PIN 을 입력하십시오.</div>`;
    const inp = el('input', { type: 'password', placeholder: 'PIN', style: 'width:100%' });
    body.appendChild(inp);
    const ok = el('button', { class: 'btn p', html: '확인', onclick: async () => {
      const v = await verifyPin(inp.value.trim(), user.pin, user.pin_hash);
      if (!v.ok) { toast('PIN 이 일치하지 않습니다.', 'err'); return; }
      if (v.legacy) {
        user.pin = await hashPin(inp.value.trim());
        delete user.pin_hash;
        await S.store.putJSON('data/users.json', S.users);
        await audit('user.pin_upgrade', `${user.name} · PBKDF2 이관`);
      }
      m2._done = true; closeModal(m2.mask); resolve(true);
    } });
    const m2 = openModal({ title, body, foot: [ok], onClose: () => { if (!m2._done) resolve(false); } });
    setTimeout(() => inp.focus(), 50);
  });
}

/** 서명 직전에 암호 서명을 모은다.
 *  기기 키(A)는 있으면 조용히 쓰고 없으면 이름 서명으로 진행한다.
 *  패스키(B)는 사용자가 켠 경우이므로, 취소·실패 시 서명 자체를 중단한다 —
 *  켜 놓은 2요소가 조용히 빠지는 것은 사용자가 기대한 보안이 아니다.
 *  반환: extras 객체, 또는 null(중단). */
async function gatherSignatureExtras(signerName, contentHash) {
  const extras = {};
  try {
    const c = await signWithDeviceKey(signerName, contentHash);
    if (c) extras.crypto = c;
  } catch (e) {
    toast('기기 키 서명 실패 — 이름 서명만 기록됩니다: ' + e.message, 'warn');
  }
  const u = S.users.users.find(x => x.name === signerName);
  if (u && u.passkey && u.passkey_sign) {
    try {
      extras.passkey = await signWithPasskey(u.passkey, contentHash);
    } catch (e) {
      toast('패스키 서명이 취소되어 서명을 중단했습니다.', 'err');
      return null;
    }
  }
  return extras;
}

/** 최초 시작 흐름 — 등록 안 된 사용자에게 설정 모달을 띄운다 */
async function ensureUserSession() {
  const me = meUser();
  const admin = adminUser();
  if (me && (me.pin_hash || me.pin)) return;   // 등록 완료 사용자 (구판·신판 모두)
  const first = !admin;                        // 아직 관리자가 없다 = 최초 시작

  const body = el('div');
  body.innerHTML = first
    ? `<div class="infoBox" style="margin-top:0">처음 시작합니다. <b>첫 등록자가 책임 데이터 관리자</b>(기본값)가 되어
       백업·복원·초기화 등 데이터 관리를 담당합니다. 이 권한은 나중에 설정에서
       다른 등록 사용자에게 언제든 양도할 수 있습니다.</div>`
    : `<div class="sm mut mb8">사용자 등록 — 이름·이메일·PIN 을 설정하십시오. (책임 데이터 관리자: <b>${esc(admin.name)}</b>)</div>`;
  const nameIn = el('input', { placeholder: '이름 (연구노트 서명에 사용)', value: currentUser() === '(미지정)' ? '' : currentUser(), style: 'width:100%;margin-top:8px' });
  const mailIn = el('input', { type: 'email', placeholder: '이메일', style: 'width:100%;margin-top:8px' });
  const pinIn = el('input', { type: 'password', placeholder: 'PIN (4자리 이상 — 데이터 관리·설정 변경 확인용)', style: 'width:100%;margin-top:8px' });
  const pin2In = el('input', { type: 'password', placeholder: 'PIN 확인', style: 'width:100%;margin-top:8px' });
  body.append(nameIn, mailIn, pinIn, pin2In);
  body.appendChild(el('div', { class: 'sm mut', style: 'margin-top:12px', html:
    '팀 공유폴더를 쓰는 회사라면 지금 연결하십시오 (Chrome/Edge · PC마다 최초 1회):' }));
  body.appendChild(el('button', { class: 'btn sm', style: 'margin-top:6px', html: '공유폴더 연결 (선택)',
    onclick: () => connectFolder() }));

  return new Promise(resolve => {
    const start = el('button', { class: 'btn p', html: '시작하기', onclick: async () => {
      const name = nameIn.value.trim(), mail = mailIn.value.trim(), pin = pinIn.value.trim();
      if (name.length < 2) { toast('이름을 입력하십시오.', 'warn'); return; }
      if (pin.length < 4) { toast('PIN 은 4자리 이상이어야 합니다.', 'warn'); return; }
      if (pin !== pin2In.value.trim()) { toast('PIN 확인이 일치하지 않습니다.', 'warn'); return; }
      const pinRec = await hashPin(pin);           // PBKDF2 — 솔트 없는 sha256 은 신규에 쓰지 않는다
      let u = S.users.users.find(x => x.name === name);
      if (u && (u.pin_hash || u.pin)) { toast('이미 등록된 이름입니다. 본인이면 이 이름으로 다시 접속하십시오.', 'warn'); return; }
      if (!u) { u = { name, role: first ? '책임 데이터 관리자' : '참여연구원' }; S.users.users.push(u); }
      u.email = mail; u.pin = pinRec;
      /* A(기본): 기기 서명 키 자동 생성 — 서명을 이름이 아니라 키에 결박한다.
         실패해도 등록은 막지 않는다(이름 서명으로 진행). */
      try {
        const { pubJwk } = await ensureDeviceKey(name);
        const fp = await keyFingerprint(pubJwk);
        u.device_keys = u.device_keys || [];
        if (!u.device_keys.some(k => k.fp === fp)) {
          u.device_keys.push({ pub_jwk: pubJwk, fp, created_at: new Date().toISOString() });
        }
      } catch (e) {
        toast('기기 서명 키 생성 실패 — 이름 서명만 기록됩니다: ' + e.message, 'warn');
      }
      if (first) u.is_admin = true;
      await S.store.putJSON('data/users.json', S.users);
      localStorage.setItem('aaarns_user', name);
      await audit('user.register', `${name}${first ? ' (책임 데이터 관리자)' : ''}`);
      mm._done = true; closeModal(mm.mask);
      renderTopMeta(); renderShell(); nav('dashboard');
      toast(first ? `${name} 님이 책임 데이터 관리자로 등록되었습니다.` : `${name} 님 등록 완료`, 'ok');
      resolve();
    } });
    const mm = openModal({
      title: first ? '시작 설정 — 책임 데이터 관리자 등록' : '사용자 등록',
      body, foot: [start], onClose: () => { if (!mm._done) resolve(); },
    });
  });
}

/* ══════════════════════════════════════════════════════════
 * 부팅
 * ══════════════════════════════════════════════════════════ */
async function boot() {
  applyTheme(localStorage.getItem('aaarns_theme') || 'institutional');
  initLang();
  mountPreLang();          // 첫 화면용 언어 선택기 (앱 진입 전 유일한 전환 수단)
  translateDOM();          // index.html 정적 마크업(제목·뒤로가기·사이드바)

  /* 설치 등록 인증 — enterprise 빌드에서는 유효한 라이선스가 없으면
     어떤 화면도 열리지 않는다. community 빌드는 키 없이 통과하되,
     사용자가 키를 넣어 두었다면 그 키를 그대로 존중한다(회사 배포본을
     공개본 위에 덮어쓰는 경우가 있다). */
  const licRec = await S.store.getJSON('data/license.json');
  S.license = licRec && licRec.key ? await verifyLicenseKey(licRec.key) : null;
  if ((!S.license || !S.license.ok) && EDITION === 'community') S.license = COMMUNITY_LICENSE;
  if (!S.license || !S.license.ok) { showLicenseGate(S.license); return; }

  S.config = await S.store.getJSON('data/config.json');
  if (!S.config) { showOnboarding(); return; }
  S.project = await S.store.getJSON('data/project.json');
  S.planner = await S.store.getJSON('data/planner.json');
  S.metrics = await S.store.getJSON('data/metrics.json');
  S.users = (await S.store.getJSON('data/users.json')) || { users: [] };
  S.notesIndex = (await S.store.getJSON('data/notes_index.json')) || { notes: [] };
  S.llm = await S.store.getJSON('data/llm.json');
  const led = await S.store.getJSON('ledger/evidence_ledger.json');
  S.ledger = new EvidenceLedger(led || []);
  if (!S.project || !S.planner) { showOnboarding(); return; }

  /* 라이선스-프로젝트 귀속 — 설치본당 1개 프로젝트.
     커뮤니티 사용권은 대상이 정해진 발급이 아니므로 귀속시키지 않는다. */
  let bind = bindsToOneProject(S.license)
    ? await S.store.getJSON('data/license_binding.json') : null;
  if (bindsToOneProject(S.license) && !bind) {
    /* 기존 설치 승계: 현재 프로젝트에 귀속 */
    bind = { license_id: S.license.license_id, licensee: S.license.payload.licensee,
      project_code: S.project.project_code, project_title: S.project.title, bound_at: new Date().toISOString() };
    await S.store.putJSON('data/license_binding.json', bind);
  }
  if (bind && (bind.project_code !== S.project.project_code || bind.license_id !== S.license.license_id)) {
    showLicenseGate(null, bind);
    return;
  }

  qs('#onboard').hidden = true;
  qs('#app').hidden = false;
  renderShell();
  nav('dashboard');
  ensureUserSession();   // 최초 1회: 이름·이메일·PIN·공유폴더 설정
}

function applyTheme(name) {
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem('aaarns_theme', name);
}

async function persistAll() {
  await S.store.putJSON('data/config.json', S.config);
  await S.store.putJSON('data/project.json', S.project);
  await S.store.putJSON('data/planner.json', S.planner);
  await S.store.putJSON('data/metrics.json', S.metrics);
  await S.store.putJSON('data/users.json', S.users);
  await S.store.putJSON('data/notes_index.json', S.notesIndex);
  await S.store.putJSON('ledger/evidence_ledger.json', S.ledger.toJSON());
}

/* ══════════════════════════════════════════════════════════
 * 온보딩 — 파일 업로드 → 심층 분석 → 확인 → 시스템 생성
 * ══════════════════════════════════════════════════════════ */
const OB = { step: 1, files: [], parsed: [], analysis: null, form: {} };

/* ══════════════════════════════════════════════════════════
 * 첫 화면 언어 선택기
 *
 * 앱 셸(#app)의 헤더 선택기는 로그인 이후에만 보이므로, 그 전 화면
 * (설치 등록 인증·온보딩)에서는 언어를 바꿀 수단이 없었다. 외국
 * 사용자가 한국어 화면에 갇히는 문제를 막기 위해 #onboard 바깥에
 * 고정 배치하고, #onboard 의 표시 여부를 따라 자동으로 켜고 끈다.
 * ══════════════════════════════════════════════════════════ */
function mountPreLang() {
  const host = qs('#preLang');
  const ob = qs('#onboard');
  if (!host || !ob) return;

  const sel = el('select', {
    title: '언어 / Language / 言語',
    onchange: e => setLang(e.target.value, { rerender: () => boot() }),
  });
  for (const l of LANGS) sel.appendChild(el('option', { value: l.id, html: l.label }));
  sel.value = getLang();
  host.innerHTML = '';
  host.appendChild(sel);

  /* #onboard 가 보일 때만 노출 — 표시 상태를 관찰해 모든 진입 경로를 자동 처리 */
  const sync = () => { host.hidden = ob.hidden; sel.value = getLang(); };
  sync();
  new MutationObserver(sync).observe(ob, { attributes: true, attributeFilter: ['hidden'] });
}

/* ══════════════════════════════════════════════════════════
 * 설치 등록 인증 화면 — 라이선스 키 입력 (오프라인 서명 검증)
 * ══════════════════════════════════════════════════════════ */
function showLicenseGate(failed, bindMismatch) {
  const ob = qs('#onboard');
  ob.hidden = false;
  qs('#app').hidden = true;
  ob.innerHTML = '';
  const wrap = el('div', { class: 'obWrap', style: 'max-width:640px' });
  wrap.innerHTML = `
    <div class="obBrand">
      <div class="logo" aria-label="Research Notes">
        <svg viewBox="0 0 48 48" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="5" width="30" height="38" rx="4"/><path d="M17 5v38"/>
          <path d="M23 15h9M23 22h9M23 29h5"/>
          <path d="M27.5 37.5l9.5-9.5 3.5 3.5-9.5 9.5-4.6 1.1z" fill="#fff" stroke="none"/>
        </svg>
      </div>
      <h1>설치 등록 인증</h1>
      <div class="obAcr">AAA-RNS · AI Agent-driven Autonomous Research Notebook System</div>
      <p class="obVer"><span class="devCred">v2.0 · Developed by <b>Seung Ho Jung</b></span></p>
    </div>`;
  const card = el('div', { class: 'card' });
  if (bindMismatch) {
    card.innerHTML = `<div class="warnBox" style="margin-top:0"><b>이 설치본은 이미 다른 프로젝트에 등록되어 있습니다.</b><br>
      등록 프로젝트: <span class="mono">${esc(bindMismatch.project_code)}</span> (${esc(bindMismatch.licensee || '')})<br><br>
      라이선스 1개는 1개 프로젝트에만 사용할 수 있습니다. 새 프로젝트에는
      새 라이선스 키를 발급받아 입력하십시오.</div>`;
  } else if (failed && failed.error) {
    card.innerHTML = `<div class="warnBox" style="margin-top:0">${esc(failed.error)}</div>`;
  } else {
    card.innerHTML = `<div class="sm mut">이 소프트웨어는 발급된 회사·연구소에서만 사용할 수 있습니다.<br>
      전달받은 <b>라이선스 키</b>를 붙여넣거나 .lic 파일을 선택하십시오.<br>
      키가 없다면 개발자(Seung Ho Jung)에게 발급을 요청하십시오.</div>`;
  }
  const ta = el('textarea', { placeholder: '라이선스 키 붙여넣기 (예: eyJ2IjoxLC… . …)', style: 'margin-top:12px;min-height:96px;font-family:var(--mono);font-size:12px' });
  card.appendChild(ta);
  const row = el('div', { class: 'flex mt8' });
  row.appendChild(el('button', {
    class: 'btn sm', html: icon('file') + '.lic 파일 선택',
    onclick: async () => {
      const files = await pickFiles('.lic,.txt', false);
      if (files.length) ta.value = new TextDecoder().decode(files[0].bytes).trim();
    },
  }));
  const okBtn = el('button', {
    class: 'btn p', style: 'margin-left:auto', html: icon('check') + '등록 인증',
    onclick: async () => {
      const v = await verifyLicenseKey(ta.value);
      if (!v.ok) { toast(v.error || '키가 유효하지 않습니다.', 'err'); return; }
      /* 귀속 불일치 상태에서 새 키 입력 → 새 키가 새 프로젝트를 담당 */
      if (bindMismatch && v.license_id === (bindMismatch.license_id || '')) {
        toast('같은 키입니다 — 이 키는 이미 프로젝트 ' + bindMismatch.project_code + ' 에 귀속되어 있습니다.', 'err');
        return;
      }
      await S.store.putJSON('data/license.json', {
        key: ta.value.trim().replace(/\s+/g, ''), licensee: v.payload.licensee,
        license_id: v.license_id, activated_at: new Date().toISOString(),
      });
      if (bindMismatch) await S.store.remove('data/license_binding.json');
      await audit('license.activate', `${v.payload.licensee} · ${v.license_id}`);
      toast(`등록 완료 — ${v.payload.licensee}`, 'ok');
      ob.hidden = true;
      boot();
    },
  });
  row.appendChild(okBtn);
  card.appendChild(row);
  wrap.appendChild(card);
  ob.appendChild(wrap);
}

function showOnboarding() {
  qs('#app').hidden = true;
  const host = qs('#onboard');
  host.hidden = false;
  OB.step = 1; OB.files = []; OB.parsed = []; OB.analysis = null; OB.form = {};
  renderOnboard();
}

function obSteps() {
  const names = ['문서 업로드', '심층 분석', '추출 결과 확인', '시스템 생성'];
  return `<div class="obSteps">${names.map((n, i) => {
    const cls = OB.step === i + 1 ? 'on' : (OB.step > i + 1 ? 'done' : '');
    return `<div class="obStep ${cls}"><span class="n">${OB.step > i + 1 ? '✓' : i + 1}</span>${n}</div>`;
  }).join('')}</div>`;
}

function renderOnboard() {
  const host = qs('#onboard');
  host.innerHTML = `
    <div class="obWrap">
      <div class="obBrand">
        <div class="logo" aria-label="Research Notes">
          <svg viewBox="0 0 48 48" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="5" width="30" height="38" rx="4"/>
            <path d="M17 5v38"/>
            <path d="M23 15h9M23 22h9M23 29h5"/>
            <path d="M27.5 37.5l9.5-9.5 3.5 3.5-9.5 9.5-4.6 1.1z" fill="#fff" stroke="none"/>
          </svg>
        </div>
        <h1>AI 에이전트 연구노트 자동화 시스템</h1>
        <div class="obAcr">AAA-RNS · AI Agent-driven Autonomous Research Notebook System</div>
        <p class="obVer"><span class="devCred">v2.0 · Developed by <b>Seung Ho Jung</b></span></p>
        <p class="obDesc">연구 문서를 업로드하면, 시스템이 과제 구조를 분석해 귀사 전용 연구노트 자동화 환경을 구성합니다.</p>
      </div>
      ${obSteps()}
      <div id="obBody"></div>
    </div>`;
  const body = qs('#obBody');
  if (OB.step === 1) renderObUpload(body);
  else if (OB.step === 2) renderObAnalyze(body);
  else if (OB.step === 3) renderObReview(body);
  else renderObGenerate(body);
}

function renderObUpload(body) {
  body.appendChild(el('div', { class: 'card' }, [
    el('div', {
      class: 'dropzone', id: 'obDrop',
      html: `${icon('upload')}<div class="big">연구 문서를 끌어다 놓거나 클릭해 선택</div>
        <div class="fmt">연구개발계획서 · 제안서 · 일정표 · 지표표 등 — PDF · DOCX · XLSX · HWPX · CSV · TXT (여러 개 가능)</div>`,
      onclick: async () => { addObFiles(await pickFiles('.pdf,.docx,.xlsx,.hwpx,.csv,.txt,.md')); },
    }),
    el('div', { id: 'obFiles' }),
    el('div', { class: 'mt16 right' }, [
      el('button', {
        class: 'btn p', html: '분석 시작 →',
        onclick: () => {
          if (!OB.files.length) { toast('문서를 1개 이상 업로드하십시오.', 'warn'); return; }
          OB.step = 2; renderOnboard(); runObAnalysis();
        },
      }),
    ]),
  ]));
  const dz = qs('#obDrop');
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', async e => {
    e.preventDefault(); dz.classList.remove('over');
    addObFiles(await readFileList(e.dataTransfer.files));
  });
  renderObFileList();
}

function addObFiles(files) {
  for (const f of files) {
    if (OB.files.some(x => x.name === f.name && x.size === f.size)) continue;
    OB.files.push(f);
  }
  renderObFileList();
}

function renderObFileList() {
  const host = qs('#obFiles');
  if (!host) return;
  host.innerHTML = '';
  OB.files.forEach((f, i) => {
    host.appendChild(el('div', { class: 'fileRow' }, [
      el('span', { html: icon('file'), style: 'width:15px;height:15px;color:var(--fg3)' }),
      el('span', { class: 'nm', html: esc(f.name) }),
      el('span', { class: 'sz', html: fmtBytes(f.size) }),
      el('button', { class: 'btn sm', html: '제거', onclick: () => { OB.files.splice(i, 1); renderObFileList(); } }),
    ]));
  });
}

function renderObAnalyze(body) {
  body.innerHTML = `<div class="card">
    <div class="cardH"><div class="cardT">문서 심층 분석 중</div></div>
    <div id="obLog" class="mono xs" style="line-height:2"></div>
    <div class="pbar mt12"><i id="obPbar" style="width:5%"></i></div>
  </div>`;
}

async function runObAnalysis() {
  const log = m => { const h = qs('#obLog'); if (h) h.innerHTML += esc(m) + '<br>'; };
  const pbar = p => { const h = qs('#obPbar'); if (h) h.style.width = p + '%'; };
  OB.parsed = [];
  for (let i = 0; i < OB.files.length; i++) {
    const f = OB.files[i];
    log(`[A6 수집·정규화] ${f.name} 파싱…`);
    const d = await parseFile(f.name, f.bytes);
    d._bytes = f.bytes;
    OB.parsed.push(d);
    log(`  → ${d.ok ? '완료' : '실패'} · ${d.kind} · 문단 ${d.paragraphs.length} · 표 ${d.tables.length + d.sheets.length}` +
      (d.warnings.length ? ` · ⚠ ${d.warnings.join('; ')}` : ''));
    pbar(5 + (i + 1) / OB.files.length * 55);
  }
  log('[A1 과제기획관] 과제 구조 추출 중…');
  await new Promise(r => setTimeout(r, 60));
  OB.analysis = analyzeDocuments(OB.parsed);
  pbar(85);
  const st = OB.analysis.stats;
  log(`  → 텍스트 ${st.lines}행 · 표 ${st.tables}개 분석 · 증거 후보 ${st.evidenceCount}건 확보`);
  log('[A7 시점판별] 추출값 확인을 위해 사용자 검토로 이동합니다.');
  pbar(100);
  setTimeout(() => { OB.step = 3; renderOnboard(); }, 500);
}

function confTag(c) {
  const label = { high: '높음', medium: '보통', low: '낮음', none: '미확인' }[c] || c;
  return `<span class="confTag conf-${c}">신뢰도 ${label}</span>`;
}

function renderObReview(body) {
  const a = OB.analysis;
  const p = a.project;
  const v = f => (p[f] && p[f].value !== undefined ? p[f].value : '');
  const c = f => (p[f] ? p[f].confidence : 'none');
  const period = v('period') || {};

  const wpRows = (p.workPackages || []).map(w =>
    `<tr><td class="mono">${esc(w.id)}</td><td>${esc(w.name)}</td><td>${confTag(w.confidence)}</td></tr>`).join('');
  const kpiRows = (p.kpis || []).map(k =>
    `<tr><td>${esc(k.name)}</td><td>${esc(k.unit || '-')}</td><td class="mono">${k.target ?? '-'}</td><td>${k.direction === 'lower' ? '낮을수록 좋음' : '높을수록 좋음'}</td></tr>`).join('');
  const flagRows = (a.flags || []).map(f =>
    `<div class="warnBox"><b>${esc(f.field)}</b> — ${esc(f.issue)}<br><span class="mut xs">${esc(f.suggestion)}</span></div>`).join('');

  body.innerHTML = `
    <div class="card">
      <div class="cardH"><div class="cardT">추출된 과제 정보</div>
        <div class="cardSub">시스템은 임의로 결정하지 않습니다 — 각 항목을 확인·수정한 뒤 진행하십시오.</div></div>
      <div class="row2">
        <div class="fld"><label>과제명 ${confTag(c('title'))}</label><input id="obTitle" value="${esc(v('title'))}"></div>
        <div class="fld"><label>과제번호 ${confTag(c('projectCode'))}</label><input id="obCode" value="${esc(v('projectCode'))}" placeholder="비우면 자동 부여"></div>
      </div>
      <div class="row2">
        <div class="fld"><label>수행 기관(회사명) ${confTag(c('orgName'))}</label><input id="obOrg" value="${esc(v('orgName'))}"></div>
        <div class="fld"><label>전문기관/부처 ${confTag(c('agency'))}</label><input id="obAgency" value="${esc(v('agency'))}" placeholder="해당 없으면 비움"></div>
      </div>
      <div class="row3">
        <div class="fld"><label>시작일 ${confTag(c('period'))}</label><input id="obStart" value="${esc(period.start || '')}" placeholder="YYYY-MM-DD"></div>
        <div class="fld"><label>종료일</label><input id="obEnd" value="${esc(period.end || '')}" placeholder="YYYY-MM-DD"></div>
        <div class="fld"><label>연구노트 주기</label>
          <select id="obCadence"><option value="biweekly">격주 (권장)</option><option value="weekly">주간</option></select></div>
      </div>
    </div>

    <div class="card">
      <div class="cardH"><div class="cardT">워크패키지 (WP) · ${(p.workPackages || []).length}건</div></div>
      <div class="tblW"><table class="tbl"><thead><tr><th>ID</th><th>명칭</th><th>추출 신뢰도</th></tr></thead>
        <tbody>${wpRows || '<tr><td colspan="3" class="mut">추출 실패 — 기본 WP 3종으로 시작합니다</td></tr>'}</tbody></table></div>
    </div>

    <div class="card">
      <div class="cardH"><div class="cardT">성능지표 (KPI) · ${(p.kpis || []).length}건</div></div>
      <div class="tblW"><table class="tbl"><thead><tr><th>지표</th><th>단위</th><th>목표</th><th>방향</th></tr></thead>
        <tbody>${kpiRows || '<tr><td colspan="4" class="mut">추출된 지표 없음 — 이후 설정에서 추가 가능</td></tr>'}</tbody></table></div>
    </div>

    ${flagRows ? `<div class="card"><div class="cardH"><div class="cardT">확인 필요 항목</div></div>${flagRows}</div>` : ''}

    <div class="mt16 spread">
      <button class="btn" id="obBack">← 문서 다시 선택</button>
      <button class="btn p" id="obNext">이 내용으로 시스템 생성 →</button>
    </div>`;

  qs('#obBack').onclick = () => { OB.step = 1; renderOnboard(); };
  qs('#obNext').onclick = () => {
    const start = qs('#obStart').value.trim(), end = qs('#obEnd').value.trim();
    if (start && !parseLooseDate(start)) { toast('시작일 형식이 올바르지 않습니다 (YYYY-MM-DD)', 'err'); return; }
    if (end && !parseLooseDate(end)) { toast('종료일 형식이 올바르지 않습니다 (YYYY-MM-DD)', 'err'); return; }
    OB.form = {
      title: qs('#obTitle').value.trim(),
      projectCode: qs('#obCode').value.trim(),
      orgName: qs('#obOrg').value.trim(),
      agency: qs('#obAgency').value.trim(),
      start: start ? parseLooseDate(start) : '',
      end: end ? parseLooseDate(end) : '',
      cadence: qs('#obCadence').value,
    };
    OB.step = 4; renderOnboard(); runObGenerate();
  };
}

function renderObGenerate(body) {
  body.innerHTML = `<div class="card">
    <div class="cardH"><div class="cardT">시스템 생성 중</div></div>
    <div id="obLog" class="mono xs" style="line-height:2"></div>
  </div>`;
}

async function runObGenerate() {
  const log = m => { const h = qs('#obLog'); if (h) h.innerHTML += esc(m) + '<br>'; };
  const f = OB.form;
  // 사용자 수정값을 분석 결과에 반영
  const a = OB.analysis;
  if (f.start && f.end && f.end > f.start) {
    a.project.period = { value: { start: f.start, end: f.end }, confidence: 'high', ev: a.project.period ? a.project.period.ev : [] };
  }
  log('[A2 일정설계관] 스프린트 격자 생성…');
  const sys = generateSystem(a, {
    today: today(), cadence: f.cadence,
    title: f.title || undefined, projectCode: f.projectCode || undefined, orgName: f.orgName || undefined,
  });
  if (f.agency) sys.project.agency = f.agency;
  const errs = validateSystem(sys);
  if (errs.length) {
    log('⚠ 생성 검증 실패: ' + errs.join(' / '));
    toast('시스템 생성 검증에 실패했습니다: ' + errs[0], 'err');
    return;
  }
  log(`  → 스프린트 ${sys.planner.sprints.length}개 · 월 블록 ${sys.planner.months.length}개 · 자가검증 통과`);

  log('[A8 증거원장] 추출 근거 등재…');
  const ledger = new EvidenceLedger();
  for (const ev of a.evidence) {
    ledger.add({
      kind: 'reference', sourceType: 'upload', sourceFile: ev.docName,
      locator: ev.loc, content: ev.quote, sha256: ev.sha256, addedBy: 'onboarding',
    });
  }
  log(`  → ${ledger.size()}건 등재`);

  /* 라이선스-프로젝트 귀속 집행: 이 설치본은 1개 프로젝트 전용
     (커뮤니티 사용권은 해당 없음 — 프로젝트 수를 제한하지 않는다) */
  const bindPrev = bindsToOneProject(S.license)
    ? await S.store.getJSON('data/license_binding.json') : null;
  if (bindPrev && bindPrev.project_code !== sys.config.project_code) {
    log('⚠ 라이선스 귀속 위반: 이 설치본은 ' + bindPrev.project_code + ' 전용입니다.');
    toast('이 설치본의 라이선스는 프로젝트 ' + bindPrev.project_code + ' 에 귀속되어 있습니다. 새 프로젝트에는 새 라이선스 키가 필요합니다.', 'err');
    return;
  }
  if (!bindPrev && bindsToOneProject(S.license)) {
    await S.store.putJSON('data/license_binding.json', {
      license_id: S.license.license_id, licensee: S.license.payload.licensee,
      project_code: sys.config.project_code, project_title: sys.project.title,
      bound_at: new Date().toISOString(),
    });
    log('[라이선스] 프로젝트 귀속: ' + sys.config.project_code + ' (' + S.license.payload.licensee + ')');
  }

  log('[A24 MATM] 저장소 기록…');
  S.config = sys.config;
  S.project = sys.project;
  S.planner = sys.planner;
  S.metrics = sys.metrics;
  S.users = { users: (sys.project.people || []).map((p, i) => ({ name: p.name, role: p.role || '참여연구원', seq: i + 1 })) };
  S.notesIndex = { notes: [] };
  S.ledger = ledger;
  await persistAll();
  // 업로드 원본 보존
  for (const d of OB.parsed) {
    if (d._bytes) { try { await S.store.putBytes('docs/' + d.name, d._bytes); } catch { /* 용량 초과 허용 */ } }
  }
  await audit('system.generate', `${sys.project.title} · 스프린트 ${sys.planner.sprints.length}개`);
  log('완료 — 시스템을 시작합니다.');
  toast('연구노트 자동화 시스템이 생성되었습니다.', 'ok');
  setTimeout(() => {
    qs('#onboard').hidden = true; qs('#app').hidden = false;
    renderShell(); nav('dashboard');
    /* 신규 설치의 첫 사용자 등록 — 이 호출이 없으면 책임 데이터 관리자가
       지정되지 않아 데이터 관리·AI 엔진 설정이 영영 잠긴 채로 남는다. */
    ensureUserSession();
  }, 700);
}

/* ══════════════════════════════════════════════════════════
 * 셸 — 사이드바·헤더
 * ══════════════════════════════════════════════════════════ */
const VIEWS = [
  { id: 'dashboard', name: '대시보드', icon: 'dashboard' },
  { id: 'roadmap', name: '로드맵', icon: 'roadmap' },
  { id: 'planner', name: '플래너', icon: 'planner' },
  { id: 'notes', name: '연구노트', icon: 'note' },
  { id: 'ledger', name: '증거원장', icon: 'ledger' },
  { id: 'metrics', name: '성능지표', icon: 'metrics' },
  { id: 'agents', name: 'AI 에이전트', icon: 'agents' },
  { id: 'settings', name: '설정', icon: 'settings' },
];
const WORKSPACE_VIEWS = 6;   // 작업 공간 그룹 크기 (나머지는 시스템 그룹)

function renderShell() {
  qs('#brandName').textContent = S.config.system_name || 'AAA-RNS';
  qs('#brandCode').textContent = S.project.project_code || '';
  /* 연결된 저장소 표시 — 제목 바로 아래 (모든 사용자, 클릭 시 연결/변경) */
  const st = qs('#sideStore');
  if (st) {
    const isFs = S.storeKind === 'fs';
    st.hidden = false;
    st.innerHTML = icon('folder') +
      `<span>${isFs ? esc(S.storeName || '공유폴더') : '로컬 저장 (이 브라우저)'}</span>` +
      `<span class="dotState ${isFs ? 'on' : ''}"></span>`;
    st.title = isFs
      ? `공유폴더 연결됨: ${S.storeName || ''} — 클릭하여 변경`
      : '로컬 저장 중 — 클릭하여 팀 공유폴더 연결 (Chrome/Edge)';
    st.onclick = async () => {
      if (await confirmModal('공유폴더', isFs ? '다른 공유폴더로 변경할까요?' : '팀 공유폴더에 연결할까요? (PC마다 최초 1회)', '연결')) connectFolder();
    };
  }
  const navHost = qs('#nav');
  navHost.innerHTML = '<div class="navSec">작업 공간</div>';
  for (const v of VIEWS.slice(0, WORKSPACE_VIEWS)) navHost.appendChild(navBtn(v));
  navHost.appendChild(el('div', { class: 'navSec', html: '시스템' }));
  for (const v of VIEWS.slice(WORKSPACE_VIEWS)) navHost.appendChild(navBtn(v));
  const back = qs('#topBack');
  if (back) back.onclick = navBack;
}

function navBtn(v) {
  return el('button', {
    class: 'navItem' + (S.view === v.id ? ' on' : ''), 'data-view': v.id,
    html: icon(v.icon) + '<span>' + esc(v.name) + '</span>',
    onclick: () => nav(v.id),
  });
}

function nav(viewId, arg, opts = {}) {
  /* 화면 이력 — 상단 ← 버튼으로 언제든 이전 화면으로 돌아갈 수 있다 */
  if (!opts.back) {
    S.navHist = S.navHist || [];
    const top = S.navHist[S.navHist.length - 1];
    if (!top || top.viewId !== viewId || JSON.stringify(top.arg ?? null) !== JSON.stringify(arg ?? null)) {
      S.navHist.push({ viewId, arg });
      if (S.navHist.length > 50) S.navHist.shift();
    }
  }
  S.view = viewId;
  document.querySelectorAll('.navItem').forEach(b =>
    b.classList.toggle('on', b.getAttribute('data-view') === viewId));
  const title = (VIEWS.find(v => v.id === viewId) || {}).name || '';
  qs('#topTitle').textContent = title;
  const back = qs('#topBack');
  if (back) back.hidden = !(S.navHist && S.navHist.length > 1);
  renderTopMeta();
  const c = qs('#content');
  c.innerHTML = '';
  c.scrollTop = 0;
  const render = {
    dashboard: renderDashboard, roadmap: renderRoadmap, planner: renderPlanner, notes: renderNotes,
    noteDetail: renderNoteDetail, ledger: renderLedger, metrics: renderMetrics,
    agents: renderAgents, settings: renderSettings,
  }[viewId];
  if (render) render(c, arg);
  if (viewId === 'dashboard') maybeBackupBanner(c);
  translateDOM();
}

function navBack() {
  if (!S.navHist || S.navHist.length < 2) return;
  S.navHist.pop();
  const prev = S.navHist[S.navHist.length - 1];
  nav(prev.viewId, prev.arg, { back: true });
}

function renderTopMeta() {
  const m = qs('#topMeta');
  const p = S.project.period;
  const d = diffDays(p.start, today());
  const mNum = currentMonthNum();
  m.innerHTML = `
    <span class="chip mono">${esc(S.project.project_code)}</span>
    <span class="chip">${d >= 0 ? 'D+' + d : 'D' + d}</span>
    <span class="chip">M${mNum}/${p.months}</span>`;
  const r = qs('#topRight');
  r.innerHTML = '';
  const sel = el('select', { onchange: e => applyTheme(e.target.value) });
  for (const [v, n] of [['institutional', '테마: 인스티튜셔널'], ['paper', '테마: 페이퍼'], ['midnight', '테마: 미드나이트'], ['graphite', '테마: 그래파이트']]) {
    sel.appendChild(el('option', { value: v, html: n }));
  }
  sel.value = localStorage.getItem('aaarns_theme') || 'institutional';
  r.appendChild(sel);
  const langSel = el('select', {
    id: 'langSel', title: '언어 / Language / 言語', 'data-no-i18n': '1',
    onchange: e => setLang(e.target.value, { rerender: () => { renderShell(); nav(S.view, undefined, { back: true }); } }),
  });
  for (const l of LANGS) langSel.appendChild(el('option', { value: l.id, html: l.label }));
  langSel.value = getLang();
  const userInput = el('input', {
    value: currentUser() === '(미지정)' ? '' : currentUser(),
    placeholder: '내 이름', style: 'width:110px',
    onchange: e => { localStorage.setItem('aaarns_user', e.target.value.trim()); toast('사용자 이름이 설정되었습니다.', 'ok'); },
  });
  r.appendChild(userInput);
  r.appendChild(langSel);
}

function currentMonthNum() {
  const p = S.project.period;
  const t = today();
  if (t < p.start) return 0;
  const d0 = new Date(p.start + 'T00:00:00Z'), d1 = new Date((t > p.end ? p.end : t) + 'T00:00:00Z');
  return Math.min(p.months, (d1.getUTCFullYear() - d0.getUTCFullYear()) * 12 + (d1.getUTCMonth() - d0.getUTCMonth()) + 1);
}

function currentSprint() {
  const t = today();
  return S.planner.sprints.find(s => s.start <= t && t <= s.end) || null;
}

/* ══════════════════════════════════════════════════════════
 * 노트 인덱스 · 로드/저장
 * ══════════════════════════════════════════════════════════ */
async function loadNote(noteId) {
  if (S.noteCache.has(noteId)) return S.noteCache.get(noteId);
  const n = await S.store.getJSON('notes/' + noteId + '.json');
  if (n) S.noteCache.set(noteId, n);
  return n;
}

async function saveNote(note) {
  S.noteCache.set(note.note_id, note);
  await S.store.putJSON('notes/' + note.note_id + '.json', note);
  const idx = S.notesIndex.notes;
  const i = idx.findIndex(x => x.note_id === note.note_id);
  const entry = {
    note_id: note.note_id, state: note._state, period: note.period,
    revision: note.revision || 0, supersedes: note.supersedes || null,
    updated_at: new Date().toISOString(),
  };
  if (i >= 0) idx[i] = entry; else idx.push(entry);
  idx.sort((a, b) => a.note_id < b.note_id ? -1 : 1);
  await S.store.putJSON('data/notes_index.json', S.notesIndex);
}

async function sealedNotesList() {
  const out = [];
  for (const e of S.notesIndex.notes.filter(x => x.state === 'sealed')) {
    const n = await loadNote(e.note_id);
    if (n) out.push(n);
  }
  return out;
}

function stateBadge(state) {
  const map = {
    empty: 'b-mut', queued: 'b-warn', draft: 'b-warn', advisory: 'b-warn',
    rejected: 'b-bad', awaiting_sign: 'b-info', sealed: 'b-ok',
  };
  return `<span class="badge ${map[state] || 'b-mut'}">${esc(stateLabel(state))}</span>`;
}

/* ══════════════════════════════════════════════════════════
 * 뷰: 대시보드
 * ══════════════════════════════════════════════════════════ */
function renderDashboard(c) {
  const p = S.project.period;
  const total = diffDays(p.start, p.end) + 1;
  const done = Math.max(0, Math.min(total, diffDays(p.start, today()) + 1));
  const pct = Math.round(done / total * 100);
  const counts = {};
  for (const n of S.notesIndex.notes) counts[n.state] = (counts[n.state] || 0) + 1;
  const sealedCount = counts.sealed || 0;
  const sp = currentSprint();
  const kpiTotal = S.metrics.catalog.length;
  const kpiWith = new Set(S.metrics.actuals.map(a => a.key)).size;

  const wrap = el('div', { class: 'pageW' });
  wrap.innerHTML = `
    <div class="grid4">
      <div class="stat"><div class="v">${pct}%</div><div class="l">기간 경과</div>
        <div class="pbar mt8"><i style="width:${pct}%"></i></div>
        <div class="d mono xs">${esc(p.start)} ~ ${esc(p.end)}</div></div>
      <div class="stat"><div class="v">${sealedCount}<span class="mut" style="font-size:14px">/${S.planner.sprints.length}</span></div>
        <div class="l">확정된 연구노트</div>
        <div class="d">${(counts.awaiting_sign || 0) ? `서명 대기 ${counts.awaiting_sign}건` : '서명 대기 없음'}</div></div>
      <div class="stat"><div class="v">${S.ledger.size()}</div><div class="l">증거원장 등재 건수</div>
        <div class="d">무증거 무기재 원칙 적용 중</div></div>
      <div class="stat"><div class="v">${kpiWith}<span class="mut" style="font-size:14px">/${kpiTotal}</span></div>
        <div class="l">실측 보유 지표</div><div class="d">목표 대비 추적</div></div>
    </div>

    <div class="card mt16">
      <div class="cardH"><div class="cardT">현재 스프린트</div></div>
      <div id="dashSprint"></div>
    </div>

    <div class="grid2 mt12">
      <div class="card" style="margin:0">
        <div class="cardH"><div class="cardT">다가오는 마일스톤</div></div>
        <div id="dashMile"></div>
      </div>
      <div class="card" style="margin:0">
        <div class="cardH"><div class="cardT">확인 필요 항목 (source flags)</div></div>
        <div id="dashFlags"></div>
      </div>
    </div>`;
  c.appendChild(wrap);

  const ds = qs('#dashSprint');
  if (sp) {
    ds.appendChild(sprintCard(sp, true));
  } else {
    ds.innerHTML = `<div class="empty">현재 날짜(${today()})가 연구 기간 밖입니다.</div>`;
  }

  const dm = qs('#dashMile');
  const upcoming = (S.project.milestones || []).filter(m => m.date && m.date >= today()).slice(0, 4);
  dm.innerHTML = upcoming.length
    ? upcoming.map(m => `<div class="kv"><div class="k mono">${esc(m.date)}</div><div class="v"><b>${esc(m.id)}</b> ${esc(m.name)}</div></div>`).join('')
    : '<div class="mut sm">예정된 마일스톤이 없습니다.</div>';

  const df = qs('#dashFlags');
  const flags = S.project.source_flags || [];
  df.innerHTML = flags.length
    ? flags.slice(0, 6).map(f => `<div class="warnBox" style="margin:0 0 8px"><b>${esc(f.field)}</b> — ${esc(f.issue)}</div>`).join('')
    : '<div class="okBox" style="margin:0">원문 이상 없음 — 추출 과정에서 확인이 필요한 항목이 없습니다.</div>';
}

/* ══════════════════════════════════════════════════════════
 * 뷰: 플래너
 * ══════════════════════════════════════════════════════════ */
/**
 * 보기 기간 컨트롤 — 로드맵과 플래너 간트가 함께 쓴다.
 * 같은 조작을 두 화면에서 따로 구현하면 동작이 갈라지므로 하나로 묶었다.
 * @param {object} period 연구 전체 기간 {start,end}
 * @param {object} range  현재 보기 범위 {start,end}
 * @param {boolean} narrowed 전체 기간이 아닌 상태인가 (→ [전체 보기] 노출)
 * @param {(a:string,b:string)=>void} onApply
 */
function periodRangeControl(period, range, narrowed, onApply) {
  const ctrl = el('div', { class: 'rmCtrl' });
  const clamp = d => (d < period.start ? period.start : (d > period.end ? period.end : d));
  const preset = el('select');
  for (const [v, n] of [['all', '전체 기간'], ['year', '올해'], ['past12', '최근 12개월'],
    ['next6', '향후 6개월'], ['custom', '사용자 지정']])
    preset.appendChild(el('option', { value: v, html: n }));
  preset.value = narrowed ? 'custom' : 'all';
  const vsIn = el('input', { type: 'date', value: range.start, min: period.start, max: period.end });
  const veIn = el('input', { type: 'date', value: range.end, min: period.start, max: period.end });
  preset.onchange = () => {
    const v = preset.value;
    if (v === 'all') onApply(period.start, period.end);
    else if (v === 'year') onApply(clamp(today().slice(0, 4) + '-01-01'), clamp(today().slice(0, 4) + '-12-31'));
    else if (v === 'past12') onApply(clamp(addDays(today(), -365)), clamp(today()));
    else if (v === 'next6') onApply(clamp(today()), clamp(addDays(today(), 183)));
  };
  ctrl.append(el('span', { class: 'sm mut', html: '보기 기간:' }), preset, vsIn,
    el('span', { class: 'mut', html: '~' }), veIn,
    el('button', { class: 'btn sm', html: '적용', onclick: () => {
      if (!isValidDate(vsIn.value) || !isValidDate(veIn.value) || vsIn.value >= veIn.value) {
        toast('기간이 올바르지 않습니다 (시작 < 끝).', 'warn'); return;
      }
      onApply(clamp(vsIn.value), clamp(veIn.value));
    } }));
  if (narrowed) ctrl.appendChild(el('button', { class: 'btn sm', html: '전체 보기', onclick: () => onApply(period.start, period.end) }));
  return ctrl;
}

/** 오늘이 보기 범위 밖일 때 그 사실을 알려 준다 (표시선이 없는 이유를 설명) */
function todayNote(range) {
  const t = today();
  if (t >= range.start && t <= range.end) return null;
  /* 한 문장을 한 텍스트 노드로 유지한다 — <b> 로 쪼개면 번역 단위가 깨진다 */
  return el('div', { class: 'sm mut', style: 'margin:6px 0 0 232px',
    html: esc(`오늘(${t})은 이 보기 기간 밖이라 오늘 표시선이 보이지 않습니다.`) });
}

function renderPlanner(c, arg) {
  /* 월간 상세로 진입한 경우 */
  if (arg && arg.month) { renderPlannerMonth(c, arg.month); return; }

  const wrap = el('div', { class: 'pageW' });
  const seg = el('div', { class: 'seg mb12' });
  const views = [['sprint', '스프린트'], ['gantt', 'WP 간트'], ['month', '월간']];
  const cur = localStorage.getItem('aaarns_planview') || 'sprint';
  for (const [v, n] of views) {
    seg.appendChild(el('button', {
      class: cur === v ? 'on' : '', html: n,
      onclick: () => { localStorage.setItem('aaarns_planview', v); nav('planner', undefined, { back: true }); },
    }));
  }
  wrap.appendChild(seg);
  const body = el('div');
  wrap.appendChild(body);
  c.appendChild(wrap);

  if (cur === 'gantt') body.appendChild(plannerGantt());
  else if (cur === 'month') body.appendChild(plannerMonths());
  else {
    const now = currentSprint();
    for (const sp of S.planner.sprints) body.appendChild(sprintCard(sp, now && sp.id === now.id));
    setTimeout(() => { const n = qs('.sprintCard.now'); if (n) n.scrollIntoView({ block: 'center' }); }, 30);
  }
}

/**
 * WP 간트 — 로드맵과 같은 DOM 행 구조로 그린다.
 * SVG 한 덩어리로 그리던 것을 행 단위 DOM 으로 바꾼 이유:
 * 행을 클릭해 해당 WP 의 연구노트로 들어갈 수 있어야 하고,
 * 보기 기간 조정·오늘 표시선을 로드맵과 동일하게 동작시키기 위해서다.
 */
function plannerGantt() {
  const card = el('div', { class: 'card' });
  const p = S.project.period;
  const vr = (S.plRange && isValidDate(S.plRange.start) && isValidDate(S.plRange.end)
    && S.plRange.start < S.plRange.end) ? S.plRange : { start: p.start, end: p.end };
  const total = Math.max(1, diffDays(vr.start, vr.end));
  const x = d => Math.min(100, Math.max(0, diffDays(vr.start, d) / total * 100));
  const inView = d => d >= vr.start && d <= vr.end;

  card.innerHTML = `<div class="cardH"><div class="cardT">WP 간트</div>
    <div class="cardSub">WP 행을 클릭하면 해당 작업의 연구노트 목록으로 이동합니다 · 붉은 세로선 = 오늘</div></div>`;
  card.appendChild(periodRangeControl(p, vr, !!S.plRange, (a, b) => {
    S.plRange = (a === p.start && b === p.end) ? null : { start: a, end: b };
    nav('planner', undefined, { back: true });
  }));

  /* 월/연 눈금 */
  const axis = el('div', { class: 'rmAxis' });
  if (total <= 430) {
    let d = vr.start.slice(0, 7) + '-01';
    if (d < vr.start) d = addMonths(d, 1);
    for (; d && d <= vr.end; d = addMonths(d, 1)) {
      if (d <= vr.start) continue;
      const mm = +d.slice(5, 7);
      axis.appendChild(el('div', { class: 'rmTick', style: `left:${x(d)}%`,
        html: `<span>${mm === 1 ? d.slice(0, 4) : mm + '월'}</span>` }));
    }
  } else {
    for (let y = +vr.start.slice(0, 4) + 1; y <= +vr.end.slice(0, 4); y++) {
      const d = `${y}-01-01`;
      if (d > vr.start && d < vr.end)
        axis.appendChild(el('div', { class: 'rmTick', style: `left:${x(d)}%`, html: `<span>${y}</span>` }));
    }
  }
  for (const m of (S.project.milestones || [])) {
    if (m && m.date && inView(m.date))
      axis.appendChild(el('div', { class: 'rmMile', style: `left:${x(m.date)}%`, title: `◆ ${m.name} · ${m.date}` }));
  }
  if (inView(today()))
    axis.appendChild(el('div', { class: 'rmToday', style: `left:${x(today())}%`, title: '오늘 ' + today() }));
  card.appendChild(axis);

  S.project.work_packages.forEach((wp, i) => {
    const sprints = S.planner.sprints.filter(sp => sp.activeWPs.includes(wp.id));
    const notes = S.notesIndex.notes.filter(n => sprints.some(sp => n.note_id.startsWith(sp.noteSlot)));
    const row = el('div', { class: 'rmRow', onclick: () => nav('roadmap', { wp: wp.id }) });
    row.appendChild(el('div', { class: 'rmLabel', html:
      `<b>${esc(wp.id)}</b><span title="${esc(wp.name)}">${esc(wp.name)}</span>` +
      `<span class="xs mut">${esc(wp.start)} ~ ${esc(wp.end)} · 노트 ${notes.length}건</span>` }));
    const track = el('div', { class: 'rmTrack' });
    if (!(wp.end < vr.start || wp.start > vr.end)) {
      const bs = wp.start < vr.start ? vr.start : wp.start;
      const be = wp.end > vr.end ? vr.end : wp.end;
      track.appendChild(el('div', { class: 'rmBar gt' + (i % 3),
        style: `left:${x(bs)}%; width:${Math.max(2, x(be) - x(bs))}%` }));
    }
    if (inView(today()))
      track.appendChild(el('div', { class: 'rmToday soft', style: `left:${x(today())}%` }));
    row.appendChild(track);
    card.appendChild(row);
  });
  const tn = todayNote(vr);
  if (tn) card.appendChild(tn);
  return card;
}

/** 월간 목록 — 각 줄을 클릭하면 그 달의 상세(스프린트·노트·마일스톤)로 */
function plannerMonths() {
  const box = el('div');
  const curM = S.planner.months.find(m => today() >= m.start && today() <= m.end);
  for (const m of S.planner.months) {
    const notes = S.notesIndex.notes.filter(n => n.period.start >= m.start && n.period.start <= m.end);
    const sealed = notes.filter(n => n.state === 'sealed').length;
    const isNow = curM && m.id === curM.id;
    box.appendChild(el('div', {
      class: 'card monthRow' + (isNow ? ' now' : ''), style: 'padding:12px 16px',
      onclick: () => nav('planner', { month: m.id }),
    }, [
      el('div', { class: 'spread' }, [
        el('div', { html: `<b class="mono">${esc(m.id)}</b> <span class="mut sm mono">${esc(m.start)} ~ ${esc(m.end)}</span>` +
          (isNow ? ' <span class="chip">이번 달</span>' : '') }),
        el('div', { html: (m.milestones || []).map(x => `<span class="chip">${esc(x)} 마일스톤</span>`).join(' ') +
          ` <span class="mut xs">노트 ${notes.length}건 · 확정 ${sealed}건</span>` }),
      ]),
    ]));
  }
  return box;
}

/** 월간 상세 — 그 달의 스프린트·연구노트·마일스톤을 모아 보여주고 노트로 연결한다 */
function renderPlannerMonth(c, monthId) {
  const m = S.planner.months.find(x => x.id === monthId);
  if (!m) { nav('planner', undefined, { back: true }); return; }
  qs('#topTitle').textContent = '플래너 · ' + monthId;
  const wrap = el('div', { class: 'pageW' });
  wrap.appendChild(el('button', { class: 'btn sm', html: '← 월간으로', onclick: () => navBack() }));

  const sprints = S.planner.sprints.filter(sp => !(sp.end < m.start || sp.start > m.end));
  const notes = S.notesIndex.notes.filter(n => n.period.start >= m.start && n.period.start <= m.end);
  const info = el('div', { class: 'card', style: 'margin-top:12px' });
  info.innerHTML = `<div class="cardH"><div class="cardT">${esc(m.id)}</div>
    <div class="cardSub">${esc(m.start)} ~ ${esc(m.end)} · 스프린트 ${sprints.length}개 · 노트 ${notes.length}건</div></div>` +
    ((m.milestones || []).length ? `<div>${(m.milestones || []).map(x => `<span class="chip">${esc(x)} 마일스톤</span>`).join(' ')}</div>` : '');
  wrap.appendChild(info);

  const list = el('div', { class: 'card' });
  list.innerHTML = `<div class="cardH"><div class="cardT">이 달의 스프린트와 연구노트</div>
    <div class="cardSub">행을 클릭하면 해당 노트로 이동합니다 (빈 슬롯은 새로 생성)</div></div>`;
  for (const sp of sprints) {
    const fam = S.notesIndex.notes.filter(n => n.note_id.startsWith(sp.noteSlot)).sort((a, b) => b.revision - a.revision);
    const st = fam.length ? fam[0].state : 'empty';
    list.appendChild(el('div', {
      class: 'fileRow', style: 'cursor:pointer',
      onclick: () => (fam.length ? nav('noteDetail', fam[0].note_id) : openSlot(sp)),
    }, [
      el('span', { class: 'chip mono', html: esc(sp.id) }),
      el('span', { class: 'sm', html: `${esc(sp.start)} ~ ${esc(sp.end)}` }),
      el('span', { class: 'sm mono mut', html: fam.length ? esc(fam[0].note_id) : '(빈 슬롯 — 클릭하여 작성)' }),
      el('span', { style: 'margin-left:auto', html: st === 'empty' ? '<span class="badge b-mut">빈 슬롯</span>' : stateBadge(st) }),
    ]));
  }
  if (!sprints.length) list.appendChild(el('div', { class: 'mut sm', html: '이 달에 걸친 스프린트가 없습니다.' }));
  wrap.appendChild(list);
  c.appendChild(wrap);
}

/* ══════════════════════════════════════════════════════════
 * 뷰: 로드맵 — 연구 전체를 한눈에, 클릭하면 관련 노트로
 * ══════════════════════════════════════════════════════════ */
function noteStateOf(sp) {
  const fam = S.notesIndex.notes.filter(n => n.note_id.startsWith(sp.noteSlot)).sort((a, b) => b.revision - a.revision);
  return fam.length ? fam[0].state : 'empty';
}

function renderRoadmap(c, arg) {
  if (arg && arg.wp) { renderRoadmapWp(c, arg.wp); return; }
  const wrap = el('div', { class: 'pageW' });
  const p = S.project.period;
  /* 보기 범위 — 사용자가 원하는 기간으로 조정 가능 (기본: 전체 기간) */
  const vr = (S.rmRange && isValidDate(S.rmRange.start) && isValidDate(S.rmRange.end)
    && S.rmRange.start < S.rmRange.end) ? S.rmRange : { start: p.start, end: p.end };
  const total = Math.max(1, diffDays(vr.start, vr.end));
  const x = d => Math.min(100, Math.max(0, diffDays(vr.start, d) / total * 100));
  const inView = d => d >= vr.start && d <= vr.end;
  const pctTotal = Math.max(1, diffDays(p.start, p.end));
  const pct = Math.round(Math.min(100, Math.max(0, diffDays(p.start, today()) / pctTotal * 100)));

  const head = el('div', { class: 'card' });
  head.innerHTML = `<div class="cardH"><div class="cardT">${esc(S.project.title)}</div>
    <div class="cardSub">${esc(p.start)} ~ ${esc(p.end)} · ${p.months}개월 · 기간 경과 ${pct}%</div></div>
    <div class="rmProg"><div class="rmProgFill" style="width:${pct}%"></div></div>`;
  wrap.appendChild(head);

  const tl = el('div', { class: 'card' });
  tl.innerHTML = `<div class="cardH"><div class="cardT">연구 로드맵</div>
    <div class="cardSub">작업(WP) 행을 클릭하면 관련 연구노트 목록으로 이동합니다 · ◆ 마일스톤 · 점 = 노트 슬롯 상태</div></div>`;

  /* 보기 기간 조정 (로드맵·플래너 간트 공용) */
  const ctrl = periodRangeControl(p, vr, !!S.rmRange, (a, b) => {
    S.rmRange = (a === p.start && b === p.end) ? null : { start: a, end: b };
    nav('roadmap', undefined, { back: true });
  });
  tl.appendChild(ctrl);

  /* 상단 축 — 연 눈금 · 마일스톤 · 오늘 */
  const axis = el('div', { class: 'rmAxis' });
  if (total <= 430) {
    /* 짧은 범위 → 월 눈금 */
    let d = vr.start.slice(0, 7) + '-01';
    if (d < vr.start) d = addMonths(d, 1);
    for (; d && d <= vr.end; d = addMonths(d, 1)) {
      if (d <= vr.start) continue;
      const mm = +d.slice(5, 7);
      axis.appendChild(el('div', { class: 'rmTick', style: `left:${x(d)}%`,
        html: `<span>${mm === 1 ? d.slice(0, 4) : mm + '월'}</span>` }));
    }
  } else {
    for (let y = +vr.start.slice(0, 4) + 1; y <= +vr.end.slice(0, 4); y++) {
      const d = `${y}-01-01`;
      if (d > vr.start && d < vr.end)
        axis.appendChild(el('div', { class: 'rmTick', style: `left:${x(d)}%`, html: `<span>${y}</span>` }));
    }
  }
  for (const m of (S.project.milestones || [])) {
    if (m && m.date && inView(m.date))
      axis.appendChild(el('div', { class: 'rmMile', style: `left:${x(m.date)}%`, title: `◆ ${m.name} · ${m.date}` }));
  }
  if (inView(today()))
    axis.appendChild(el('div', { class: 'rmToday', style: `left:${x(today())}%`, title: '오늘 ' + today() }));
  tl.appendChild(axis);

  /* WP 행 — 막대 + 노트 점 */
  for (const wp of S.project.work_packages) {
    const sprints = S.planner.sprints.filter(sp => sp.activeWPs.includes(wp.id));
    const done = sprints.filter(sp => noteStateOf(sp) === 'sealed').length;
    const row = el('div', { class: 'rmRow', onclick: () => nav('roadmap', { wp: wp.id }) });
    row.appendChild(el('div', { class: 'rmLabel', html:
      `<b>${esc(wp.id)}</b><span title="${esc(wp.name)}">${esc(wp.name)}</span><span class="xs mut">확정 ${done}/${sprints.length}</span>` }));
    const track = el('div', { class: 'rmTrack' });
    if (!(wp.end < vr.start || wp.start > vr.end)) {
      const bs = wp.start < vr.start ? vr.start : wp.start;
      const be = wp.end > vr.end ? vr.end : wp.end;
      track.appendChild(el('div', { class: 'rmBar',
        style: `left:${x(bs)}%; width:${Math.max(2, x(be) - x(bs))}%` }));
    }
    /* 장기 과제(슬롯 50개 초과)는 빈 슬롯 점을 생략해 과밀을 막는다 —
       작성된 노트만 점으로 보이고, 빈 슬롯은 행 클릭(목록)에서 접근 */
    const dense = sprints.length > 50;
    for (const sp of sprints) {
      const st = noteStateOf(sp);
      if (dense && st === 'empty') continue;
      const mid = addDays(sp.start, Math.floor(diffDays(sp.start, sp.end) / 2));
      if (!inView(mid)) continue;
      track.appendChild(el('span', {
        class: 'rmDot st-' + st, style: `left:${x(mid)}%`,
        title: `${sp.id} · ${sp.start} ~ ${sp.end} · ${st === 'empty' ? '빈 슬롯 (클릭하여 작성)' : stateLabel(st)}`,
        onclick: e => { e.stopPropagation(); openSlot(sp); },
      }));
    }
    if (inView(today()))
      track.appendChild(el('div', { class: 'rmToday soft', style: `left:${x(today())}%` }));
    row.appendChild(track);
    tl.appendChild(row);
  }

  const tnR = todayNote(vr);
  if (tnR) tl.appendChild(tnR);
  tl.appendChild(el('div', { class: 'rmLegend', html:
    `<span><i class="rmDot st-sealed"></i>확정</span><span><i class="rmDot st-awaiting_sign"></i>서명 대기</span>` +
    `<span><i class="rmDot st-advisory"></i>권고 지적</span><span><i class="rmDot st-draft"></i>초안</span>` +
    `<span><i class="rmDot st-empty"></i>빈 슬롯</span><span class="mut xs">점 클릭 = 해당 노트 열기</span>` }));
  wrap.appendChild(tl);
  c.appendChild(wrap);
}

function renderRoadmapWp(c, wpId) {
  const wp = S.project.work_packages.find(w => w.id === wpId);
  if (!wp) { nav('roadmap', undefined, { back: true }); return; }
  qs('#topTitle').textContent = '로드맵 · ' + wpId;
  const wrap = el('div', { class: 'pageW' });
  wrap.appendChild(el('button', { class: 'btn sm', html: '← 로드맵으로', onclick: () => navBack() }));

  const sprints = S.planner.sprints.filter(sp => sp.activeWPs.includes(wp.id));
  const done = sprints.filter(sp => noteStateOf(sp) === 'sealed').length;
  const info = el('div', { class: 'card', style: 'margin-top:12px' });
  info.innerHTML = `<div class="cardH"><div class="cardT">${esc(wp.id)} — ${esc(wp.name)}</div>
    <div class="cardSub">${esc(wp.start)} ~ ${esc(wp.end)}${wp.owner ? ' · 담당 ' + esc(wp.owner) : ''} · 스프린트 ${sprints.length}개 · 확정 ${done}건</div></div>`;
  wrap.appendChild(info);

  const list = el('div', { class: 'card' });
  list.innerHTML = `<div class="cardH"><div class="cardT">관련 연구노트</div>
    <div class="cardSub">행을 클릭하면 해당 노트로 이동합니다 (빈 슬롯은 새로 생성). 상단 ← 로 언제든 돌아올 수 있습니다.</div></div>`;
  for (const sp of sprints) {
    const fam = S.notesIndex.notes.filter(n => n.note_id.startsWith(sp.noteSlot)).sort((a, b) => b.revision - a.revision);
    const st = fam.length ? fam[0].state : 'empty';
    list.appendChild(el('div', {
      class: 'fileRow', style: 'cursor:pointer',
      onclick: () => fam.length ? nav('noteDetail', fam[0].note_id) : openSlot(sp),
    }, [
      el('span', { class: 'chip mono', html: esc(sp.id) }),
      el('span', { class: 'sm', html: `${esc(sp.start)} ~ ${esc(sp.end)}` }),
      el('span', { class: 'sm mono mut', html: fam.length ? esc(fam[0].note_id) : '(빈 슬롯 — 클릭하여 작성)' }),
      el('span', { style: 'margin-left:auto', html: st === 'empty' ? '<span class="badge b-mut">빈 슬롯</span>' : stateBadge(st) }),
    ]));
  }
  wrap.appendChild(list);
  c.appendChild(wrap);
}

/* ══════════════════════════════════════════════════════════
 * 백업 — 언제든 가능 + 월 1회 알림
 * ══════════════════════════════════════════════════════════ */
async function doZipBackup() {
  const { bytes, manifest } = await buildBackupZip(S.store);
  downloadBytes(`AAA-RNS_백업_${today()}.zip`, bytes, 'application/zip');
  await S.store.putJSON('data/backup_meta.json', { last_backup_at: new Date().toISOString() });
  await audit('data.backup', `zip · ${manifest.files.length}개 파일 · ${bytes.length.toLocaleString()}B`);
  toast(`백업 완료 — ${manifest.files.length}개 파일 (무결성 매니페스트 포함)`, 'ok');
}

/** 마지막 백업 후 30일 경과 시 대시보드 상단에 안내 (월 1회 · 끌 수 있음) */
async function maybeBackupBanner(c) {
  if ((S.config.backup_remind || 'monthly') === 'off') return;
  if (!S.notesIndex.notes.length) return;
  const meta = await S.store.getJSON('data/backup_meta.json');
  const last = meta && meta.last_backup_at ? String(meta.last_backup_at).slice(0, 10) : null;
  const days = last ? diffDays(last, today()) : null;
  if (last && days < 30) return;
  const banner = el('div', { class: 'pageW', style: 'padding-bottom:0' });
  banner.appendChild(el('div', { class: 'warnBox', style: 'display:flex;align-items:center;gap:12px;margin-top:0' }, [
    el('span', { class: 'sm', style: 'flex:1', html:
      (last ? esc(`마지막 전체 백업 후 ${days}일이 지났습니다.`) : '아직 전체 백업을 받은 적이 없습니다.') + ' ' +
      ' 월 1회 백업을 권장합니다. (설정에서 알림을 끌 수 있습니다)' }),
    el('button', { class: 'btn sm p', html: icon('download') + '지금 백업', onclick: async () => {
      try { await doZipBackup(); banner.remove(); } catch (e) { toast('백업 실패: ' + e.message, 'err'); }
    } }),
    el('button', { class: 'btn sm', html: '나중에', onclick: () => banner.remove() }),
  ]));
  c.prepend(banner);
}

function sprintCard(sp, isNow) {
  const idxEntry = S.notesIndex.notes.filter(n => !n.supersedes && n.note_id.startsWith(sp.noteSlot)).sort((a, b) => b.revision - a.revision)[0]
    || S.notesIndex.notes.filter(n => n.note_id.startsWith(sp.noteSlot)).sort((a, b) => b.revision - a.revision)[0];
  const state = idxEntry ? idxEntry.state : 'empty';
  return el('div', {
    class: 'sprintCard' + (isNow ? ' now' : ''),
    onclick: () => openSlot(sp),
  }, [
    el('span', { class: 'sid', html: esc(sp.id) }),
    el('span', { class: 'rng', html: `${esc(sp.start)} ~ ${esc(sp.end)}` }),
    el('span', { class: 'wps', html: sp.activeWPs.slice(0, 6).map(w => `<span class="chip">${esc(w)}</span>`).join('') }),
    el('span', { html: stateBadge(state) }),
  ]);
}

async function openSlot(sp) {
  // 슬롯의 최신 노트(개정 포함)를 찾거나 새로 생성
  const family = S.notesIndex.notes.filter(n => n.note_id.startsWith(sp.noteSlot)).sort((a, b) => b.revision - a.revision);
  if (family.length) { nav('noteDetail', family[0].note_id); return; }
  const note = createNote({
    project: S.project, period: { start: sp.start, end: sp.end },
    wpRefs: sp.activeWPs, author: currentUser() === '(미지정)' ? '' : currentUser(),
    reviewer: '', cadence: S.planner.cadence, today: today(),
  });
  await commitNote(note, currentUser(), '노트 슬롯 생성');
  await saveNote(note);
  await audit('note.create', note.note_id);
  nav('noteDetail', note.note_id);
}

/* ══════════════════════════════════════════════════════════
 * 뷰: 연구노트 목록
 * ══════════════════════════════════════════════════════════ */
function renderNotes(c) {
  const wrap = el('div', { class: 'pageW' });
  const notes = [...S.notesIndex.notes].sort((a, b) => b.note_id < a.note_id ? -1 : 1);
  if (!notes.length) {
    wrap.appendChild(el('div', { class: 'empty', html: '아직 작성된 연구노트가 없습니다.<br><span class="xs mut">플래너에서 스프린트를 선택해 첫 노트를 작성하십시오.</span>' }));
  }
  const legend = el('div', { class: 'flex mb12', style: 'flex-wrap:wrap' });
  legend.innerHTML = ['sealed', 'awaiting_sign', 'advisory', 'draft', 'rejected']
    .map(s => stateBadge(s)).join(' ');
  wrap.appendChild(legend);
  for (const n of notes) {
    wrap.appendChild(el('div', { class: 'noteItem', onclick: () => nav('noteDetail', n.note_id) }, [
      el('span', { class: 'nid', html: esc(n.note_id) }),
      el('span', { class: 'rng', html: `${esc(n.period.start)} ~ ${esc(n.period.end)}` }),
      el('span', { style: 'flex:1' }),
      n.supersedes ? el('span', { class: 'chip', html: '개정판 R' + n.revision }) : null,
      el('span', { html: stateBadge(n.state) }),
    ]));
  }
  c.appendChild(wrap);
}

/* ══════════════════════════════════════════════════════════
 * 뷰: 노트 상세 — 작성·검증·서명·출력
 * ══════════════════════════════════════════════════════════ */
const SECTION_DEFS = [
  ['goal', '1. 기간 목표', '이 기간에 달성하려던 목표'],
  ['work', '2. 수행 내용', '실제 수행한 활동 — 모든 문장에 [E#] 인용 필수'],
  ['results', '3. 결과 데이터 (서술)', '관찰·산출 결과 서술 — [E#] 인용 필수'],
  ['interpretation', '5. 해석', '결과의 의미 — [E#] 인용 필수'],
  ['next_plan', '6. 차기 계획', '다음 기간 계획 — [E#] 인용 필수'],
];

async function renderNoteDetail(c, noteId) {
  S.currentNoteId = noteId || S.currentNoteId;
  const note = await loadNote(S.currentNoteId);
  if (!note) { c.innerHTML = '<div class="empty">노트를 찾을 수 없습니다.</div>'; return; }
  qs('#topTitle').textContent = '연구노트 · ' + note.note_id;
  const sealed = note._state === 'sealed';
  const wrap = el('div', { class: 'pageW' });
  c.appendChild(wrap);

  /* ── 헤더 카드 ── */
  const head = el('div', { class: 'card' });
  head.innerHTML = `
    <div class="spread">
      <div class="flex">
        <span class="nid mono" style="font-weight:700">${esc(note.note_id)}</span>
        ${stateBadge(note._state)}
        ${note.supersedes ? `<span class="chip">← ${esc(note.supersedes)} 개정</span>` : ''}
      </div>
      <div class="flex" id="noteActions"></div>
    </div>
    <div class="row3 mt12">
      <div class="fld" style="margin:0"><label>작성기간</label>
        <input value="${esc(note.period.start)} ~ ${esc(note.period.end)}" disabled></div>
      <div class="fld" style="margin:0"><label>작성자</label>
        <input id="ndAuthor" value="${esc(note.header.작성자 || '')}" ${sealed ? 'disabled' : ''}></div>
      <div class="fld" style="margin:0"><label>점검자 (작성자와 달라야 함)</label>
        <input id="ndReviewer" value="${esc(note.header.점검자 || '')}" ${sealed ? 'disabled' : ''}></div>
    </div>
    <div class="flex mt8" style="flex-wrap:wrap">
      ${note.wp_refs.map(w => `<span class="chip">${esc(w)}</span>`).join('')}
    </div>`;
  wrap.appendChild(head);

  const actions = head.querySelector('#noteActions');
  actions.appendChild(el('button', { class: 'btn sm', html: icon('download') + 'DOCX', onclick: () => exportNoteDocx(note) }));
  actions.appendChild(el('button', { class: 'btn sm', html: icon('download') + 'XLSX', onclick: () => exportNoteXlsx(note) }));
  actions.appendChild(el('button', { class: 'btn sm', html: icon('print') + '인쇄', onclick: () => printNote(note) }));
  if (sealed) {
    actions.appendChild(el('button', {
      class: 'btn sm', html: icon('refresh') + '개정판 발행',
      onclick: async () => {
        if (!await confirmModal('개정판 발행', `확정 노트는 수정할 수 없습니다. ${note.note_id} 의 개정판(-R${(note.revision || 0) + 1})을 발행할까요? 원본은 그대로 보존됩니다.`)) return;
        const rev = reviseNote(note, currentUser());
        await commitNote(rev, currentUser(), '개정판 발행');
        await saveNote(rev);
        await audit('note.revise', rev.note_id);
        toast('개정판이 발행되었습니다: ' + rev.note_id, 'ok');
        nav('noteDetail', rev.note_id);
      },
    }));
  }

  if (sealed) {
    /* 확정 노트: 정본 문서 뷰 */
    const integrity = await verifyNoteIntegrity(note);
    if (!integrity.ok) {
      wrap.appendChild(el('div', { class: 'badBox', html: '<b>⚠ 무결성 경고</b> — 저장된 본문 해시와 현재 내용이 일치하지 않습니다. 파일이 외부에서 수정되었을 수 있습니다.' }));
    }
    /* 암호 서명·시점인증 상태 — 확정 노트에서 항상 보여준다.
       '이름만' 서명도 정직하게 표시한다: 없는 보증을 있는 것처럼 만들지 않는다. */
    {
      const byName = Object.fromEntries(S.users.users.map(u => [u.name, u]));
      const sigRs = await verifyCryptoSignatures(note, byName);
      const rows = sigRs.map(r => {
        const method = r.method === 'device-key' ? '기기 키' : r.method === 'passkey' ? '패스키' : '이름만 (암호 서명 없음)';
        let verdict;
        if (r.ok === null) verdict = '<span class="mut">—</span>';
        else if (!r.ok) verdict = '<b style="color:var(--no,#9b2c2c)">서명 검증 실패</b>';
        else if (r.keyKnown === false) verdict = '<b style="color:var(--warn,#8a5a12)">유효하나 키 대장에 없는 키</b>';
        else verdict = '<b style="color:var(--ok,#1f7a4d)">검증됨</b>' + (r.keyKnown ? ' · 키 대장 일치' : '');
        return `<div class="sm">${esc(r.signer)} <span class="mut">(${r.stage === 'final_approval' ? '최종 승인' : '기여자'} · ${method})</span> — ${verdict}</div>`;
      }).join('');
      let tsHtml;
      if (note.rfc3161) {
        const tv = verifyStoredTimestamp(note.rfc3161, note.seal_hash);
        tsHtml = tv.ok
          ? `<div class="sm">시점인증 — <b style="color:var(--ok,#1f7a4d)">${esc(tv.gen_time)}</b> <span class="mut">(${esc(note.rfc3161.tsa)}) · 구조 검증 통과 — TSA 서명은 openssl 로 독립 검증 가능</span></div>`
          : `<div class="sm">시점인증 — <b style="color:var(--no,#9b2c2c)">토큰 검증 실패: ${esc(tv.reason)}</b></div>`;
      } else {
        tsHtml = `<div class="sm mut">시점인증 — 없음 (로컬 시계 기록)</div>`;
      }
      wrap.appendChild(el('div', { class: 'card', html:
        `<div class="cardH"><div class="cardT">서명 · 시점인증 검증</div></div>${rows}${tsHtml}` }));
    }
    wrap.appendChild(el('div', { class: 'mt12', html: renderNoteDocHtml(note) }));
    return;
  }

  /* ── 편집 가능 상태: 섹션 편집기 ── */
  if (note._state === 'rejected') {
    wrap.appendChild(el('div', { class: 'badBox', html: '<b>반려됨</b> — 아래 게이트 지적사항을 해결한 뒤 다시 검증하십시오.' }));
  } else if (note._state === 'advisory') {
    wrap.appendChild(el('div', { class: 'warnBox', html: '<b>권고 지적 보유</b> — 저장·서명은 가능하지만, 지적사항을 보완하면 좋습니다.' }));
  }

  /* 첨부·증거 카드 */
  const evCard = el('div', { class: 'card' });
  evCard.innerHTML = `<div class="cardH"><div class="cardT">첨부 원본 · 증거 등재</div>
    <div class="cardSub">파일을 올리면 SHA-256 해시가 기록되고, 내용에서 증거 후보를 추출합니다.</div></div>
    <div id="ndAtts"></div>`;
  /* 드래그&드롭 업로드 존 — 등재 후 "분석할까요?" 를 물어본다 */
  const dz = el('div', {
    class: 'dropMini', id: 'ndDrop',
    html: icon('upload') + '<span>실험일지·측정데이터 파일을 끌어다 놓거나 클릭해 업로드하십시오</span>',
  });
  dz.addEventListener('click', async () => {
    const files = await pickFiles('');
    if (files.length) await ingestAndAsk(note, files);
  });
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', async e => {
    e.preventDefault(); dz.classList.remove('over');
    const files = await readFileList(e.dataTransfer.files);
    if (files.length) await ingestAndAsk(note, files);
  });
  evCard.appendChild(dz);

  const evBtns = el('div', { class: 'flex mt8' });
  evBtns.appendChild(el('button', {
    class: 'btn sm p', html: icon('zap') + '분석 시작하기 (자동 집필)',
    title: 'A12 집필 에이전트 — 첨부에서 등재된 증거만으로 수행내용·결과데이터·해석 초안을 자동 작성하고 게이트를 실행합니다.',
    onclick: () => runAutoDraft(note),
  }));
  if (S.llm && S.llm.api_key) {
    evBtns.appendChild(el('button', {
      class: 'btn sm', html: icon('agents') + 'AI 서술 다듬기',
      title: 'A7 — ' + (LLM_PROVIDERS[S.llm.provider] || {}).name + ' 로 서술을 자연스럽게 다듬습니다. 결과는 게이트가 재검증합니다.',
      onclick: () => aiPolishNote(note),
    }));
  }
  evBtns.appendChild(el('button', {
    class: 'btn sm', html: icon('upload') + '수동 등재 (후보 선택)',
    onclick: () => uploadEvidenceFiles(note),
  }));
  evBtns.appendChild(el('button', {
    class: 'btn sm', html: icon('plus') + '직접 기록 (연구자 진술)',
    onclick: () => addResearcherStatement(note),
  }));
  evCard.appendChild(evBtns);
  wrap.appendChild(evCard);
  renderAttList(note);

  /* 섹션 편집기 — 측정 데이터(4번)는 서술 결과(3번) 바로 뒤에 온다.
     번호 순서대로 읽히도록 반복문 안에서 제자리에 끼워 넣는다. */
  for (const [key, title, hint] of SECTION_DEFS) {
    wrap.appendChild(sectionEditor(note, key, title, hint));
    if (key === 'results') wrap.appendChild(metricsEditor(note));
  }

  /* 게이트 실행 */
  const gateCard = el('div', { class: 'card' });
  gateCard.innerHTML = `<div class="cardH"><div class="cardT">검증 게이트</div>
    <div class="cardSub">G1 증거매핑 · G2 과거정합성 · G3 수치단위 · G4 지침준수 — 모드: <b>${esc(S.config.gates.mode_default === 'strict' ? '필수(strict)' : '권고(advisory)')}</b></div></div>
    <div id="gateResult"></div>`;
  gateCard.appendChild(el('button', {
    class: 'btn p', html: icon('shield') + '게이트 검증 실행',
    onclick: () => runNoteGates(note),
  }));
  wrap.appendChild(gateCard);
  if (note._gate_summary) renderGateSummary(note._gate_summary);

  /* 서명·확정 */
  if (note._state === 'awaiting_sign' || note._state === 'advisory') {
    wrap.appendChild(signPanel(note));
  }
}

function renderAttList(note) {
  const host = qs('#ndAtts');
  if (!host) return;
  host.innerHTML = note.attachments.length ? '' : '<div class="mut sm">첨부 없음</div>';
  for (const a of note.attachments) {
    host.appendChild(el('div', { class: 'fileRow' }, [
      el('span', { class: 'nm', html: esc(a.name) }),
      el('span', { class: 'sz', html: fmtBytes(a.size) }),
      el('span', { class: 'sz', html: 'SHA-256 ' + (a.sha256 || '').slice(0, 12) + '…' }),
    ]));
  }
}

/* 파일 업로드 → 파싱 → 증거 후보 선택 모달 */
async function uploadEvidenceFiles(note) {
  const files = await pickFiles('');
  if (!files.length) return;
  for (const f of files) {
    const d = await parseFile(f.name, f.bytes);
    note.attachments.push({
      file_id: 'F' + (note.attachments.length + 1), name: d.name,
      sha256: d.sha256, size: d.size, contributor: currentUser(),
    });
    try { await S.store.putBytes('notes_files/' + note.note_id + '/' + d.name, f.bytes); } catch { /* 용량 제한 허용 */ }
    if (!d.ok || !d.text.trim()) {
      // 텍스트 없는 파일(스캔본 등)은 파일 단위 증거로만
      S.ledger.add({
        kind: 'reference', sourceType: 'upload', sourceFile: d.name,
        locator: '파일 전체', content: `첨부 원본: ${d.name}`, sha256: d.sha256, addedBy: currentUser(),
      });
      continue;
    }
    await evidenceCandidateModal(note, d);
  }
  await commitNote(note, currentUser(), '첨부 추가');
  await saveNote(note);
  await S.store.putJSON('ledger/evidence_ledger.json', S.ledger.toJSON());
  await audit('evidence.upload', files.map(f => f.name).join(', '));
  renderAttList(note);
  toast('첨부가 등재되었습니다. 본문에서 [E#] 로 인용하십시오.', 'ok');
  nav('noteDetail', note.note_id);
}

/* ── 자동 초안 3단계: ① 파일 수집·등재 → ② "분석할까요?" → ③ 분석·집필 ── */

/** ① 파일 파싱 → 첨부 + SHA-256 → 증거 후보 전량 등재 */
async function ingestEvidenceFiles(note, files) {
  const entries = [];
  for (const f of files) {
    const d = await parseFile(f.name, f.bytes);
    note.attachments.push({
      file_id: 'F' + (note.attachments.length + 1), name: d.name,
      sha256: d.sha256, size: d.size, contributor: currentUser(),
    });
    try { await S.store.putBytes('notes_files/' + note.note_id + '/' + d.name, f.bytes); } catch { /* 용량 제한 허용 */ }
    if (!d.ok || !d.text.trim()) {
      S.ledger.add({
        kind: 'reference', sourceType: 'upload', sourceFile: d.name,
        locator: '파일 전체', content: `첨부 원본: ${d.name}`, sha256: d.sha256, addedBy: currentUser(),
      });
      continue;
    }
    entries.push(...autoRegisterEvidence(S.ledger, d, currentUser(), 60, getLang()));
  }
  await commitNote(note, currentUser(), '첨부 추가');
  await saveNote(note);
  await S.store.putJSON('ledger/evidence_ledger.json', S.ledger.toJSON());
  await audit('evidence.upload', files.map(f => f.name).join(', '));
  renderAttList(note);
  return entries;
}

/** ② 업로드 직후 — 바로 분석할지, 추가 작업을 계속할지 묻는다 */
async function ingestAndAsk(note, files) {
  const entries = await ingestEvidenceFiles(note, files);
  const body = el('div');
  body.innerHTML = `
    <div class="sm">파일 <b>${files.length}개</b> 첨부 · 증거 후보 <b>${entries.length}건</b> 등재를 완료했습니다.</div>
    <div class="sm mut mt8">지금 자동 분석·집필을 실행하면 수행내용·결과데이터·해석 초안이 작성되고
    게이트 검증까지 진행됩니다.<br>파일을 더 올리거나 내용을 직접 편집하려면 [추가 작업 계속]을 선택한 뒤,
    준비되었을 때 <b>[분석 시작하기]</b> 버튼을 누르십시오.</div>`;
  const yes = el('button', {
    class: 'btn p', html: icon('zap') + '지금 분석·집필',
    onclick: async () => { closeModal(); await runAutoDraft(note); },
  });
  const later = el('button', {
    class: 'btn', html: '추가 작업 계속',
    onclick: () => {
      closeModal();
      toast('준비되면 [분석 시작하기 (자동 집필)] 버튼을 누르십시오.', 'ok');
      nav('noteDetail', note.note_id);
    },
  });
  openModal({ title: '분석할까요?', body, foot: [later, yes] });
}

/** ③ 분석 시작 — 이 노트 첨부에서 등재된 증거 전체로 A7 결정론 집필 + 게이트 */
async function runAutoDraft(note) {
  const attNames = new Set(note.attachments.map(a => a.name));
  const entries = S.ledger.entries.filter(e =>
    e.source_type === 'upload' && attNames.has(e.source_file) && e.kind !== 'reference');
  if (!entries.length) {
    toast('분석할 증거가 없습니다. 먼저 파일을 업로드해 증거를 등재하십시오.', 'warn');
    return;
  }
  const draft = buildAutoDraft({ note, entries, metricsCatalog: S.metrics.catalog, lang: getLang() });
  const { added } = applyDraftToNote(note, draft);
  await commitNote(note, currentUser(), '자동 초안 작성');
  await saveNote(note);
  await audit('note.autodraft',
    `${note.note_id} (증거 ${entries.length} · 수행 ${added.work} · 측정 ${added.metrics} · 해석 ${added.interpretation})`);

  const total = added.work + added.metrics + added.interpretation;
  if (!total && draft.stats.skippedOffPeriod) {
    /* 기록 날짜와 노트 기간의 불일치 — 올바른 기간의 노트에 집필할지 제안 */
    await offerRedirectDraft(note, entries, draft.stats.skippedOffPeriod);
    return;
  }
  const skip = draft.stats.skippedForbidden + draft.stats.skippedOffPeriod;
  toast(`자동 집필 완료 — 수행내용 ${added.work} · 결과데이터 ${added.metrics} · 해석 ${added.interpretation}건 작성` +
    (skip ? ` (금지표현·기간외 ${skip}건 제외)` : ''), 'ok');
  await runNoteGates(note);
}

/** AI 서술 다듬기 — LLM 결과를 게이트로 재검증하고, 악화되면 되돌린다 */
async function aiPolishNote(note) {
  if (!S.llm || !S.llm.api_key) { toast('설정에서 AI 엔진을 먼저 구성하십시오.', 'warn'); return; }
  const hasText = ['work', 'results', 'interpretation'].some(k => (note.sections[k] || []).some(e => e.text && e.text.trim()));
  if (!hasText) { toast('다듬을 서술이 없습니다. 먼저 자동 초안을 작성하십시오.', 'warn'); return; }
  toast('AI 서술 다듬기 실행 중… (' + (LLM_PROVIDERS[S.llm.provider] || {}).name + ')', 'ok');
  const backup = JSON.stringify(note.sections);
  try {
    const sealed = await sealedNotesList();
    const gateCtx = { ledger: S.ledger, sealedNotes: sealed, metricsCatalog: S.metrics.catalog,
      requiredFields: S.config.note.required_fields, mode: S.config.gates.mode_default };
    await commitNote(note, currentUser(), 'AI 다듬기 전');
    const before = runGates(note, { ...gateCtx, expectedHash: note.content_sha256 });

    const r = await polishNarrative(S.llm, note);

    await commitNote(note, currentUser(), 'AI 서술 다듬기');
    const after = runGates(note, { ...gateCtx, expectedHash: note.content_sha256 });
    if (after.violationCount > before.violationCount) {
      note.sections = JSON.parse(backup);
      await commitNote(note, currentUser(), 'AI 다듬기 되돌림');
      toast(`되돌림 — AI 결과가 게이트 지적을 늘렸습니다 (${before.violationCount}→${after.violationCount}건).`, 'warn');
    } else {
      applyGateResult(note, after);
      await saveNote(note);
      await audit('note.ai_polish', `${note.note_id} · 채택 ${r.applied} · 폐기 ${r.rejected}`);
      toast(`AI 다듬기 완료 — ${r.applied}개 문장 채택` + (r.rejected ? `, ${r.rejected}개 폐기(인용·금지표현 검증 실패)` : ''), 'ok');
    }
    nav('noteDetail', note.note_id);
  } catch (e) {
    note.sections = JSON.parse(backup);
    toast('AI 다듬기 실패: ' + e.message, 'err');
  }
}

/** 증거 항목들의 기록 날짜 → 소속 스프린트 분포 */
function sprintTargetsOf(entries) {
  const bySprint = new Map();
  for (const e of entries) {
    const raw = String(e.content || '').trim();
    const csv = raw.split(',');
    let d = null;
    if (csv.length >= 4 && isValidDate(csv[0].trim())) d = csv[0].trim();
    else { const m = raw.match(/^(\d{4}-\d{2}-\d{2})/); if (m) d = m[1]; }
    if (!d) continue;
    const sp = S.planner.sprints.find(s => s.start <= d && d <= s.end);
    if (!sp) continue;
    const cur = bySprint.get(sp.id) || { sp, count: 0 };
    cur.count++;
    bySprint.set(sp.id, cur);
  }
  return [...bySprint.values()].sort((a, b) => b.count - a.count);
}

/** 슬롯의 최신 노트를 로드하거나 새로 생성 (화면 이동 없음) */
async function ensureNoteForSprint(sp) {
  const family = S.notesIndex.notes.filter(n => n.note_id.startsWith(sp.noteSlot)).sort((a, b) => b.revision - a.revision);
  if (family.length) return loadNote(family[0].note_id);
  const n = createNote({
    project: S.project, period: { start: sp.start, end: sp.end },
    wpRefs: sp.activeWPs, author: currentUser() === '(미지정)' ? '' : currentUser(),
    reviewer: '', cadence: S.planner.cadence, today: today(),
  });
  await commitNote(n, currentUser(), '노트 슬롯 생성');
  await saveNote(n);
  await audit('note.create', n.note_id);
  return n;
}

/** 기간 불일치 시: 기록이 속한 스프린트를 찾아 그 노트에 자동 집필을 제안 */
async function offerRedirectDraft(note, entries, offCount) {
  const targets = sprintTargetsOf(entries).filter(t => t.sp.start !== note.period.start);
  const explain = esc(`업로드한 기록 ${offCount}건의 날짜가 이 노트의 작성기간(${note.period.start} ~ ${note.period.end}) 밖입니다.`);

  if (!targets.length) {
    /* 연구기간 전체 밖 — 제안할 노트가 없으므로 이유만 설명 */
    openModal({
      title: '채택된 기록이 없습니다',
      body: el('div', { html: `<div class="warnBox" style="margin-top:0">${explain}<br><br>
        기록 날짜가 연구기간 안의 어떤 스프린트에도 속하지 않습니다. 기록의 날짜를 확인하십시오.
        등재된 증거는 유지되며 증거원장에서 확인할 수 있습니다.</div>` }),
      foot: [el('button', { class: 'btn p', html: '확인', onclick: () => closeModal() })],
    });
    nav('noteDetail', note.note_id);
    return;
  }

  const list = targets.map(t =>
    `<div class="fileRow"><span class="chip">${esc(t.sp.id)}</span>
     <span class="sm">${esc(t.sp.start)} ~ ${esc(t.sp.end)}</span>
     <span class="sm mut">기록 ${t.count}건</span></div>`).join('');
  const body = el('div', { html: `
    <div class="warnBox" style="margin-top:0">${explain}</div>
    <div class="sm mt12 mb8">기록 날짜는 아래 기간에 속합니다. <b>해당 기간의 노트에 자동 집필할까요?</b></div>
    ${list}` });
  const yes = el('button', {
    class: 'btn p', html: icon('zap') + '해당 노트에 자동 집필',
    onclick: async () => {
      closeModal();
      const results = [];
      for (const { sp } of targets) {
        const tn = await ensureNoteForSprint(sp);
        if (tn._state === 'sealed') { results.push({ id: tn.note_id, sealed: true }); continue; }
        /* 원본 파일 첨부를 대상 노트에도 연결 (G4 첨부 요건) */
        const fileNames = new Set(entries.map(e => e.source_file));
        for (const a of note.attachments) {
          if (fileNames.has(a.name) && !tn.attachments.some(x => x.name === a.name)) {
            tn.attachments.push({ ...a, file_id: 'F' + (tn.attachments.length + 1) });
          }
        }
        const d = buildAutoDraft({ note: tn, entries, metricsCatalog: S.metrics.catalog, lang: getLang() });
        const r = applyDraftToNote(tn, d);
        await commitNote(tn, currentUser(), '자동 초안 작성 (기간 자동 이동)');
        const g = runGates(tn, {
          ledger: S.ledger, sealedNotes: await sealedNotesList(),
          metricsCatalog: S.metrics.catalog, requiredFields: S.config.note.required_fields,
          mode: S.config.gates.mode_default, expectedHash: tn.content_sha256,
        });
        applyGateResult(tn, g);
        await saveNote(tn);
        await audit('note.autodraft', `${tn.note_id} (기간 자동 이동 · 수행 ${r.added.work} · 측정 ${r.added.metrics} · 해석 ${r.added.interpretation})`);
        results.push({ id: tn.note_id, added: r.added, pass: g.allPass, v: g.violationCount });
      }
      const drafted = results.filter(r => !r.sealed);
      const sealed = results.filter(r => r.sealed);
      if (sealed.length) toast(`확정된 노트 ${sealed.length}건은 건너뛰었습니다 (개정판 필요): ${sealed.map(r => r.id).join(', ')}`, 'warn');
      if (drafted.length) {
        const first = drafted[0];
        toast(`${drafted.map(r => `${r.id} — 수행 ${r.added.work}·측정 ${r.added.metrics}·해석 ${r.added.interpretation}` +
          (r.pass ? ' (게이트 통과)' : ` (지적 ${r.v}건)`)).join(' / ')}`, 'ok');
        nav('noteDetail', first.id);
      } else {
        nav('noteDetail', note.note_id);
      }
    },
  });
  const no = el('button', { class: 'btn', html: '취소', onclick: () => { closeModal(); nav('noteDetail', note.note_id); } });
  openModal({ title: '기록 날짜가 다른 기간입니다', body, foot: [no, yes] });
}

/** A8 증거원장: 파싱된 문서에서 증거 후보를 사용자가 선택해 등재 */
function evidenceCandidateModal(note, doc) {
  return new Promise(resolve => {
    // 후보: 수치 포함 라인(측정) 우선 + 일반 문단(진술) — autodraft 와 공유 구현
    const cands = extractCandidates(doc);
    const body = el('div');
    body.innerHTML = `<div class="sm mut mb8">자료에 실재하는 사실만 증거가 됩니다. 이 노트에서 인용할 내용을 선택하십시오. (1증거 = 1주장)</div>`;
    const listEl = el('div', { style: 'max-height:340px;overflow-y:auto' });
    const checks = [];
    for (const cd of cands.slice(0, 60)) {
      const cb = el('input', { type: 'checkbox' });
      checks.push([cb, cd]);
      listEl.appendChild(el('label', { class: 'fileRow', style: 'cursor:pointer;align-items:flex-start' }, [
        cb,
        el('span', { class: 'chip', html: cd.kind === 'measurement' ? '측정' : '진술', style: 'flex-shrink:0' }),
        el('span', { class: 'sm', html: esc(cd.text) }),
      ]));
    }
    body.appendChild(listEl);
    const done = el('button', {
      class: 'btn p', html: '선택 항목 증거 등재',
      onclick: () => {
        let n = 0;
        for (const [cb, cd] of checks) {
          if (!cb.checked) continue;
          S.ledger.add({
            kind: cd.kind, sourceType: 'upload', sourceFile: doc.name,
            locator: `문단 ${cd.idx + 1}`, content: cd.text, sha256: doc.sha256, addedBy: currentUser(),
          });
          n++;
        }
        toast(n ? `${n}건 등재 (E${S.ledger.size() - n + 1}~E${S.ledger.size()})` : '선택된 항목이 없습니다.', n ? 'ok' : 'warn');
        closeModal(m.mask);
        resolve();
      },
    });
    const skip = el('button', { class: 'btn', html: '건너뛰기', onclick: () => { closeModal(m.mask); resolve(); } });
    const m = openModal({ title: `증거 후보 — ${doc.name}`, body, foot: [skip, done], wide: true, onClose: () => resolve() });
  });
}

async function addResearcherStatement(note) {
  const body = el('div');
  body.innerHTML = `<div class="warnBox" style="margin-top:0">직접 기록은 <b>원본 대조가 불가한 연구자 진술</b>로 등재됩니다(증거 강도: 낮음). 가능하면 원본 파일 업로드를 권장합니다.</div>`;
  const ta = el('textarea', { placeholder: '수행 사실을 과거시제로 기술 (예: 7월 12일 3차 배양 실험을 수행하였다)' });
  body.appendChild(ta);
  const ok = el('button', {
    class: 'btn p', html: '등재',
    onclick: async () => {
      const t = ta.value.trim();
      if (t.length < 5) { toast('내용을 입력하십시오.', 'warn'); return; }
      const e = S.ledger.add({
        kind: 'researcher_statement', sourceType: 'upload', sourceFile: '(직접 기록)',
        locator: '연구자 진술', content: t, addedBy: currentUser(),
      });
      await S.store.putJSON('ledger/evidence_ledger.json', S.ledger.toJSON());
      await audit('evidence.statement', e.id);
      toast(`${e.id} 로 등재되었습니다. 본문에서 [${e.id}] 로 인용하십시오.`, 'ok');
      closeModal();
    },
  });
  openModal({ title: '직접 기록 (연구자 진술)', body, foot: [ok] });
}

/* 섹션 편집기 */
function sectionEditor(note, key, title, hint) {
  const card = el('div', { class: 'card' });
  card.innerHTML = `<div class="cardH"><div class="cardT">${esc(title)}</div><div class="cardSub">${esc(hint)}</div></div>`;
  const list = el('div');
  card.appendChild(list);

  const renderList = () => {
    list.innerHTML = '';
    const arr = note.sections[key] || [];
    if (!arr.length) list.innerHTML = '<div class="mut sm mb8">항목 없음 — 증거가 없으면 비워 두십시오 ("해당 기간 관련 증거 자료 없음"으로 출력됩니다)</div>';
    arr.forEach((entry, i) => {
      const row = el('div', { class: 'flex mb8', style: 'align-items:flex-start' });
      const ta = el('textarea', {
        style: 'flex:1;min-height:52px', value: '',
        onchange: async e => {
          entry.text = e.target.value;
          await commitNote(note, currentUser(), `${title} 수정`);
          await saveNote(note);
        },
      });
      ta.value = entry.text || '';
      row.appendChild(ta);
      const cites = citationsIn(entry.text || '');
      row.appendChild(el('div', { style: 'width:120px;flex-shrink:0' }, [
        el('div', { class: 'xs mut', html: cites.length ? cites.map(x => `<span class="evRef">${esc(x)}</span>`).join('') : '<span class="confTag conf-low">인용 없음</span>' }),
        el('button', {
          class: 'btn sm mt8', html: '삭제',
          onclick: async () => {
            note.sections[key].splice(i, 1);
            await commitNote(note, currentUser(), `${title} 항목 삭제`);
            await saveNote(note);
            renderList();
          },
        }),
      ]));
      list.appendChild(row);
    });
  };
  renderList();

  card.appendChild(el('button', {
    class: 'btn sm', html: icon('plus') + '항목 추가',
    onclick: async () => {
      note.sections[key] = note.sections[key] || [];
      note.sections[key].push({ text: '', wp: note.wp_refs[0] || '', evidence: [] });
      await saveNote(note);
      renderList();
    },
  }));
  return card;
}

/* 측정값 편집기 */
function metricsEditor(note) {
  const card = el('div', { class: 'card' });
  card.innerHTML = `<div class="cardH"><div class="cardT">4. 결과 데이터 (측정값)</div>
    <div class="cardSub">지표 카탈로그와 연결된 실측치 — 확정 시 대시보드에 자동 반영됩니다</div></div>`;
  const list = el('div');
  card.appendChild(list);

  const renderRows = () => {
    list.innerHTML = '';
    const rows = note.sections.metrics || [];
    if (!rows.length) list.innerHTML = '<div class="mut sm mb8">측정값 없음</div>';
    rows.forEach((row, i) => {
      const wrap = el('div', { class: 'flex mb8', style: 'flex-wrap:wrap' });
      const sel = el('select', {
        style: 'width:200px',
        onchange: async e => {
          const cat = S.metrics.catalog.find(k => k.key === e.target.value);
          row.metric_key = e.target.value;
          row.metric = cat ? cat.name : e.target.value;
          row.unit = cat ? cat.unit : row.unit;
          row.target = cat ? cat.target : null;
          row.direction = cat ? cat.direction : 'higher';
          await commitNote(note, currentUser(), '측정값 수정'); await saveNote(note); renderRows();
        },
      });
      sel.appendChild(el('option', { value: '', html: '지표 선택…' }));
      for (const k of S.metrics.catalog) sel.appendChild(el('option', { value: k.key, html: k.name }));
      sel.value = row.metric_key || '';
      wrap.appendChild(sel);
      const val = el('input', {
        placeholder: '값', style: 'width:90px', value: row.value ?? '',
        onchange: async e => { row.value = e.target.value === '' ? '' : +e.target.value; await commitNote(note, currentUser(), '측정값 수정'); await saveNote(note); },
      });
      wrap.appendChild(val);
      wrap.appendChild(el('span', { class: 'chip mono', html: esc(row.unit || '-') }));
      const cond = el('input', {
        placeholder: '측정 조건', style: 'flex:1;min-width:140px', value: row.condition || '',
        onchange: async e => { row.condition = e.target.value; await commitNote(note, currentUser(), '측정값 수정'); await saveNote(note); },
      });
      wrap.appendChild(cond);
      const evBtn = el('button', {
        class: 'btn sm', html: (row.evidence || []).length ? `증거 ${(row.evidence || []).length}건` : '증거 연결',
        onclick: () => pickEvidenceModal(row.evidence || [], async ids => {
          row.evidence = ids;
          await commitNote(note, currentUser(), '측정 증거 연결'); await saveNote(note); renderRows();
        }),
      });
      wrap.appendChild(evBtn);
      wrap.appendChild(el('button', {
        class: 'btn sm', html: '삭제',
        onclick: async () => { note.sections.metrics.splice(i, 1); await commitNote(note, currentUser(), '측정행 삭제'); await saveNote(note); renderRows(); },
      }));
      list.appendChild(wrap);
    });
  };
  renderRows();

  card.appendChild(el('button', {
    class: 'btn sm', html: icon('plus') + '측정값 추가',
    onclick: async () => {
      note.sections.metrics = note.sections.metrics || [];
      note.sections.metrics.push({ metric: '', metric_key: '', value: '', unit: '', condition: '', evidence: [] });
      await saveNote(note);
      renderRows();
    },
  }));
  return card;
}

function pickEvidenceModal(selected, onDone) {
  const body = el('div', { style: 'max-height:360px;overflow-y:auto' });
  const set = new Set(selected);
  if (!S.ledger.size()) body.innerHTML = '<div class="mut sm">증거원장이 비어 있습니다. 먼저 파일을 업로드해 증거를 등재하십시오.</div>';
  for (const e of S.ledger.entries.slice().reverse().slice(0, 300)) {
    const cb = el('input', { type: 'checkbox' });
    cb.checked = set.has(e.id);
    cb.addEventListener('change', () => { cb.checked ? set.add(e.id) : set.delete(e.id); });
    body.appendChild(el('label', { class: 'fileRow', style: 'cursor:pointer;align-items:flex-start' }, [
      cb,
      el('span', { class: 'evRef', html: esc(e.id) }),
      el('span', { class: 'sm', html: `${esc(e.content.slice(0, 110))} <span class="mut xs">· ${esc(e.source_file)} · ${esc(e.locator)}</span>` }),
    ]));
  }
  const ok = el('button', { class: 'btn p', html: '연결', onclick: () => { closeModal(); onDone([...set]); } });
  openModal({ title: '증거 연결', body, foot: [ok], wide: true });
}

/* 게이트 실행 */
async function runNoteGates(note) {
  // 편집 필드 반영
  const author = qs('#ndAuthor'), reviewer = qs('#ndReviewer');
  if (author) note.header.작성자 = author.value.trim();
  if (reviewer) note.header.점검자 = reviewer.value.trim();
  await commitNote(note, currentUser(), '게이트 검증 실행');

  const sealed = await sealedNotesList();
  const result = runGates(note, {
    ledger: S.ledger,
    sealedNotes: sealed,
    metricsCatalog: S.metrics.catalog,
    requiredFields: S.config.note.required_fields,
    mode: S.config.gates.mode_default,
    expectedHash: note.content_sha256,
  });
  applyGateResult(note, result);
  await saveNote(note);
  await audit('gates.run', `${note.note_id} → ${result.decision} (지적 ${result.violationCount}건)`);
  renderGateSummary(note._gate_summary);
  toast(result.allPass ? '전 게이트 통과 — 서명 대기 상태로 전환되었습니다.'
    : (result.decision === 'rejected' ? `반려: 지적 ${result.violationCount}건 (strict 모드)` : `권고 지적 ${result.violationCount}건 — 저장은 유지됩니다.`),
    result.allPass ? 'ok' : (result.decision === 'rejected' ? 'err' : 'warn'));
  nav('noteDetail', note.note_id);
}

function renderGateSummary(sum) {
  const host = qs('#gateResult');
  if (!host || !sum) return;
  let html = `<div class="gateBar">${sum.gates.map(g =>
    `<div class="gate ${g.pass ? 'pass' : 'fail'}">${esc(g.gate)} ${g.pass ? 'PASS' : '지적 ' + g.violations.length}</div>`).join('')}</div>`;
  for (const g of sum.gates) {
    for (const v of g.violations) {
      html += `<div class="viol ${v.severity}">
        <div class="vh">${esc(g.gate)} · ${esc(v.check)} <span class="mut xs">— ${esc(v.location)}</span></div>
        <div>${esc(v.issue)}</div>
        ${v.quote ? `<div class="vq">${esc(v.quote)}</div>` : ''}
        <div class="va"><b>조치</b> ${esc(v.required_action)}</div>
      </div>`;
    }
  }
  host.innerHTML = html;
}

/* 서명 패널 */
function signPanel(note) {
  const card = el('div', { class: 'card' });
  const contribs = note.signatures.contributors;
  card.innerHTML = `<div class="cardH"><div class="cardT">서명 · 확정</div>
    <div class="cardSub">① 기여자 서명 → ② 최종 승인(교차 승인 원칙 — 작성자 본인 승인 불가) → 확정(sealed) 후 불변</div></div>
    <div class="sm mb8">기여자 서명: ${contribs.length ? contribs.map(s => `<span class="chip">${esc(s.signer)} ✓</span>`).join(' ') : '<span class="mut">없음</span>'}</div>`;

  const meIn = el('input', { placeholder: '서명자 이름', value: currentUser() === '(미지정)' ? '' : currentUser(), style: 'width:140px' });
  const row = el('div', { class: 'flex', style: 'flex-wrap:wrap' });
  row.appendChild(meIn);
  row.appendChild(el('button', {
    class: 'btn', html: icon('check') + '기여자 서명',
    onclick: async () => {
      const nm = meIn.value.trim();
      if (!nm) { toast('서명자 이름을 입력하십시오.', 'warn'); return; }
      try {
        const extras = await gatherSignatureExtras(nm, note.content_sha256);
        if (extras === null) return;                       // 패스키 취소 → 중단
        addContributorSignature(note, nm, note.content_sha256, extras);
        await saveNote(note);
        await audit('note.sign', `${note.note_id} · ${nm}`);
        toast('기여자 서명이 기록되었습니다.', 'ok');
        nav('noteDetail', note.note_id);
      } catch (e) { toast(e.message, 'err'); }
    },
  }));
  row.appendChild(el('button', {
    class: 'btn p', html: icon('lock') + '최종 승인 · 확정',
    onclick: async () => {
      const nm = meIn.value.trim();
      if (!nm) { toast('승인자 이름을 입력하십시오.', 'warn'); return; }
      if (!await confirmModal('최종 승인', `'${nm}' 이름으로 최종 승인하고 확정(sealed)합니다. 확정 후에는 수정할 수 없으며, 변경은 개정판 발행으로만 가능합니다.`)) return;
      try {
        const finalExtras = await gatherSignatureExtras(nm, note.content_sha256);
        if (finalExtras === null) return;                  // 패스키 취소 → 중단
        const sealedAll = await sealedNotesList();
        const chainSorted = sealedAll.filter(n => n.seal_hash).sort((a, b) => a.note_id < b.note_id ? -1 : 1);
        const prev = chainSorted.length ? chainSorted[chainSorted.length - 1].seal_hash : '';
        await sealNote(note, {
          approver: nm, prevSealHash: prev, contentHash: note.content_sha256,
          allowAdvisory: S.config.gates.mode_default !== 'strict',
          finalExtras,
        });
        /* 시점인증 — 켜져 있을 때만, 봉인 해시(32바이트)만 전송.
           실패는 확정을 절대 막지 않는다: 감사로그에 사유를 남기고
           로컬 시계 기록으로 진행한다 (에어갭 동작 보장). */
        if (S.config.timestamp && S.config.timestamp.enabled) {
          const tsRec = await obtainTimestamp(note.seal_hash, S.config.timestamp.tsa_url || DEFAULT_TSA);
          if (tsRec.ok) {
            attachTimestamp(note, tsRec);
            await audit('note.timestamp', `${note.note_id} · ${tsRec.gen_time} · ${tsRec.tsa}`);
          } else {
            await audit('note.timestamp.fail', `${note.note_id} · ${tsRec.reason} — 로컬 시계로 기록`);
          }
        }
        // A8: 측정값을 지표 실측에 누적
        for (const r of note.sections.metrics || []) {
          if (r.metric_key && Number.isFinite(+r.value)) {
            S.metrics.actuals.push({
              key: r.metric_key, value: +r.value, date: note.period.end,
              m: monthNumOf(note.period.end), noteId: note.note_id, evidence: r.evidence || [],
            });
          }
        }
        await persistAll();
        await saveNote(note);
        await audit('note.seal', `${note.note_id} · 승인 ${nm}`);
        /* 확정 즉시 영구 아카이브 (원본 JSON + 정본 DOCX) */
        const arc = await archiveSealedNote(S.store, note, S.ledger);
        if (arc.json || arc.docx) await audit('archive.seal', `${note.note_id} → ${arc.base} (json:${arc.json} docx:${arc.docx})`);
        toast('연구노트가 확정되었습니다.'
          + (note.rfc3161 ? ' 시점인증 토큰이 부착되었습니다.' : '')
          + (arc.json ? ' 아카이브에 보관되었습니다.' : ''), 'ok');
        nav('noteDetail', note.note_id);
      } catch (e) { toast(e.message, 'err'); }
    },
  }));
  card.appendChild(row);
  return card;
}

function monthNumOf(iso) {
  const p = S.project.period;
  const d0 = new Date(p.start + 'T00:00:00Z'), d1 = new Date(iso + 'T00:00:00Z');
  return Math.max(1, Math.min(p.months, (d1.getUTCFullYear() - d0.getUTCFullYear()) * 12 + (d1.getUTCMonth() - d0.getUTCMonth()) + 1));
}

/* 정본 HTML (확정 노트 뷰 + 인쇄)
 *
 * 두 가지 원칙을 지킨다:
 *  ① 라벨(껍데기)은 DOCX 와 같은 사전 dt() 로 번역한다 — 정본 문서와
 *     화면이 서로 다른 말을 하면 안 되므로 번역 출처를 하나로 둔다.
 *  ② 기록(본문·측정값·서명·해시)은 번역하지 않는다. 컨테이너에
 *     data-no-i18n 을 달아 화면 번역기가 확정된 기록을 건드리지 못하게 한다.
 *     기록이 표시 시점에 바뀌면 봉인된 해시와 화면이 어긋난다.
 */
function renderNoteDocHtml(note) {
  const h = note.header;
  const none = `<p class="mut">${esc(dt('해당 기간 관련 증거 자료 없음'))}</p>`;
  const secList = (arr) => {
    const items = (arr || []).filter(x => x && String(x.text || '').trim());
    return items.length
      ? '<ul>' + items.map(x => `<li>${esc(x.text)}</li>`).join('') + '</ul>'
      : none;
  };
  const metricRowsH = (note.sections.metrics || []).map(m =>
    `<tr><td>${esc(m.metric)}</td><td class="mono">${esc(String(m.value))}</td><td>${esc(m.unit || '')}</td><td>${esc(m.condition || '')}</td><td>${(m.evidence || []).map(e => esc(e)).join(', ')}</td></tr>`).join('');
  return `<div class="noteDoc" data-no-i18n="1">
    <h1>${esc(dt('연 구 노 트'))}</h1>
    <table>
      <tr><th style="width:110px">${esc(dt('과제번호'))}</th><td>${esc(h.과제번호)}</td><th style="width:110px">${esc(dt('연구노트번호'))}</th><td class="mono">${esc(note.note_id)}</td></tr>
      <tr><th>${esc(dt('과제명'))}</th><td>${esc(h.과제명)}</td><th>${esc(dt('작성기간'))}</th><td class="mono">${esc(note.period.start)} ~ ${esc(note.period.end)}</td></tr>
      <tr><th>${esc(dt('작성자'))}</th><td>${esc(h.작성자)}</td><th>${esc(dt('점검자'))}</th><td>${esc(h.점검자)}</td></tr>
      <tr><th>${esc(dt('WP 연계'))}</th><td>${note.wp_refs.map(esc).join(', ') || '-'}</td><th>${esc(dt('상태'))}</th><td>${esc(stateLabel(note._state))}</td></tr>
    </table>
    <h2>${esc(dt('1. 기간 목표'))}</h2>${secList(note.sections.goal)}
    <h2>${esc(dt('2. 수행 내용'))}</h2>${secList(note.sections.work)}
    <h2>${esc(dt('3. 결과 데이터 (서술)'))}</h2>${secList(note.sections.results)}
    <h2>${esc(dt('4. 결과 데이터 (측정)'))}</h2>
    ${metricRowsH ? `<table><tr><th>${esc(dt('지표'))}</th><th>${esc(dt('값'))}</th><th>${esc(dt('단위'))}</th><th>${esc(dt('측정조건'))}</th><th>${esc(dt('증거'))}</th></tr>${metricRowsH}</table>` : none}
    <h2>${esc(dt('5. 해석'))}</h2>${secList(note.sections.interpretation)}
    <h2>${esc(dt('6. 차기 계획'))}</h2>${secList(note.sections.next_plan)}
    <h2>${esc(dt('7. 첨부 원본 목록'))}</h2>
    ${note.attachments.length ? `<table><tr><th>${esc(dt('파일명'))}</th><th>${esc(dt('크기'))}</th><th>SHA-256</th></tr>${note.attachments.map(a =>
      `<tr><td>${esc(a.name)}</td><td>${fmtBytes(a.size)}</td><td class="mono xs">${esc((a.sha256 || '').slice(0, 24))}…</td></tr>`).join('')}</table>` : `<p class="mut">${esc(dt('첨부 없음'))}</p>`}
    <h2>${esc(dt('9. 서명'))}</h2>
    <table><tr><th>${esc(dt('단계'))}</th><th>${esc(dt('서명자'))}</th><th>${esc(dt('시각'))}</th></tr>
      ${note.signatures.contributors.map(s => `<tr><td>${esc(dt('기여자'))}</td><td>${esc(s.signer)}</td><td class="mono xs">${esc(s.signed_at)}</td></tr>`).join('')}
      ${note.signatures.final ? `<tr><td><b>${esc(dt('최종 승인'))}</b></td><td><b>${esc(note.signatures.final.signer)}</b></td><td class="mono xs">${esc(note.signatures.final.signed_at)}</td></tr>` : `<tr><td colspan="3" class="mut">${esc(dt('최종 승인 없음'))}</td></tr>`}
    </table>
    <div class="docFoot">
      ${esc(dt('본 문서의 무결성은 SHA-256 해시로 검증됩니다 (PKI 신원 증명이 아닙니다).'))}<br>
      ${esc(dt('본문 해시'))} ${esc(note.content_sha256)}<br>
      ${note.seal_hash ? esc(dt('확정 해시')) + ' ' + esc(note.seal_hash) : ''}
    </div>
  </div>`;
}

function printNote(note) {
  const pa = qs('#printArea');
  pa.innerHTML = renderNoteDocHtml(note);
  pa.hidden = false;
  audit('note.print', note.note_id);
  setTimeout(() => { window.print(); pa.hidden = true; }, 60);
}

function exportNoteDocx(note) {
  const blocks = noteToDocxBlocks(note, S.ledger);
  const bytes = docxBuild(blocks, { title: note.note_id, creator: S.config.system_name });
  downloadBytes(`${note.note_id}_정본.docx`, bytes,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  audit('doc.export', note.note_id + '.docx');
}

function exportNoteXlsx(note) {
  const sheets = [
    { name: '요약', rows: [
      ['과제번호', note.header.과제번호], ['과제명', note.header.과제명],
      ['연구노트번호', note.note_id], ['작성기간', `${note.period.start} ~ ${note.period.end}`],
      ['작성자', note.header.작성자], ['점검자', note.header.점검자],
      ['상태', stateLabel(note._state)], ['본문 해시', note.content_sha256],
    ] },
    { name: '측정데이터', rows: [['지표', '값', '단위', '조건', '증거'],
      ...(note.sections.metrics || []).map(m => [m.metric, Number.isFinite(+m.value) ? +m.value : String(m.value), m.unit || '', m.condition || '', (m.evidence || []).join(', ')])] },
    { name: '서술기록', rows: [['섹션', '내용'],
      ...['goal', 'work', 'results', 'interpretation', 'next_plan'].flatMap(k =>
        (note.sections[k] || []).map(x => [k, x.text]))] },
    { name: '증거원장', rows: [['ID', '종류', '출처', '위치', '내용'],
      ...S.ledger.entries.map(e => [e.id, e.kind, e.source_file, e.locator, e.content])] },
  ];
  downloadBytes(`${note.note_id}_데이터.xlsx`, xlsxBuild(sheets),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  audit('doc.export', note.note_id + '.xlsx');
}

/* ══════════════════════════════════════════════════════════
 * 뷰: 증거원장
 * ══════════════════════════════════════════════════════════ */
function renderLedger(c) {
  const wrap = el('div', { class: 'pageW' });
  wrap.innerHTML = `<div class="infoBox" style="margin-top:0"><b>무증거 무기재</b> — 연구노트의 모든 서술 문장은 이 원장의 증거ID [E#] 1개 이상에 매핑되어야 합니다.
    인정 소스: 업로드 원본 · 확정 과거 노트 · 계획서 추출본.</div>`;
  if (!S.ledger.size()) {
    wrap.appendChild(el('div', { class: 'empty', html: '등재된 증거가 없습니다.<br><span class="xs">연구노트 화면에서 파일을 업로드하면 증거 후보가 추출됩니다.</span>' }));
  } else {
    const rows = S.ledger.entries.slice().reverse().map(e => `
      <tr><td class="mono nowrap"><b>${esc(e.id)}</b></td>
      <td>${esc(kindLabel(e.kind))}${e.strength === 'low' ? ' <span class="confTag conf-low">강도 낮음</span>' : ''}</td>
      <td>${esc(e.content)}</td>
      <td class="xs mut nowrap">${esc(e.source_file)}<br>${esc(e.locator)}</td>
      <td class="xs mut nowrap">${esc(e.added_by)}<br>${esc((e.added_at || '').slice(0, 10))}</td></tr>`).join('');
    wrap.appendChild(el('div', { class: 'tblW', html: `<table class="tbl">
      <thead><tr><th>ID</th><th>종류</th><th>내용</th><th>출처·위치</th><th>등재</th></tr></thead>
      <tbody>${rows}</tbody></table>` }));
  }
  c.appendChild(wrap);
}

function kindLabel(k) {
  return ({ measurement: '측정', statement: '진술', decision: '결정', schedule: '일정', reference: '참조', researcher_statement: '연구자 진술' })[k] || k;
}

/* ══════════════════════════════════════════════════════════
 * 뷰: 성능지표
 * ══════════════════════════════════════════════════════════ */
function renderMetrics(c) {
  const wrap = el('div', { class: 'pageW' });
  if (!S.metrics.catalog.length) {
    wrap.appendChild(el('div', { class: 'empty', html: '등록된 지표가 없습니다. 설정에서 지표를 추가하십시오.' }));
    c.appendChild(wrap);
    return;
  }
  const grid = el('div', { class: 'grid2' });
  for (const k of S.metrics.catalog) {
    const acts = S.metrics.actuals.filter(a => a.key === k.key).sort((a, b) => (a.m || 0) - (b.m || 0));
    const last = acts.length ? acts[acts.length - 1] : null;
    let status = 'no_data', badgeCls = 'b-mut', label = '데이터 없음';
    if (last && Number.isFinite(+k.target)) {
      const met = k.direction === 'lower' ? +last.value <= +k.target : +last.value >= +k.target;
      status = met ? 'achieved' : 'in_progress';
      badgeCls = met ? 'b-ok' : 'b-warn';
      label = met ? '목표 달성' : '진행 중';
    } else if (last) { badgeCls = 'b-info'; label = '측정 중'; }
    const card = el('div', { class: 'metricCard' });
    card.innerHTML = `
      <div class="spread"><span class="mn">${esc(k.name)}</span><span class="badge ${badgeCls}">${label}</span></div>
      <div class="mv">${last ? esc(String(last.value)) : '—'}<span class="mut" style="font-size:12px"> ${esc(k.unit || '')}</span></div>
      <div class="mt">목표 ${k.target ?? '-'}${esc(k.unit || '')} · ${k.direction === 'lower' ? '낮을수록 좋음' : '높을수록 좋음'} · 실측 ${acts.length}건</div>
      ${lineChart({ width: 440, height: 110, months: S.project.period.months, target: k.target, actuals: acts.map(a => ({ m: a.m, value: a.value })), direction: k.direction })}`;
    grid.appendChild(card);
  }
  wrap.appendChild(grid);
  wrap.appendChild(el('div', { class: 'infoBox mt12', html: '실측치는 확정(sealed)된 연구노트의 측정값에서만 자동 누적됩니다. 보간·외삽은 하지 않습니다 — 없는 데이터는 그리지 않습니다.' }));
  c.appendChild(wrap);
}

/* ══════════════════════════════════════════════════════════
 * 뷰: AI 에이전트
 * ══════════════════════════════════════════════════════════ */
function renderAgents(c) {
  const wrap = el('div', { class: 'pageW' });
  wrap.innerHTML = `<div class="infoBox" style="margin-top:0">
    <b>${AGENT_ROSTER.length}개 전문 에이전트</b>가 7계층(총괄·기획·수집·집필·검증·출력·기억)으로
    연구노트 파이프라인을 구성합니다. 그룹마다 ★리드가 산출물 완결성을 책임지고, 계층 사이는
    형식이 고정된 패킷(ProjectFrame → EvidenceBundle → DraftNote → GateVerdict)으로만 통신하며,
    그룹 내부는 단일 작성자 블랙보드(data/*.json 파일별 유일 편집자)를 씁니다 —
    상세 설계: <span class="mono">agents/MAS_SPEC.md</span>. 결정론 코어(파서·게이트·해시)는
    브라우저에서 직접 실행되며, 프롬프트 템플릿(<span class="mono">agents/prompts/</span>)은
    어떤 LLM 엔진과도 연결할 수 있습니다.</div>`;
  const PACKET = { 'L1 기획': 'ProjectFrame 패킷 발신 → L2·L3', 'L2 수집': 'EvidenceBundle 패킷 발신 → L3',
    'L3 집필': 'DraftNote 패킷 발신 → L4', 'L4 검증': 'GateVerdict 패킷 발신 → A0·L3' };
  let layer = '';
  for (const a of AGENT_ROSTER) {
    if (a.layer !== layer) {
      layer = a.layer;
      const n = AGENT_ROSTER.filter(x => x.layer === layer).length;
      wrap.appendChild(el('div', { class: 'navSec', style: 'padding-left:2px',
        html: `${esc(layer)} · ${n}종${PACKET[layer] ? ` <span style="text-transform:none;font-weight:400">— ${esc(PACKET[layer])}</span>` : ''}` }));
    }
    wrap.appendChild(el('div', { class: 'agentCard' }, [
      el('div', { class: 'aid', html: esc(a.id) }),
      el('div', {}, [
        el('div', { html: `<span class="an">${esc(a.name)}</span>${a.lead ? '<span class="chip" style="margin-left:6px">★ 리드</span>' : ''}<span class="al">${esc(a.en)}</span>` }),
        el('div', { class: 'ar', html: esc(a.role) }),
      ]),
    ]));
  }
  c.appendChild(wrap);
}

/* ══════════════════════════════════════════════════════════
 * 뷰: 설정
 * ══════════════════════════════════════════════════════════ */
/** AI 엔진(LLM) 설정 카드 — 관리자만 편집, 키는 마스킹 표시 */
function llmCard() {
  const card = el('div', { class: 'card' });
  card.innerHTML = `<div class="cardH"><div class="cardT">AI 엔진 (LLM)</div>
    <div class="cardSub">자동 초안의 서술을 자연스럽게 다듬는 A7 보강 엔진 — 선택 사항이며, 없어도 시스템은 완전히 동작합니다</div></div>`;

  const cur = S.llm;
  if (!isAdmin()) {
    card.appendChild(el('div', { class: 'infoBox', style: 'margin-top:0', html: cur && cur.api_key
      ? `구성됨: <b>${esc((LLM_PROVIDERS[cur.provider] || {}).name || cur.provider)}</b> · <span class="mono">${esc(cur.model)}</span> · 키 ${esc(String(cur.api_key).slice(0, 7))}…(마스킹)`
      : '아직 구성되지 않았습니다. 구성은 책임 데이터 관리자가 할 수 있습니다.' }));
    return card;
  }

  const provSel = el('select');
  for (const [id, p] of Object.entries(LLM_PROVIDERS))
    provSel.appendChild(el('option', { value: id, html: p.name }));
  const modelIn = el('input', { placeholder: '모델', style: 'width:200px', class: 'mono' });
  const keyIn = el('input', { type: 'password', placeholder: 'API 키', style: 'flex:1;min-width:220px' });
  const syncDefaults = () => {
    const p = LLM_PROVIDERS[provSel.value];
    modelIn.value = (cur && cur.provider === provSel.value && cur.model) || p.defaultModel;
    keyIn.placeholder = 'API 키 (' + p.keyHint + ')';
  };
  provSel.onchange = syncDefaults;
  provSel.value = (cur && cur.provider) || 'claude';
  syncDefaults();
  if (cur && cur.api_key) keyIn.value = cur.api_key;

  const row = el('div', { class: 'flex', style: 'flex-wrap:wrap;gap:8px' });
  row.append(provSel, modelIn, keyIn);
  card.appendChild(row);

  const btnRow = el('div', { class: 'flex mt8' });
  const status = el('span', { class: 'sm mut', style: 'margin-left:auto' });
  btnRow.appendChild(el('button', {
    class: 'btn sm', html: '연결 테스트',
    onclick: async () => {
      if (!keyIn.value.trim()) { toast('API 키를 입력하십시오.', 'warn'); return; }
      status.textContent = '테스트 중…';
      const r = await llmTest({ provider: provSel.value, model: modelIn.value.trim(), api_key: keyIn.value.trim() });
      status.textContent = r.message;
      toast(r.message, r.ok ? 'ok' : 'err');
    },
  }));
  btnRow.appendChild(el('button', {
    class: 'btn sm p', html: '저장',
    onclick: async () => {
      if (!keyIn.value.trim()) { toast('API 키를 입력하십시오.', 'warn'); return; }
      S.llm = { provider: provSel.value, model: modelIn.value.trim(), api_key: keyIn.value.trim(), saved_at: new Date().toISOString() };
      await S.store.putJSON('data/llm.json', S.llm);
      await audit('llm.config', `${provSel.value} · ${modelIn.value.trim()}`);
      toast('AI 엔진 설정이 저장되었습니다. 노트 화면에 [AI 서술 다듬기] 버튼이 나타납니다.', 'ok');
    },
  }));
  btnRow.appendChild(el('button', {
    class: 'btn sm', html: '설정 삭제',
    onclick: async () => {
      if (!await confirmModal('AI 엔진 설정 삭제', 'API 키를 포함한 설정을 삭제할까요?')) return;
      S.llm = null;
      await S.store.remove('data/llm.json');
      toast('삭제되었습니다.', 'ok');
      nav('settings');
    },
  }));
  btnRow.appendChild(status);
  card.appendChild(btnRow);
  card.appendChild(el('div', { class: 'infoBox mt12', html:
    `안전 장치: AI 가 다듬은 문장도 <b>결정론 게이트가 재검증</b>하며, 증거 인용 [E#] 이 바뀌거나
    금지 표현이 유입된 문장은 자동 폐기됩니다. 사실·수치의 원천은 항상 증거원장입니다.<br>
    보관 주의: 키는 <span class="mono">data/llm.json</span> 에 저장됩니다 — 공유폴더 모드에서는 팀 전체가
    공유하고 백업 ZIP 에도 포함됩니다. 회사 발급 키 사용을 권장합니다.` }));
  return card;
}

/** 내 계정 카드 — 모든 사용자 공통 */
function accountCard() {
  const meU = meUser();
  const card = el('div', { class: 'card' });
  card.innerHTML = `<div class="cardH"><div class="cardT">내 계정</div></div>`;
  if (!meU || !meU.pin_hash) {
    card.appendChild(el('div', { class: 'infoBox', style: 'margin-top:0',
      html: '등록된 계정이 없습니다. 이름·이메일·PIN 을 설정하면 서명·감사 기록에 사용됩니다.' }));
    card.appendChild(el('button', { class: 'btn sm p', style: 'margin-top:10px', html: '사용자 등록',
      onclick: () => ensureUserSession() }));
    return card;
  }
  card.innerHTML += `
    <div class="kv"><div class="k">이름</div><div class="v"><b>${esc(meU.name)}</b>${meU.is_admin ? ' <span class="chip">책임 데이터 관리자</span>' : ''}</div></div>
    <div class="kv"><div class="k">이메일</div><div class="v">${esc(meU.email || '—')}</div></div>
    <div class="kv"><div class="k">역할</div><div class="v">${esc(meU.role || '참여연구원')}</div></div>`;
  card.appendChild(el('button', {
    class: 'btn sm', style: 'margin-top:10px', html: 'PIN 변경',
    onclick: async () => {
      if (!await pinConfirm(meU, '현재 PIN 확인')) return;
      const body = el('div');
      const p1 = el('input', { type: 'password', placeholder: '새 PIN (4자리 이상)', style: 'width:100%' });
      const p2 = el('input', { type: 'password', placeholder: '새 PIN 확인', style: 'width:100%;margin-top:8px' });
      body.append(p1, p2);
      const ok = el('button', { class: 'btn p', html: '변경', onclick: async () => {
        if (p1.value.trim().length < 4) { toast('PIN 은 4자리 이상이어야 합니다.', 'warn'); return; }
        if (p1.value !== p2.value) { toast('PIN 확인이 일치하지 않습니다.', 'warn'); return; }
        meU.pin_hash = await sha256(p1.value.trim());
        await S.store.putJSON('data/users.json', S.users);
        await audit('user.pin_change', meU.name);
        closeModal();
        toast('PIN 이 변경되었습니다.', 'ok');
      } });
      openModal({ title: 'PIN 변경', body, foot: [ok] });
    },
  }));
  return card;
}

function renderSettings(c) {
  const wrap = el('div', { class: 'pageW' });
  const p = S.project;

  /* 과제 정보 */
  const info = el('div', { class: 'card' });
  info.innerHTML = `<div class="cardH"><div class="cardT">과제 정보</div></div>
    <div class="row2">
      <div class="fld"><label>과제명</label><input id="stTitle" value="${esc(p.title)}"></div>
      <div class="fld"><label>과제번호</label><input id="stCode" value="${esc(p.project_code)}"></div>
    </div>
    <div class="row2">
      <div class="fld"><label>수행 기관</label><input id="stOrg" value="${esc(p.org_name)}"></div>
      <div class="fld"><label>전문기관/부처</label><input id="stAgency" value="${esc(p.agency || '')}"></div>
    </div>
    <div class="row3">
      <div class="fld"><label>시작일</label><input id="stStart" value="${esc(p.period.start)}"></div>
      <div class="fld"><label>종료일</label><input id="stEnd" value="${esc(p.period.end)}"></div>
      <div class="fld"><label>노트 주기</label><select id="stCadence">
        <option value="biweekly" ${S.planner.cadence === 'biweekly' ? 'selected' : ''}>격주</option>
        <option value="weekly" ${S.planner.cadence === 'weekly' ? 'selected' : ''}>주간</option></select></div>
    </div>`;
  info.appendChild(el('button', {
    class: 'btn p', html: '저장 (기간·주기 변경 시 플래너 재생성)',
    onclick: async () => {
      const start = qs('#stStart').value.trim(), end = qs('#stEnd').value.trim();
      if (!isValidDate(start) || !isValidDate(end) || start >= end) { toast('기간이 유효하지 않습니다.', 'err'); return; }
      const cadence = qs('#stCadence').value;
      const periodChanged = start !== p.period.start || end !== p.period.end || cadence !== S.planner.cadence;
      if (periodChanged && S.notesIndex.notes.length &&
        !await confirmModal('플래너 재생성', '기간/주기 변경 시 스프린트 격자가 재생성됩니다. 이미 작성된 노트는 보존되지만 새 격자와 어긋날 수 있습니다. 계속할까요?')) return;
      p.title = qs('#stTitle').value.trim() || p.title;
      p.project_code = qs('#stCode').value.trim() || p.project_code;
      p.org_name = qs('#stOrg').value.trim();
      p.agency = qs('#stAgency').value.trim();
      const { monthSpan } = await import('../core/util.js');
      p.period = { start, end, months: monthSpan(start, end), source: 'manual' };
      // WP 기간 클립
      for (const w of p.work_packages) {
        if (w.start < start) w.start = start;
        if (w.end > end) w.end = end;
      }
      if (periodChanged) S.planner = buildPlanner(p, cadence);
      const errs = validateSystem({ project: p, planner: S.planner, metrics: S.metrics });
      if (errs.length) { toast('검증 실패: ' + errs[0], 'err'); return; }
      await persistAll();
      await audit('settings.project', '과제 정보 수정');
      toast('저장되었습니다.', 'ok');
      renderShell(); nav('settings');
    },
  }));
  wrap.appendChild(info);

  /* 게이트 모드 */
  const gate = el('div', { class: 'card' });
  gate.innerHTML = `<div class="cardH"><div class="cardT">검증 게이트 모드</div>
    <div class="cardSub">권고: 지적이 있어도 저장하고 「보완 항목」으로 보관 · 필수: 지적 1건이라도 있으면 반려</div></div>`;
  const seg = el('div', { class: 'seg' });
  for (const [v, n] of [['advisory', '권고 (advisory)'], ['strict', '필수 (strict)']]) {
    seg.appendChild(el('button', {
      class: S.config.gates.mode_default === v ? 'on' : '', html: n,
      onclick: async () => {
        S.config.gates.mode_default = v;
        await persistAll(); await audit('settings.gatemode', v);
        toast('게이트 모드: ' + n, 'ok'); nav('settings');
      },
    }));
  }
  gate.appendChild(seg);
  wrap.appendChild(gate);

  /* 지표 관리 */
  const met = el('div', { class: 'card' });
  met.innerHTML = `<div class="cardH"><div class="cardT">지표 카탈로그 · ${S.metrics.catalog.length}건</div></div>
    <div class="tblW"><table class="tbl"><thead><tr><th>지표</th><th>단위</th><th>목표</th><th>방향</th></tr></thead><tbody>
    ${S.metrics.catalog.map(k => `<tr><td>${esc(k.name)}</td><td>${esc(k.unit || '-')}</td><td class="mono">${k.target ?? '-'}</td><td>${k.direction === 'lower' ? '↓' : '↑'}</td></tr>`).join('')}
    </tbody></table></div>`;
  met.appendChild(el('button', {
    class: 'btn sm mt8', html: icon('plus') + '지표 추가',
    onclick: () => {
      const body = el('div');
      const nm = el('input', { placeholder: '지표명' }), un = el('input', { placeholder: '단위 (%, 건…)' }),
        tg = el('input', { placeholder: '목표값 (숫자)' }),
        dr = el('select', { html: '<option value="higher">높을수록 좋음</option><option value="lower">낮을수록 좋음</option>' });
      for (const [lab, elx] of [['지표명', nm], ['단위', un], ['목표값', tg], ['방향', dr]]) {
        body.appendChild(el('div', { class: 'fld' }, [el('label', { html: lab }), elx]));
      }
      openModal({ title: '지표 추가', body, foot: [el('button', {
        class: 'btn p', html: '추가',
        onclick: async () => {
          const name = nm.value.trim();
          if (!name) { toast('지표명을 입력하십시오.', 'warn'); return; }
          let key = name.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '_').replace(/^_+|_+$/g, '') || 'kpi';
          let base = key, i = 2;
          while (S.metrics.catalog.some(k => k.key === key)) key = base + '_' + (i++);
          const t = parseFloat(tg.value);
          S.metrics.catalog.push({ key, name, unit: un.value.trim(), target: Number.isFinite(t) ? t : null, direction: dr.value, source: 'manual' });
          await persistAll(); toast('지표가 추가되었습니다.', 'ok'); closeModal(); nav('settings');
        },
      })] });
    },
  }));
  wrap.appendChild(met);

  /* 사용자 */
  const usersCard = el('div', { class: 'card' });
  usersCard.innerHTML = `<div class="cardH"><div class="cardT">구성원 · ${S.users.users.length}명</div>
    <div class="cardSub">작성자·점검자·승인자 선택에 사용됩니다. 교차 점검·교차 승인 원칙이 적용됩니다.</div></div>
    <div>${S.users.users.map(u => `<span class="chip">${esc(u.name)} · ${esc(u.role)}</span> `).join('')}</div>`;
  usersCard.appendChild(el('button', {
    class: 'btn sm mt8', html: icon('plus') + '구성원 추가',
    onclick: () => {
      const nm = el('input', { placeholder: '이름' }), rl = el('input', { placeholder: '역할 (연구책임자/참여연구원…)' });
      const body = el('div');
      body.appendChild(el('div', { class: 'fld' }, [el('label', { html: '이름' }), nm]));
      body.appendChild(el('div', { class: 'fld' }, [el('label', { html: '역할' }), rl]));
      openModal({ title: '구성원 추가', body, foot: [el('button', {
        class: 'btn p', html: '추가',
        onclick: async () => {
          if (!nm.value.trim()) { toast('이름을 입력하십시오.', 'warn'); return; }
          S.users.users.push({ name: nm.value.trim(), role: rl.value.trim() || '참여연구원', seq: S.users.users.length + 1 });
          await persistAll(); toast('추가되었습니다.', 'ok'); closeModal(); nav('settings');
        },
      })] });
    },
  }));
  wrap.appendChild(usersCard);

  /* 무결성 검증 */
  const integ = el('div', { class: 'card' });
  integ.innerHTML = `<div class="cardH"><div class="cardT">기록 무결성 검증</div>
    <div class="cardSub">확정 노트 전체의 SHA-256 해시 체인을 검증합니다 (감사 대응)</div></div>
    <div id="stChainOut"></div>`;
  integ.appendChild(el('button', {
    class: 'btn', html: icon('shield') + '해시 체인 검증',
    onclick: async () => {
      const sealed = (await sealedNotesList()).filter(n => n.seal_hash)
        .sort((a, b) => (a.signatures.final?.signed_at || '') < (b.signatures.final?.signed_at || '') ? -1 : 1);
      const r = await verifySealChain(sealed);
      qs('#stChainOut').innerHTML = r.ok
        ? `<div class="okBox">체인 무결 — 확정 노트 ${r.checked}건 검증 통과</div>`
        : `<div class="badBox">체인 손상 — ${esc(r.brokenAt)} 에서 ${esc(r.reason)} (검증 ${r.checked}건 후 중단)</div>`;
      await audit('chain.verify', r.ok ? 'OK' : 'BROKEN@' + r.brokenAt);
    },
  }));
  wrap.appendChild(integ);

  /* 내 계정 (모든 사용자) */
  wrap.appendChild(accountCard());

  /* AI 엔진 (LLM) — 자동 집필 서술 다듬기용 (선택) */
  wrap.appendChild(llmCard());

  /* 데이터 관리 — 책임 데이터 관리자 전용 */
  const data = el('div', { class: 'card' });
  data.innerHTML = `<div class="cardH"><div class="cardT">데이터 관리</div>
    <div class="cardSub">백업·복원·초기화 — 책임 데이터 관리자 전용</div></div>`;
  if (!isAdmin()) {
    const adm = adminUser();
    data.appendChild(el('div', { class: 'infoBox', style: 'margin-top:0', html:
      `이 기능은 <b>책임 데이터 관리자</b>${adm ? ` (<b>${esc(adm.name)}</b>)` : ''} 전용입니다. ` +
      `본인이 관리자라면 상단 입력창의 이름이 등록 이름과 같은지 확인하십시오.<br>` +
      `공유폴더 연결·변경은 왼쪽 위 저장소 표시를 클릭하십시오 (모든 사용자 · PC마다 최초 1회).` }));
  } else {
  const dRow = el('div', { class: 'flex', style: 'flex-wrap:wrap' });
  dRow.appendChild(el('button', {
    class: 'btn p', html: icon('download') + '전체 백업 (.zip · 원본 포함)',
    title: '연구노트·증거원장·업로드 원본·아카이브 전체를 파일별 SHA-256 무결성 검증이 내장된 ZIP 으로 내보냅니다. 언제든 받을 수 있습니다.',
    onclick: async () => {
      try { toast('백업 생성 중…', 'ok'); await doZipBackup(); }
      catch (e) { toast('백업 실패: ' + e.message, 'err'); }
    },
  }));
  dRow.appendChild(el('button', {
    class: 'btn', html: icon('download') + '전체 내보내기 (JSON)',
    onclick: async () => {
      const dump = {
        exported_at: new Date().toISOString(), product: 'AAA-RNS 2.0',
        config: S.config, project: S.project, planner: S.planner, metrics: S.metrics,
        users: S.users, notes_index: S.notesIndex, ledger: S.ledger.toJSON(),
        notes: {},
        audit: await S.store.getJSON('data/audit.json'),
      };
      for (const e of S.notesIndex.notes) dump.notes[e.note_id] = await loadNote(e.note_id);
      downloadText(`AAA-RNS_백업_${today()}.json`, JSON.stringify(dump, null, 2), 'application/json');
      await audit('data.export', 'full');
    },
  }));
  dRow.appendChild(el('button', {
    class: 'btn', html: icon('upload') + '백업 복원 (.zip/.json)',
    onclick: async () => {
      if (!await pinConfirm(meUser(), '데이터 관리자 PIN 확인')) return;
      const files = await pickFiles('.zip,.json', false);
      if (!files.length) return;
      try {
        if (files[0].name.toLowerCase().endsWith('.zip')) {
          /* ZIP 백업 — 전 파일 SHA-256 검증 후에만 기록 */
          if (!await confirmModal('백업 복원', '무결성 검증을 통과한 백업으로 현재 데이터를 교체합니다. 계속할까요?')) return;
          const r = await restoreBackupZip(S.store, files[0].bytes);
          await audit('data.restore', `zip · ${r.files}개 파일 · 백업 시점 ${r.exported_at}`);
          toast(`복원 완료 — ${r.files}개 파일 (백업 시점: ${String(r.exported_at).slice(0, 10)})`, 'ok');
          location.reload();
          return;
        }
        const dump = JSON.parse(new TextDecoder().decode(files[0].bytes));
        if (!dump.config || !dump.project) throw new Error('백업 형식이 아닙니다');
        if (!await confirmModal('백업 가져오기', '현재 데이터를 백업 내용으로 교체합니다. 계속할까요?')) return;
        S.config = dump.config; S.project = dump.project; S.planner = dump.planner;
        S.metrics = dump.metrics; S.users = dump.users || { users: [] };
        S.notesIndex = dump.notes_index || { notes: [] };
        S.ledger = new EvidenceLedger(dump.ledger || []);
        S.noteCache.clear();
        await persistAll();
        for (const [id, n] of Object.entries(dump.notes || {})) await S.store.putJSON('notes/' + id + '.json', n);
        toast('가져오기 완료', 'ok'); renderShell(); nav('dashboard');
      } catch (e) { toast('복원 실패: ' + e.message, 'err'); }
    },
  }));
  dRow.appendChild(el('button', {
    class: 'btn danger', html: '시스템 초기화 (재온보딩)',
    onclick: async () => {
      if (!await pinConfirm(meUser(), '데이터 관리자 PIN 확인')) return;
      if (!await confirmModal('시스템 초기화', '모든 로컬 데이터가 삭제되고 온보딩부터 다시 시작합니다. 먼저 [전체 백업]을 권장합니다. 계속할까요?', '초기화')) return;
      const keys = await S.store.list('');
      for (const k of keys) {
        /* 라이선스·귀속 기록은 보존 — 초기화로 1프로젝트 제한을 우회할 수 없다 */
        if (k.startsWith('data/license')) continue;
        await S.store.remove(k);
      }
      S.noteCache.clear();
      toast('초기화되었습니다.', 'ok');
      showOnboarding();
    },
  }));
  /* 백업 알림 주기 */
  const remindRow = el('div', { class: 'flex mt12', style: 'align-items:center;gap:10px' });
  remindRow.appendChild(el('span', { class: 'sm', html: '백업 알림:' }));
  const remindSel = el('select', {
    onchange: async e => {
      S.config.backup_remind = e.target.value;
      await persistAll();
      toast(e.target.value === 'off' ? '백업 알림을 껐습니다. [전체 백업] 버튼으로 언제든 받을 수 있습니다.'
        : '마지막 백업 후 30일이 지나면 대시보드에서 안내합니다.', 'ok');
    },
  });
  remindSel.appendChild(el('option', { value: 'monthly', html: '월 1회 알림 (기본)' }));
  remindSel.appendChild(el('option', { value: 'off', html: '알림 끄기' }));
  remindSel.value = S.config.backup_remind || 'monthly';
  remindRow.appendChild(remindSel);
  data.appendChild(dRow);
  data.appendChild(remindRow);

  /* 책임 데이터 관리자 권한 양도 */
  const transferRow = el('div', { class: 'flex mt12', style: 'align-items:center;gap:10px;flex-wrap:wrap' });
  transferRow.appendChild(el('span', { class: 'sm', html: '권한 양도:' }));
  const candidates = S.users.users.filter(u => !u.is_admin && u.pin_hash);
  const tSel = el('select');
  if (!candidates.length) {
    tSel.appendChild(el('option', { value: '', html: '(양도 가능한 등록 사용자 없음)' }));
    tSel.disabled = true;
  } else {
    for (const u of candidates) tSel.appendChild(el('option', { value: u.name, html: `${u.name} (${u.role || '참여연구원'})` }));
  }
  transferRow.appendChild(tSel);
  transferRow.appendChild(el('button', {
    class: 'btn sm', html: '책임 데이터 관리자 양도',
    onclick: async () => {
      const target = S.users.users.find(u => u.name === tSel.value && u.pin_hash && !u.is_admin);
      if (!target) { toast('양도 대상이 없습니다. 대상자가 먼저 [사용자 등록](이름·PIN)을 마쳐야 합니다.', 'warn'); return; }
      if (!await confirmModal('권한 양도',
        `책임 데이터 관리자 권한을 '${target.name}' 님에게 양도합니다.\n양도 후 본인은 데이터 관리(백업·복원·초기화)를 사용할 수 없습니다. 계속할까요?`, '양도')) return;
      if (!await pinConfirm(meUser(), '현재 관리자 PIN 확인')) return;
      const me = meUser();
      me.is_admin = false;
      if (me.role === '책임 데이터 관리자') me.role = '참여연구원';
      target.is_admin = true;
      target.role = '책임 데이터 관리자';
      await S.store.putJSON('data/users.json', S.users);
      await audit('user.admin_transfer', `${me.name} → ${target.name}`);
      toast(`책임 데이터 관리자 권한이 ${target.name} 님에게 양도되었습니다.`, 'ok');
      nav('settings');
    },
  }));
  transferRow.appendChild(el('span', { class: 'xs mut', html: '대상자는 먼저 사용자 등록(이름·PIN)이 되어 있어야 합니다' }));
  data.appendChild(transferRow);
  } // isAdmin
  data.appendChild(el('div', { class: 'infoBox mt12', html:
    `현재 저장소: <b>${S.storeKind === 'fs' ? '공유폴더 (File System Access)' : '브라우저 로컬 (localStorage)'}</b> — ` +
    `공유폴더에 연결하면 팀원과 같은 기록을 공유할 수 있습니다. 실제 접근 통제는 폴더 공유 설정으로 수행하십시오.<br><br>` +
    `<b>저장 구조</b> — <span class="mono">data/</span> 과제·플래너·지표·감사로그 · ` +
    `<span class="mono">notes/</span> 연구노트 · <span class="mono">notes_files/</span> 업로드 원본 · ` +
    `<span class="mono">ledger/</span> 증거원장 · <span class="mono">archive/</span> 확정 노트 영구 보관본(연도별, 확정 시 자동 생성).<br>` +
    `확정 노트는 SHA-256 해시 체인으로 연결되어 사후 변조가 탐지되며, 아카이브는 앱이 다시 쓰지 않는 일방향 보관본입니다. ` +
    `백업은 <b>언제든</b> [전체 백업 (.zip)] 으로 받을 수 있고, 마지막 백업 후 30일이 지나면 월 1회 알림으로 안내합니다.` }));
  wrap.appendChild(data);

  /* 서명 · 시점인증 */
  const sig = el('div', { class: 'card' });
  sig.innerHTML = `<div class="cardH"><div class="cardT">서명 · 시점인증</div></div>
    <div class="cardSub">기기 키(기본)와 패스키(선택)로 서명을 키에 결박하고, 확정 시각을 공인 TSA 에 고정합니다</div>`;
  const me2 = meUser();
  const sigBody = el('div');
  sig.appendChild(sigBody);
  (async () => {
    /* A. 기기 키 — 이 브라우저 프로필의 서명 키 */
    const dk = me2 ? await deviceKeyInfo(me2.name) : null;
    const dkRow = el('div', { class: 'kv' });
    if (dk) {
      const fp = await keyFingerprint(dk.pubJwk);
      dkRow.innerHTML = `<div class="k">기기 키</div>
        <div class="v">생성됨 · 키 지문 <span class="mono">${esc(fp)}</span>
        <div class="sm mut">개인키는 이 브라우저 프로필 밖으로 나갈 수 없습니다(추출 불가). 다른 기기에서는 그 기기의 키가 새로 만들어집니다.</div></div>`;
    } else {
      dkRow.innerHTML = `<div class="k">기기 키</div><div class="v">없음</div>`;
      const mk = el('button', { class: 'btn sm', html: '기기 키 만들기', onclick: async () => {
        try {
          const { pubJwk } = await ensureDeviceKey(me2.name);
          const fp = await keyFingerprint(pubJwk);
          me2.device_keys = me2.device_keys || [];
          if (!me2.device_keys.some(k => k.fp === fp)) me2.device_keys.push({ pub_jwk: pubJwk, fp, created_at: new Date().toISOString() });
          await S.store.putJSON('data/users.json', S.users);
          await audit('user.device_key', `${me2.name} · ${fp}`);
          toast('기기 키가 생성되었습니다. 이후 서명에 자동 사용됩니다.', 'ok');
          nav('settings');
        } catch (e) { toast('기기 키 생성 실패: ' + e.message, 'err'); }
      } });
      dkRow.querySelector('.v').appendChild(mk);
    }
    sigBody.appendChild(dkRow);

    /* B. 패스키 — 생체/기기 PIN 이 개입하는 2요소 서명 */
    const pkRow = el('div', { class: 'kv' });
    if (me2 && me2.passkey) {
      pkRow.innerHTML = `<div class="k">패스키</div>
        <div class="v">등록됨 (${esc((me2.passkey.enrolled_at || '').slice(0, 10))})</div>`;
      const tgl = el('label', { class: 'sm', style: 'display:block;margin-top:6px' });
      const cb = el('input', { type: 'checkbox' });
      cb.checked = !!me2.passkey_sign;
      cb.onchange = async () => {
        me2.passkey_sign = cb.checked;
        await S.store.putJSON('data/users.json', S.users);
        toast(cb.checked ? '서명 시 패스키를 요구합니다.' : '패스키 요구를 껐습니다.', 'ok');
      };
      tgl.append(cb, ' 서명할 때마다 패스키(생체/기기 PIN) 확인을 요구');
      pkRow.querySelector('.v').appendChild(tgl);
    } else {
      pkRow.innerHTML = `<div class="k">패스키</div><div class="v">미등록 <span class="sm mut">— Touch ID 등 플랫폼 인증기가 서명마다 개입합니다 (선택)</span></div>`;
      if (me2) {
        const en = el('button', { class: 'btn sm', html: '패스키 등록', onclick: async () => {
          try {
            me2.passkey = await enrollPasskey(me2.name);
            me2.passkey_sign = true;
            await S.store.putJSON('data/users.json', S.users);
            await audit('user.passkey', me2.name);
            toast('패스키가 등록되었습니다. 서명 시 확인을 요구합니다.', 'ok');
            nav('settings');
          } catch (e) { toast('패스키 등록 실패 또는 취소: ' + e.message, 'err'); }
        } });
        pkRow.querySelector('.v').appendChild(en);
      }
    }
    sigBody.appendChild(pkRow);

    /* C. 시점인증 — 설치본 전체 정책이므로 책임 데이터 관리자만 변경 */
    const tsOn = !!(S.config.timestamp && S.config.timestamp.enabled);
    const tsRow = el('div', { class: 'kv' });
    tsRow.innerHTML = `<div class="k">시점인증 (RFC-3161)</div><div class="v"></div>`;
    const tsV = tsRow.querySelector('.v');
    const tsl = el('label', { class: 'sm', style: 'display:block' });
    const tcb = el('input', { type: 'checkbox' });
    tcb.checked = tsOn;
    tcb.disabled = !isAdmin();
    tcb.onchange = async () => {
      S.config.timestamp = { enabled: tcb.checked, tsa_url: (S.config.timestamp && S.config.timestamp.tsa_url) || DEFAULT_TSA };
      await S.store.putJSON('data/config.json', S.config);
      await audit('config.timestamp', tcb.checked ? `켬 · ${S.config.timestamp.tsa_url}` : '끔');
      toast(tcb.checked ? '시점인증을 켰습니다. 확정 시 봉인 해시만 TSA 로 전송됩니다.' : '시점인증을 껐습니다.', 'ok');
    };
    tsl.append(tcb, ` 확정 시 공인 TSA 의 시점인증 토큰을 받아 노트에 부착 (기본 꺼짐)`);
    tsV.appendChild(tsl);
    tsV.appendChild(el('div', { class: 'sm mut', style: 'margin-top:6px', html:
      `TSA: <span class="mono">${esc((S.config.timestamp && S.config.timestamp.tsa_url) || DEFAULT_TSA)}</span><br>` +
      '전송되는 것은 봉인 해시 32바이트뿐입니다 — 본문·제목·이름은 나가지 않습니다. ' +
      '오프라인이면 로컬 시계로 조용히 강등되며, 확정을 막지 않습니다.' +
      (isAdmin() ? '' : '<br>변경은 책임 데이터 관리자만 할 수 있습니다.') }));
    sigBody.appendChild(tsRow);
  })();
  wrap.appendChild(sig);

  /* 제품 정보 */
  const about = el('div', { class: 'card' });
  about.innerHTML = `<div class="cardH"><div class="cardT">제품 정보</div></div>
    <div class="kv"><div class="k">제품</div><div class="v">AAA-RNS — AI Agent-driven Autonomous Research Notebook System</div></div>
    <div class="kv"><div class="k">버전</div><div class="v mono">v${APP_VERSION} (${BUILD_DATE})</div></div>
    <div class="kv"><div class="k">개발자</div><div class="v">Developed by <b>Seung Ho Jung</b> — 설계·엔진·검증 전체</div></div>
    <div class="kv"><div class="k">라이선스</div><div class="v">Apache License 2.0 © 2026 Seung Ho Jung</div></div>
    <div class="kv"><div class="k">사용 허가</div><div class="v">${S.license && S.license.ok
      ? (S.license.payload.edition === 'community'
          ? '커뮤니티 에디션 — 등록 키 없이 사용, 프로젝트 수 제한 없음'
          : `<b>${esc(S.license.payload.licensee)}</b> · 키 <span class="mono">${esc(S.license.license_id)}</span> · 프로젝트 ${S.license.payload.max_projects}개 한정${S.license.payload.expires ? ' · 만료 ' + esc(S.license.payload.expires) : ''}`)
      : '미등록'}</div></div>
    <div class="kv"><div class="k">검증</div><div class="v">시뮬레이션 ${VERIFY_CYCLES}사이클 · 총 ${VERIFY_RUNS.toLocaleString('en-US')}회 통과</div></div>`;
  wrap.appendChild(about);

  c.appendChild(wrap);
}

async function connectFolder() {
  if (!window.showDirectoryPicker) {
    toast('이 브라우저는 폴더 연결을 지원하지 않습니다. Chrome 또는 Edge 를 사용하십시오.', 'err');
    return;
  }
  try {
    const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
    const fs = new FsStore(dir);
    S.storeName = dir.name;
    // 쓰기 시험
    await fs.putJSON('data/_write_test.json', { at: new Date().toISOString() });
    await fs.remove('data/_write_test.json');
    // 기존 데이터 이전 (폴더가 비어 있으면)
    const existing = await fs.getJSON('data/config.json');
    if (!existing && S.config) {
      const old = S.store;
      S.store = fs; S.storeKind = 'fs';
      await persistAll();
      for (const e of S.notesIndex.notes) {
        const n = await old.getJSON('notes/' + e.note_id + '.json');
        if (n) await fs.putJSON('notes/' + e.note_id + '.json', n);
      }
      toast('공유폴더로 이전 완료 — 이제 이 폴더가 기록 저장소입니다.', 'ok');
    } else if (existing) {
      if (!await confirmModal('기존 기록 발견', '선택한 폴더에 기존 시스템 기록이 있습니다. 그 기록을 불러올까요? (현재 로컬 데이터는 유지되지만 화면은 폴더 기록으로 전환됩니다)')) return;
      S.store = fs; S.storeKind = 'fs'; S.noteCache.clear();
      await boot();
      toast('공유폴더 기록을 불러왔습니다.', 'ok');
      return;
    } else {
      S.store = fs; S.storeKind = 'fs';
      toast('공유폴더가 연결되었습니다.', 'ok');
    }
    await audit('storage.connect', 'fs · ' + (S.storeName || ''));
    renderShell();
    nav('settings');
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    toast('폴더 연결 실패: ' + e.message, 'err');
  }
}

/* ── 시작 ── */
boot();
