# Smart Library Platform Server - Enhanced Startup Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Smart Library Platform Server" -ForegroundColor Cyan
Write-Host "  Enhanced PowerShell Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
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
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "✅ Dependencies already installed" -ForegroundColor Green
}

# Enhanced port cleanup with better error handling
Write-Host "🔧 Checking for port conflicts..." -ForegroundColor Yellow
$portInUse = $false

try {
    $connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Where-Object {$_.State -eq "Listen"}
    if ($connections) {
        $portInUse = $true
        Write-Host "🔍 Found $($connections.Count) process(es) using port 3000" -ForegroundColor Yellow
        
        foreach ($connection in $connections) {
            $pid = $connection.OwningProcess
            $processName = (Get-Process -Id $pid -ErrorAction SilentlyContinue).ProcessName
            Write-Host "🛑 Terminating process: $processName (PID: $pid)" -ForegroundColor Yellow
            
            try {
                Stop-Process -Id $pid -Force -ErrorAction Stop
                Write-Host "✅ Process $pid terminated successfully" -ForegroundColor Green
            } catch {
                Write-Host "⚠️  Could not terminate process $pid : $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
} catch {
    Write-Host "ℹ️  No existing processes found on port 3000" -ForegroundColor Blue
}

if ($portInUse) {
    Write-Host "⏳ Waiting for port to be fully released..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    
    # Verify port is actually free
    $stillInUse = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Where-Object {$_.State -eq "Listen"}
    if ($stillInUse) {
        Write-Host "⚠️  Port 3000 still in use after cleanup attempts" -ForegroundColor Red
        Write-Host "The server will attempt automatic port resolution..." -ForegroundColor Yellow
    } else {
        Write-Host "✅ Port 3000 is now available" -ForegroundColor Green
    }
} else {
    Write-Host "✅ Port 3000 is available" -ForegroundColor Green
}

# Check for .env file
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  Warning: .env file not found" -ForegroundColor Yellow
    if (Test-Path "config.env.example") {
        Write-Host "📝 Creating .env file from example..." -ForegroundColor Yellow
        Copy-Item "config.env.example" ".env"
        Write-Host "✅ Created .env file from example" -ForegroundColor Green
        Write-Host "⚠️  Please edit .env file with your database credentials" -ForegroundColor Yellow
    } else {
        Write-Host "❌ config.env.example not found" -ForegroundColor Red
    }
}

# Start the server with enhanced error handling
Write-Host ""
Write-Host "🚀 Starting Smart Library Platform Server..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    node server.js
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        Write-Host ""
        Write-Host "❌ Server exited with error code: $exitCode" -ForegroundColor Red
        Write-Host "Check the error messages above for details" -ForegroundColor Yellow
    }
} catch {
    Write-Host ""
    Write-Host "❌ Server failed to start: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "🛑 Server stopped. Press Enter to exit..." -ForegroundColor Yellow
Read-Host