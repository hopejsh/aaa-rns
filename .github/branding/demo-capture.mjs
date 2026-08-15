/* ════════════════════════════════════════════════════════════════
 * 데모 GIF 용 프레임 촬영
 *
 * 보여줄 이야기 하나: 계획서를 넣으면 과제 구조가 잡히고, 실험일지를
 * 넣으면 노트가 근거와 함께 써지고, 게이트가 검사하고, 두 사람이
 * 서명해야 확정된다.
 *
 * 앱은 클릭 시점에 input 을 동적으로 만들므로 fileChooser 로 받는다.
 *
 * 사용: node demo-frames.mjs <port> <출력폴더> [lang]
 * ════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PORT = process.argv[2] || '8799';
const OUT  = process.argv[3];
const LANG = process.argv[4] || 'en';
const BASE = `http://localhost:${PORT}`;
const DOCS = '/Users/seunghojung/Documents/AAA_Research_Notes_System/가상문서/가상문서_대한정밀화학_RS-2030-38354655';
mkdirSync(OUT, { recursive: true });

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
let n = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--window-size=1280,760', '--force-device-scale-factor=1'],
  defaultViewport: { width: 1280, height: 720 },
});
const page = await browser.newPage();

async function shot(hold = 1) {
  for (let i = 0; i < hold; i++) {
    await page.screenshot({ path: join(OUT, `f${String(n).padStart(4, '0')}.png`) });
    n++;
  }
}
async function film(ms, everyMs = 130) {
  const end = Date.now() + ms;
  while (Date.now() < end) { await shot(); await sleep(everyMs); }
}
async function caption(text) {
  await page.evaluate(t => {
    let el = document.getElementById('__cap');
    if (!el) {
      el = document.createElement('div');
      el.id = '__cap';
      el.style.cssText = `position:fixed;left:0;right:0;bottom:0;z-index:99999;
        background:linear-gradient(transparent,rgba(16,24,34,.95) 45%);color:#fff;
        font:600 22px/1.4 Barlow,-apple-system,'Noto Sans KR','Noto Sans JP',sans-serif;
        padding:56px 34px 24px;text-align:center;letter-spacing:.01em;
        text-shadow:0 2px 12px rgba(0,0,0,.6);pointer-events:none`;
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
}
/** 텍스트로 버튼을 찾아 누른다 */
async function clickText(re, tag = 'button') {
  const els = await page.$$(tag);
  for (const e of els) {
    const t = await page.evaluate(x => (x.innerText || '').trim(), e);
    if (re.test(t)) { await e.click(); return t; }
  }
  return null;
}
/** 클릭이 여는 파일 선택창에 파일을 넣는다 */
async function pickInto(selector, files) {
  const [chooser] = await Promise.all([
    page.waitForFileChooser({ timeout: 8000 }),
    page.click(selector),
  ]);
  await chooser.accept(files);
}

const T = {
  en: { boot:'Unzip, double-click. No server, no cloud account.',
        up:'Upload the project plan — it reads out the structure',
        ex:'Every extracted value carries its source and confidence',
        made:'A sprint grid, one research-note slot per sprint',
        log:'Now drop in the experiment log',
        draft:'Each sentence carries the evidence ID it came from',
        gate:'Four gates run before the note can be sealed',
        seal:'Author signs, a different reviewer approves. Then it is sealed.' },
  ko: { boot:'압축을 풀고 더블클릭 — 서버도 클라우드 계정도 없습니다',
        up:'연구개발계획서를 올리면 과제 구조를 읽어냅니다',
        ex:'추출한 값마다 근거 문서와 신뢰도가 붙습니다',
        made:'스프린트 격자 — 기간마다 연구노트 한 칸',
        log:'이제 실험일지를 넣습니다',
        draft:'모든 문장에 근거가 된 증거번호가 붙습니다',
        gate:'확정 전에 게이트 넷이 검사합니다',
        seal:'작성자가 서명하고 다른 점검자가 승인해야 확정됩니다.' },
}[LANG] || {};

/* ── 초기화 ── */
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(async l => {
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem('aaarns_lang', l);
  for (const db of await indexedDB.databases()) indexedDB.deleteDatabase(db.name);
}, LANG);
await page.goto(BASE, { waitUntil: 'networkidle2' });
await sleep(1500);

/* ① 첫 화면 */
await caption(T.boot); await shot(12);

/* ② 계획서 업로드 */
await caption(T.up);
await pickInto('#obDrop', [join(DOCS, '연구개발계획서.docx'), join(DOCS, '성능지표.xlsx')]);
await film(1800, 140);

/* ③ 분석 */
await clickText(/분석 시작|Start analysis|分析開始/);
await caption(T.ex);
await film(5000, 150);

/* ④ 추출 결과 확인 → 시스템 생성 */
await clickText(/시스템 생성|Create system|システム生成|확인.*완료|Confirm/);
await sleep(600);
await clickText(/시스템 생성|Create system|システム生成/);
await caption(T.made);
await film(3500, 150);

/* ⑤ 시작 설정 — 데모라 최소한만 채우고 넘어간다 */
/* 상단 헤더에도 이름 입력칸이 있다. 문서 전체에서 placeholder 로 찾으면
   모달이 아니라 헤더 칸을 집는다 — 실제로 그렇게 어긋났다. 모달로 범위를 좁힌다. */
const filled = await page.evaluate(() => {
  const modal = [...document.querySelectorAll('.modal, dialog, [class*=modal]')]
    .find(m => m.offsetParent && /Initial setup|시작 설정|開始設定/.test(m.innerText));
  if (!modal) return 'modal-not-found';
  const ins = [...modal.querySelectorAll('input')].filter(i => i.offsetParent);
  const set = (el, v) => { if (!el) return false; el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true })); return true; };
  const text = ins.filter(i => i.type !== 'password');
  const pins = ins.filter(i => i.type === 'password');
  const ok = set(text[0], 'J. Kim') && set(text[1], 'j.kim@example.com')
          && set(pins[0], '2468') && set(pins[1], '2468');
  return ok ? 'ok' : `text=${text.length} pins=${pins.length}`;
});
if (filled !== 'ok') { console.log('  ✗ 시작 설정 입력 실패:', filled); await browser.close(); process.exit(1); }
await sleep(300);
await clickText(/Get started|시작하기|開始/);
await sleep(1400);
if (await page.evaluate(() => /Initial setup|시작 설정|開始設定/.test(document.body.innerText))) {
  console.log('  ✗ 시작 설정 모달이 닫히지 않았습니다 — 중단');
  await browser.close(); process.exit(1);
}
console.log('  ✓ 사용자 등록 완료');

/* ⑥ 노트 편집기로 — capture3.mjs 에서 검증된 경로를 그대로 쓴다.
      사이드바 인덱스 2 = 플래너, 거기서 S01 행을 찾아 올라가며 클릭 */
const ev = (fn, arg) => page.evaluate(fn, arg);
const navIdx = i => ev(n => { const e = [...document.querySelectorAll('.navItem')][n]; if (e) e.click(); }, i);
const clickRe = async re => {
  const bs = await page.$$('button');
  for (const b of bs) { const t = await page.evaluate(x => x.innerText, b); if (re.test(t)) { await b.click(); return true; } }
  return false;
};

await ev(() => localStorage.setItem('aaarns_planview', 'sprint'));
await navIdx(2); await sleep(900);
await ev(() => {
  const l = [...document.querySelectorAll('*')].find(x => x.children.length === 0 && x.textContent.trim() === 'S01');
  let r = l; while (r?.parentElement && !r.parentElement.textContent.includes('S02')) r = r.parentElement; r?.click();
});
await sleep(1600);
await ev(() => {
  const f = (id, v) => { const e = document.querySelector(id); if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); } };
  f('#ndAuthor', 'J. Kim'); f('#ndReviewer', 'S. Park');
});
await sleep(500);
if (!(await page.$('#ndDrop'))) { console.log('  ✗ 노트 편집기에 도달하지 못했습니다 — 중단'); await browser.close(); process.exit(1); }
console.log('  ✓ 노트 편집기 도달');
await shot(6);

/* ⑦ 실험일지·측정데이터 투입 — 앱이 기대하는 drop 이벤트로 */
await caption(T.log);
await ev(async set => {
  const dt = new DataTransfer();
  for (const n of ['실험일지_1주차.txt', '측정데이터.csv']) {
    const r = await fetch(encodeURI(`/가상문서/${set}/${n}`));
    dt.items.add(new File([await r.blob()], n));
  }
  document.querySelector('#ndDrop').dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
}, '가상문서_대한정밀화학_RS-2030-38354655');
await film(2400, 140);

/* ⑧ 자동 집필 */
await ev(() => [...document.querySelectorAll('.modal button')].pop()?.click());
await caption(T.draft);
await film(3800, 140);
await ev(() => { const h = [...document.querySelectorAll('.cardT')].find(n => /^2\./.test(n.textContent)); h?.scrollIntoView({ block:'start', behavior:'smooth' }); });
await film(2200, 140);

/* ⑨ 게이트 */
await caption(T.gate);
await ev(() => { const c = [...document.querySelectorAll('.card')].find(c => /G1/.test(c.textContent)); c?.scrollIntoView({ block:'start', behavior:'smooth' }); });
await film(2600, 140);

/* ⑩ 서명 → 확정 */
await caption(T.seal);
await ev(() => { const c = [...document.querySelectorAll('.card')].find(c => /Contributor|기여자|寄与者/.test(c.textContent));
  const i = c?.querySelector('input'); if (i) { i.value = 'J. Kim'; i.dispatchEvent(new Event('input', { bubbles:true })); } });
await clickRe(/기여자 서명|Contributor Signature|寄与者署名/); await film(1400, 140);
await ev(() => { const c = [...document.querySelectorAll('.card')].find(c => /Contributor|기여자|寄与者/.test(c.textContent));
  const i = c?.querySelector('input'); if (i) { i.value = 'S. Park'; i.dispatchEvent(new Event('input', { bubbles:true })); } });
await clickRe(/최종 승인|Final approval|最終承認/); await sleep(700);
await ev(() => [...document.querySelectorAll('.modal button')].pop()?.click());
await film(3000, 150);

/* 확정 여부는 긍정으로 확인한다.
   앞서 두 번 틀렸다. ① 본문에서 /sealed/ 를 찾다가 화면 다른 곳의
   "…on sealing" 에 걸렸고, ② "승인 버튼이 없음" 으로 바꿨더니 노트가
   아예 집필되지 않아 버튼이 처음부터 없던 경우도 통과했다.
   없음을 근거로 삼는 검사는 조건이 거짓이어도 통과한다. */
const st = await page.evaluate(() => {
  const badge = [...document.querySelectorAll('*')]
    .filter(e => e.children.length === 0)
    .map(e => e.textContent.trim())
    .find(t => /^(Sealed|확정|確定)$/.test(t));
  const doc = document.body.innerText;
  return {
    sealedBadge: badge || null,
    stateRow: /State\s*\n?\s*(Sealed|확정|確定)/.test(doc) || /상태\s*\n?\s*확정/.test(doc),
    citedSentences: (doc.match(/\[E\d+\]/g) || []).length,
    revisionBtn: [...document.querySelectorAll('button')].some(b => /Issue revision|개정판|改訂版/.test(b.innerText)),
  };
});
const sealed = !!st.sealedBadge && st.stateRow && st.citedSentences >= 3 && st.revisionBtn;
console.log(sealed
  ? `  ✓ 확정 확인 — 배지 "${st.sealedBadge}" · 정본 State · 인용 ${st.citedSentences}건 · 개정 버튼`
  : `  ✗ 확정 미확인 — ${JSON.stringify(st)}`);
if (!sealed) { await browser.close(); process.exit(1); }
console.log(`  프레임 ${n}`);
await browser.close();
console.log(`촬영 완료: ${n} 프레임 → ${OUT}`);
