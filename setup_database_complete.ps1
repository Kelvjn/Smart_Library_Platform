# Smart Library Platform - Complete Database Setup Script
# This PowerShell script sets up the entire database with comprehensive sample data

Write-Host "Smart Library Platform - Database Setup" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green

# Check if MySQL is available
Write-Host "Checking MySQL connection..." -ForegroundColor Yellow
try {
    mysql --version
    Write-Host "MySQL is available" -ForegroundColor Green
} catch {
    Write-Host "Error: MySQL is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install MySQL and ensure it's in your system PATH" -ForegroundColor Red
    exit 1
}

# Prompt for MySQL credentials
Write-Host "`nPlease enter your MySQL credentials:" -ForegroundColor Yellow
$mysqlUser = Read-Host "MySQL Username (default: root)"
if ([string]::IsNullOrEmpty($mysqlUser)) {
    $mysqlUser = "root"
}

$mysqlPassword = Read-Host "MySQL Password" -AsSecureString
$mysqlPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($mysqlPassword))

# Test connection
Write-Host "`nTesting MySQL connection..." -ForegroundColor Yellow
$testConnection = "mysql -u $mysqlUser -p$mysqlPasswordPlain -e 'SELECT 1;' 2>&1"
$testResult = Invoke-Expression $testConnection

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Cannot connect to MySQL. Please check your credentials." -ForegroundColor Red
    exit 1
}

Write-Host "MySQL connection successful!" -ForegroundColor Green

# Setup database
Write-Host "`nSetting up Smart Library database..." -ForegroundColor Yellow
Write-Host "This will recreate the entire database with comprehensive sample data." -ForegroundColor Yellow

$confirm = Read-Host "Do you want to continue? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Setup cancelled." -ForegroundColor Yellow
    exit 0
}

# Execute the complete setup script
Write-Host "`nExecuting database setup..." -ForegroundColor Yellow
$setupCommand = "mysql -u $mysqlUser -p$mysqlPasswordPlain < setup_complete_database.sql"
Invoke-Expression $setupCommand

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDatabase setup completed successfully!" -ForegroundColor Green
    
    # Run verification
    Write-Host "`nRunning verification tests..." -ForegroundColor Yellow
    $verifyCommand = "mysql -u $mysqlUser -p$mysqlPasswordPlain smart_library < test_database_setup.sql"
    Invoke-Expression $verifyCommand
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nVerification completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "`nWarning: Verification had some issues, but database setup completed." -ForegroundColor Yellow
    }
    
    Write-Host "`n=======================================" -ForegroundColor Green
    Write-Host "Setup Summary:" -ForegroundColor Green
    Write-Host "- Database: smart_library" -ForegroundColor White
    Write-Host "- Users: 4 (2 staff, 2 readers)" -ForegroundColor White
    Write-Host "- Books: 31 (including all requested series)" -ForegroundColor White
    Write-Host "- Authors: 17" -ForegroundColor White
    Write-Host "- Sample checkouts, reviews, and staff logs included" -ForegroundColor White
    Write-Host "`nTest Accounts:" -ForegroundColor Green
    Write-Host "- Staff: admin/admin123" -ForegroundColor White
    Write-Host "- Staff: thinh/12345678" -ForegroundColor White
    Write-Host "- Reader: duc/12345678910" -ForegroundColor White
    Write-Host "- Reader: Mary/mytra2012@" -ForegroundColor White
    Write-Host "`nYou can now start the application with: node server.js" -ForegroundColor Green
    
} else {
    Write-Host "`nError: Database setup failed. Please check the error messages above." -ForegroundColor Red
    exit 1
}

Write-Host "`nSetup completed!" -ForegroundColor Green
