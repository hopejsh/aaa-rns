@echo off
chcp 65001 >nul
rem ══════════════════════════════════════════════════════════════
rem  AI 에이전트 연구노트 자동화 시스템 (AAA-RNS) — 가상 테스트 문서 생성 (Windows)
rem  Developed by Seung Ho Jung · v2.0
rem
rem  실제 문서 없이 시스템을 시험해 볼 수 있도록 가상의 회사·과제
rem  문서 세트를 '가상문서\' 폴더에 생성합니다.
rem  ※ Node.js 가 필요합니다 (https://nodejs.org).
rem ══════════════════════════════════════════════════════════════
cd /d "%~dp0"
echo.
where node >nul 2>nul
if not %errorlevel%==0 (
  echo   Node.js 가 설치되어 있지 않습니다.
  echo   https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하십시오.
  pause
  goto :eof
)
node simulation\make_test_docs.mjs %1
echo.
start "" "가상문서"
pause
