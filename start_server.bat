@echo off
title Smart Library Platform Server
color 0A

echo.
echo ========================================
echo   Smart Library Platform Server
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if package.json exists
if not exist "package.json" (
    echo ERROR: package.json not found
    echo Please run this script from the project root directory
    pause
    exit /b 1
)

REM Kill any existing processes on port 3000
echo Checking for existing processes on port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    if not "%%a"=="0" (
        echo Killing process %%a on port 3000...
        taskkill /PID %%a /F >nul 2>&1
    )
)

REM Wait a moment for processes to be killed
timeout /t 2 /nobreak >nul

REM Set environment variables
set PORT=3000
set NODE_ENV=development

echo Starting Smart Library Platform on port %PORT%...
echo.
echo Web Application: http://localhost:%PORT%
echo Health Check: http://localhost:%PORT%/health
echo API Docs: http://localhost:%PORT%/api
echo.
echo Test Accounts:
echo   Staff: admin/admin123, thinh/12345678
echo   Reader: duc/12345678910, Mary/mytra2012@
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start the server
node server.js

echo.
echo Server stopped.
pause