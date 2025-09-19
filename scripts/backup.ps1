param(
  [string]$OutDir = "backups"
)

$ErrorActionPreference = 'Stop'

# Ensure output directory exists
if (!(Test-Path $OutDir)) { New-Item -ItemType Directory -Force -Path $OutDir | Out-Null }

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$zipPath = Join-Path $OutDir "site-backup-$timestamp.zip"

# Exclusions (for tar)
$excludes = @(
  '--exclude=.git',
  '--exclude=node_modules',
  '--exclude=.next',
  '--exclude=backups',
  '--exclude=.env',
  '--exclude=.env.local'
)

try {
  tar -a -c -f $zipPath @excludes .
}
catch {
  Write-Warning "tar not available; using Compress-Archive (no excludes)."
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Compress-Archive -Path * -DestinationPath $zipPath -Force
}

Write-Host "Created backup: $zipPath"