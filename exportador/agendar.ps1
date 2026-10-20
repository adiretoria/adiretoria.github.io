# Atualiza o site a cada 15 minutos: exporta as ofertas publicadas pelo robô e envia ao GitHub (sem janela).
# Uso:     powershell -ExecutionPolicy Bypass -File exportador\agendar.ps1
# Remover: powershell -ExecutionPolicy Bypass -File exportador\agendar.ps1 -Remover
param([switch]$Remover)
$nome = 'ADiretoriaSite'
$pasta = (Resolve-Path "$PSScriptRoot\..").Path

if ($Remover) {
  Unregister-ScheduledTask -TaskName $nome -Confirm:$false -ErrorAction SilentlyContinue
  Write-Output "Tarefa $nome removida. O site continua no ar com a última lista enviada."
  return
}

# Log com rotação simples: guarda só o arquivo atual e o anterior.
Set-Content -Encoding ascii "$pasta\exportador\rodar.ps1" @"
Set-Location '$pasta'
`$log = '$pasta\exportador\exportar.log'
if ((Test-Path `$log) -and (Get-Item `$log).Length -gt 1MB) { Move-Item -Force `$log "`$log.anterior" }
& node exportador/exportar.js --publicar *>> `$log
"@
$acao = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$pasta\exportador\rodar.ps1`"" -WorkingDirectory $pasta
$aoEntrar = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$aCada15min = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 15)
$config = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName $nome -Action $acao -Trigger @($aoEntrar, $aCada15min) -Settings $config -Description 'A Diretoria: atualiza o site de ofertas (GitHub Pages)' -Force | Out-Null
Start-ScheduledTask -TaskName $nome
Write-Output "Tarefa ${nome}: atualiza o site a cada 15 min. Log: $pasta\exportador\exportar.log"
