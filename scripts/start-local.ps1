[CmdletBinding()]
param(
    [ValidateSet("Native", "Docker")]
    [string]$Mode = "Native",
    [switch]$Bootstrap
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runDir = Join-Path $root ".run"
$logDir = Join-Path $runDir "logs"
$venvPython = Join-Path $root ".venv\Scripts\python.exe"

function Write-PidFile {
    param(
        [string]$Name,
        [int]$ProcessId
    )

    if (-not (Test-Path $runDir)) {
        New-Item -ItemType Directory -Path $runDir -Force | Out-Null
    }

    Set-Content -Path (Join-Path $runDir "$Name.pid") -Value $ProcessId
}

function New-LogPath {
    param([string]$Name)
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    return Join-Path $logDir "$Name.log"
}

function Start-DebugWiseProcess {
    param(
        [string]$Name,
        [string]$Command
    )

    $stdoutPath = New-LogPath -Name "$Name.stdout"
    $stderrPath = New-LogPath -Name "$Name.stderr"
    $shell = Start-Process powershell `
        -ArgumentList "-NoProfile", "-Command", $Command `
        -PassThru `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath

    Start-Sleep -Seconds 1
    if ($shell.HasExited) {
        $logOutput = @()
        if (Test-Path $stdoutPath) { $logOutput += Get-Content $stdoutPath -Raw }
        if (Test-Path $stderrPath) { $logOutput += Get-Content $stderrPath -Raw }
        if (-not $logOutput.Count) { $logOutput = @("No log output captured.") }
        throw "$Name exited during startup.`n$logOutput"
    }

    Write-PidFile -Name $Name -ProcessId $shell.Id
}

function Wait-ForHttp {
    param(
        [string]$Url,
        [string]$Name,
        [int]$TimeoutSeconds = 40
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 4
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return
            }
        } catch {
            Start-Sleep -Milliseconds 750
        }
    }

    $stdoutPath = Join-Path $logDir "$Name.stdout.log"
    $stderrPath = Join-Path $logDir "$Name.stderr.log"
    $logOutput = @()
    if (Test-Path $stdoutPath) { $logOutput += Get-Content $stdoutPath -Raw }
    if (Test-Path $stderrPath) { $logOutput += Get-Content $stderrPath -Raw }
    if (-not $logOutput.Count) { $logOutput = @("No log output captured.") }
    throw "$Name did not become healthy at $Url.`n$logOutput"
}

Push-Location $root
try {
    & (Join-Path $PSScriptRoot "stop-local.ps1") | Out-Null

    if ($Bootstrap) {
        & (Join-Path $PSScriptRoot "bootstrap-local.ps1")
    }

    if ($Mode -eq "Docker") {
        if (-not (Test-Path ".env")) {
            Copy-Item ".env.example" ".env"
        }
        docker compose -f infra/docker/docker-compose.local.yml up -d --build
        Write-Host "DebugWise.AI is running in Docker mode." -ForegroundColor Green
        Write-Host "Web IDE: http://localhost:4173"
        Write-Host "Gateway health: http://localhost:4000/health"
        Write-Host "Analysis health: http://localhost:8000/health"
        exit 0
    }

    if (-not (Test-Path ".env")) {
        Copy-Item ".env.example" ".env"
    }

    if (-not (Test-Path $venvPython)) {
        throw "Python virtual environment not found. Run scripts/bootstrap-local.ps1 first."
    }

    if (Test-Path $runDir) {
        Remove-Item $runDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null

    Start-DebugWiseProcess -Name "analysis" -Command "Set-Location '$root'; & '$venvPython' -m uvicorn services.analysis.app.main:app --app-dir . --host 0.0.0.0 --port 8000"
    Wait-ForHttp -Url "http://localhost:8000/health" -Name "analysis"

    Start-DebugWiseProcess -Name "gateway" -Command "Set-Location '$root'; npm run dev:gateway"
    Wait-ForHttp -Url "http://localhost:4000/health" -Name "gateway"

    Start-DebugWiseProcess -Name "web" -Command "Set-Location '$root'; npm --workspace @debugwise/web run dev -- --host=0.0.0.0"
    Wait-ForHttp -Url "http://localhost:5173" -Name "web"

    Write-Host "DebugWise.AI native dev stack started." -ForegroundColor Green
    Write-Host "Web IDE: http://localhost:5173"
    Write-Host "Gateway health: http://localhost:4000/health"
    Write-Host "Analysis health: http://localhost:8000/health"
    Write-Host "Logs: $logDir"
}
finally {
    Pop-Location
}
