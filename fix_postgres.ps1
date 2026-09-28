# Automated PostgreSQL Password Reset and Database Setup Script
# Requires Administrator privileges (Run as Administrator)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Automated PostgreSQL 17 Reset & Setup for DSA Assessment" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Check Administrator privileges
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "`n[ERROR] This script MUST be run as Administrator." -ForegroundColor Red
    Write-Host "Please open PowerShell as Administrator and execute:" -ForegroundColor Yellow
    Write-Host "  powershell -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -ForegroundColor White
    exit 1
}

$pgDataDir = "C:\Program Files\PostgreSQL\17\data"
$pgBinDir = "C:\Program Files\PostgreSQL\17\bin"
$hbaFile = Join-Path $pgDataDir "pg_hba.conf"
$hbaBackup = Join-Path $pgDataDir "pg_hba.conf.bak"
$psql = Join-Path $pgBinDir "psql.exe"

if (-not (Test-Path $hbaFile)) {
    Write-Host "[ERROR] Could not find pg_hba.conf at $hbaFile" -ForegroundColor Red
    exit 1
}

Write-Host "`n1. Backing up pg_hba.conf..." -ForegroundColor Green
Copy-Item -Path $hbaFile -Destination $hbaBackup -Force

try {
    Write-Host "2. Temporarily setting local connections to 'trust' mode..." -ForegroundColor Green
    $content = Get-Content $hbaFile
    $newContent = $content -replace "host\s+all\s+all\s+127\.0\.0\.1/32\s+(scram-sha-256|md5)", "host    all             all             127.0.0.1/32            trust" `
                           -replace "host\s+all\s+all\s+::1/128\s+(scram-sha-256|md5)", "host    all             all             ::1/128                 trust"
    Set-Content -Path $hbaFile -Value $newContent

    Write-Host "3. Restarting postgresql-x64-17 service with temporary trust configuration..." -ForegroundColor Green
    Restart-Service postgresql-x64-17

    Start-Sleep -Seconds 2

    Write-Host "4. Setting password for user 'postgres' to 'postgres'..." -ForegroundColor Green
    & $psql -U postgres -h 127.0.0.1 -c "ALTER USER postgres WITH PASSWORD 'postgres';"

    Write-Host "5. Ensuring database 'dsa_mcq_db' exists..." -ForegroundColor Green
    $checkDb = & $psql -U postgres -h 127.0.0.1 -t -A -c "SELECT 1 FROM pg_database WHERE datname='dsa_mcq_db';"
    if ($checkDb -ne "1") {
        & $psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE dsa_mcq_db;"
        Write-Host "   Database 'dsa_mcq_db' created successfully." -ForegroundColor Green
    } else {
        Write-Host "   Database 'dsa_mcq_db' already exists." -ForegroundColor Green
    }
}
finally {
    Write-Host "`n6. Restoring original secure authentication (scram-sha-256)..." -ForegroundColor Green
    if (Test-Path $hbaBackup) {
        Copy-Item -Path $hbaBackup -Destination $hbaFile -Force
        Remove-Item -Path $hbaBackup -Force
    }

    Write-Host "7. Restarting postgresql-x64-17 service with secure authentication..." -ForegroundColor Green
    Restart-Service postgresql-x64-17
    Start-Sleep -Seconds 2
}

Write-Host "`n8. Verifying connection with secure password authentication..." -ForegroundColor Green
$env:PGPASSWORD = "postgres"
$verify = & $psql -U postgres -h 127.0.0.1 -d dsa_mcq_db -t -A -c "SELECT 'CONNECTION_SUCCESS';"
$env:PGPASSWORD = $null

if ($verify -eq "CONNECTION_SUCCESS") {
    Write-Host "`n[SUCCESS] PostgreSQL is fully configured and accepting connections with password 'postgres'!" -ForegroundColor Cyan
    Write-Host "Database 'dsa_mcq_db' is ready." -ForegroundColor Cyan
} else {
    Write-Host "`n[WARNING] Verification returned: $verify" -ForegroundColor Yellow
}
