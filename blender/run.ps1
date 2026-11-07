# Runs a pipeline script headless with the Microsoft Store Blender and waits for it to finish.
# Usage: .\run.ps1 <script.py> [script args...]
# The Store build only launches through blender-launcher, which discards console output;
# scripts write their own log to blender/.logs/<script>.log (see common.py).
param([Parameter(Mandatory = $true)][string]$Script, [Parameter(ValueFromRemainingArguments = $true)][string[]]$ScriptArgs)

$launcher = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\blender-launcher.exe'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptPath = Join-Path $here $Script
$log = Join-Path $here ('.logs\' + [IO.Path]::GetFileNameWithoutExtension($Script) + '.log')

$list = @('--background', '--factory-startup', '--python-exit-code', '1', '--python', "`"$scriptPath`"", '--')
if ($ScriptArgs) { $list += $ScriptArgs }
$before = @(Get-Process blender -ErrorAction SilentlyContinue | ForEach-Object Id)
$proc = Start-Process $launcher -ArgumentList $list -PassThru -Wait
Start-Sleep -Seconds 2
do {
    $running = @(Get-Process blender -ErrorAction SilentlyContinue | Where-Object { $before -notcontains $_.Id })
    if ($running.Count) { Start-Sleep -Seconds 2 }
} while ($running.Count)
Write-Output "done (launcher exit $($proc.ExitCode)); log: $log"
