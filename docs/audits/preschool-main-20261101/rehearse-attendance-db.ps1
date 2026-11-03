param([Parameter(Mandatory=$true)][string]$RunDirectory,[Parameter(Mandatory=$true)][ValidateSet('v1','v2')][string]$Label)
$ErrorActionPreference='Stop'
$taskRun=(Resolve-Path -LiteralPath $RunDirectory).Path
$taskReceipt=Get-Content -LiteralPath (Join-Path $taskRun 'receipt.json') -Raw|ConvertFrom-Json
$taskIntent=Get-Content -LiteralPath (Join-Path $taskRun 'owner-intent.json') -Raw|ConvertFrom-Json
if($taskReceipt.projectId -ne $taskIntent.projectId -or $taskIntent.projectId -notmatch '^bella-preschool-[a-f0-9]{8}$' -or $taskReceipt.schemaAcceptance -ne 'PASS'){throw 'OWNED_PROFILE_CHECKPOINT_REQUIRED'}
$taskSaved=@{}
$taskNames=@('BELLA_PROFILE_API_URL','BELLA_PROFILE_DB_URL','BELLA_PROFILE_ANON_KEY','BELLA_PROFILE_SERVICE_ROLE_KEY')
foreach($n in $taskNames){$taskSaved[$n]=[Environment]::GetEnvironmentVariable($n,'Process')}
$taskExit=1
try {
 $taskStatus=@(& supabase status --workdir $taskRun -o env 2>&1);if($LASTEXITCODE -ne 0){throw 'LOCAL_STATUS_FAILED'}
 $taskVars=@{}
 foreach($line in $taskStatus){$t=[string]$line;if($t -match '^\s*\$env:([A-Z0-9_]+)="(.*)"$'){$taskVars[$matches[1]]=$matches[2]}elseif($t -match '^\s*([A-Z0-9_]+)=(.*)$'){$taskVars[$matches[1]]=$matches[2].Trim('"')}}
 foreach($key in @('API_URL','DB_URL','ANON_KEY','SERVICE_ROLE_KEY')){if(!$taskVars.ContainsKey($key)){throw 'LOCAL_CONNECTION_INFO_MISSING'}}
 if(([uri]$taskVars.API_URL).Host -notin @('127.0.0.1','localhost') -or ([uri]$taskVars.DB_URL).Host -notin @('127.0.0.1','localhost')){throw 'REMOTE_TARGET_REFUSED'}
 $env:BELLA_PROFILE_API_URL=$taskVars.API_URL
 $env:BELLA_PROFILE_DB_URL=$taskVars.DB_URL
 $env:BELLA_PROFILE_ANON_KEY=$taskVars.ANON_KEY
 $env:BELLA_PROFILE_SERVICE_ROLE_KEY=$taskVars.SERVICE_ROLE_KEY
 & node docs/audits/preschool-main-20261101/rehearse-attendance-db.mjs $taskRun $Label
 $taskExit=$LASTEXITCODE
} finally {
 foreach($n in $taskNames){[Environment]::SetEnvironmentVariable($n,$taskSaved[$n],'Process')}
 & pwsh -NoProfile -File scripts/ci/preschool-browser-profile/run.ps1 -Action Cleanup -RunDirectory $taskRun
 if($LASTEXITCODE -ne 0){$taskExit=1}
}
exit $taskExit

