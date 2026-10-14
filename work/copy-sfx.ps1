$src = "D:\project\polaris-local-first\work\sfx\Shinlalala's Lewd Sound Pack"
$dst = "D:\project\polaris-local-first\public\sfx\flesh"
$map = @{ 'DryPlaps'='dryplap'; 'WetPlaps'='wetplap'; 'Wet'='wet'; 'Strokes'='stroke'; 'Cum'='cum'; 'PullOut'='pullout' }
foreach ($k in $map.Keys) {
  $from = Join-Path $src $k
  $to = Join-Path $dst $map[$k]
  New-Item -ItemType Directory -Force -Path $to | Out-Null
  Get-ChildItem -LiteralPath $from -File | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $to $_.Name) -Force }
}
Get-ChildItem -Recurse -File $dst | Group-Object { Split-Path -Leaf (Split-Path -Parent $_.FullName) } | ForEach-Object { "{0,-10} {1}" -f $_.Name, $_.Count }
"bytes: " + (Get-ChildItem -Recurse -File $dst | Measure-Object -Property Length -Sum).Sum
