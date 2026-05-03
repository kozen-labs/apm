# skill — shorthand for 'apm --type skill' (Windows PowerShell)
# Delegates to bin/apm.ps1, inserting --type skill after each subcommand.
#
# Examples
#   .\bin\skill.ps1 list
#   .\bin\skill.ps1 --provider claude --scope global install
#   .\bin\skill.ps1 --provider claude --scope global install ks-devops
#   .\bin\skill.ps1 status

param([Parameter(ValueFromRemainingArguments = $true)] [string[]]$Arguments)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SubCmds   = @('install','uninstall','list','status','outdated','init')

# Inject --type skill immediately after the subcommand token.
$Rewritten    = [System.Collections.Generic.List[string]]::new()
$TypeInjected = $false

foreach ($arg in $Arguments) {
    $Rewritten.Add($arg)
    if (-not $TypeInjected -and $SubCmds -contains $arg) {
        $Rewritten.Add('--type')
        $Rewritten.Add('skill')
        $TypeInjected = $true
    }
}

& "$ScriptDir\apm.ps1" @Rewritten
exit $LASTEXITCODE
