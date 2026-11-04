param(
  [Parameter(Mandatory = $true)]
  [string] $RunDirectory,

  [ValidateSet('TeacherAttendance', 'Admission', 'GuardianRead')]
  [string] $AcceptanceType = 'TeacherAttendance'
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

$scriptRepoPath = Join-Path $PSScriptRoot '..\..\..'
$repoRoot = (& git -C $scriptRepoPath rev-parse --show-toplevel 2>$null).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($repoRoot)) {
  throw 'PROFILE_GIT_REPOSITORY_ROOT_UNAVAILABLE'
}
$profileRunner = Join-Path $PSScriptRoot 'run.ps1'
$acceptanceScript = if ($AcceptanceType -eq 'Admission') {
  Join-Path $PSScriptRoot 'preschool-admission.e2e.mjs'
} else { Join-Path $PSScriptRoot 'teacher-attendance.e2e.mjs' }
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
$activeProfileId = if ($AcceptanceType -eq 'Admission') {
  [string] $manifest.admissionProfile.profileId
} else {
  [string] $manifest.profileId
}
$activeProfileMigrations = @($manifest.profileMigrations)
if ($AcceptanceType -eq 'Admission') {
  $activeProfileMigrations = @($activeProfileMigrations | Where-Object { $_.profileVersion -ne '20261019020001' })
  $activeProfileMigrations = @($activeProfileMigrations + @($manifest.admissionProfile.profileMigrations) | Sort-Object { [string] $_.profileVersion })
}
$dbResultsPath = Join-Path $resolvedRun 'admission-db-results.json'
$currentHead = (& git -C $repoRoot rev-parse HEAD).Trim()
$pinnedRevision = [string] $manifest.sourceRevisionRequired
if ($LASTEXITCODE -ne 0 -or $currentHead -notmatch '^[a-f0-9]{40}$' -or
  $currentHead -ne $receipt.sourceRevision -or
  (![string]::IsNullOrWhiteSpace($pinnedRevision) -and $pinnedRevision -ne $receipt.sourceRevision)) {
  throw 'PROFILE_SOURCE_REVISION_MISMATCH'
}
foreach ($entry in $activeProfileMigrations) {
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
if ($receipt.projectId -ne $intent.projectId -or $receipt.profileId -ne $activeProfileId -or $receipt.acceptanceType -ne $AcceptanceType -or $intent.acceptanceType -ne $AcceptanceType -or
  $receipt.schemaAcceptance -ne 'PASS' -or $receipt.realJwt -ne 'NOT_RUN' -or $receipt.browserE2e -ne 'NOT_RUN') {
  throw 'PROFILE_NOT_AT_SCHEMA_ACCEPTANCE_CHECKPOINT'
}
if ($receipt.databasePort -ne ($intent.portBase + 1) -or $receipt.databaseContainerId -ne $intent.databaseContainerId) {
  throw 'PROFILE_OWNERSHIP_MARKER_MISMATCH'
}

$statusLines = & pwsh -NoProfile -File $profileRunner -Action Status -AcceptanceType $AcceptanceType -RunDirectory $resolvedRun 2>&1
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
  'BELLA_PROFILE_APP_ROOT', 'BELLA_PROFILE_TARGET_COMMIT', 'BELLA_PROFILE_REPO_ROOT',
  'BELLA_PROFILE_DB_RESULTS_PATH', 'PRESCHOOL_ADMISSION_DB_PHASE', 'PRESCHOOL_PROOF_DB_URL', 'PRESCHOOL_PROOF_SHA',
  'PRESCHOOL_PROFILE_ACCEPTANCE_FOCUS'
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

  $runtimeScopes = @('src/app', 'src/lib', 'src/services', 'src/platform', 'src/products', 'src/types')
  $runtimeChanges = @(& git -C $repoRoot diff --name-only $receipt.sourceRevision -- $runtimeScopes |
    Where-Object { $_ -notmatch '(^|/)__tests__/' -and $_ -notmatch '\.(test|spec)\.' })
  if ($LASTEXITCODE -ne 0) { throw 'APP_RUNTIME_DIFF_READ_FAILED' }
  $untrackedRuntimeChanges = @(& git -C $repoRoot ls-files --others --exclude-standard -- $runtimeScopes |
    Where-Object { $_ -notmatch '(^|/)__tests__/' -and $_ -notmatch '\.(test|spec)\.' })
  if ($LASTEXITCODE -ne 0) { throw 'APP_UNTRACKED_RUNTIME_SOURCE_READ_FAILED' }

  $approvedOverlayByPath = @{}
  foreach ($entry in @($manifest.approvedRuntimeOverlays)) {
    $relativePath = [string] $entry.path
    if ([string]::IsNullOrWhiteSpace($relativePath) -or ($relativePath -match '(^|/)\.\.(?:/|$)') -or $relativePath.StartsWith('/') -or $relativePath.Contains(':') -or ($relativePath -notmatch '^(src/(app|lib|services|platform|products|types)/)')) {
      throw 'APP_RUNTIME_OVERLAY_MANIFEST_PATH_INVALID'
    }
    if ($approvedOverlayByPath.ContainsKey($relativePath)) { throw 'APP_RUNTIME_OVERLAY_MANIFEST_DUPLICATE_PATH' }
    $approvedOverlayByPath[$relativePath] = [string] $entry.sha256
  }
  foreach ($relativePath in $untrackedRuntimeChanges) {
    if (!$approvedOverlayByPath.ContainsKey($relativePath)) {
      throw 'APP_UNTRACKED_RUNTIME_SOURCE_REQUIRES_REVIEW'
    }
    $sourcePath = [IO.Path]::GetFullPath((Join-Path $repoRoot $relativePath))
    $repoPrefix = [IO.Path]::GetFullPath($repoRoot).TrimEnd([char]'\', [char]'/') + $pathSeparator
    if (!$sourcePath.StartsWith($repoPrefix, [StringComparison]::OrdinalIgnoreCase) -or
      !(Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
      throw 'APP_RUNTIME_OVERLAY_SOURCE_PATH_INVALID'
    }
    if ((Get-CanonicalSourceSha256 $sourcePath) -ne $approvedOverlayByPath[$relativePath]) {
      throw 'APP_RUNTIME_OVERLAY_SOURCE_HASH_MISMATCH'
    }
  }
  $overlayFiles = @()
  $runtimeOverlayPaths = @($runtimeChanges + $untrackedRuntimeChanges | Sort-Object -Unique)
  foreach ($relativePath in $runtimeOverlayPaths) {
    $sourcePath = [IO.Path]::GetFullPath((Join-Path $repoRoot $relativePath))
    $destinationPath = [IO.Path]::GetFullPath((Join-Path $appWorktree $relativePath))
    $repoPrefix = [IO.Path]::GetFullPath($repoRoot).TrimEnd([char]'\', [char]'/') + $pathSeparator
    $appPrefix = [IO.Path]::GetFullPath($appWorktree).TrimEnd([char]'\', [char]'/') + $pathSeparator
    if (!$sourcePath.StartsWith($repoPrefix, [StringComparison]::OrdinalIgnoreCase) -or
      !$destinationPath.StartsWith($appPrefix, [StringComparison]::OrdinalIgnoreCase) -or
      !(Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
      throw 'APP_RUNTIME_OVERLAY_PATH_INVALID'
    }
    $isUntracked = $untrackedRuntimeChanges -contains $relativePath
    if ($isUntracked) {
      New-Item -ItemType Directory -Path (Split-Path -Parent $destinationPath) -Force | Out-Null
    } elseif (!(Test-Path -LiteralPath $destinationPath -PathType Leaf)) {
      throw 'APP_TRACKED_RUNTIME_OVERLAY_TARGET_MISSING'
    }
    $sourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
    $destinationHash = (Get-FileHash -LiteralPath $destinationPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($sourceHash -ne $destinationHash) { throw 'APP_RUNTIME_OVERLAY_COPY_MISMATCH' }
    $overlayFiles += [pscustomobject]@{ path = $relativePath; sha256 = $sourceHash }
  }
  $testOverlayFiles = @()
  if ($AcceptanceType -eq 'Admission') {
    $admissionTestPath = 'src/products/bella-education/__tests__/preschool-admission-real-db.test.ts'
    $testEntries = @($manifest.approvedTestOverlays | Where-Object { [string] $_.path -eq $admissionTestPath })
    if ($testEntries.Count -ne 1) { throw 'ADMISSION_TEST_OVERLAY_NOT_APPROVED' }
    $sourcePath = [IO.Path]::GetFullPath((Join-Path $repoRoot $admissionTestPath))
    $destinationPath = [IO.Path]::GetFullPath((Join-Path $appWorktree $admissionTestPath))
    $repoPrefix = [IO.Path]::GetFullPath($repoRoot).TrimEnd([char]'\', [char]'/') + $pathSeparator
    $appPrefix = [IO.Path]::GetFullPath($appWorktree).TrimEnd([char]'\', [char]'/') + $pathSeparator
    if (!$sourcePath.StartsWith($repoPrefix, [StringComparison]::OrdinalIgnoreCase) -or
      !$destinationPath.StartsWith($appPrefix, [StringComparison]::OrdinalIgnoreCase) -or
      !(Test-Path -LiteralPath $sourcePath -PathType Leaf) -or
      !(Test-Path -LiteralPath $destinationPath -PathType Leaf)) {
      throw 'ADMISSION_TEST_OVERLAY_PATH_INVALID'
    }
    $sourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($sourceHash -ne [string] $testEntries[0].sha256) { throw 'ADMISSION_TEST_OVERLAY_HASH_MISMATCH' }
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
    if ((Get-FileHash -LiteralPath $destinationPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sourceHash) {
      throw 'ADMISSION_TEST_OVERLAY_COPY_MISMATCH'
    }
    $testOverlayFiles += [pscustomobject]@{ path = $admissionTestPath; sha256 = $sourceHash }
  }
  $applicationOverlay = [pscustomobject]@{
    sourceRevision = $receipt.sourceRevision
    status = if (($overlayFiles.Count + $testOverlayFiles.Count) -gt 0) { 'HASH_VERIFIED_LOCAL_RUNTIME_AND_TEST_CHANGES_APPLIED' } else { 'CLEAN_COMMIT_RUNTIME'
    }
    files = @($overlayFiles)
    testFiles = @($testOverlayFiles)
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

  if ($AcceptanceType -eq 'Admission') {
    if ([int] $receipt.databasePort -ne ($apiUri.Port + 1)) { throw 'ADMISSION_PROFILE_API_DB_PORT_MISMATCH' }
    $jestCli = Join-Path $appWorktree 'node_modules\jest\bin\jest.js'
    $jestConfig = Join-Path $appWorktree 'jest.config.ts'
    $admissionTest = Join-Path $appWorktree 'src\products\bella-education\__tests__\preschool-admission-real-db.test.ts'
    foreach ($path in @($jestCli, $jestConfig, $admissionTest)) {
      if (!(Test-Path -LiteralPath $path -PathType Leaf)) { throw 'ADMISSION_DB_TEST_HARNESS_UNAVAILABLE' }
    }
    $admissionProofDirectory = Join-Path $appWorktree 'implementation-artifacts\preschool-full-chain'
    New-Item -ItemType Directory -Path $admissionProofDirectory -Force | Out-Null
    $phaseResults = @()
    foreach ($phase in @('commit', 'restart')) {
      $reportPath = Join-Path $resolvedRun "admission-db-$phase-jest.json"
      $logPath = Join-Path $resolvedRun "admission-db-$phase.log"
      $env:PRESCHOOL_ADMISSION_DB_PHASE = $phase
      $env:PRESCHOOL_PROOF_DB_URL = $statusVars.DB_URL
      $env:PRESCHOOL_PROOF_SHA = $receipt.sourceRevision
      Push-Location -LiteralPath $appWorktree
      try {
        $jestOutput = @(& node $jestCli --config $jestConfig --runInBand --runTestsByPath $admissionTest --json "--outputFile=$reportPath" 2>&1)
        $jestExit = $LASTEXITCODE
      } finally { Pop-Location }
      $safeOutput = ($jestOutput | ForEach-Object { [string] $_ }) -join [Environment]::NewLine
      $safeOutput = [regex]::Replace($safeOutput, '(?i)(sb_(?:publishable|secret)_[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,})', '[REDACTED_SECRET]')
      $safeOutput = [regex]::Replace($safeOutput, '(?i)postgres(?:ql)?://[^"\s]+', '[REDACTED_DATABASE_URL]')
      $safeOutput = [regex]::Replace($safeOutput, '(?i)(password|service_role_key|anon_key)(\s*[:=]\s*)[^\s,;]+', '$1$2[REDACTED]')
      [IO.File]::WriteAllText($logPath, $safeOutput + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
      if ($jestExit -ne 0 -or !(Test-Path -LiteralPath $reportPath -PathType Leaf)) {
        throw "ADMISSION_REAL_DB_$($phase.ToUpperInvariant())_FAILED; see redacted run log."
      }
      $jestReport = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
      $assertions = @($jestReport.testResults | ForEach-Object { $_.assertionResults })
      $passed = @($assertions | Where-Object { $_.status -eq 'passed' }).Count
      $failed = @($assertions | Where-Object { $_.status -eq 'failed' }).Count
      if ($jestReport.success -ne $true -or $passed -lt 1 -or $failed -ne 0) {
        throw "ADMISSION_REAL_DB_$($phase.ToUpperInvariant())_HAS_NO_PASSING_ASSERTIONS"
      }
      $phaseResults += [ordered]@{ phase = $phase; status = 'PASS'; passedTests = $passed; failedTests = $failed }
    }
    $dbResults = [ordered]@{ profileId = $activeProfileId; targetRevision = $receipt.sourceRevision; status = 'PASS'; phases = $phaseResults }
    $dbResults | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $dbResultsPath -Encoding utf8
    $env:BELLA_PROFILE_DB_RESULTS_PATH = $dbResultsPath
  }

  $env:PRESCHOOL_PROFILE_ACCEPTANCE_FOCUS = if ($AcceptanceType -eq 'GuardianRead') { 'guardian' } else { 'full' }
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
    & pwsh -NoProfile -File $profileRunner -Action Cleanup -AcceptanceType $AcceptanceType -RunDirectory $resolvedRun 2>&1 | Out-Null
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
        $boundedStatus = if ($testExit -eq 0 -and $cleanupExit -eq 0 -and
          $acceptanceReceipt.jwtDatabase.status -eq 'PASS' -and $acceptanceReceipt.browserE2e.status -eq 'PASS' -and
          $acceptanceReceipt.readback.status -eq 'PASS' -and $appCleanupStatus -eq 'TEMP_APP_WORKTREE_REMOVED') {
          'PASS_BOUNDED_LOCAL'
        } else { 'NOT_PROVEN' }
        Add-Member -InputObject $acceptanceReceipt -NotePropertyName boundedStatus -NotePropertyValue $boundedStatus -Force
        Add-Member -InputObject $acceptanceReceipt -NotePropertyName cleanup -NotePropertyValue $stackCleanupStatus -Force
        Add-Member -InputObject $acceptanceReceipt -NotePropertyName appWorktreeCleanup -NotePropertyValue $appCleanupStatus -Force
        Add-Member -InputObject $acceptanceReceipt -NotePropertyName applicationOverlay -NotePropertyValue $applicationOverlay -Force
        Set-Content -LiteralPath $acceptanceReceiptPath -Value ($acceptanceReceipt | ConvertTo-Json -Depth 20) -Encoding utf8
        Add-Member -InputObject $latestReceipt -NotePropertyName acceptance -NotePropertyValue $acceptanceReceipt -Force
        Add-Member -InputObject $latestReceipt -NotePropertyName boundedStatus -NotePropertyValue $boundedStatus -Force
        Add-Member -InputObject $latestReceipt -NotePropertyName realJwt -NotePropertyValue $(if ($acceptanceReceipt.jwtDatabase.status -eq 'PASS') { 'PASS' } else { 'NOT_PROVEN' }) -Force
        Add-Member -InputObject $latestReceipt -NotePropertyName browserE2e -NotePropertyValue $acceptanceReceipt.browserE2e.status -Force
      } else {
        Add-Member -InputObject $latestReceipt -NotePropertyName boundedStatus -NotePropertyValue 'NOT_PROVEN' -Force
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
