$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
$runDir = Join-Path $root ".run"

function Stop-ProcessTree {
    param([int]$ProcessId)

    $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $ProcessId }
    foreach ($child in $children) {
        Stop-ProcessTree -ProcessId $child.ProcessId
    }

    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path $runDir)) {
    Write-Host "No local process metadata found."
} else {
    Get-ChildItem $runDir -Filter *.pid | ForEach-Object {
        $pidValue = Get-Content $_.FullName | Select-Object -First 1
        if ($pidValue) {
            Stop-ProcessTree -ProcessId ([int]$pidValue)
            Write-Host "Stopped PID $pidValue"
        }
    }

    Remove-Item $runDir -Recurse -Force -ErrorAction SilentlyContinue
}

# Clean up orphaned DebugWise analysis/web/gateway processes left from previous interrupted runs.
Get-CimInstance Win32_Process |
    Where-Object {
        ($_.CommandLine -like "*uvicorn services.analysis.app.main:app*") -or
        ($_.CommandLine -like "*tsx watch src/server.ts*") -or
        ($_.CommandLine -like "*vite.js*DebugWise.AI*")
    } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }

Write-Host "DebugWise.AI local processes stopped."
