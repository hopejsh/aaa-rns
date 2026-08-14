#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  AAA-RNS — 배포 패키지 생성기
#  사용: bash tools/make_dist.sh
#  Developed by Seung Ho Jung
#  결과: dist/AAA-RNS_v<VERSION>.zip  (+ .sha256)
#
#  · 프로그램 파일만 포함 — 회사 기록 데이터(data/·notes/·ledger/·archive/)와
#    개발 잡파일은 제외한다 (프로그램·데이터 분리 원칙)
#  · zip 은 유닉스 실행 권한을 보존하므로 Mac 에서 압축을 풀면
#    start_mac.command 가 바로 더블클릭 실행된다
#
#  이 스크립트는 "만들고 나서 확인"하지 않는다. tools/verify-dist.sh 가
#  금지 경로·비밀·브랜딩을 검사해 실패하면 산출물을 지우고 0이 아닌 값으로
#  끝난다. 눈으로 목록을 훑는 것은 검사가 아니기 때문이다.
# ══════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"

# ── 버전은 루트 VERSION 파일이 단일 출처 ──────────────────────
VERSION="$(tr -d ' \n\r' < VERSION)"
[ -n "$VERSION" ] || { echo "FATAL: VERSION 파일이 비었습니다" >&2; exit 1; }
if ! grep -q "APP_VERSION = '${VERSION}'" js/core/version.js; then
  echo "FATAL: VERSION(${VERSION}) 과 js/core/version.js 가 어긋납니다" >&2; exit 1
fi

NAME="AAA-RNS_v${VERSION%.0}"      # 2.0.0 → AAA-RNS_v2.0
TMP="$(mktemp -d)"
STAGE="${TMP}/${NAME}"
OUT_ABS="${ROOT}/dist/${NAME}.zip"   # 서브셸 진입 전에 절대경로로 고정
mkdir -p "$STAGE" "${ROOT}/dist"
trap 'rm -rf "$TMP"' EXIT

# ── 제외 목록 ────────────────────────────────────────────────
# 모든 경로 제외를 '/' 로 앵커한다. 앵커가 없으면 rsync 는 깊이에 관계없이
# 같은 이름의 디렉터리를 전부 지운다 — 언젠가 js/help/docs/ 를 만드는 날
# 조용히 사라지고, 종료코드는 0 이며, "생성 완료" 가 찍힌다.
rsync -a \
  --exclude '/dist' --exclude '/tools' --exclude '/.git' --exclude '/.github' \
  --exclude '/data' --exclude '/notes' --exclude '/notes_files' \
  --exclude '/ledger' --exclude '/archive' --exclude '/exports' \
  --exclude '/_INBOX' --exclude '/_REVIEW' --exclude '/.claude' \
  --exclude '/docs' --exclude '/assets' \
  --exclude '/.gitignore' --exclude '/.gitattributes' \
  --exclude '/CONTRIBUTING.md' --exclude '/CODE_OF_CONDUCT.md' \
  --exclude '/SUPPORT.md' --exclude '/CITATION.cff' \
  --exclude '/.zenodo.json' --exclude '/codemeta.json' \
  --exclude '.DS_Store' --exclude '._*' --exclude '*.lic' \
  --exclude 'license_keys*.json' --exclude 'node_modules' \
  ./ "$STAGE/"

# 가상문서 폴더는 macOS 의 NFC/NFD 정규화 차이로 이름 매칭이 어긋날 수 있어
# 이름이 아니라 "저장소 루트의 디렉터리" 라는 사실로 지운다.
find "$STAGE" -maxdepth 1 -type d ! -path "$STAGE" -exec sh -c '
  for d; do case "$(basename "$d")" in *문서) rm -rf "$d";; esac; done' _ {} +

# 배포 원칙: 실행에 직접 필요한 파일만 넣는다.
#  · docs/ (가이드 PDF·교육 자료·설명서) 는 통째로 제외 — GitHub 저장소에서
#    필요한 언어만 받도록 안내한다 (설치안내.txt 참조).
#  · .gitignore/.gitattributes 도 제외 — 최종 사용자에게 의미가 없다.

chmod 0755 "$STAGE/start_mac.command" "$STAGE/server.py"
# set -e 아래에서 glob 이 아무것도 못 맞히면 [ -e ] 가 1 을 돌려주며 빌드가
# 통째로 죽는다. 파일명이 한글이라 러너의 로케일·정규화에 따라 실제로 일어날
# 수 있으므로, 존재 여부를 조건이 아니라 find 로 다룬다.
find "$STAGE" -maxdepth 1 -name '*.command' -exec chmod 0755 {} +

# ── 결정론적 압축 ───────────────────────────────────────────
# 비결정성의 원인 두 가지를 제거한다.
#  ① mtime — zip -X 는 uid/gid 는 버리지만 항목별 mtime 은 남긴다.
#  ② 항목 순서 — zip -r 은 디렉터리를 읽은 순서대로 담으므로 파일시스템에
#     따라 순서가 달라진다. 목록을 정렬해 표준입력으로 넘긴다.
#
# 정직한 한계: 이렇게 해도 **플랫폼이 다르면 해시가 달라진다.** 실제로
# 확인했다 — 이 스크립트가 만든 macOS 빌드와 GitHub Actions(Ubuntu)
# 빌드의 SHA-256 이 서로 다르다. Info-ZIP 구현과 zlib 판이 다르면 같은
# 입력에서도 압축 바이트가 달라지기 때문이며, 위 두 가지로는 해소되지
# 않는다. 따라서 보장하는 것은 "같은 환경에서 다시 빌드하면 같은 바이트"
# 까지다. 내려받은 파일의 진위는 함께 배포하는 .sha256 으로 확인한다.
find "$STAGE" -exec touch -t 202601010000 {} +

rm -f "$OUT_ABS"
( cd "$TMP" && find "$NAME" -print | LC_ALL=C sort | zip -X -q -@ "$OUT_ABS" )

# ── 나가기 전 검사 ───────────────────────────────────────────
if ! bash "${ROOT}/tools/verify-dist.sh" "$OUT_ABS"; then
  rm -f "$OUT_ABS"
  echo "FATAL: 검사 실패 — 배포본을 삭제했습니다." >&2
  exit 1
fi

( cd "${ROOT}/dist" && shasum -a 256 "$(basename "$OUT_ABS")" > "$(basename "$OUT_ABS").sha256" )

echo
echo "생성 완료: dist/$(basename "$OUT_ABS") ($(du -h "$OUT_ABS" | cut -f1 | tr -d ' '))"
echo "SHA-256  : $(cut -d' ' -f1 < "${OUT_ABS}.sha256")"
echo "파일 수  : $(unzip -Z1 "$OUT_ABS" | grep -vc '/$')"
