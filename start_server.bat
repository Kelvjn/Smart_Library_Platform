@echo off
echo Starting Smart Library Platform Server...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Kill any existing Node processes on port 3000
echo Checking for existing processes on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    taskkill /f /pid %%a >nul 2>&1
)

REM Wait a moment for port to be released
timeout /t 2 /nobreak >nul

REM Start the server
echo Starting server...
node server.js

REM If server exits, pause to see any error messages
echo.
echo Server stopped. Press any key to exit...
pause >nul
