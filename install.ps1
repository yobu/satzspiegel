# Satzspiegel — Windows install. The same four copies `make install` makes.
#   powershell -ExecutionPolicy Bypass -File install.ps1
# Puts the template, defaults files and filter into Pandoc's user data directory
# (%APPDATA%\pandoc) and the stylesheets and fonts into %LOCALAPPDATA%\satzspiegel,
# and writes the *-local defaults for offline rendering.
$ErrorActionPreference = 'Stop'

$pandoc = Get-Command pandoc -ErrorAction SilentlyContinue
if (-not $pandoc) { Write-Error 'pandoc not found: winget install JohnMacFarlane.Pandoc'; exit 1 }
$dataDir = (& pandoc --version | Select-String '^User data directory: (.*)$').Matches[0].Groups[1].Value.Trim()
if (-not $dataDir) { $dataDir = Join-Path $env:APPDATA 'pandoc' }
$local = Join-Path $env:LOCALAPPDATA 'satzspiegel'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

foreach ($d in 'templates', 'defaults', 'filters') { New-Item -ItemType Directory -Force -Path (Join-Path $dataDir $d) | Out-Null }
New-Item -ItemType Directory -Force -Path (Join-Path $local 'pandoc\review') | Out-Null

Copy-Item (Join-Path $here 'pandoc\templates\satzspiegel.html') (Join-Path $dataDir 'templates')
Copy-Item (Join-Path $here 'pandoc\filters\satzspiegel.lua'), (Join-Path $here 'pandoc\filters\satzspiegel-diagram.lua'), (Join-Path $here 'pandoc\filters\satzspiegel-diagram.LICENSE') (Join-Path $dataDir 'filters')
Copy-Item (Join-Path $here 'satzspiegel.css'), (Join-Path $here 'satzspiegel-code.css'), (Join-Path $here 'fonts.css') $local
if (Test-Path (Join-Path $local 'fonts')) { Remove-Item -Recurse -Force (Join-Path $local 'fonts') }
Copy-Item -Recurse (Join-Path $here 'fonts') (Join-Path $local 'fonts')
Copy-Item (Join-Path $here 'pandoc\review\satzspiegel-review.js'), (Join-Path $here 'pandoc\review\satzspiegel-review.css') (Join-Path $local 'pandoc\review')

$localUrl = ($local -replace '\\', '/') + '/'
foreach ($name in 'satzspiegel', 'satzspiegel-gfm', 'satzspiegel-review', 'satzspiegel-review-light') {
  $src = Join-Path $here "pandoc\defaults\$name.yaml"
  Copy-Item $src (Join-Path $dataDir 'defaults')
  (Get-Content $src -Raw) -replace 'https://yobu\.github\.io/satzspiegel/', $localUrl |
    Set-Content (Join-Path $dataDir "defaults\$name-local.yaml") -NoNewline
}
Write-Host "installed: pandoc -d satzspiegel | -gfm | -review | -review-light, and -local variants of each for offline use"
