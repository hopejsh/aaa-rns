@echo off
rem ══════════════════════════════════════════════════════════════
rem  AAA-RNS — Start (Windows).  Developed by Seung Ho Jung, v2.0
rem  Double-click this file. Nothing to install.
rem
rem  Console output is English-only ASCII on purpose: the Windows
rem  console cannot be relied on to render CJK text (code page and
rem  raster-font limits). The application UI itself is multilingual
rem  (Korean / English / Japanese).
rem
rem  1st choice: Python server (server.py)
rem  2nd choice: PowerShell server (server.ps1) - works without
rem              Python on every Windows installation.
rem ══════════════════════════════════════════════════════════════
cd /d "%~dp0"
set PORT=8777

if not exist index.html (
  echo.
  echo   [X] index.html not found.
  echo       Run this file from the unzipped AAA-RNS folder.
  echo.
  pause
  goto :eof
)

rem The server prints the banner; keep the launcher quiet.
where python >nul 2>nul
if %errorlevel%==0 (
  python server.py %PORT%
  goto :eof
)
where py >nul 2>nul
if %errorlevel%==0 (
  py server.py %PORT%
  goto :eof
)

echo.
echo   Python not found - starting the built-in PowerShell server instead.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" %PORT%
