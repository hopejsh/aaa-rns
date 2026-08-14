#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  AI 에이전트 연구노트 자동화 시스템 (AAA-RNS) — 가상 테스트 문서 생성 (macOS)
#  Developed by Seung Ho Jung · v2.0
#
#  실제 문서 없이 시스템을 시험해 볼 수 있도록 가상의 회사·과제
#  문서 세트(계획서 DOCX·지표 XLSX·실험일지 TXT·측정 CSV)를
#  '가상문서/' 폴더에 생성합니다. 실행할 때마다 새로운 가상
#  회사가 만들어집니다.
#
#  ※ Node.js 가 필요합니다 (https://nodejs.org).
# ══════════════════════════════════════════════════════════════
cd "$(dirname "$0")"
echo ""
if ! command -v node >/dev/null 2>&1; then
  echo "  ❌ Node.js 가 설치되어 있지 않습니다."
  echo "     https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하십시오."
  echo ""
  read -r -p "  Enter 를 누르면 닫힙니다."; exit 1
fi
node simulation/make_test_docs.mjs "${1:-1}"
echo ""
open "가상문서" 2>/dev/null
read -r -p "  Enter 를 누르면 닫힙니다."
