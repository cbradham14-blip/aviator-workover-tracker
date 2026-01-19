# Workover API Deployment Script
# Requires: Azure CLI (az) to be installed and logged in

$ErrorActionPreference = 'Stop'

Write-Host "=== Aviator Workover API Deployment ===" -ForegroundColor Cyan

# Check for Azure CLI
try {
    $azVersion = az --version | Select-String "azure-cli" | Select-Object -First 1
    Write-Host "Azure CLI found: $azVersion" -ForegroundColor Green
} catch {
    Write-Host "Azure CLI not found. Please install it from https://aka.ms/installazurecliwindows" -ForegroundColor Red
    Write-Host "Then run: az login" -ForegroundColor Yellow
    exit 1
}

# Check if logged in
$account = az account show 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in to Azure. Running 'az login'..." -ForegroundColor Yellow
    az login
}

# Variables
$resourceGroup = "workover-tracker-rg"
$functionAppName = "aviator-workover-api"
$apiPath = "$PSScriptRoot\api"

Write-Host "Deploying from: $apiPath" -ForegroundColor Gray

# Deploy using func
Set-Location $apiPath
func azure functionapp publish $functionAppName --javascript

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host "API URL: https://aviator-workover-api-bzcffpe8h5cjckdd.centralus-01.azurewebsites.net/api/" -ForegroundColor Cyan
