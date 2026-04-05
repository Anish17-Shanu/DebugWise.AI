[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Test-CommandAvailable {
    param([string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Write-Check {
    param(
        [string]$Label,
        [bool]$Ok,
        [string]$Detail
    )

    $status = if ($Ok) { "OK" } else { "WARN" }
    $color = if ($Ok) { "Green" } else { "Yellow" }
    Write-Host ("[{0}] {1}: {2}" -f $status, $Label, $Detail) -ForegroundColor $color
}

function Get-VersionLine {
    param(
        [string]$Command,
        [string[]]$Arguments = @("--version")
    )

    try {
        return (& $Command @Arguments 2>$null | Select-Object -First 1)
    } catch {
        return "unknown"
    }
}

Push-Location $root
try {
    $nodeOk = Test-CommandAvailable "node"
    $npmOk = Test-CommandAvailable "npm"
    $pythonOk = Test-CommandAvailable "python"
    $dockerOk = Test-CommandAvailable "docker"
    $ollamaOk = Test-CommandAvailable "ollama"
    $envOk = Test-Path ".env"
    $venvOk = Test-Path ".venv\Scripts\python.exe"
    $modulesOk = Test-Path "node_modules"

    Write-Host "DebugWise.AI local environment doctor" -ForegroundColor Cyan
    Write-Check -Label "Node" -Ok $nodeOk -Detail ($(if ($nodeOk) { Get-VersionLine "node" } else { "missing from PATH" }))
    Write-Check -Label "npm" -Ok $npmOk -Detail ($(if ($npmOk) { Get-VersionLine "npm" } else { "missing from PATH" }))
    Write-Check -Label "Python" -Ok $pythonOk -Detail ($(if ($pythonOk) { Get-VersionLine "python" } else { "missing from PATH" }))
    Write-Check -Label ".env" -Ok $envOk -Detail ($(if ($envOk) { "present" } else { "missing; bootstrap will create it from .env.example" }))
    Write-Check -Label "node_modules" -Ok $modulesOk -Detail ($(if ($modulesOk) { "installed" } else { "missing; run bootstrap-local.ps1" }))
    Write-Check -Label ".venv" -Ok $venvOk -Detail ($(if ($venvOk) { "present" } else { "missing; run bootstrap-local.ps1" }))
    Write-Check -Label "Docker" -Ok $dockerOk -Detail ($(if ($dockerOk) { "available for sandbox mode" } else { "optional; local runtime fallback will be used" }))
    Write-Check -Label "Ollama" -Ok $ollamaOk -Detail ($(if ($ollamaOk) { "available for local AI responses" } else { "optional; deterministic fallback assistant will be used" }))

    if (-not ($nodeOk -and $npmOk -and $pythonOk)) {
        throw "Critical dependencies are missing. Install Node.js and Python, then re-run the doctor."
    }

    Write-Host ""
    Write-Host "Recommended next command:" -ForegroundColor Cyan
    if (-not ($modulesOk -and $venvOk)) {
        Write-Host "powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-local.ps1" -ForegroundColor Green
    } else {
        Write-Host "powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1 -Mode Native" -ForegroundColor Green
    }
}
finally {
    Pop-Location
}
