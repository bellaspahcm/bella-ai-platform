$ErrorActionPreference = 'Stop'
$projectRef = 'lvnvkpyxtuilhrabtlwv'
$auditDir = Join-Path $PSScriptRoot ''
$queries = @(
  @{ name = 'containment-post-change-table-acl-readonly'; sql = 'containment-post-change-table-acl-readonly.sql' },
  @{ name = 'containment-post-change-function-acl-readonly'; sql = 'containment-post-change-function-acl-readonly.sql' },
  @{ name = 'containment-post-change-policies-readonly'; sql = 'containment-post-change-policies-readonly.sql' },
  @{ name = 'containment-post-change-role-membership-readonly'; sql = 'containment-post-change-role-membership-readonly.sql' },
  @{ name = 'containment-live-function-contract-readonly'; sql = 'containment-live-function-contract-readonly.sql' },
  @{ name = 'containment-trigger-preflight-readonly'; sql = 'containment-trigger-preflight-readonly.sql' }
)
$results = [System.Collections.Generic.List[object]]::new()

foreach ($query in $queries) {
  $started = [DateTime]::UtcNow
  $sqlPath = Join-Path $auditDir $query.sql
  $sqlHash = (Get-FileHash -LiteralPath $sqlPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $output = & supabase db query --linked --project-ref $projectRef --file $sqlPath -o json 2>&1
  $exitCode = $LASTEXITCODE
  $ended = [DateTime]::UtcNow
  $stdoutPath = Join-Path $auditDir ($query.name + '.stdout.log')
  $stderrPath = Join-Path $auditDir ($query.name + '.stderr.log')
  Set-Content -LiteralPath $stdoutPath -Value ($output -join [Environment]::NewLine)
  Set-Content -LiteralPath $stderrPath -Value ''
  $record = [ordered]@{
    command = "supabase db query --linked --project-ref $projectRef --file docs/audits/platform-risk-20261027/$($query.sql) -o json"
    startedUtc = $started.ToString('o')
    endedUtc = $ended.ToString('o')
    exitCode = $exitCode
    querySha256 = $sqlHash
    outputFile = [System.IO.Path]::GetFileName($stdoutPath)
  }
  $record | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $auditDir ($query.name + '.execution.json'))
  $results.Add([pscustomobject]@{ name = $query.name; exitCode = $exitCode; outputFile = [System.IO.Path]::GetFileName($stdoutPath) })
  if ($exitCode -ne 0) { throw "Read-only catalog query failed: $($query.name)" }
}

$results | ConvertTo-Json -Depth 4 -Compress
