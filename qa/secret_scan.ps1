$ErrorActionPreference = 'Stop'

$publicPattern = 'OPENAI_API_KEY\s*=\s*\S+|DISCORD_(BOT_)?TOKEN\s*=\s*\S+|DATABASE_URL\s*=\s*[^\s<>{}]+://[^\s<>{}]+:[^\s<>{}]+@[^\s<>{}]+|https://discord(?:app)?\.com/api/webhooks/[0-9]{10,}/[A-Za-z0-9._-]{20,}|sk-[A-Za-z0-9_-]{20,}'
$historyPattern = 'OPENAI_API_KEY[[:space:]]*=[[:space:]]*[^[:space:]]+|DISCORD_(BOT_)?TOKEN[[:space:]]*=[[:space:]]*[^[:space:]]+|DATABASE_URL[[:space:]]*=[[:space:]]*[^[:space:]]+://[^[:space:]]+:[^[:space:]]+@[^[:space:]]+|https://discord(app)?\.com/api/webhooks/[0-9]{10,}/[A-Za-z0-9._-]{20,}|sk-[A-Za-z0-9_-]{20,}'

# Values are never emitted: both searches return file names only.
$publicHits = @(
  rg -l --hidden --no-ignore `
    --glob '!.git/**' `
    --glob '!.env' `
    --glob '!.env.*' `
    --glob '!node_modules/**' `
    --pcre2 $publicPattern . 2>$null
)

$historyHits = @(
  git rev-list --all | ForEach-Object {
    git grep -I -l -E $historyPattern $_ 2>$null
  } | Sort-Object -Unique
)

$unignoredLocalEnvFiles = New-Object System.Collections.Generic.List[string]
$repositoryRoot = (Get-Location).Path
Get-ChildItem -Force -File -Recurse | Where-Object {
  $_.FullName -notlike "$repositoryRoot\.git\*" -and
  ($_.Name -eq '.env' -or $_.Name -like '.env.*' -or $_.Name -eq '.envrc')
} | ForEach-Object {
  if ($_.Name -eq '.env.example') { return }
  $relativePath = (Resolve-Path -LiteralPath $_.FullName -Relative) -replace '^\.\\', ''
  git check-ignore -q -- $relativePath
  if ($LASTEXITCODE -ne 0) { $unignoredLocalEnvFiles.Add($relativePath) }
}

Write-Output "public_surface_secret_candidate_files=$($publicHits.Count)"
Write-Output "history_secret_candidate_files=$($historyHits.Count)"
Write-Output "unignored_local_env_files=$($unignoredLocalEnvFiles.Count)"

if ($publicHits.Count -gt 0 -or $historyHits.Count -gt 0 -or $unignoredLocalEnvFiles.Count -gt 0) {
  exit 1
}

Write-Output 'secret_scan=PASS'
