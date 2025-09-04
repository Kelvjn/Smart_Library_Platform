# Simple PowerShell startup script that bypasses execution policy
# Run with: powershell -ExecutionPolicy Bypass -File start_server_simple.ps1

Write-Host "🚀 Starting Smart Library Platform Server..." -ForegroundColor Green

# Kill any existing Node processes
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Start the server
node server.js
