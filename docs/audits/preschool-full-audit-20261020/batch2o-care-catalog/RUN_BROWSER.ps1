param([string]$ReuseBuild='', [switch]$BuildOnly)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskStamp=[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
$taskExit=$null
try {
  Set-Location -LiteralPath $taskRoot
  $env:E2E_ENV_FILE='D:\Antigravity\Projects\BELLA SPA ERP\.env.e2e'
  $taskArgs=@('scripts/verify-preschool-care-browser-e2e.cjs','--execute','--catalog-approved')
  if($BuildOnly){$taskArgs+='--build-only'}
  if($ReuseBuild){$taskArgs+=@('--reuse-build',$ReuseBuild)}
  & node @taskArgs
  $taskExit=$LASTEXITCODE
} finally {
  Remove-Item Env:E2E_ENV_FILE -ErrorAction SilentlyContinue
  @{startedAt=$taskStamp;finishedAt=[DateTime]::UtcNow.ToString('o');actualNativeExitCode=$taskExit;productionOperations=$false} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot "execution-exit-$taskStamp.json") -Encoding utf8
}
if($null -eq $taskExit){exit 1}
exit $taskExit
