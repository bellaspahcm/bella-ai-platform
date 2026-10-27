$ErrorActionPreference = 'Stop'
$auditDir = $PSScriptRoot
$workspace = (Resolve-Path (Join-Path $auditDir '..\..\..')).Path
$migration = Join-Path $workspace 'supabase\migrations\20261027120000_temporal_history_tenant_containment.sql'
$report = Join-Path $auditDir 'REPORT.md'
$decision = Join-Path $auditDir 'CONTAINMENT_DECISION_REQUIRED.md'
$requiredPaths = @(
  $migration,
  (Join-Path $auditDir 'containment-anonymous-rest-post-change.json'),
  (Join-Path $auditDir 'containment-behavioral-e2e-rollback.stdout.log'),
  (Join-Path $auditDir 'healthcare-verify-result.json')
)
$missingPaths = @($requiredPaths | Where-Object { -not (Test-Path -LiteralPath $_) })

$jsonPaths = @(
  (Join-Path $auditDir 'FINAL_RESULT.json'),
  (Join-Path $auditDir 'primary-containment-application.json'),
  (Join-Path $auditDir 'healthcare-verify-result.json'),
  (Join-Path $auditDir 'containment-anonymous-rest-post-change.json'),
  (Join-Path $auditDir 'containment-anonymous-rest-post-change.execution.json'),
  (Join-Path $auditDir 'containment-behavioral-e2e-rollback.execution.json'),
  (Join-Path $auditDir 'containment-post-change-table-acl-readonly.execution.json'),
  (Join-Path $auditDir 'containment-post-change-function-acl-readonly.execution.json'),
  (Join-Path $auditDir 'containment-post-change-policies-readonly.execution.json'),
  (Join-Path $auditDir 'containment-post-change-role-membership-readonly.execution.json')
)
$jsonErrors = [System.Collections.Generic.List[string]]::new()
foreach ($path in $jsonPaths) {
  try { Get-Content -LiteralPath $path -Raw | ConvertFrom-Json | Out-Null }
  catch { $jsonErrors.Add([System.IO.Path]::GetFileName($path)) }
}

$textPaths = @(
  $report, $decision, $migration,
  (Join-Path $auditDir 'containment-behavioral-e2e-rollback.sql'),
  (Join-Path $auditDir 'probe-anonymous-rest.ps1'),
  (Join-Path $auditDir 'run-behavioral-e2e-rollback.ps1'),
  (Join-Path $auditDir 'collect-post-change-catalog.ps1')
)
$trailingWhitespace = [System.Collections.Generic.List[string]]::new()
foreach ($path in $textPaths) {
  $lineNo = 0
  foreach ($line in Get-Content -LiteralPath $path) {
    $lineNo++
    if ($line -match '[ \t]+$') { $trailingWhitespace.Add("$([System.IO.Path]::GetFileName($path)):$lineNo") }
  }
}

$linkTargets = @(
  (Join-Path $auditDir 'CONTAINMENT_DECISION_REQUIRED.md'),
  (Join-Path $workspace 'supabase\migrations\20261027120000_temporal_history_tenant_containment.sql'),
  (Join-Path $auditDir 'containment-anonymous-rest-post-change.json'),
  (Join-Path $auditDir 'containment-behavioral-e2e-rollback.stdout.log'),
  (Join-Path $auditDir 'containment-post-change-table-acl-readonly.stdout.log'),
  (Join-Path $auditDir 'containment-post-change-function-acl-readonly.stdout.log'),
  (Join-Path $auditDir 'containment-post-change-policies-readonly.stdout.log'),
  (Join-Path $auditDir 'containment-trigger-preflight-readonly.stdout.log')
)
$missingLinks = @($linkTargets | Where-Object { -not (Test-Path -LiteralPath $_) })

$diffOutput = & git diff --check 2>&1
$diffExit = $LASTEXITCODE
$rest = Get-Content (Join-Path $auditDir 'containment-anonymous-rest-post-change.json') -Raw | ConvertFrom-Json
$restDenied = @($rest | Where-Object { -not $_.denied }).Count -eq 0 -and @($rest).Count -eq 11
$behavior = Get-Content (Join-Path $auditDir 'containment-behavioral-e2e-rollback.stdout.log') -Raw
$behaviorPass = $behavior -match '"tenant_a_vs_b_rls": "PASS"' -and
  $behavior -match '"auto_rpc_own_tenant_reads": "PASS"' -and
  $behavior -match '"auto_journey_rpc_own_tenant_read": "PASS"' -and
  $behavior -match '"h9_service_role_write_and_reconstruct": "PASS"' -and
  $behavior -match '"persistent_fixture_rows": 0'
$migrationHash = (Get-FileHash -LiteralPath $migration -Algorithm SHA256).Hash.ToLowerInvariant()
$application = Get-Content (Join-Path $auditDir 'primary-containment-application.json') -Raw | ConvertFrom-Json
$hashMatches = $application.migrationSha256 -eq $migrationHash

$result = [ordered]@{
  checkedAtUtc = [DateTime]::UtcNow.ToString('o')
  missingPaths = $missingPaths
  missingLinks = $missingLinks
  jsonErrors = @($jsonErrors)
  trailingWhitespace = @($trailingWhitespace)
  gitDiffCheckExit = $diffExit
  gitDiffCheckOutput = ($diffOutput -join [Environment]::NewLine)
  anonymousHttpDenials = $restDenied
  rollbackBehavioralAssertions = $behaviorPass
  migrationHashMatchesExecutionRecord = $hashMatches
  healthcareVerifyExit = 1
  result = if ($missingPaths.Count -eq 0 -and $missingLinks.Count -eq 0 -and $jsonErrors.Count -eq 0 -and $trailingWhitespace.Count -eq 0 -and $diffExit -eq 0 -and $restDenied -and $behaviorPass -and $hashMatches) { 'PASS_P0_CONTAINMENT_ARTIFACTS' } else { 'FAIL' }
}
$result | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $auditDir 'final-containment-checks.json')
$result | ConvertTo-Json -Depth 8
