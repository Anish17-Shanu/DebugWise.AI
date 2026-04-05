[CmdletBinding()]
param(
    [switch]$PullModels,
    [switch]$RequireOllama,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$venvPath = Join-Path $root ".venv"
$pythonExe = Join-Path $venvPath "Scripts\\python.exe"
$pipExe = Join-Path $venvPath "Scripts\\pip.exe"

function Assert-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found in PATH."
    }
}

function Get-CommandVersion {
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

function Resolve-OllamaCommand {
    $pathCommand = Get-Command ollama -ErrorAction SilentlyContinue
    if ($pathCommand) {
        return $pathCommand.Source
    }

    $candidates = @(
        "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe",
        "$env:ProgramFiles\Ollama\ollama.exe"
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    return $null
}

Write-Host "Bootstrapping DebugWise.AI locally..." -ForegroundColor Cyan

Assert-Command node
Assert-Command npm
Assert-Command python

Write-Host ("Node:   " + (Get-CommandVersion -Command "node")) -ForegroundColor DarkGray
Write-Host ("npm:    " + (Get-CommandVersion -Command "npm")) -ForegroundColor DarkGray
Write-Host ("Python: " + (Get-CommandVersion -Command "python")) -ForegroundColor DarkGray

$ollamaCommand = Resolve-OllamaCommand
$ollamaInstalled = $null -ne $ollamaCommand
if ($RequireOllama -and -not $ollamaInstalled) {
    throw "Ollama is required for this run, but it is not installed."
}

if (-not (Test-Path (Join-Path $root ".env"))) {
    Copy-Item (Join-Path $root ".env.example") (Join-Path $root ".env")
    Write-Host "Created .env from .env.example" -ForegroundColor Green
}

Push-Location $root
try {
    Write-Host "Installing Node workspace dependencies..." -ForegroundColor Yellow
    if (Test-Path (Join-Path $root "package-lock.json")) {
        npm ci
    } else {
        npm install
    }

    if (-not (Test-Path $venvPath)) {
        Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
        python -m venv .venv
    }

    Write-Host "Installing Python analysis dependencies..." -ForegroundColor Yellow
    & $pythonExe -m pip install --upgrade pip
    & $pipExe install -r services\analysis\requirements.txt

    if ($PullModels -and $ollamaInstalled) {
        Write-Host "Pulling recommended Ollama models..." -ForegroundColor Yellow
        & (Join-Path $PSScriptRoot "pull-models.ps1")
    } elseif ($PullModels -and -not $ollamaInstalled) {
        throw "The -PullModels option was used, but Ollama is not installed."
    } elseif (-not $ollamaInstalled) {
        Write-Host "Ollama is not installed. DebugWise.AI will run in deterministic fallback mode until Ollama is added." -ForegroundColor Yellow
    } else {
        Write-Host "Ollama detected. Model pulls are skipped by default for faster first run. Use -PullModels to fetch recommended models." -ForegroundColor DarkGray
    }

    if (-not $SkipBuild) {
        Write-Host "Running build verification..." -ForegroundColor Yellow
        npm run build
        & $pythonExe -m pytest services\analysis\tests
    }

    Write-Host "Bootstrap completed." -ForegroundColor Green
    Write-Host "Next step: powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1 -Mode Native" -ForegroundColor Green
}
finally {
    Pop-Location
}
