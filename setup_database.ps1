# Smart Library Platform Database Setup Script
# PowerShell version for Windows

Write-Host "Setting up Smart Library Platform Database..." -ForegroundColor Green
Write-Host ""

# Set MySQL path
$mysqlPath = "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe"

# Check if MySQL exists
if (-not (Test-Path $mysqlPath)) {
    Write-Host "Error: MySQL not found at $mysqlPath" -ForegroundColor Red
    Write-Host "Please check your MySQL installation." -ForegroundColor Red
    exit 1
}

# MySQL password
$mysqlPassword = "1192004"

Write-Host "Step 1: Creating database (if not exists)..." -ForegroundColor Yellow
$createDbCmd = "CREATE DATABASE IF NOT EXISTS smart_library CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
& $mysqlPath -u root -p$mysqlPassword -e $createDbCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error in Step 1 - Database creation failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Importing database schema..." -ForegroundColor Yellow
& $mysqlPath -u root -p$mysqlPassword smart_library -e "SOURCE database/mysql_schema.sql;"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error in Step 2 - Schema import failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 3: Importing stored functions..." -ForegroundColor Yellow
& $mysqlPath -u root -p$mysqlPassword smart_library -e "SOURCE database/mysql_functions.sql;"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error in Step 3 - Functions import failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 4: Importing stored procedures..." -ForegroundColor Yellow
& $mysqlPath -u root -p$mysqlPassword smart_library -e "SOURCE database/mysql_procedures.sql;"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error in Step 4 - Procedures import failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 5: Importing triggers..." -ForegroundColor Yellow
& $mysqlPath -u root -p$mysqlPassword smart_library -e "SOURCE database/mysql_triggers.sql;"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error in Step 5 - Triggers import failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 6: Populating with sample data..." -ForegroundColor Yellow
& $mysqlPath -u root -p$mysqlPassword smart_library -e "SOURCE populate_sample_data.sql;"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error in Step 6 - Sample data import failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Database setup completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Testing database connection..." -ForegroundColor Yellow

# Test the database
& $mysqlPath -u root -p$mysqlPassword -e @"
USE smart_library;
SHOW TABLES;
SELECT 'Database Statistics:' as Info;
SELECT COUNT(*) as 'Total Books' FROM books;
SELECT COUNT(*) as 'Total Users' FROM users;
SELECT COUNT(*) as 'Total Authors' FROM authors;
SELECT COUNT(*) as 'Total Checkouts' FROM checkouts;
SELECT COUNT(*) as 'Total Reviews' FROM reviews;
"@

Write-Host ""
Write-Host "Setup completed successfully!" -ForegroundColor Green
Write-Host "You can now start the application with: node server.js" -ForegroundColor Cyan
