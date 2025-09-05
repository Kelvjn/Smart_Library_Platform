@echo off
echo ========================================
echo SMART LIBRARY PLATFORM - FINAL SUBMISSION
echo ========================================
echo.

REM Create clean submission directory
if exist "submission" rmdir /s /q "submission"
mkdir "submission"

echo Copying required files for submission...

REM Core application files
copy "server.js" "submission\"
copy "package.json" "submission\"
copy "package-lock.json" "submission\"
copy "README.txt" "submission\"
copy "config.env.example" "submission\"

REM Database and testing files (REQUIRED by assessment)
copy "populate_sample_data.sql" "submission\"
copy "performance_testing.sql" "submission\"
copy "test_all_functionality.sql" "submission\"
copy "setup_mongodb_analytics.js" "submission\"

REM Core directories
xcopy "config" "submission\config\" /e /i
xcopy "database" "submission\database\" /e /i
xcopy "middleware" "submission\middleware\" /e /i
xcopy "routes" "submission\routes\" /e /i

REM Frontend (only essential files)
mkdir "submission\public"
copy "public\index.html" "submission\public\"
mkdir "submission\public\uploads"
copy "public\uploads\.gitkeep" "submission\public\uploads\"

REM Startup scripts (useful for running)
copy "start_server.bat" "submission\"
copy "start_server.ps1" "submission\"

echo.
echo ========================================
echo SUBMISSION PREPARATION COMPLETE!
echo ========================================
echo.
echo FILES INCLUDED:
echo ✓ Core application (server.js, package.json)
echo ✓ Database schema and scripts
echo ✓ MySQL functions, procedures, triggers
echo ✓ MongoDB setup and aggregations
echo ✓ Performance testing evidence
echo ✓ Functionality testing scripts
echo ✓ Sample data
echo ✓ API routes and middleware
echo ✓ Frontend (index.html)
echo ✓ Uploads folder for book covers
echo ✓ Configuration files
echo ✓ Startup scripts
echo ✓ README.txt with instructions
echo.
echo EXCLUDED (as required):
echo ✗ node_modules (dependencies)
echo ✗ Upload files
echo ✗ Helper scripts
echo.
echo NEXT STEPS:
echo 1. Add your PDF report to submission folder
echo 2. Update video URL in submission\README.txt
echo 3. Zip the submission folder
echo 4. Submit to Canvas
echo.
echo ASSESSMENT REQUIREMENTS COVERED:
echo ✓ Database Design (mysql_schema.sql)
echo ✓ Optimization (performance_testing.sql)
echo ✓ Functions (mysql_functions.sql)
echo ✓ Stored Procedures (mysql_procedures.sql)
echo ✓ Triggers (mysql_triggers.sql)
echo ✓ Transaction Management (in procedures)
echo ✓ Aggregation Pipeline (mongodb_aggregations.js)
echo ✓ Web Application (complete Node.js app)
echo ✓ Source code with sample data
echo ✓ README.txt with instructions
echo.
pause
