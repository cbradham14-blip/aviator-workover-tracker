# Workover Tracker - Azure Static Web App Deployment Script
# Run this script from PowerShell to deploy updates to the frontend

$ErrorActionPreference = 'Stop'

$deploymentToken = '06af8bf8368f663d03f6dcfcddea63504968c18306eef9a741d5ec55a40e9e9906-80dfc918-79dc-4d62-9863-df97d65264540102224024906c10'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$swaClient = "$env:USERPROFILE\.swa\deploy\694f9b1be52be00b1b4cde5deb5bb4994154f9b6\StaticSitesClient.exe"

Write-Host "=== Aviator Workover Tracker Deployment ===" -ForegroundColor Cyan
Write-Host "Source: $scriptDir" -ForegroundColor Gray

# Create temp deployment folder
$tempDir = "$env:TEMP\swa-deploy-$(Get-Random)"
$appDir = "$tempDir\app"
New-Item -ItemType Directory -Path $appDir -Force | Out-Null

# Copy index.html
Copy-Item "$scriptDir\index.html" $appDir
Write-Host "Prepared deployment package" -ForegroundColor Green

# Check for StaticSitesClient
if (-not (Test-Path $swaClient)) {
    Write-Host "StaticSitesClient not found. Please run 'npm install -g @azure/static-web-apps-cli' first." -ForegroundColor Red
    exit 1
}

# Deploy
Write-Host "Deploying to Azure..." -ForegroundColor Yellow
Push-Location $tempDir
try {
    & $swaClient upload --apiToken $deploymentToken --workdir "." --app "app" --outputLocation "app" --skipAppBuild
    Write-Host ""
    Write-Host "=== Deployment Complete ===" -ForegroundColor Green
    Write-Host "URL: https://kind-sky-024906c10.6.azurestaticapps.net" -ForegroundColor Cyan
} finally {
    Pop-Location
    Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
}
