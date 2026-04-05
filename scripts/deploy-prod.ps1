[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root "infra\\docker\\.env.prod"
$composeFile = Join-Path $root "infra\\docker\\docker-compose.prod.yml"

if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $root "infra\\docker\\.env.prod.example") $envFile
    Write-Host "Created infra/docker/.env.prod from template. Review it before public deployment." -ForegroundColor Yellow
}

Push-Location $root
try {
    docker compose -f $composeFile --env-file $envFile up -d --build
    docker compose -f $composeFile --env-file $envFile ps
}
finally {
    Pop-Location
}

