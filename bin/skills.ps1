# install-mongodb-skills.ps1
# Installs the MongoDB Skills Pack into %USERPROFILE%\.claude\skills\ for global
# availability in Claude Code CLI and Claude Desktop on Windows.
#
# Usage:
#   .\scripts\install-mongodb-skills.ps1           # install
#   .\scripts\install-mongodb-skills.ps1 -Uninstall  # remove

param(
    [switch]$Uninstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$SkillsSrc   = Join-Path $ProjectRoot ".agents\skills"
$ManifestSrc = Join-Path $ProjectRoot ".claude\manifest.json"
$SkillsDst   = Join-Path $env:USERPROFILE ".claude\skills"
$SharedSrc   = Join-Path $SkillsSrc "shared"
$SharedDst   = Join-Path $SkillsDst "shared"
$SkillPrefix = "mongodb-"

function Write-Info    { param($msg) Write-Host "  [info]  $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "  [ok]    $msg" -ForegroundColor Green }
function Write-Warn    { param($msg) Write-Host "  [warn]  $msg" -ForegroundColor Yellow }

# ── Uninstall ─────────────────────────────────────────────────────────────────
if ($Uninstall) {
    Write-Host "Removing MongoDB skills from $SkillsDst ..." -ForegroundColor Magenta
    Get-ChildItem -Path $SkillsDst -Directory -Filter "${SkillPrefix}*" -ErrorAction SilentlyContinue | ForEach-Object {
        Remove-Item -Recurse -Force $_.FullName
        Write-Info "Removed $($_.Name)"
    }
    if (Test-Path $SharedDst) {
        Remove-Item -Recurse -Force $SharedDst
        Write-Info "Removed shared/"
    }
    Write-Host "Done." -ForegroundColor Green
    exit 0
}

# ── Install ───────────────────────────────────────────────────────────────────
Write-Host "Installing MongoDB Skills Pack → $SkillsDst" -ForegroundColor Magenta
Write-Host ""

New-Item -ItemType Directory -Force -Path $SkillsDst | Out-Null

# 1. Copy shared references
if (Test-Path $SharedSrc) {
    New-Item -ItemType Directory -Force -Path $SharedDst | Out-Null
    Copy-Item -Recurse -Force "$SharedSrc\*" $SharedDst
    Write-Success "shared/  (docs-map, global-rules, product-matrix)"
}

# 2. Copy each mongodb-* skill directory
$count = 0
Get-ChildItem -Path $SkillsSrc -Directory -Filter "${SkillPrefix}*" | ForEach-Object {
    $skillName = $_.Name
    $dst = Join-Path $SkillsDst $skillName

    if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
    Copy-Item -Recurse -Force $_.FullName $dst

    if (-not (Test-Path (Join-Path $dst "SKILL.md"))) {
        Write-Warn "$skillName — SKILL.md not found, skipping"
        Remove-Item -Recurse -Force $dst
        return
    }

    Write-Success $skillName
    $count++
}

# 3. Copy manifest — strip the source-only "../.agents/skills/" prefix from paths
#    so installed paths resolve correctly relative to %USERPROFILE%\.claude\skills\
if (Test-Path $ManifestSrc) {
    (Get-Content $ManifestSrc -Raw) -replace '"\.\./.agents/skills/', '"' |
        Set-Content (Join-Path $SkillsDst "mongodb-skills-manifest.json") -Encoding UTF8
    Write-Success "manifest.json"
}

Write-Host ""
Write-Host "Installed $count skills to $SkillsDst" -ForegroundColor Green
Write-Host ""
Write-Host "Verify installation:"
Write-Host "  Get-ChildItem $SkillsDst"
Write-Host ""
Write-Host "To uninstall:"
Write-Host "  .\scripts\install-mongodb-skills.ps1 -Uninstall"
