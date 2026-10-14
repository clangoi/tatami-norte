# Una vuelta de recordatorios (node recordatorios.js --once). La usa el Programador de tareas de Windows.
# Deja lo que imprime en recordatorios.log (en esta misma carpeta).
param(
  [string]$SiteUrl = "",      # https://tu-sitio.cl  (para el enlace de cambiar o cancelar)
  [string]$Node = "node",     # ruta de node.exe
  [switch]$Dry                # solo muestra qué enviaría
)
$ErrorActionPreference = "Continue"
Set-Location -LiteralPath $PSScriptRoot
if ($SiteUrl) { $env:SITE_URL = $SiteUrl }
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8   # para que el registro conserve tildes y emojis
$modo = if ($Dry) { "--dry" } else { "--once" }
$log = Join-Path $PSScriptRoot "recordatorios.log"
"=== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $modo ===" | Out-File -FilePath $log -Append -Encoding utf8
& $Node "recordatorios.js" $modo 2>&1 | Out-File -FilePath $log -Append -Encoding utf8
# el registro no crece sin límite: se conservan las últimas 2000 líneas
$lines = Get-Content -LiteralPath $log -ErrorAction SilentlyContinue
if ($lines.Count -gt 2000) { $lines | Select-Object -Last 2000 | Set-Content -LiteralPath $log -Encoding utf8 }
