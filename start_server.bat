@echo off
echo ========================================
echo   Smart Library Platform Server
echo   Enhanced Startup Script
echo ========================================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js found: 
node --version

REM Check if dependencies are installed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Error: Failed to install dependencies
        pause
        exit /b 1
    )
    echo ✅ Dependencies installed successfully
) else (
    echo ✅ Dependencies already installed
)

REM Enhanced port cleanup
echo 🔧 Checking for port conflicts...
set PORT_FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 2^>nul') do (
    if not "%%a"=="0" (
        echo 🔍 Found process %%a using port 3000
        set PORT_FOUND=1
        echo 🛑 Terminating process %%a...
        taskkill /F /PID %%a >nul 2>&1
        if %errorlevel% neq 0 (
            echo ⚠️  Could not terminate process %%a
        ) else (
            echo ✅ Process %%a terminated
        )
    )
)

if %PORT_FOUND%==0 (
    echo ✅ Port 3000 is available
) else (
    echo ⏳ Waiting for port to be released...
    timeout /t 3 /nobreak >nul
)

REM Check for .env file
if not exist ".env" (
    echo ⚠️  Warning: .env file not found
    echo Creating from example...
    if exist "config.env.example" (
        copy "config.env.example" ".env" >nul
        echo ✅ Created .env file from example
        echo ⚠️  Please edit .env file with your database credentials
    ) else (
        echo ❌ config.env.example not found
    )
)

REM Start the server with enhanced error handling
echo 🚀 Starting Smart Library Platform Server...
echo ========================================
node server.js

if %errorlevel% neq 0 (
    echo ❌ Server failed to start
    echo Check the error messages above
    pause
    exit /b 1
)

echo Server stopped
pause