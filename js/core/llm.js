/* ════════════════════════════════════════════════════════════════
 * AAA-RNS · core/llm.js
 * Developed by Seung Ho Jung · v2.0 · Apache-2.0 © 2026
 * LLM 엔진 어댑터 — Claude · Gemini · OpenAI (선택 사항)
 *
 * 시스템은 LLM 없이 완전히 동작한다 (결정론 코어). LLM 을 연결하면
 * A12 집필 에이전트가 자동 초안의 서술을 자연스럽게 다듬는다.
 *
 * 안전 설계 — "거짓을 쓸 수 없는 시스템" 원칙은 LLM 에도 적용된다:
 *   · LLM 출력은 항상 결정론 게이트(G1~G4)로 재검증된다
 *   · 문장의 증거 인용 [E#] 집합이 달라지면 그 문장은 폐기된다
 *   · 금지 표현이 유입되면 그 문장은 폐기된다
 *   · 게이트 통과 상태가 악화되면 전체를 되돌린다 (app.js)
 *
 * 주의: API 키는 data/llm.json 에 저장된다 — 공유폴더 모드에서는
 * 팀 전체가 공유하며 백업 ZIP 에도 포함된다.
 * ════════════════════════════════════════════════════════════════ */

import { FORBIDDEN_PATTERNS } from './gates.js';
import { citationsIn } from './ledger.js';

export const LLM_PROVIDERS = {
  claude: {
    name: 'Anthropic Claude',
    defaultModel: 'claude-sonnet-5',
    keyHint: 'sk-ant-…',
  },
  gemini: {
    name: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    keyHint: 'AIza…',
  },
  openai: {
    name: 'OpenAI (ChatGPT)',
    defaultModel: 'gpt-5-mini',
    keyHint: 'sk-…',
    corsNote: 'OpenAI 는 브라우저 직접 호출을 차단하는 경우가 있습니다(CORS). 실패하면 Claude 또는 Gemini 를 사용하십시오.',
  },
};

/** 공통 채팅 호출 — 텍스트 응답 반환 */
export async function llmChat(cfg, system, user, { maxTokens = 2048, timeoutMs = 60000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    if (cfg.provider === 'claude') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctrl.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.api_key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: cfg.model, max_tokens: maxTokens, system,
          messages: [{ role: 'user', content: user }],
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error && j.error.message ? j.error.message : 'HTTP ' + r.status);
      return (j.content || []).map(c => c.text || '').join('');
    }
    if (cfg.provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.api_key)}`;
      const r = await fetch(url, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: user }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error && j.error.message ? j.error.message : 'HTTP ' + r.status);
      const cand = (j.candidates || [])[0];
      return cand && cand.content ? cand.content.parts.map(p => p.text || '').join('') : '';
    }
    if (cfg.provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.api_key },
        body: JSON.stringify({
          model: cfg.model, max_completion_tokens: maxTokens,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error && j.error.message ? j.error.message : 'HTTP ' + r.status);
      return ((j.choices || [])[0] || {}).message?.content || '';
    }
    throw new Error('알 수 없는 제공자: ' + cfg.provider);
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('응답 시간 초과');
    if (e instanceof TypeError) {
      throw new Error('연결 실패 — 네트워크/CORS 차단' +
        (cfg.provider === 'openai' ? ' (OpenAI 는 브라우저 직접 호출을 차단합니다. Claude/Gemini 를 사용하십시오)' : ''));
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** 연결 테스트 — 키·모델·네트워크가 유효한지 최소 비용으로 확인 */
export async function llmTest(cfg) {
  try {
    const out = await llmChat(cfg, '당신은 연결 테스트 응답기입니다.',
      '연결 확인입니다. "OK" 두 글자만 답하십시오.', { maxTokens: 500, timeoutMs: 20000 });
    return { ok: true, message: `연결 성공 — 응답: ${String(out).trim().slice(0, 40) || '(빈 응답)'}` };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

const A12_SYSTEM = `당신은 전자연구노트 집필 에이전트(A12)입니다. 주어진 문장들을 자연스럽고
전문적인 한국어 연구노트 문체(과거시제 사실 서술)로 다듬으십시오. 절대 규칙:
1. 사실·수치·날짜를 더하거나 빼거나 바꾸지 않는다.
2. 각 문장의 증거 인용 [E#] 을 정확히 그대로 유지한다 (추가·삭제 금지).
3. 추정·전망·과장 표현(보인다, 예상된다, 성공적으로, 약, 아마도 등)을 쓰지 않는다.
4. 출력은 JSON 배열만: [{"i":항목번호,"text":"다듬은 문장"}] — 다른 텍스트 금지.`;

/**
 * 자동 초안 서술 다듬기 (A12 의미론 보강).
 * 반환된 문장은 검증을 통과한 것만 채택된다:
 *  인용 집합 동일 · 금지 표현 없음 · 비어 있지 않음.
 * @returns {{applied:number, rejected:number, sections:object}}
 */
export async function polishNarrative(cfg, note) {
  const items = [];
  for (const key of ['work', 'results', 'interpretation']) {
    (note.sections[key] || []).forEach((ent, idx) => {
      if (ent && ent.text && ent.text.trim()) items.push({ key, idx, text: ent.text });
    });
  }
  if (!items.length) return { applied: 0, rejected: 0 };

  const user = '다음 연구노트 문장들을 다듬으십시오:\n' +
    JSON.stringify(items.map((it, i) => ({ i, text: it.text })), null, 0);
  const raw = await llmChat(cfg, A12_SYSTEM, user, { maxTokens: 4000 });

  let arr;
  try {
    const m = raw.match(/\[[\s\S]*\]/);
    arr = JSON.parse(m ? m[0] : raw);
  } catch { throw new Error('AI 응답을 해석할 수 없습니다 (JSON 아님)'); }

  let applied = 0, rejected = 0;
  for (const out of Array.isArray(arr) ? arr : []) {
    const it = items[out.i];
    const text = String(out.text || '').trim();
    if (!it || !text || text.length < 5) { rejected++; continue; }
    /* 인용 집합 불변 검증 */
    const before = [...citationsIn(it.text)].sort().join(',');
    const after = [...citationsIn(text)].sort().join(',');
    if (before !== after) { rejected++; continue; }
    /* 금지 표현 유입 차단 */
    if (FORBIDDEN_PATTERNS.some(f => f.re.test(text.replace(/\[E\d+\]/g, '')))) { rejected++; continue; }
    note.sections[it.key][it.idx].text = text;
    applied++;
  }
  return { applied, rejected };
}
