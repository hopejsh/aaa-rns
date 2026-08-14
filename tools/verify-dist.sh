#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  AAA-RNS — 배포본 출고 검사 (release gate)
#  사용: bash tools/verify-dist.sh dist/AAA-RNS_v2.0.zip
#  Developed by Seung Ho Jung
#
#  make_dist.sh 가 압축 직후 호출한다. 하나라도 걸리면 0 이 아닌 값으로
#  끝나고, 호출부는 산출물을 지운다.
#
#  왜 별도 스크립트인가: 검사는 빌드와 독립적으로도 돌 수 있어야 한다.
#  이미 배포한 zip, 남이 보내온 zip, CI 가 내려받은 릴리스 자산 모두
#  같은 기준으로 검사할 수 있어야 "이 파일은 정품인가" 에 답할 수 있다.
# ══════════════════════════════════════════════════════════════
set -uo pipefail
ZIP="${1:?사용: verify-dist.sh <zip>}"
[ -f "$ZIP" ] || { echo "FATAL: $ZIP 이 없습니다" >&2; exit 1; }

FAIL=0
say() { printf '  %-46s %s\n' "$1" "$2"; }
bad() { FAIL=1; printf '  %-46s \033[31m실패\033[0m — %s\n' "$1" "$2"; }

LIST="$(unzip -Z1 "$ZIP")"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
unzip -qq "$ZIP" -d "$TMP"
ROOT="$(find "$TMP" -maxdepth 1 -mindepth 1 -type d | head -1)"

echo "── 배포본 검사: $(basename "$ZIP")"

# 1. 금지 경로 ────────────────────────────────────────────────
if echo "$LIST" | grep -qE '(^|/)(data|notes|notes_files|ledger|archive|_INBOX|_REVIEW|exports|docs|tools|dist|node_modules|\.git|\.github|\.claude)/'; then
  bad "금지 경로 미포함" "$(echo "$LIST" | grep -oE '(^|/)(data|notes|ledger|archive|docs|tools)/' | sort -u | tr '\n' ' ')"
else say "금지 경로 미포함" "통과"; fi

# 2. 잡파일 ──────────────────────────────────────────────────
if echo "$LIST" | grep -qE '\.DS_Store$|__MACOSX|/\._|\.gitignore$|\.lic$|license_keys.*\.json$'; then
  bad "잡파일·비밀 파일 미포함" "$(echo "$LIST" | grep -E '\.DS_Store$|__MACOSX|\.gitignore$|\.lic$|license_keys' | head -3 | tr '\n' ' ')"
else say "잡파일·비밀 파일 미포함" "통과"; fi

# 3. 비밀·개발자 경로 ────────────────────────────────────────
HITS="$(grep -rIl -E '(BEGIN [A-Z ]*PRIVATE KEY|sk-ant-[A-Za-z0-9]{20}|AIza[A-Za-z0-9_-]{30}|ghp_[A-Za-z0-9]{30}|/Users/[a-z]+/Documents)' "$ROOT" 2>/dev/null | head -3)"
if [ -n "$HITS" ]; then bad "비밀·개발자 경로 없음" "$(echo "$HITS" | tr '\n' ' ')"
else say "비밀·개발자 경로 없음" "통과"; fi

# 4. 금지 브랜딩 — OOXML 내부까지 ────────────────────────────
BRAND=0
grep -rIq 'AAA-RNS General' "$ROOT" 2>/dev/null && BRAND=1
while IFS= read -r f; do
  unzip -p "$f" '*' 2>/dev/null | grep -aq 'AAA-RNS General' && { BRAND=1; echo "      └ $f"; }
done < <(find "$ROOT" \( -name '*.docx' -o -name '*.xlsx' -o -name '*.pptx' \) 2>/dev/null)
[ "$BRAND" -eq 0 ] && say "금지 브랜딩 없음 (OOXML 포함)" "통과" \
                   || bad "금지 브랜딩 없음 (OOXML 포함)" "'AAA-RNS General' 발견"

# 5. 실행에 필요한 파일이 다 있는가 ──────────────────────────
MISS=""
for f in index.html server.py server.ps1 start_mac.command start_windows.bat \
         css/app.css js/ui/app.js js/core/edition.js js/core/version.js LICENSE NOTICE; do
  [ -f "$ROOT/$f" ] || MISS="$MISS $f"
done
[ -z "$MISS" ] && say "필수 파일 존재" "통과" || bad "필수 파일 존재" "누락:$MISS"

# 6. 모든 import 가 압축본 안에서 풀리는가 ────────────────────
UNRES=0
while IFS= read -r f; do
  while IFS= read -r imp; do
    case "$imp" in
      ./*|../*) [ -f "$(cd "$(dirname "$f")" && cd "$(dirname "$imp")" 2>/dev/null && pwd)/$(basename "$imp")" ] \
                  || { echo "      └ $(basename "$f") → $imp"; UNRES=1; } ;;
    esac
  done < <(grep -oE "from '[^']+'" "$f" 2>/dev/null | sed "s/from '//;s/'//")
done < <(find "$ROOT/js" -name '*.js' 2>/dev/null)
[ "$UNRES" -eq 0 ] && say "모듈 import 전부 해소" "통과" || bad "모듈 import 전부 해소" "미해소 참조 있음"

# 7. 외부 네트워크 참조 ──────────────────────────────────────
CDN="$(grep -rIoE 'https?://[a-z0-9.-]+' "$ROOT" --include='*.html' --include='*.js' --include='*.css' 2>/dev/null \
       | grep -vE 'api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.openai\.com|www\.w3\.org|schemas\.openxmlformats\.org|purl\.org|apache\.org|localhost' \
       | sort -u | head -3)"
[ -z "$CDN" ] && say "CDN·외부 자산 참조 없음" "통과" || bad "CDN·외부 자산 참조 없음" "$(echo "$CDN" | tr '\n' ' ')"

# 8. 실행 권한 ───────────────────────────────────────────────
PERMBAD=""
for f in start_mac.command server.py; do
  [ -x "$ROOT/$f" ] || PERMBAD="$PERMBAD $f"
done
[ -z "$PERMBAD" ] && say "실행 권한 0755" "통과" || bad "실행 권한 0755" "누락:$PERMBAD"

# 9. 개발자 표기 ─────────────────────────────────────────────
N=$(grep -rIl 'Seung Ho Jung' "$ROOT" 2>/dev/null | wc -l | tr -d ' ')
[ "$N" -ge 10 ] && say "개발자 표기 ($N개 파일)" "통과" || bad "개발자 표기" "$N개 파일뿐"

# 10. 라이선스 일관성 ────────────────────────────────────────
if grep -rIq 'MIT License\|MIT ©' "$ROOT" 2>/dev/null; then
  bad "라이선스 표기 일관성" "MIT 잔존 — LICENSE 는 Apache-2.0"
else say "라이선스 표기 일관성 (Apache-2.0)" "통과"; fi

echo
[ "$FAIL" -eq 0 ] && echo "  ✅ 출고 검사 통과" || echo "  ❌ 출고 검사 실패"
exit "$FAIL"
