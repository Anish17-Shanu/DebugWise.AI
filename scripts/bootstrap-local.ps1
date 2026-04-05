[CmdletBinding()]
param(
    [switch]$SkipModels,
    [switch]$SkipDockerCheck,
    [switch]$RequireOllama
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
if (-not $SkipDockerCheck) {
    Assert-Command docker
}

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
    npm install

    if (-not (Test-Path $venvPath)) {
        Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
        python -m venv .venv
    }

    Write-Host "Installing Python analysis dependencies..." -ForegroundColor Yellow
    & $pythonExe -m pip install --upgrade pip
    & $pipExe install -r services\analysis\requirements.txt

    if (-not $SkipModels -and $ollamaInstalled) {
        Write-Host "Checking Ollama models..." -ForegroundColor Yellow
        $models = (& $ollamaCommand list | Out-String)
        foreach ($model in @("deepseek-coder", "deepseek-r1", "codellama")) {
            if ($models -notmatch [regex]::Escape($model)) {
                Write-Host "Pulling missing Ollama model: $model" -ForegroundColor Yellow
                & $ollamaCommand pull $model
            }
        }
    } elseif (-not $ollamaInstalled) {
        Write-Host "Ollama is not installed. DebugWise.AI will run in deterministic fallback mode until Ollama is added." -ForegroundColor Yellow
    }

    Write-Host "Running build verification..." -ForegroundColor Yellow
    npm run build
    & $pythonExe -m pytest services\analysis\tests

    Write-Host "Bootstrap completed." -ForegroundColor Green
}
finally {
    Pop-Location
}
