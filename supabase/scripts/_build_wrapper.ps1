$header    = Get-Content "d:\Antigravity\Projects\BELLA SPA ERP\supabase\scripts\_wrapper_header.sql" -Raw
$section0  = Get-Content "d:\Antigravity\Projects\BELLA SPA ERP\supabase\scripts\_wrapper_section0.sql" -Raw
$m1Body    = Get-Content "d:\Antigravity\Projects\BELLA SPA ERP\supabase\migrations\20261113165251_interior_commercial_transaction_engine.sql" -Raw
$footer    = Get-Content "d:\Antigravity\Projects\BELLA SPA ERP\supabase\scripts\_wrapper_footer.sql" -Raw

$full = $header + "`r`n" + $section0 + "`r`n" + $m1Body + "`r`n" + $footer

[System.IO.File]::WriteAllText(
    "d:\Antigravity\Projects\BELLA SPA ERP\supabase\scripts\m1_wrapper_window_b.sql",
    $full,
    [System.Text.Encoding]::UTF8
)

$finalLines = (Get-Content "d:\Antigravity\Projects\BELLA SPA ERP\supabase\scripts\m1_wrapper_window_b.sql").Count
$finalBytes = (Get-Item "d:\Antigravity\Projects\BELLA SPA ERP\supabase\scripts\m1_wrapper_window_b.sql").Length
Write-Host "Final wrapper: $finalLines lines, $finalBytes bytes"
