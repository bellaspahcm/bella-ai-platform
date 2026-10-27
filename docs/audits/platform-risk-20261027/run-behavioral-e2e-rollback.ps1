$ErrorActionPreference = 'Stop'
$projectRef = 'lvnvkpyxtuilhrabtlwv'
$sqlPath = Join-Path $PSScriptRoot 'containment-behavioral-e2e-rollback.sql'
$startedUtc = [DateTime]::UtcNow
$sqlHash = (Get-FileHash -LiteralPath $sqlPath -Algorithm SHA256).Hash.ToLowerInvariant()
$output = & supabase db query --linked --project-ref $projectRef --file $sqlPath -o json 2>&1
$exitCode = $LASTEXITCODE
$combinedOutput = $output -join [Environment]::NewLine
$expectedPasses = @(
  '"anonymous_sql_denials": "PASS"',
  '"tenant_a_vs_b_rls": "PASS"',
  '"auto_rpc_tenant_guards": "PASS"',
  '"auto_rpc_own_tenant_reads": "PASS"',
  '"auto_journey_rpc_own_tenant_read": "PASS"',
  '"authenticated_vehicle_booking_triggers": "PASS"',
  '"service_role_journey_trigger": "PASS"',
  '"h9_authenticated_tenant_read": "PASS"',
  '"h9_service_role_write_and_reconstruct": "PASS"',
  '"persistent_fixture_rows": 0'
)
$behavioralPass = $exitCode -eq 0
foreach ($expected in $expectedPasses) { if ($combinedOutput -notlike "*$expected*") { $behavioralPass = $false } }
$endedUtc = [DateTime]::UtcNow
$outputPath = Join-Path $PSScriptRoot 'containment-behavioral-e2e-rollback.stdout.log'
Set-Content -LiteralPath $outputPath -Value $combinedOutput
[ordered]@{
  command = "supabase db query --linked --project-ref $projectRef --file docs/audits/platform-risk-20261027/containment-behavioral-e2e-rollback.sql -o json"
  startedUtc = $startedUtc.ToString('o')
  endedUtc = $endedUtc.ToString('o')
  exitCode = $exitCode
  querySha256 = $sqlHash
  outputFile = [System.IO.Path]::GetFileName($outputPath)
  behavioralAssertionsPassed = $behavioralPass
  persistentFixtureRows = if ($behavioralPass) { 0 } else { $null }
  finalStatement = 'ROLLBACK'
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'containment-behavioral-e2e-rollback.execution.json')
if (-not $behavioralPass) { throw 'Rollback behavioral verification failed; inspect output file.' }
$combinedOutput | Select-String -Pattern '"verification"|"anonymous_sql_denials"|"tenant_a_vs_b_rls"|"authenticated_vehicle_booking_triggers"|"service_role_journey_trigger"|"h9_service_role_write_and_reconstruct"|"persistent_fixture_rows"' | ForEach-Object { $_.Line }
