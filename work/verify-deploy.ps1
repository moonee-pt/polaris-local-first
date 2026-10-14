$base = 'https://polaris-local-first-two.vercel.app'
$found = ''
for ($i = 0; $i -lt 14; $i++) {
  try {
    $html = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 40 -Uri ($base + '/?cb=' + (Get-Date).Ticks)).Content
    $assets = ([regex]::Matches($html, 'assets/[A-Za-z0-9_.\-]+\.js') | ForEach-Object { $_.Value }) | Sort-Object -Unique
    $found = ''
    foreach ($a in $assets) {
      $t = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 40 -Uri ($base + '/' + $a)).Content
      if ($t -match '"1\.9\.0"') { $found = $a; break }
    }
    $stamp = (Get-Date).ToString('HH:mm:ss')
    if ($found) { Write-Output ($stamp + '  FOUND 1.9.0 in ' + $found) ; break }
    Write-Output ($stamp + '  still old (assets=' + $assets.Count + ')')
  } catch {
    Write-Output ((Get-Date).ToString('HH:mm:ss') + '  ERR ' + $_.Exception.Message)
  }
  Start-Sleep -Seconds 20
}
