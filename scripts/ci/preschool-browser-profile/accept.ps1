param(
  [Parameter(Mandatory = $true)]
  [string] $RunDirectory
)

$ErrorActionPreference = 'Stop'

function Get-CanonicalSourceSha256([string] $Path) {
  $content = [IO.File]::ReadAllText($Path)
  $canonicalContent = $content.Replace("`r`n", "`n").Replace("`r", "`n")
  $bytes = [Text.UTF8Encoding]::new($false).GetBytes($canonicalContent)
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return [Convert]::ToHexString($sha.ComputeHash($bytes)).ToLowerInvariant() }
  finally { $sha.Dispose() }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$profileRunner = Join-Path $PSScriptRoot 'run.ps1'
$acceptanceScript = Join-Path $PSScriptRoot 'teacher-attendance.e2e.mjs'
$resolvedRun = (Resolve-Path -LiteralPath $RunDirectory).Path
$profilesParent = if (![string]::IsNullOrWhiteSpace($env:RUNNER_TEMP)) {
  Join-Path $env:RUNNER_TEMP 'bella-preschool-disposable-profiles'
} else {
  Join-Path $env:LOCALAPPDATA 'Bella\Preschool\DisposableProfiles'
}
$pathSeparator = [IO.Path]::DirectorySeparatorChar
$expectedProfiles = [IO.Path]::GetFullPath($profilesParent).TrimEnd([char]'\', [char]'/') + $pathSeparator
$resolvedRunFull = [IO.Path]::GetFullPath($resolvedRun)

if (!$resolvedRunFull.StartsWith($expectedProfiles, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'PROFILE_PATH_OUTSIDE_OWNED_ROOT'
}

$receiptPath = Join-Path $resolvedRun 'receipt.json'
$intentPath = Join-Path $resolvedRun 'owner-intent.json'
if (!(Test-Path -LiteralPath $receiptPath -PathType Leaf) -or !(Test-Path -LiteralPath $intentPath -PathType Leaf)) {
  throw 'PROFILE_OWNERSHIP_RECEIPT_MISSING'
}
$receipt = Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json
$intent = Get-Content -LiteralPath $intentPath -Raw | ConvertFrom-Json
$manifestSnapshotPath = Join-Path $resolvedRun 'manifest.snapshot.json'
$manifestPath = Join-Path $PSScriptRoot 'manifest.json'
if (!(Test-Path -LiteralPath $manifestSnapshotPath -PathType Leaf) -or !(Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  throw 'PROFILE_MANIFEST_MISSING'
}
$manifestSha = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
$snapshotSha = (Get-FileHash -LiteralPath $manifestSnapshotPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($manifestSha -ne $receipt.manifestSha256 -or $snapshotSha -ne $receipt.manifestSha256) { throw 'PROFILE_MANIFEST_HASH_MISMATCH' }
$manifest = Get-Content -LiteralPath $manifestSnapshotPath -Raw | ConvertFrom-Json
$currentHead = (& git -C $repoRoot rev-parse HEAD).Trim()
$pinnedRevision = [string] $manifest.sourceRevisionRequired
if ($LASTEXITCODE -ne 0 -or $currentHead -notmatch '^[a-f0-9]{40}$' -or
  $currentHead -ne $receipt.sourceRevision -or
  (![string]::IsNullOrWhiteSpace($pinnedRevision) -and $pinnedRevision -ne $receipt.sourceRevision)) {
  throw 'PROFILE_SOURCE_REVISION_MISMATCH'
}
foreach ($entry in $manifest.profileMigrations) {
  foreach ($sourceEntry in @(@{ path = $entry.source; sha = $entry.sha256 }, @{ path = $entry.sourceMigration; sha = $entry.sourceMigrationSha256 })) {
    if (!$sourceEntry.path -or !$sourceEntry.sha) { continue }
    if ([IO.Path]::IsPathRooted([string] $sourceEntry.path)) {
      throw 'PROFILE_MIGRATION_SOURCE_MISSING_OR_OUTSIDE_REPOSITORY'
    }
    $repoRootFull = [IO.Path]::GetFullPath($repoRoot)
    $sourcePath = [IO.Path]::GetFullPath((Join-Path $repoRootFull ([string] $sourceEntry.path)))
    $relativeSource = [IO.Path]::GetRelativePath($repoRootFull, $sourcePath)
    $parentPrefix = '..' + [IO.Path]::DirectorySeparatorChar
    if ([IO.Path]::IsPathRooted($relativeSource) -or $relativeSource -eq '..' -or
      $relativeSource.StartsWith($parentPrefix, [StringComparison]::Ordinal) -or
      !(Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
      throw 'PROFILE_MIGRATION_SOURCE_MISSING_OR_OUTSIDE_REPOSITORY'
    }
    $sourceSha = Get-CanonicalSourceSha256 $sourcePath
    if ($sourceSha -ne $sourceEntry.sha) { throw 'PROFILE_MIGRATION_SOURCE_HASH_MISMATCH' }
  }
}
if ($receipt.projectId -ne $intent.projectId -or $receipt.profileId -ne 'preschool-teacher-browser-acceptance-v1' -or
  $receipt.schemaAcceptance -ne 'PASS' -or $receipt.realJwt -ne 'NOT_RUN' -or $receipt.browserE2e -ne 'NOT_RUN') {
  throw 'PROFILE_NOT_AT_SCHEMA_ACCEPTANCE_CHECKPOINT'
}
if ($receipt.databasePort -ne ($intent.portBase + 1) -or $receipt.databaseContainerId -ne $intent.databaseContainerId) {
  throw 'PROFILE_OWNERSHIP_MARKER_MISMATCH'
}

$statusLines = & pwsh -NoProfile -File $profileRunner -Action Status -RunDirectory $resolvedRun 2>&1
if ($LASTEXITCODE -ne 0) { throw 'PROFILE_OWNERSHIP_STATUS_FAILED' }
$statusText = ($statusLines | ForEach-Object { [string] $_ }) -join "`n"
if ($statusText -notmatch [regex]::Escape($receipt.projectId) -or $statusText -notmatch 'SCHEMA_ACCEPTANCE_PASS_RETAINED') {
  throw 'PROFILE_STACK_NOT_RETAINED_FOR_ACCEPTANCE'
}
$profileOwnershipVerified = $true

$appParent = Split-Path (Split-Path $repoRoot -Parent) -Parent
$appWorktree = Join-Path $appParent ('.preschool-profile-' + $receipt.projectId + '-app')
$appWorktree = [IO.Path]::GetFullPath($appWorktree)
if (Test-Path -LiteralPath $appWorktree) { throw 'APP_WORKTREE_PATH_ALREADY_EXISTS' }
$appParentFull = [IO.Path]::GetFullPath($appParent).TrimEnd([char]'\', [char]'/')
$relativeAppWorktree = [IO.Path]::GetRelativePath($appParentFull, $appWorktree)
$parentPrefix = '..' + [IO.Path]::DirectorySeparatorChar
if ([IO.Path]::IsPathRooted($relativeAppWorktree) -or $relativeAppWorktree -eq '..' -or
  $relativeAppWorktree.StartsWith($parentPrefix, [StringComparison]::Ordinal)) {
  throw 'APP_WORKTREE_PATH_OUTSIDE_TEMP_ROOT'
}

$savedEnvironment = @{}
$variableNames = @(
  'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY', 'BELLA_PROFILE_API_URL', 'BELLA_PROFILE_DB_URL',
  'BELLA_PROFILE_ANON_KEY', 'BELLA_PROFILE_SERVICE_ROLE_KEY', 'BELLA_PROFILE_RUN_DIRECTORY',
  'BELLA_PROFILE_APP_ROOT', 'BELLA_PROFILE_TARGET_COMMIT', 'BELLA_PROFILE_REPO_ROOT'
)
foreach ($name in $variableNames) { $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }

$testExit = 1
$cleanupExit = 1
$appWorktreeCreated = $false
$applicationOverlay = $null
$safeRunnerOutput = @()
try {
  & git -C $repoRoot worktree add --detach $appWorktree $receipt.sourceRevision 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'APP_WORKTREE_CREATE_FAILED' }
  $appWorktreeCreated = $true

  $runtimeChanges = @(& git -C $repoRoot diff --name-only $receipt.sourceRevision -- src/app src/services src/platform src/products src/types |
    Where-Object { $_ -notmatch '(^|/)__tests__/' -and $_ -notmatch '\.(test|spec)\.' })
  if ($LASTEXITCODE -ne 0) { throw 'APP_RUNTIME_DIFF_READ_FAILED' }
  $untrackedRuntimeChanges = @(& git -C $repoRoot ls-files --others --exclude-standard -- src/app src/services src/platform src/products src/types |
    Where-Object { $_ -notmatch '(^|/)__tests__/' -and $_ -notmatch '\.(test|spec)\.' })
  if ($LASTEXITCODE -ne 0 -or $untrackedRuntimeChanges.Count -gt 0) {
    throw 'APP_UNTRACKED_RUNTIME_SOURCE_REQUIRES_REVIEW'
  }
  $overlayFiles = @()
  foreach ($relativePath in $runtimeChanges) {
    $sourcePath = [IO.Path]::GetFullPath((Join-Path $repoRoot $relativePath))
    $destinationPath = [IO.Path]::GetFullPath((Join-Path $appWorktree $relativePath))
    $repoPrefix = [IO.Path]::GetFullPath($repoRoot).TrimEnd([char]'\', [char]'/') + $pathSeparator
    $appPrefix = [IO.Path]::GetFullPath($appWorktree).TrimEnd([char]'\', [char]'/') + $pathSeparator
    if (!$sourcePath.StartsWith($repoPrefix, [StringComparison]::OrdinalIgnoreCase) -or
      !$destinationPath.StartsWith($appPrefix, [StringComparison]::OrdinalIgnoreCase) -or
      !(Test-Path -LiteralPath $sourcePath -PathType Leaf) -or !(Test-Path -LiteralPath $destinationPath -PathType Leaf)) {
      throw 'APP_RUNTIME_OVERLAY_PATH_INVALID'
    }
    $sourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
    $destinationHash = (Get-FileHash -LiteralPath $destinationPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($sourceHash -ne $destinationHash) { throw 'APP_RUNTIME_OVERLAY_COPY_MISMATCH' }
    $overlayFiles += [pscustomobject]@{ path = $relativePath; sha256 = $sourceHash }
  }
  $applicationOverlay = [pscustomobject]@{
    sourceRevision = $receipt.sourceRevision
    status = if ($overlayFiles.Count -gt 0) { 'TRACKED_LOCAL_RUNTIME_CHANGES_APPLIED' } else { 'CLEAN_COMMIT_RUNTIME'
    }
    files = @($overlayFiles)
  }
  $applicationOverlay | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $resolvedRun 'application-overlay.json') -Encoding utf8

  $sourceNodeModules = Join-Path $repoRoot 'node_modules'
  $appNodeModules = Join-Path $appWorktree 'node_modules'
  if (!(Test-Path -LiteralPath $sourceNodeModules -PathType Container)) { throw 'NODE_MODULES_UNAVAILABLE' }
  $linkType = if ($IsWindows) { 'Junction' } else { 'SymbolicLink' }
  New-Item -ItemType $linkType -Path $appNodeModules -Target $sourceNodeModules | Out-Null

  $statusEnv = & supabase status --workdir $resolvedRun -o env 2>&1
  $statusVars = @{}
  foreach ($line in $statusEnv) {
    $text = [string] $line
    if ($text -match '^\s*\$env:([A-Z0-9_]+)="(.*)"$') { $statusVars[$matches[1]] = $matches[2] }
    elseif ($text -match '^\s*([A-Z0-9_]+)=(.*)$') { $statusVars[$matches[1]] = $matches[2].Trim('"') }
  }
  foreach ($required in @('API_URL', 'DB_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY')) {
    if (!$statusVars.ContainsKey($required) -or [string]::IsNullOrWhiteSpace($statusVars[$required])) {
      throw 'PROFILE_LOCAL_CONNECTION_INFO_UNAVAILABLE'
    }
  }
  $apiUri = [uri] $statusVars.API_URL
  $dbUri = [uri] $statusVars.DB_URL
  $expectedApi = [uri] $receipt.apiOrigin
  if ($apiUri.Scheme -ne 'http' -or $apiUri.Host -notin @('127.0.0.1', 'localhost', '::1') -or
    $apiUri.AbsoluteUri.TrimEnd('/') -ne $expectedApi.AbsoluteUri.TrimEnd('/') -or
    $dbUri.Host -notin @('127.0.0.1', 'localhost', '::1') -or $dbUri.Port -ne [int] $receipt.databasePort) {
    throw 'PROFILE_TARGET_IS_NOT_THE_RECORDED_LOCAL_STACK'
  }

  $env:NEXT_PUBLIC_SUPABASE_URL = $statusVars.API_URL
  $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $statusVars.ANON_KEY
  $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $statusVars.ANON_KEY
  $env:SUPABASE_URL = $statusVars.API_URL
  $env:SUPABASE_ANON_KEY = $statusVars.ANON_KEY
  $env:SUPABASE_PUBLISHABLE_KEY = $statusVars.ANON_KEY
  $env:SUPABASE_SECRET_KEY = $statusVars.SERVICE_ROLE_KEY
  $env:SUPABASE_SERVICE_ROLE_KEY = $statusVars.SERVICE_ROLE_KEY
  $env:BELLA_PROFILE_API_URL = $statusVars.API_URL
  $env:BELLA_PROFILE_DB_URL = $statusVars.DB_URL
  $env:BELLA_PROFILE_ANON_KEY = $statusVars.ANON_KEY
  $env:BELLA_PROFILE_SERVICE_ROLE_KEY = $statusVars.SERVICE_ROLE_KEY
  $env:BELLA_PROFILE_RUN_DIRECTORY = $resolvedRun
  $env:BELLA_PROFILE_APP_ROOT = $appWorktree
  $env:BELLA_PROFILE_TARGET_COMMIT = $receipt.sourceRevision
  $env:BELLA_PROFILE_REPO_ROOT = $repoRoot

  & node $acceptanceScript
  $testExit = $LASTEXITCODE
} catch {
  $safeRunnerOutput += $_.Exception.Message
  $testExit = 1
} finally {
  foreach ($name in $variableNames) {
    [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process')
  }

  if ($appWorktreeCreated) {
    $worktreeList = & git -C $repoRoot worktree list --porcelain 2>$null
    $registeredPaths = @()
    foreach ($line in $worktreeList) {
      if ($line.StartsWith('worktree ')) {
        try { $registeredPaths += [IO.Path]::GetFullPath($line.Substring(9)) } catch { }
      }
    }
    $worktreeRegistered = @($registeredPaths | Where-Object {
      [IO.Path]::GetFullPath($_).TrimEnd([char]'\', [char]'/') -ieq
        [IO.Path]::GetFullPath($appWorktree).TrimEnd([char]'\', [char]'/')
    }).Count -eq 1
    if ($worktreeRegistered) {
      & git -C $repoRoot worktree remove --force $appWorktree 2>&1 | Out-Null
      if ($LASTEXITCODE -ne 0) { $safeRunnerOutput += 'APP_WORKTREE_CLEANUP_FAILED' }
    } else {
      $safeRunnerOutput += 'APP_WORKTREE_OWNERSHIP_NOT_VERIFIED'
    }
    if (Test-Path -LiteralPath $appWorktree) {
      $leftovers = @(Get-ChildItem -LiteralPath $appWorktree -Force)
      if ($leftovers.Count -eq 1 -and $leftovers[0].Name -eq 'node_modules' -and
        $leftovers[0].LinkType -in @('Junction', 'SymbolicLink')) {
        $junctionTarget = [IO.Path]::GetFullPath([string] $leftovers[0].Target)
        $expectedTarget = [IO.Path]::GetFullPath((Join-Path $repoRoot 'node_modules'))
        if ($junctionTarget -ieq $expectedTarget) {
          Remove-Item -LiteralPath (Join-Path $appWorktree 'node_modules') -Force
          Remove-Item -LiteralPath $appWorktree -Force
        } else {
          $safeRunnerOutput += 'APP_NODE_MODULES_JUNCTION_TARGET_UNEXPECTED'
        }
      }
      if (Test-Path -LiteralPath $appWorktree) { $safeRunnerOutput += 'APP_WORKTREE_CLEANUP_FAILED' }
    }
  }

  if ($profileOwnershipVerified) {
    & pwsh -NoProfile -File $profileRunner -Action Cleanup -RunDirectory $resolvedRun 2>&1 | Out-Null
    $cleanupExit = $LASTEXITCODE
  }
  if (Test-Path -LiteralPath $receiptPath -PathType Leaf) {
    try {
      $latestReceipt = Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json
      $acceptanceReceiptPath = Join-Path $resolvedRun 'acceptance-receipt.json'
      if (Test-Path -LiteralPath $acceptanceReceiptPath -PathType Leaf) {
        $acceptanceReceipt = Get-Content -LiteralPath $acceptanceReceiptPath -Raw | ConvertFrom-Json
        $stackCleanupStatus = if ($cleanupExit -eq 0) { 'DISPOSABLE_STACK_CLEANED' } else { 'CLEANUP_NOT_CONFIRMED' }
        $appCleanupStatus = if (!(Test-Path -LiteralPath $appWorktree)) { 'TEMP_APP_WORKTREE_REMOVED' } else { 'TEMP_APP_WORKTREE_REMAINS' }
        Add-Member -InputObject $acceptanceReceipt -NotePropertyName cleanup -NotePropertyValue $stackCleanupStatus -Force
        Add-Member -InputObject $acceptanceReceipt -NotePropertyName appWorktreeCleanup -NotePropertyValue $appCleanupStatus -Force
        Add-Member -InputObject $acceptanceReceipt -NotePropertyName applicationOverlay -NotePropertyValue $applicationOverlay -Force
        Set-Content -LiteralPath $acceptanceReceiptPath -Value ($acceptanceReceipt | ConvertTo-Json -Depth 20) -Encoding utf8
        Add-Member -InputObject $latestReceipt -NotePropertyName acceptance -NotePropertyValue $acceptanceReceipt -Force
      }
      Add-Member -InputObject $latestReceipt -NotePropertyName acceptanceCleanup -NotePropertyValue $(if ($cleanupExit -eq 0) { 'DISPOSABLE_STACK_CLEANED' } else { 'CLEANUP_NOT_CONFIRMED' }) -Force
      Add-Member -InputObject $latestReceipt -NotePropertyName acceptanceAppWorktreeCleanup -NotePropertyValue $(if (!(Test-Path -LiteralPath $appWorktree)) { 'TEMP_APP_WORKTREE_REMOVED' } else { 'TEMP_APP_WORKTREE_REMAINS' }) -Force
      Add-Member -InputObject $latestReceipt -NotePropertyName acceptanceCompletedAt -NotePropertyValue ([DateTime]::UtcNow.ToString('o')) -Force
      $latestReceipt | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $receiptPath -Encoding utf8
    } catch { $safeRunnerOutput += 'RECEIPT_UPDATE_FAILED' }
  }
}

foreach ($line in $safeRunnerOutput) { Write-Output $line }
if ($testExit -ne 0 -or $cleanupExit -ne 0 -or $safeRunnerOutput.Count -gt 0) { exit 1 }
Write-Output "PRESCHOOL_PROFILE_ACCEPTANCE_AND_CLEANUP_PASS $($receipt.projectId)"
