param(
  [ValidateSet('arrival-diagnostic', 'full')][string]$Mode = 'arrival-diagnostic',
  [ValidateSet('E2E_PREPARE_V2.sql', 'E2E_PREPARE_V3.sql')][string]$Sql = 'E2E_PREPARE_V2.sql',
  [switch]$RetainOnPass
)
$ErrorActionPreference = 'Stop'
if ($Mode -eq 'arrival-diagnostic' -and $RetainOnPass) { throw 'DIAGNOSTIC_RETENTION_FORBIDDEN' }
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskStamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
$taskExit = $null
$taskFailure = $null
try {
  Set-Location -LiteralPath $taskRoot
  $env:E2E_ENV_FILE = 'D:\Antigravity\Projects\BELLA SPA ERP\.env.e2e'
  $taskArgs = @('scripts/verify-preschool-care-rls-e2e.cjs', '--owner-approved-e2e-scope6', '--with-owner-approved-timeline-fk', '--sql', (Join-Path $PSScriptRoot $Sql))
  if ($Mode -eq 'arrival-diagnostic') { $taskArgs += '--arrival-diagnostic' }
  if ($RetainOnPass) { $taskArgs += '--retain-on-pass' }
  & node @taskArgs
  $taskExit = $LASTEXITCODE
} catch { $taskFailure = 'HARNESS_LAUNCH_OR_WRAPPER_FAILURE' }
finally { Remove-Item Env:E2E_ENV_FILE -ErrorAction SilentlyContinue }
$taskReceipt = @{ startedAt = $taskStamp; finishedAt = [DateTime]::UtcNow.ToString('o'); mode = $Mode; sql = $Sql; retainRequested = [bool]$RetainOnPass; actualNativeExitCode = $taskExit; wrapperFailure = $taskFailure }
$taskReceipt | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot "execution-exit-$taskStamp.json") -Encoding utf8
if ($null -eq $taskExit -or $taskFailure) { exit 1 }
exit $taskExit
