# Crea (o quita) la tarea del Programador de tareas de Windows que envía los recordatorios.
#
#   .\tarea-windows.ps1 -SiteUrl "https://tu-sitio.cl"          crea la tarea (cada 10 minutos)
#   .\tarea-windows.ps1 -SiteUrl "https://tu-sitio.cl" -Cada 5  cada 5 minutos
#   .\tarea-windows.ps1 -Quitar                                 borra la tarea
#
# La tarea se ejecuta con tu usuario, mientras tengas la sesión de Windows iniciada, y no se encima
# consigo misma: si una vuelta sigue enviando, la siguiente se omite.
param(
  [string]$SiteUrl = "",
  [int]$Cada = 10,
  [switch]$Quitar
)
$nombre = "Kizuna - Recordatorios WhatsApp"

if ($Quitar) {
  Unregister-ScheduledTask -TaskName $nombre -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Tarea «$nombre» eliminada."
  return
}

$nodeExe = (Get-Command node -ErrorAction Stop).Source
$runner = Join-Path $PSScriptRoot "ejecutar-recordatorios.ps1"
$argumentos = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runner`" -Node `"$nodeExe`""
if ($SiteUrl) { $argumentos += " -SiteUrl `"$SiteUrl`"" }

$accion = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argumentos -WorkingDirectory $PSScriptRoot
$disparador = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $Cada)
$ajustes = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
  -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $nombre -Action $accion -Trigger $disparador -Settings $ajustes `
  -Description "Envía por WhatsApp el recordatorio de cada clase 4 horas antes (scripts/wsp)." -Force | Out-Null

Write-Host "Tarea «$nombre» creada: se ejecuta cada $Cada minutos."
Write-Host "Registro de lo que hace: $(Join-Path $PSScriptRoot 'recordatorios.log')"
Write-Host "Probar ahora:  Start-ScheduledTask -TaskName '$nombre'"

