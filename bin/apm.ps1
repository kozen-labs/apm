# apm — Agent Package Manager
# Requires Node.js 18+ on PATH.

param([Parameter(ValueFromRemainingArguments = $true)] [string[]]$Arguments)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$DistEntry   = Join-Path $ProjectRoot "dist\cli\index.js"
$SrcEntry    = Join-Path $ProjectRoot "src\cli\index.ts"

# ── locate Node.js ─────────────────────────────────────────────────────────
$NodeCmd = $null
foreach ($candidate in @("node", "nodejs")) {
    try {
        $ver = & $candidate --version 2>&1
        if ($ver -match "v(\d+)") {
            if ([int]$Matches[1] -ge 18) { $NodeCmd = $candidate; break }
        }
    } catch { }
}

if (-not $NodeCmd) {
    Write-Host "[error] Node.js 18+ not found. Install Node.js and ensure it is on your PATH." -ForegroundColor Red
    exit 1
}

# ── run ────────────────────────────────────────────────────────────────────
if (Test-Path $DistEntry) {
    & $NodeCmd $DistEntry @Arguments
    exit $LASTEXITCODE
}

$npx = Get-Command npx -ErrorAction SilentlyContinue
if ($npx -and (Test-Path $SrcEntry)) {
    & npx ts-node $SrcEntry @Arguments
    exit $LASTEXITCODE
}

Write-Host "[error] Run 'npm run build' first to compile the TypeScript source." -ForegroundColor Red
exit 1
