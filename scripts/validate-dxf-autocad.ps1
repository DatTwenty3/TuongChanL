# Open a DXF with AutoCAD Core Console (accoreconsole.exe), run AUDIT and re-save, to prove AutoCAD can read it.
# Usage: powershell -File scripts\validate-dxf-autocad.ps1 -Dxf "C:\path\to\ga.dxf"
# Prints AUDIT's "Total errors found N"; exits 0 when N = 0.
param([Parameter(Mandatory = $true)][string]$Dxf)

$exe = Get-ChildItem "C:\Program Files\Autodesk" -Recurse -Filter accoreconsole.exe -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending | Select-Object -First 1
if (-not $exe) { Write-Error "accoreconsole.exe not found (AutoCAD is required)."; exit 2 }

$src = (Resolve-Path $Dxf).Path
$tmp = Join-Path $env:TEMP ("hoga-validate-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tmp | Out-Null
$out = Join-Path $tmp "resaved.dxf"
$log = Join-Path $tmp "log.txt"
$scr = Join-Path $tmp "run.scr"
"FILEDIA 0`r`n_AUDIT`r`nY`r`n_DXFOUT`r`n$out`r`n16`r`n_QUIT Y`r`n" | Set-Content -Encoding ASCII $scr

$p = Start-Process -FilePath $exe.FullName -ArgumentList "/i", "`"$src`"", "/s", "`"$scr`"", "/l", "en-US" `
  -PassThru -NoNewWindow -RedirectStandardOutput $log
if (-not $p.WaitForExit(300000)) { $p.Kill(); Write-Error "Timed out waiting for AutoCAD."; exit 3 }

$text = (Get-Content $log -Raw) -replace "`0", ""
$text -split "`r?`n" | Where-Object { $_ -match "objects audited|Total errors|rror|discarded" }
if (-not (Test-Path $out)) { Write-Error "AutoCAD could not read the DXF file."; exit 1 }
if ($text -match "Total errors found (\d+)") { if ([int]$Matches[1] -gt 0) { exit 1 } }
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "OK: AutoCAD opened the file and AUDIT found no errors."
