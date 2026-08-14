/* ════════════════════════════════════════════════════════════════
 * AAA-RNS · i18n/i18n.js
 * Developed by Seung Ho Jung · v2.0 · Apache-2.0 © 2026
 * 다국어 런타임 — 한국어 · English · 日本語
 *
 * 설계 근거 (기존 코드를 다시 쓰지 않는 후행 국제화):
 *  · 소스의 원문(한국어)이 곧 사전의 키다 — 키 관리 비용이 없고,
 *    한국어 모드에서는 사전을 거치지 않아 성능·정확도 손실이 0이다.
 *  · 화면이 그려진 뒤 DOM 을 순회하며 텍스트·placeholder·title 을
 *    치환한다. 모달·토스트처럼 나중에 삽입되는 요소는
 *    MutationObserver 가 잡아 같은 규칙을 적용한다.
 *  · 회사 데이터(과제명·기관명·사람 이름·증거 원문)는 번역하지 않는다.
 *    기록의 원본성이 제품의 핵심이므로, 사전에 없는 문구는 그대로 둔다.
 *  · 숫자·날짜가 낀 동적 문구는 패턴 사전(PATTERNS)으로 처리한다.
 * ════════════════════════════════════════════════════════════════ */

import { DICT, PATTERNS, INLINE_PATTERNS } from './dict.js';

export const LANGS = [
  { id: 'ko', label: '한국어', htmlLang: 'ko' },
  { id: 'en', label: 'English', htmlLang: 'en' },
  { id: 'ja', label: '日本語', htmlLang: 'ja' },
];

let LANG = 'ko';
let observer = null;

export function getLang() { return LANG; }

/** 문구 하나를 현재 언어로 (사전에 없으면 원문 유지 — 회사 데이터 보호) */
export function t(ko) {
  if (LANG === 'ko') return ko;
  const s = String(ko);
  const key = s.trim();
  if (!key) return s;
  const hit = DICT[key];
  if (hit && hit[LANG]) return s.replace(key, hit[LANG]);
  for (const p of PATTERNS) {
    const m = key.match(p.re);
    if (m) {
      const out = p[LANG].replace(/\$(\d)/g, (_, i) => m[+i] ?? '');
      return s.replace(key, out);
    }
  }
  /* 폴백 — 회사 데이터와 UI 용어가 한 덩어리로 섞인 경우(예: "홍길동 · 책임 데이터 관리자")
     부분 치환한다. 오치환 방지를 위해 4자 이상 용어만, 긴 것부터 적용한다. */
  let out = s, changed = false;
  /* ① 인라인 패턴을 먼저 적용한다.
     "스프린트 57개" 같은 복합 표현은 부분 치환이 '스프린트'만 먼저 바꾸면
     패턴이 더 이상 일치하지 않아 "スプリント 57개" 처럼 반쪽만 번역된다. */
  for (const p of INLINE_PATTERNS) {
    p.re.lastIndex = 0;
    if (p.re.test(out)) {
      p.re.lastIndex = 0;
      out = out.replace(p.re, (...a) => p[LANG].replace(/\$(\d)/g, (_, i) => a[+i] ?? ''));
      changed = true;
    }
    p.re.lastIndex = 0;
  }
  /* ② 남은 용어를 부분 치환 (긴 키 우선) */
  for (const term of PARTIAL_KEYS) {
    if (out.includes(term)) {
      const tr = DICT[term][LANG];
      if (tr) { out = out.split(term).join(tr); changed = true; }
    }
  }
  if (!changed) recordMiss(s);
  return changed ? out : s;
}

/* ── 번역 누락 계측 (개발 전용) ──
 * localStorage.aaarns_i18n_debug = '1' 일 때만 동작한다. 화면에 실제로
 * 나타난 미번역 문구를 그대로 수집하므로, 소스 정적 분석으로는 알 수 없는
 * "연결로 완성되는 문장"까지 정확히 잡힌다. 평상시에는 아무 일도 하지 않는다. */
function recordMiss(s) {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem('aaarns_i18n_debug') !== '1') return;
  (window.__i18nMiss ||= new Set()).add(String(s).replace(/\s+/g, ' ').trim());
}

/* 부분 치환 후보 — 4자 이상 한국어 키, 긴 것 우선.
 * 완결 문장(마침표·… 로 끝나는 키)도 포함한다: 로그 줄처럼
 * "[A5 시점판별] 추출값 확인을 …합니다." 앞에 접두어가 붙는 경우,
 * 문장 키를 제외하면 영영 번역되지 않기 때문이다. 긴 키를 먼저
 * 적용하므로 짧은 키가 문장을 잘라먹는 일은 없다. */
const PARTIAL_KEYS = Object.keys(DICT)
  .filter(k => k.length >= 4 && /[가-힣]/.test(k))
  .sort((a, b) => b.length - a.length);

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);
const hasKo = s => /[가-힣]/.test(s);

/** DOM 전체를 현재 언어로 치환 (한국어 모드는 아무것도 하지 않음) */
export function translateDOM(root = document.body) {
  if (LANG === 'ko' || !root) return;
  /* ① 텍스트 노드 */
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || !hasKo(n.nodeValue)) return NodeFilter.FILTER_REJECT;
      if (n.parentElement && SKIP_TAGS.has(n.parentElement.tagName)) return NodeFilter.FILTER_REJECT;
      if (n.parentElement && n.parentElement.closest('[data-no-i18n]')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const texts = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n);
  for (const n of texts) {
    const out = t(n.nodeValue);
    if (out !== n.nodeValue) n.nodeValue = out;
  }
  /* ② 속성 (placeholder·title·value·aria-label) */
  const els = root.querySelectorAll('[placeholder], [title], [aria-label], input[type="button"], input[type="submit"]');
  for (const el of els) {
    if (el.closest('[data-no-i18n]')) continue;
    for (const attr of ['placeholder', 'title', 'aria-label']) {
      const v = el.getAttribute(attr);
      if (v && hasKo(v)) el.setAttribute(attr, t(v));
    }
    if (el.tagName === 'INPUT' && /button|submit/i.test(el.type) && hasKo(el.value)) el.value = t(el.value);
  }
  /* ③ select 의 option (textContent 는 ①이 처리하지만 안전망) */
  for (const opt of root.querySelectorAll('option')) {
    if (hasKo(opt.textContent) && !opt.closest('[data-no-i18n]')) {
      const out = t(opt.textContent);
      if (out !== opt.textContent) opt.textContent = out;
    }
  }
}

/**
 * 문서 제목(<title>).
 *
 * <title> 은 <head> 안에 있어 translateDOM(document.body) 과 MutationObserver
 * 의 범위 밖이다. 그대로 두면 화면은 영어·일본어인데 브라우저 탭·북마크·창
 * 제목만 한국어로 남는다. 사전 치환에 맡기지 않고 언어별 완성 문장을 두는 이유는,
 * 제품명은 부분 일치로 조합해서는 안 되는 고정 표기이기 때문이다.
 */
const DOC_TITLE = {
  ko: 'AI 에이전트 연구노트 자동화 시스템 · AAA-RNS',
  en: 'AI Agent Research Notebook Automation System · AAA-RNS',
  ja: 'AI エージェント研究ノート自動化システム · AAA-RNS',
};

function applyDocTitle() {
  const s = DOC_TITLE[LANG] || DOC_TITLE.ko;
  if (document.title !== s) document.title = s;
}

/** 언어 전환 — 저장 후 즉시 화면 반영 */
export function setLang(id, { rerender } = {}) {
  LANG = LANGS.some(l => l.id === id) ? id : 'ko';
  localStorage.setItem('aaarns_lang', LANG);
  const meta = LANGS.find(l => l.id === LANG);
  document.documentElement.setAttribute('lang', meta.htmlLang);
  document.documentElement.setAttribute('data-lang', LANG);
  applyDocTitle();
  if (typeof rerender === 'function') rerender();   // 한국어 원문으로 다시 그린 뒤
  translateDOM();                                    // 현재 언어로 치환
  startObserver();
}

/** 나중에 삽입되는 요소(모달·토스트·부분 렌더)를 자동 치환 */
function startObserver() {
  if (observer) observer.disconnect();
  if (LANG === 'ko') { observer = null; return; }
  observer = new MutationObserver(muts => {
    for (const m of muts) {
      /* textContent 직접 변경(예: 상단 제목 갱신)도 잡는다 */
      if (m.type === 'characterData' && m.target && hasKo(m.target.nodeValue || '')) {
        const el = m.target.parentElement;
        if (!el || (!SKIP_TAGS.has(el.tagName) && !el.closest('[data-no-i18n]'))) {
          const o = t(m.target.nodeValue);
          if (o !== m.target.nodeValue) m.target.nodeValue = o;
        }
      }
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) translateDOM(node);
        else if (node.nodeType === 3 && hasKo(node.nodeValue)) {
          const out = t(node.nodeValue);
          if (out !== node.nodeValue) node.nodeValue = out;
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

/**
 * 최초 실행 시 언어 결정 — 브라우저(=OS) 언어를 따른다.
 *
 * 왜 자동 감지인가: 첫 화면(설치 등록 인증)부터 읽을 수 있어야 하는데,
 * 저장된 선택이 없다고 한국어로 고정하면 외국 사용자는 언어를 바꿀
 * 방법조차 읽지 못하는 "언어 벽"에 갇힌다. OS 설치 관리자와 웹 표준이
 * 모두 쓰는 방식(로케일 감지 + 첫 화면에서 즉시 변경 가능)을 따른다.
 * 미지원 언어는 국제 공용어인 영어로 보낸다.
 */
function detectLang() {
  const cands = (navigator.languages && navigator.languages.length)
    ? navigator.languages : [navigator.language || ''];
  for (const c of cands) {
    const tag = String(c).toLowerCase();
    if (tag.startsWith('ko')) return 'ko';
    if (tag.startsWith('ja')) return 'ja';
    if (tag.startsWith('en')) return 'en';
  }
  return 'en';
}

/** 부팅 시 언어 결정 — 저장된 선택 우선, 없으면 브라우저 언어 감지 */
export function initLang() {
  const saved = localStorage.getItem('aaarns_lang');
  LANG = LANGS.some(l => l.id === saved) ? saved : detectLang();
  /* 감지 결과도 즉시 저장한다.
     문서 생성기(docgen.dt)는 localStorage 를 직접 읽어 정본 문서·DOCX 의
     라벨 언어를 정하므로, 저장하지 않으면 화면은 영어인데 정본 문서만
     한국어로 나오는 불일치가 생긴다. */
  if (saved !== LANG) localStorage.setItem('aaarns_lang', LANG);
  const meta = LANGS.find(l => l.id === LANG);
  document.documentElement.setAttribute('lang', meta.htmlLang);
  document.documentElement.setAttribute('data-lang', LANG);
  applyDocTitle();
  startObserver();
  return LANG;
}
