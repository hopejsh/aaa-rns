/* ════════════════════════════════════════════════════════════════
 * 버전·검증 수치의 단일 출처 (single source of truth)
 * Developed by Seung Ho Jung
 *
 * 같은 숫자가 40군데에 흩어져 있으면 반드시 어긋난다 — 실제로
 * 「제품 정보」 화면이 2026-08-12 로 만든 빌드라고 표시하는 동안
 * 배포본은 08-14 에 만들어졌고, 검증 횟수도 갱신 전 값이 남아 있었다.
 * 표시용 숫자는 전부 여기서만 읽는다. 빌드 스크립트(tools/make_dist.sh)도
 * 루트 VERSION 파일과 이 값이 일치하는지 검사한 뒤에야 압축한다.
 * ════════════════════════════════════════════════════════════════ */

export const APP_VERSION = '2.0.1';
export const BUILD_DATE = '2026-08-14';

/* 검증 시뮬레이션 누적 — 캠페인 1(12사이클) + 캠페인 2(9사이클).
   simulation/reports/ 의 실제 보고서 합계와 일치해야 하며,
   tools/verify-dist.sh 가 이 값을 보고서에서 재계산해 대조한다. */
export const VERIFY_CYCLES = 21;
export const VERIFY_RUNS = 2446015;
