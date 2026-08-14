/* ════════════════════════════════════════════════════════════════
 * 에디션 — 이 빌드가 설치 등록 인증을 요구하는지 한 곳에서 정한다.
 * Developed by Seung Ho Jung
 *
 * 왜 상수 하나로 가르는가
 * ─────────────────────────────────────────────────────────────
 * 공개 저장소에서 받은 빌드까지 라이선스 키를 요구하면, 방문자는
 * 압축을 풀어도 첫 화면에서 막혀 제품을 한 번도 못 본 채 떠난다.
 * 게다가 소스가 공개된 로컬 앱에서 키 검사는 코드를 고칠 수 있는
 * 사람을 막지 못한다(js/core/license.js 주석 참조) — 즉 통제력은
 * 0에 가깝고 진입 비용은 100%다.
 *
 * 그래서 두 갈래로 나눈다.
 *   community  — 키 없이 즉시 실행. 공개 배포본의 기본값.
 *   enterprise — 서명된 키 + 설치본당 프로젝트 1개 제한. 지인 회사
 *                배포본처럼 발급 대상이 정해진 경우.
 *
 * 검사 로직 자체는 그대로 살아 있다. enterprise 빌드는 이 상수만
 * 바꿔 만들며, 그때 키 게이트와 프로젝트 귀속이 전부 되살아난다.
 * ════════════════════════════════════════════════════════════════ */

export const EDITION = 'community';   // 'community' | 'enterprise'

/** 키 없이 통과하는 커뮤니티 사용권 — 검증 결과와 같은 모양을 갖춘다 */
export const COMMUNITY_LICENSE = Object.freeze({
  ok: true,
  license_id: 'community',
  payload: Object.freeze({
    v: 1,
    licensee: 'Community',
    email: '',
    edition: 'community',
    max_projects: 0,          // 0 = 무제한 (귀속 검사를 건너뛴다)
    issued: null,
    expires: null,
  }),
});

/** 이 사용권이 설치본을 프로젝트 1개로 묶는가 */
export function bindsToOneProject(license) {
  return !!license && license.payload?.edition !== 'community'
    && Number(license.payload?.max_projects) > 0;
}
