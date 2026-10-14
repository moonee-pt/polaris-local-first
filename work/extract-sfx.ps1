Add-Type -AssemblyName System.IO.Compression.FileSystem
$src = "C:\Users\Administrator\Documents\xwechat_files\wxid_5crhyvqwil4u22_25bb\msg\file\2026-10\Shinlalala's Lewd Sound Pack.zip"
$dst = "D:\project\polaris-local-first\work\sfx"
$z = [System.IO.Compression.ZipFile]::OpenRead($src)
foreach ($e in $z.Entries) {
  if ($e.Name -eq "") { continue }
  $target = Join-Path $dst ($e.FullName -replace '/', '\')
  $dir = Split-Path -Parent $target
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, $target, $true)
}
$z.Dispose()
Get-ChildItem -Recurse -File $dst | Group-Object { Split-Path -Leaf (Split-Path -Parent $_.FullName) } | ForEach-Object { "{0,-12} {1}" -f $_.Name, $_.Count }
