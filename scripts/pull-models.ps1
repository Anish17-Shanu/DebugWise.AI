[CmdletBinding()]
param(
    [string[]]$Models = @("deepseek-coder", "deepseek-r1", "codellama")
)

$ErrorActionPreference = "Stop"

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

    throw "Ollama executable not found."
}

$ollama = Resolve-OllamaCommand
foreach ($model in $Models) {
    Write-Host "Pulling model: $model" -ForegroundColor Yellow
    & $ollama pull $model
}

Write-Host "Requested Ollama models are available." -ForegroundColor Green
