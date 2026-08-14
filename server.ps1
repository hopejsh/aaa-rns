# ══════════════════════════════════════════════════════════════
#  AAA-RNS — local web server (Windows fallback).
#  Developed by Seung Ho Jung, v2.0
#
#  For PCs without Python. PowerShell ships with every Windows
#  installation, so nothing needs to be installed.
#
#  Console output is English-only ASCII on purpose: the Windows
#  console cannot be relied on to render CJK text. The application
#  UI itself is multilingual (Korean / English / Japanese).
#
#  Why a server is needed:
#  Browsers grant folder access (File System Access API) only over
#  https or localhost. Opening index.html directly as file:// cannot
#  connect a shared folder.
#
#  Why Cache-Control: no-store:
#  It prevents the browser from running a stale cached copy after the
#  program files are updated.
# ══════════════════════════════════════════════════════════════
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = if ($args.Count -ge 1) { [int]$args[0] } else { 8777 }

$mime = @{
  '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8'
  '.js'='text/javascript; charset=utf-8'; '.mjs'='text/javascript; charset=utf-8'
  '.css'='text/css; charset=utf-8'
  '.json'='application/json; charset=utf-8'; '.md'='text/plain; charset=utf-8'
  '.txt'='text/plain; charset=utf-8'; '.csv'='text/csv; charset=utf-8'
  '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'
  '.gif'='image/gif'; '.svg'='image/svg+xml'; '.ico'='image/x-icon'
  '.pdf'='application/pdf'
  '.docx'='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  '.xlsx'='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  '.hwpx'='application/hwp+zip'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try { $listener.Start() }
catch {
  Write-Host ""
  Write-Host "  [X] Cannot open port $port." -ForegroundColor Red
  Write-Host "      Another instance may already be running."
  Write-Host ""
  Read-Host "  Press Enter to close"
  exit 1
}

Write-Host ""
Write-Host "  +----------------------------------------------------+" -ForegroundColor Cyan
Write-Host "  |  AAA-RNS  Research Notebook Automation System       |" -ForegroundColor Cyan
Write-Host "  |  v2.0  -  Developed by Seung Ho Jung                |" -ForegroundColor Cyan
Write-Host "  +----------------------------------------------------+" -ForegroundColor Cyan
Write-Host "  Folder : $root"
Write-Host "  Address: http://localhost:$port"
Write-Host ""
Write-Host "  * Keep this window open. Closing it shuts the system down." -ForegroundColor Yellow
Write-Host "  * Shared-folder connection works in Chrome / Edge only." -ForegroundColor Yellow
Write-Host "  * Language (Korean / English / Japanese) is selected in the app."
Write-Host ""

# Prefer Chrome/Edge: the folder-access feature works only in these.
$candidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if ($candidates) {
  Start-Process $candidates "http://localhost:$port"
} else {
  Write-Host "  ! Chrome/Edge not found - opening the default browser." -ForegroundColor Yellow
  Start-Process "http://localhost:$port"
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($rel -eq '/') { $rel = '/index.html' }

    # Block path traversal above the program folder.
    $target = Join-Path $root ($rel.TrimStart('/') -replace '/','\')
    $full = [System.IO.Path]::GetFullPath($target)
    $rootFull = [System.IO.Path]::GetFullPath($root)

    if (-not $full.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
      $ctx.Response.StatusCode = 403
    }
    elseif (Test-Path -LiteralPath $full -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $ctx.Response.ContentType = $(if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' })
      $ctx.Response.Headers.Add('Cache-Control','no-store')
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
  } catch {
    # A single failed request must not stop the server.
  }
}
