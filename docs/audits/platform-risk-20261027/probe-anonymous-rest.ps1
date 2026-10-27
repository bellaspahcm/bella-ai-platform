$ErrorActionPreference = 'Stop'
$startedUtc = [DateTime]::UtcNow
$projectRef = 'lvnvkpyxtuilhrabtlwv'
$envPath = 'D:\Antigravity\Projects\BELLA SPA ERP\.env.local'
$vars = @{}
foreach ($line in Get-Content -LiteralPath $envPath) {
  if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    $name = $Matches[1]
    if ($name -in @('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')) {
      $value = $Matches[2].Trim()
      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      $vars[$name] = $value
    }
  }
}

$baseUrl = $vars['NEXT_PUBLIC_SUPABASE_URL']
if (-not $baseUrl) { $baseUrl = $vars['SUPABASE_URL'] }
$anonKey = $vars['NEXT_PUBLIC_SUPABASE_ANON_KEY']
if (-not $anonKey) { $anonKey = $vars['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] }
if (-not $baseUrl -or -not $anonKey) { throw 'Public Supabase URL/key is unavailable.' }
$uri = [uri]$baseUrl
if ($uri.Host -notlike "$projectRef.*") { throw 'Configured public URL does not match the authorized primary project.' }

$client = [System.Net.Http.HttpClient]::new()
$headers = @{
  apikey = $anonKey
  Authorization = "Bearer $anonKey"
}
$results = [System.Collections.Generic.List[object]]::new()

foreach ($table in @('auto_vehicles_history', 'auto_bookings_history', 'auto_customer_journeys_history', 'hc_temporal_events', 'hc_temporal_snapshots')) {
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Head, "$baseUrl/rest/v1/${table}?select=id&limit=1")
  foreach ($entry in $headers.GetEnumerator()) { [void]$request.Headers.TryAddWithoutValidation($entry.Key, $entry.Value) }
  $response = $client.SendAsync($request).GetAwaiter().GetResult()
  $results.Add([pscustomobject]@{ endpoint = "table:$table"; http_status = [int]$response.StatusCode; denied = ([int]$response.StatusCode -in @(401, 403, 404)) })
  $response.Dispose(); $request.Dispose()
}

$rpcBodies = @{
  get_booking_as_of = @{ p_entity_id = '00000000-0000-0000-0000-000000000001'; p_as_of_date = '2026-10-27T00:00:00Z'; p_tenant_id = '00000000-0000-0000-0000-000000000002' }
  get_journey_as_of = @{ p_entity_id = '00000000-0000-0000-0000-000000000001'; p_as_of_date = '2026-10-27T00:00:00Z'; p_tenant_id = '00000000-0000-0000-0000-000000000002' }
  get_temporal_vehicle_inventory = @{ p_tenant_id = '00000000-0000-0000-0000-000000000002'; p_as_of_time = '2026-10-27T00:00:00Z' }
  get_vehicle_as_of = @{ p_entity_id = '00000000-0000-0000-0000-000000000001'; p_as_of_date = '2026-10-27T00:00:00Z'; p_tenant_id = '00000000-0000-0000-0000-000000000002' }
  get_vehicle_status_history = @{ p_tenant_id = '00000000-0000-0000-0000-000000000002'; p_vehicle_id = '00000000-0000-0000-0000-000000000001'; p_start_time = '2026-01-01T00:00:00Z'; p_end_time = '2026-10-27T00:00:00Z' }
  reconstruct_temporal_state_at = @{ p_tenant_id = '00000000-0000-0000-0000-000000000002'; p_encounter_id = '00000000-0000-0000-0000-000000000001'; p_target_time = '2026-10-27T00:00:00Z'; p_dimension = 'VALID_TIME' }
}

foreach ($rpc in $rpcBodies.Keys) {
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, "$baseUrl/rest/v1/rpc/$rpc")
  foreach ($entry in $headers.GetEnumerator()) { [void]$request.Headers.TryAddWithoutValidation($entry.Key, $entry.Value) }
  $json = ConvertTo-Json -InputObject $rpcBodies[$rpc] -Compress
  $request.Content = [System.Net.Http.StringContent]::new($json, [System.Text.Encoding]::UTF8, 'application/json')
  $response = $client.SendAsync($request).GetAwaiter().GetResult()
  $results.Add([pscustomobject]@{ endpoint = "rpc:$rpc"; http_status = [int]$response.StatusCode; denied = ([int]$response.StatusCode -in @(401, 403, 404)) })
  $response.Dispose(); $request.Dispose()
}

$client.Dispose()
$resultJson = $results | Sort-Object endpoint | ConvertTo-Json -Depth 4
$resultPath = Join-Path $PSScriptRoot 'containment-anonymous-rest-post-change.json'
Set-Content -LiteralPath $resultPath -Value $resultJson
$endedUtc = [DateTime]::UtcNow
$scriptHash = (Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()
[ordered]@{
  command = 'pwsh -NoProfile -File docs/audits/platform-risk-20261027/probe-anonymous-rest.ps1'
  startedUtc = $startedUtc.ToString('o')
  endedUtc = $endedUtc.ToString('o')
  exitCode = 0
  scriptSha256 = $scriptHash
  resultFile = [System.IO.Path]::GetFileName($resultPath)
  credentialsRetained = $false
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'containment-anonymous-rest-post-change.execution.json')
$resultJson
