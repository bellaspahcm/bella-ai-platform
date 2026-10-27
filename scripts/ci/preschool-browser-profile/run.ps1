[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Prepare', 'Status', 'Cleanup')]
  [string] $Action,

  [string] $RunDirectory,

  [string] $SourceRevision
)

$ErrorActionPreference = 'Stop'
$profileDirectory = $PSScriptRoot
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $profileDirectory '..\..\..'))
$manifestPath = Join-Path $profileDirectory 'manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$manifestHash = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
$resolvedSourceRevision = $null

function Get-ProfileRunDirectory([string] $Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) { throw 'RUN_DIRECTORY_REQUIRED' }
  $resolved = [IO.Path]::GetFullPath($Path)
  if (!(Test-Path -LiteralPath $resolved -PathType Container)) { throw 'RUN_DIRECTORY_NOT_FOUND' }
  return $resolved
}

function Read-OwnerIntent([string] $Path) {
  $intentPath = Join-Path $Path 'owner-intent.json'
  if (!(Test-Path -LiteralPath $intentPath -PathType Leaf)) { throw 'PROFILE_OWNERSHIP_MARKER_MISSING' }
  $intent = Get-Content -LiteralPath $intentPath -Raw | ConvertFrom-Json
  $snapshotPath = Join-Path $Path 'manifest.snapshot.json'
  if (!(Test-Path -LiteralPath $snapshotPath -PathType Leaf) -or
      (Get-FileHash -LiteralPath $snapshotPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $intent.manifestSha256) {
    throw 'PROFILE_MANIFEST_SNAPSHOT_MISMATCH'
  }
  $snapshot = Get-Content -LiteralPath $snapshotPath -Raw | ConvertFrom-Json
  if ($intent.profileId -ne $manifest.profileId -or $intent.repositoryRoot -ne $repositoryRoot -or
      $snapshot.profileId -ne $intent.profileId -or $intent.createdBeforeStart -ne $true -or
      $intent.projectId -notmatch '^bella-preschool-[a-f0-9]{8}$') {
    throw 'PROFILE_OWNERSHIP_MARKER_MISMATCH'
  }
  return $intent
}

function Get-ProjectResourceNames([string] $ProjectId) {
  $containerNames = @(& docker ps -a --format '{{.Names}}' 2>$null)
  if ($LASTEXITCODE -ne 0) { throw 'DOCKER_CONTAINER_INVENTORY_FAILED' }
  $volumeNames = @(& docker volume ls --format '{{.Name}}' 2>$null)
  if ($LASTEXITCODE -ne 0) { throw 'DOCKER_VOLUME_INVENTORY_FAILED' }
  $pattern = "^supabase_[a-z0-9_-]+_$([regex]::Escape($ProjectId))$"
  return [pscustomobject]@{
    Containers = @($containerNames | Where-Object { $_ -match $pattern })
    Volumes = @($volumeNames | Where-Object { $_ -match $pattern })
  }
}

function Write-SafeProcessLog([string] $Path, [object[]] $Output) {
  $text = ($Output | ForEach-Object { [string] $_ }) -join [Environment]::NewLine
  $text = [regex]::Replace($text, '(?i)(sb_(?:publishable|secret)_[A-Za-z0-9_-]{12,})', '[REDACTED_KEY]')
  $text = [regex]::Replace($text, '(?i)(eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,})', '[REDACTED_JWT]')
  $text = [regex]::Replace($text, '(?i)("(?:ANON_KEY|SERVICE_ROLE_KEY|JWT_SECRET|POSTGRES_PASSWORD|SUPABASE_DB_PASSWORD)"\s*:\s*")[^"]*(")', '$1[REDACTED]$2')
  $text = [regex]::Replace($text, '(?im)(ANON_KEY|SERVICE_ROLE_KEY|JWT_SECRET|POSTGRES_PASSWORD)(\s*[:=]\s*)\S+', '$1$2[REDACTED]')
  [IO.File]::WriteAllText($Path, $text + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}

function Get-CanonicalSourceSha256([string] $Path) {
  $content = [IO.File]::ReadAllText($Path)
  $canonicalContent = $content.Replace("`r`n", "`n").Replace("`r", "`n")
  $bytes = [Text.UTF8Encoding]::new($false).GetBytes($canonicalContent)
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return [Convert]::ToHexString($sha.ComputeHash($bytes)).ToLowerInvariant() }
  finally { $sha.Dispose() }
}

function Invoke-LoggedCommand([string] $Name, [string] $Executable, [string[]] $Arguments, [string] $LogPath) {
  $output = @(& $Executable @Arguments 2>&1)
  $exitCode = $LASTEXITCODE
  Write-SafeProcessLog $LogPath $output
  if ($exitCode -ne 0) { throw "$Name failed with exit code $exitCode; see the redacted log in the run directory." }
}

function Set-TomlValue([string] $Path, [string] $Section, [string] $Key, [string] $Value) {
  $text = [IO.File]::ReadAllText($Path)
  $pattern = "(?ms)(^\[$([regex]::Escape($Section))\]\r?\n(?:(?!^\[).)*?^$([regex]::Escape($Key))\s*=\s*)[^\r\n]+"
  $count = 0
  $evaluator = [Text.RegularExpressions.MatchEvaluator]{ param($match) $match.Groups[1].Value + $Value }
  $updated = [regex]::Replace($text, $pattern, $evaluator, [Text.RegularExpressions.RegexOptions]::Multiline -bor [Text.RegularExpressions.RegexOptions]::Singleline)
  if ($updated -eq $text) { throw "PROFILE_CONFIG_KEY_NOT_FOUND:$Section.$Key" }
  $count = [regex]::Matches($text, $pattern).Count
  if ($count -ne 1) { throw "PROFILE_CONFIG_KEY_COUNT_INVALID:${Section}.${Key}:$count" }
  [IO.File]::WriteAllText($Path, $updated, [Text.UTF8Encoding]::new($false))
}

function Test-PortFree([int] $Port) {
  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
  try { $listener.Start(); return $true } catch { return $false } finally { $listener.Stop() }
}

function Get-FreePortBase {
  $random = [Random]::new()
  for ($attempt = 0; $attempt -lt 500; $attempt++) {
    $candidate = $random.Next(26000, 48000)
    $ports = @(($candidate - 1), $candidate, ($candidate + 1), ($candidate + 2), ($candidate + 3), ($candidate + 4), ($candidate + 5))
    if (@($ports | Where-Object { !(Test-PortFree $_) }).Count -eq 0) { return $candidate }
  }
  throw 'PROFILE_NO_FREE_PORT_RANGE'
}

function Assert-ManifestAndSources {
  $head = (& git -C $repositoryRoot rev-parse HEAD).Trim()
  $expectedRevision = if (![string]::IsNullOrWhiteSpace($SourceRevision)) {
    $SourceRevision.Trim()
  } else {
    [string] $manifest.sourceRevisionRequired
  }
  if ($LASTEXITCODE -ne 0 -or $head -notmatch '^[a-f0-9]{40}$' -or
      (![string]::IsNullOrWhiteSpace($expectedRevision) -and $head -ne $expectedRevision)) {
    throw 'PROFILE_SOURCE_REVISION_MISMATCH'
  }
  $script:resolvedSourceRevision = $head
  $versions = @($manifest.profileMigrations | ForEach-Object { [string] $_.profileVersion })
  if (($versions | Select-Object -Unique).Count -ne $versions.Count) { throw 'PROFILE_MIGRATION_VERSION_DUPLICATE' }
  $sortedVersions = @($versions | Sort-Object)
  if ([string]::Join(',', $versions) -ne [string]::Join(',', $sortedVersions)) {
    throw 'PROFILE_MIGRATION_VERSIONS_NOT_ORDERED'
  }
  foreach ($entry in $manifest.profileMigrations) {
    $source = [IO.Path]::GetFullPath((Join-Path $repositoryRoot ([string] $entry.source)))
    if (!$source.StartsWith($repositoryRoot, [StringComparison]::OrdinalIgnoreCase) -or !(Test-Path -LiteralPath $source -PathType Leaf)) {
      throw "PROFILE_MIGRATION_SOURCE_MISSING:$($entry.source)"
    }
    $actual = Get-CanonicalSourceSha256 $source
    if ($actual -ne [string] $entry.sha256) { throw "PROFILE_MIGRATION_SOURCE_HASH_MISMATCH:$($entry.source)" }
    if ($entry.source -eq 'scripts/ci/preschool-browser-profile/20260912000001_preschool_student_party_id_schema_projection.sql') {
      $r3Path = Join-Path $repositoryRoot ([string] $entry.sourceMigration)
      if ((Get-CanonicalSourceSha256 $r3Path) -ne [string] $entry.sourceMigrationSha256) {
        throw 'R3_SOURCE_MIGRATION_HASH_MISMATCH'
      }
      $r3 = Get-Content -LiteralPath $r3Path -Raw
      foreach ($fragment in @('ALTER TABLE students ADD COLUMN party_id UUID;',
          'FOREIGN KEY (party_id)', 'REFERENCES party_parties(id)', 'ON DELETE RESTRICT;',
          'CREATE INDEX idx_students_party_id ON students(party_id);')) {
        if (!$r3.Contains($fragment)) { throw "R3_SOURCE_FRAGMENT_NOT_FOUND:$fragment" }
      }
    }
    if ($entry.source -eq 'scripts/ci/preschool-browser-profile/20260808000012_platform_rule_domain_projection.sql') {
      $sourcePath = Join-Path $repositoryRoot ([string] $entry.sourceMigration)
      if ((Get-CanonicalSourceSha256 $sourcePath) -ne [string] $entry.sourceMigrationSha256) {
        throw 'RULE_DOMAIN_SOURCE_MIGRATION_HASH_MISMATCH'
      }
      $sourceText = Get-Content -LiteralPath $sourcePath -Raw
      foreach ($fragment in @(
          'CREATE TYPE platform_rule_domain AS ENUM (',
          "'platform.system'",
          'EXCEPTION WHEN duplicate_object THEN NULL; END $$;')) {
        if (!$sourceText.Contains($fragment)) { throw "RULE_DOMAIN_SOURCE_FRAGMENT_NOT_FOUND:$fragment" }
      }
    }
    if ($entry.source -eq 'scripts/ci/preschool-browser-profile/20260808000012_platform_rule_domain_projection.sql') {
      $sourcePath = Join-Path $repositoryRoot ([string] $entry.sourceMigration)
      if ((Get-CanonicalSourceSha256 $sourcePath) -ne [string] $entry.sourceMigrationSha256) {
        throw 'RULE_DOMAIN_SOURCE_MIGRATION_HASH_MISMATCH'
      }
      $sourceText = Get-Content -LiteralPath $sourcePath -Raw
      foreach ($fragment in @(
          'CREATE TYPE platform_rule_domain AS ENUM (',
          "'platform.system'",
          'EXCEPTION WHEN duplicate_object THEN NULL; END $$;')) {
        if (!$sourceText.Contains($fragment)) { throw "RULE_DOMAIN_SOURCE_FRAGMENT_NOT_FOUND:$fragment" }
      }
    }
  }
}

function Stop-OwnedProfile([string] $Path, [object] $Intent) {
  $resources = Get-ProjectResourceNames ([string] $Intent.projectId)
  if ($resources.Containers.Count -eq 0 -and $resources.Volumes.Count -eq 0) { return 'ALREADY_ABSENT' }
  $databaseContainerName = "supabase_db_$($Intent.projectId)"
  if ($resources.Containers -notcontains $databaseContainerName) { throw 'PROFILE_OWNED_DATABASE_CONTAINER_MISSING' }
  $actual = (& docker inspect --format '{{.Id}}|{{index .Config.Labels "com.supabase.cli.project"}}|{{index .Config.Labels "com.supabase.cli.workdir"}}' $databaseContainerName).Trim()
  if ($LASTEXITCODE -ne 0) { throw 'PROFILE_DATABASE_CONTAINER_READBACK_FAILED' }
  $identity = $actual -split '\|', 3
  if ($identity.Count -ne 3 -or $identity[1] -ne [string] $Intent.projectId -or
      [IO.Path]::GetFullPath($identity[2]) -ne [IO.Path]::GetFullPath($Path)) {
    throw 'PROFILE_DATABASE_CONTAINER_OWNERSHIP_LABEL_MISMATCH'
  }
  if ($identity[0] -ne [string] $Intent.databaseContainerId) {
    # Supabase CLI may recreate its database container during an explicit reset.
    # Accept the new ID only after the immutable project/workdir labels match this run.
    $Intent | Add-Member -NotePropertyName previousDatabaseContainerId -NotePropertyValue $Intent.databaseContainerId -Force
    $Intent.databaseContainerId = $identity[0]
    $Intent.stackState = 'OWNED_CONTAINER_RECREATED_BY_PROFILE_RESET'
    $intentPath = Join-Path $Path 'owner-intent.json'
    $Intent | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $intentPath -Encoding utf8
  }
  $stopLog = Join-Path $Path 'cleanup.log'
  Invoke-LoggedCommand 'Supabase owned-project cleanup' 'supabase' @('stop', '--project-id', [string] $Intent.projectId, '--workdir', $Path, '--no-backup') $stopLog
  $after = Get-ProjectResourceNames ([string] $Intent.projectId)
  if ($after.Containers.Count -ne 0 -or $after.Volumes.Count -ne 0) { throw 'PROFILE_CLEANUP_READBACK_FAILED' }
  return 'OWNED_PROJECT_AND_VOLUMES_REMOVED'
}

if ($Action -eq 'Prepare') {
  Assert-ManifestAndSources
  $null = & docker info 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'DOCKER_ENGINE_UNAVAILABLE' }
  $null = & supabase --version 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'SUPABASE_CLI_UNAVAILABLE' }

  $shortId = [Guid]::NewGuid().ToString('N').Substring(0, 8)
  $projectId = "bella-preschool-$shortId"
  $portBase = Get-FreePortBase
  $parent = if (![string]::IsNullOrWhiteSpace($env:RUNNER_TEMP)) {
    Join-Path $env:RUNNER_TEMP 'bella-preschool-disposable-profiles'
  } else {
    Join-Path $env:LOCALAPPDATA 'Bella\Preschool\DisposableProfiles'
  }
  $runDirectory = Join-Path $parent $projectId
  if (Test-Path -LiteralPath $runDirectory) { throw 'PROFILE_RUN_DIRECTORY_ALREADY_EXISTS' }
  $existing = Get-ProjectResourceNames $projectId
  if ($existing.Containers.Count -ne 0 -or $existing.Volumes.Count -ne 0) { throw 'PROFILE_PROJECT_RESOURCES_PREEXIST' }
  New-Item -ItemType Directory -Path $runDirectory -Force | Out-Null

  $intent = [ordered]@{
    profileId = [string] $manifest.profileId
    runId = $projectId
    projectId = $projectId
    repositoryRoot = $repositoryRoot
    sourceRevision = [string] $resolvedSourceRevision
    manifestSha256 = $manifestHash
    createdAt = [DateTimeOffset]::UtcNow.ToString('o')
    createdBeforeStart = $true
    portBase = $portBase
    databaseContainerId = $null
    stackState = 'PREPARING'
  }
  $intentPath = Join-Path $runDirectory 'owner-intent.json'
  Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $runDirectory 'manifest.snapshot.json')
  $intent | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $intentPath -Encoding utf8
  $success = $false

  try {
    Invoke-LoggedCommand 'Supabase init' 'supabase' @('init', '--workdir', $runDirectory, '--yes') (Join-Path $runDirectory 'init.log')
    $configPath = Join-Path $runDirectory 'supabase\config.toml'
    if (!(Test-Path -LiteralPath $configPath -PathType Leaf)) { throw 'PROFILE_CONFIG_NOT_CREATED' }
    $configText = [IO.File]::ReadAllText($configPath)
    $configText = [regex]::Replace($configText, '(?m)^project_id\s*=\s*"[^"]+"', "project_id = `"$projectId`"", 1)
    [IO.File]::WriteAllText($configPath, $configText, [Text.UTF8Encoding]::new($false))
    Set-TomlValue $configPath 'api' 'port' ([string] $portBase)
    Set-TomlValue $configPath 'db' 'port' ([string] ($portBase + 1))
    Set-TomlValue $configPath 'db' 'shadow_port' ([string] ($portBase - 1))
    Set-TomlValue $configPath 'db.migrations' 'enabled' 'false'
    Set-TomlValue $configPath 'db.seed' 'enabled' 'false'
    if (Test-Path -LiteralPath (Join-Path $runDirectory 'supabase\migrations')) { throw 'PROFILE_MIGRATIONS_MUST_NOT_EXIST_BEFORE_START' }

    Invoke-LoggedCommand 'Supabase isolated stack start' 'supabase' @('start', '--workdir', $runDirectory,
      '--exclude', 'realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor') (Join-Path $runDirectory 'start.log')
    $dbContainerName = "supabase_db_$projectId"
    $containerId = (& docker inspect --format '{{.Id}}' $dbContainerName).Trim()
    if ($LASTEXITCODE -ne 0 -or $containerId -notmatch '^[a-f0-9]{64}$') { throw 'PROFILE_DATABASE_CONTAINER_ID_INVALID' }
    $intent.databaseContainerId = $containerId
    $intent.stackState = 'STACK_STARTED_EMPTY'
    $intent | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $intentPath -Encoding utf8

    $emptyPublic = (& docker exec $containerId psql -XAt -U postgres -d postgres -c "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','v')").Trim()
    if ($LASTEXITCODE -ne 0 -or $emptyPublic -ne '0') { throw 'PROFILE_PUBLIC_SCHEMA_NOT_EMPTY_AT_START' }

    $migrationsDirectory = Join-Path $runDirectory 'supabase\migrations'
    New-Item -ItemType Directory -Path $migrationsDirectory | Out-Null
    $copied = @()
    foreach ($entry in $manifest.profileMigrations) {
      $source = [IO.Path]::GetFullPath((Join-Path $repositoryRoot ([string] $entry.source)))
      $sourceName = [IO.Path]::GetFileName([string] $entry.source)
      if ($sourceName -match '^\d+_(.+\.sql)$') { $suffix = $Matches[1] } else { throw "PROFILE_SOURCE_FILENAME_INVALID:$sourceName" }
      $target = Join-Path $migrationsDirectory ("$($entry.profileVersion)_$suffix")
      Copy-Item -LiteralPath $source -Destination $target
      if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash) {
        throw "PROFILE_MIGRATION_COPY_HASH_MISMATCH:$($entry.profileVersion)"
      }
      $copied += [string] $entry.profileVersion
    }
    Set-TomlValue $configPath 'db.migrations' 'enabled' 'true'
    Invoke-LoggedCommand 'Scoped profile migration apply' 'supabase' @('db', 'reset', '--local', '--no-seed', '--yes', '--workdir', $runDirectory) (Join-Path $runDirectory 'migration-apply.log')

    $resetIdentity = (& docker inspect --format '{{.Id}}|{{index .Config.Labels "com.supabase.cli.project"}}|{{index .Config.Labels "com.supabase.cli.workdir"}}' $dbContainerName).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'PROFILE_DATABASE_CONTAINER_READBACK_FAILED_AFTER_RESET' }
    $resetParts = $resetIdentity -split '\|', 3
    if ($resetParts.Count -ne 3 -or $resetParts[0] -notmatch '^[a-f0-9]{64}$' -or
        $resetParts[1] -ne $projectId -or
        [IO.Path]::GetFullPath($resetParts[2]) -ne [IO.Path]::GetFullPath($runDirectory)) {
      throw 'PROFILE_DATABASE_CONTAINER_OWNERSHIP_LABEL_MISMATCH_AFTER_RESET'
    }
    $containerId = $resetParts[0]
    $intent.databaseContainerId = $containerId
    $intent.stackState = 'PROFILE_MIGRATIONS_APPLIED_PENDING_ACCEPTANCE'
    $intent | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $intentPath -Encoding utf8

    $ledger = @(& docker exec $containerId psql -XAt -U postgres -d postgres -c 'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version' 2>&1)
    if ($LASTEXITCODE -ne 0) { throw 'PROFILE_MIGRATION_LEDGER_READ_FAILED' }
    $applied = @($ledger | ForEach-Object { ([string] $_).Trim() } | Where-Object { $_ -match '^\d+$' })
    if ([string]::Join(',', $applied) -ne [string]::Join(',', $copied)) { throw 'PROFILE_MIGRATION_LEDGER_DOES_NOT_MATCH_ALLOWLIST' }

    $verifyPath = Join-Path $profileDirectory 'verify-bootstrap.sql'
    $containerVerify = '/tmp/preschool-profile-verify.sql'
    & docker cp $verifyPath "${containerId}:$containerVerify" *> $null
    if ($LASTEXITCODE -ne 0) { throw 'PROFILE_VERIFIER_COPY_FAILED' }
    $verifyOutput = @(& docker exec $containerId psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -f $containerVerify 2>&1)
    $verifyExit = $LASTEXITCODE
    Write-SafeProcessLog (Join-Path $runDirectory 'schema-verification.log') $verifyOutput
    if ($verifyExit -ne 0 -or !($verifyOutput -match 'PRESCHOOL_PROFILE_SCHEMA_ACL_RLS_PASS')) { throw 'PROFILE_SCHEMA_ACCEPTANCE_FAILED' }

    $receipt = [ordered]@{
      profileId = [string] $manifest.profileId
      manifestSha256 = $manifestHash
      sourceRevision = [string] $resolvedSourceRevision
      projectId = $projectId
      apiOrigin = "http://127.0.0.1:$portBase"
      databasePort = $portBase + 1
      databaseContainerId = $containerId
      profileMigrationVersionsApplied = $applied
      migrationSourceHashes = @($manifest.profileMigrations | ForEach-Object { [ordered]@{ source = $_.source; sha256 = $_.sha256 } })
      schemaAcceptance = 'PASS'
      schemaAcceptanceOutput = 'PRESCHOOL_PROFILE_SCHEMA_ACL_RLS_PASS'
      realJwt = 'NOT_RUN'
      browserE2e = 'NOT_RUN'
      businessRowsImported = $false
      fabricatedR3IdentityMappings = $false
      cleanup = 'STACK_RETAINED_FOR_NEXT_ISOLATED_ACCEPTANCE_STAGE'
      completedAt = [DateTimeOffset]::UtcNow.ToString('o')
    }
    $receipt | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDirectory 'receipt.json') -Encoding utf8
    $intent.stackState = 'SCHEMA_ACCEPTANCE_PASS_RETAINED'
    $intent | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $intentPath -Encoding utf8
    $success = $true
    Write-Output "PROFILE_SCHEMA_ACCEPTANCE_PASS project=$projectId api=http://127.0.0.1:$portBase"
    Write-Output "PROFILE_RUN_DIRECTORY=$runDirectory"
  } catch {
    $failure = $_.Exception.Message
    $safeFailure = [regex]::Replace($failure, '(?i)(sb_(?:publishable|secret)_[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,})', '[REDACTED_SECRET]')
    [ordered]@{
      profileId = [string] $manifest.profileId
      manifestSha256 = $manifestHash
      sourceRevision = [string] $resolvedSourceRevision
      projectId = $projectId
      schemaAcceptance = 'FAIL'
      failure = $safeFailure
      realJwt = 'NOT_RUN'
      browserE2e = 'NOT_RUN'
      cleanup = 'ATTEMPTED_IN_FINALLY'
      completedAt = [DateTimeOffset]::UtcNow.ToString('o')
    } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $runDirectory 'receipt.json') -Encoding utf8
    throw
  } finally {
    if (!$success -and (Test-Path -LiteralPath $intentPath)) {
      try {
        $ownedIntent = Read-OwnerIntent $runDirectory
        $cleanupResult = Stop-OwnedProfile $runDirectory $ownedIntent
        $receiptPath = Join-Path $runDirectory 'receipt.json'
        if (Test-Path -LiteralPath $receiptPath) {
          $failedReceipt = Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json
          $failedReceipt.cleanup = $cleanupResult
          $failedReceipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $receiptPath -Encoding utf8
        }
      } catch {
        $cleanupError = [regex]::Replace($_.Exception.Message, '(?i)(sb_(?:publishable|secret)_[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,})', '[REDACTED_SECRET]')
        Set-Content -LiteralPath (Join-Path $runDirectory 'cleanup-failure.txt') -Value $cleanupError -Encoding utf8
      }
    }
  }
}
elseif ($Action -eq 'Status') {
  $runDirectory = Get-ProfileRunDirectory $RunDirectory
  $intent = Read-OwnerIntent $runDirectory
  $resources = Get-ProjectResourceNames ([string] $intent.projectId)
  $receiptPath = Join-Path $runDirectory 'receipt.json'
  $receiptState = if (Test-Path -LiteralPath $receiptPath) { (Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json).schemaAcceptance } else { 'NO_RECEIPT' }
  [pscustomobject]@{
    ProjectId = $intent.projectId
    StackState = $intent.stackState
    DatabaseContainerOwned = $resources.Containers -contains "supabase_db_$($intent.projectId)"
    OwnedContainerCount = $resources.Containers.Count
    OwnedVolumeCount = $resources.Volumes.Count
    SchemaAcceptance = $receiptState
    RunDirectory = $runDirectory
  } | Format-List
}
elseif ($Action -eq 'Cleanup') {
  $runDirectory = Get-ProfileRunDirectory $RunDirectory
  $intent = Read-OwnerIntent $runDirectory
  $cleanupResult = Stop-OwnedProfile $runDirectory $intent
  $receiptPath = Join-Path $runDirectory 'receipt.json'
  if (Test-Path -LiteralPath $receiptPath) {
    $receipt = Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json
    $receipt.cleanup = $cleanupResult
    $receipt | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $receiptPath -Encoding utf8
  }
  Write-Output "PROFILE_CLEANUP=$cleanupResult project=$($intent.projectId)"
  Write-Output "RECEIPT_PRESERVED=$receiptPath"
}
