# Smart Library Platform Server Startup Script
Write-Host "🚀 Starting Smart Library Platform Server..." -ForegroundColor Green
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ ERROR: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if dependencies are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ ERROR: Failed to install dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Kill any existing Node processes on port 3000
Write-Host "🔍 Checking for existing processes on port 3000..." -ForegroundColor Yellow
try {
    $processes = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Where-Object {$_.State -eq "Listen"}
    foreach ($process in $processes) {
        $pid = $process.OwningProcess
        Write-Host "🔄 Stopping process PID: $pid" -ForegroundColor Yellow
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
} catch {
    Write-Host "ℹ️  No existing processes found on port 3000" -ForegroundColor Blue
}

# Wait a moment for port to be released
Write-Host "⏳ Waiting for port to be released..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Start the server
Write-Host "🚀 Starting server..." -ForegroundColor Green
Write-Host ""

try {
    node server.js
} catch {
    Write-Host "❌ Server failed to start: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "🛑 Server stopped. Press Enter to exit..." -ForegroundColor Yellow
Read-Host
