@echo off
:: Batch launcher to run fix_postgres.ps1 as Administrator
echo Requesting Administrator privileges to configure PostgreSQL 17...
powershell -Command "Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0fix_postgres.ps1\"' -Verb RunAs"
pause
