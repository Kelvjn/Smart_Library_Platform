SMART LIBRARY PLATFORM
========================

A comprehensive library management system built with Node.js, Express, MySQL, and MongoDB.

CONTRIBUTION
------------
This project was completed individually by Lu Duc Thinh.
All code, database design, and documentation was developed independently.

CONTRIBUTION SCORES
-------------------
• Lu Duc Thinh: 5.0 (Individual project - 100% contribution)

VIDEO DEMONSTRATION
-------------------
Demo Video URL: https://rmiteduau-my.sharepoint.com/:v:/r/personal/s3992133_rmit_edu_vn/Documents/Recordings/Private-20250905_152923-Meeting%20Recording.mp4?csf=1&web=1&e=W2olmU&nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJTdHJlYW1XZWJBcHAiLCJyZWZlcnJhbFZpZXciOiJTaGFyZURpYWxvZy1MaW5rIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXcifX0%3D
Note: Video must be 25 minutes total (5 minutes presentation + 20 minutes demo)
Permission: Set to allow read access to all RMIT accounts

PREREQUISITES
-------------
• Node.js (v16 or higher)
• MySQL Server (v8.0 or higher)
• MongoDB (v5.0 or higher)

INSTALLATION STEPS
------------------

1. INSTALL DEPENDENCIES
   npm install

2. DATABASE SETUP
   
   a) MySQL Database (IMPORTANT - Sample data required for demonstration):
      - Create database: mysql -u root -p -e "CREATE DATABASE smart_library;"
      - Import schema: mysql -u root -p smart_library < database/mysql_schema.sql
      - Import functions: mysql -u root -p smart_library < database/mysql_functions.sql
      - Import procedures: mysql -u root -p smart_library < database/mysql_procedures.sql
      - Import triggers: mysql -u root -p smart_library < database/mysql_triggers.sql
      - Import sample data: mysql -u root -p smart_library < populate_sample_data.sql
      
      Alternative (if you have a full dump with routines and triggers):
      - mysql -u root -p < dump_full.sql --routines --triggers
   
   b) MongoDB (IMPORTANT - Analytics data required for demonstration):
      - Ensure MongoDB is running on localhost:27017
      - Run setup script: node setup_mongodb_analytics.js
      - This populates reading sessions, user analytics, and performance data
      - The application will automatically create the 'smart_library_nosql' database

3. ENVIRONMENT CONFIGURATION
   cp config.env.example .env
   
   Edit .env file with your database credentials:
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password_here
   DB_NAME=smart_library
   MONGODB_URI=mongodb://localhost:27017/smart_library_nosql
   JWT_SECRET=your_super_secret_jwt_key_here

4. *START THE APPLICATION* (important)
   node server.js
   
   Alternative startup methods:
   - Windows: start_server.bat
   - PowerShell: start_server.ps1

TEST ACCOUNTS (IMPORTANT - Required for demonstration)
-----------------------------------------------------
• Staff: admin/admin123
• Staff: thinh/12345678
• Reader: duc/12345678910
• Reader: Mary/mytra2012@

WHY SAMPLE DATA IS REQUIRED
---------------------------
Sample data is essential for assessment because:

1. **Demonstration Requirements**: Assessors need to see the complete flow:
   - Borrow/return functionality with existing books
   - Review system with sample ratings
   - Analytics dashboard with real data
   - Trigger demonstrations with actual transactions

2. **Performance Testing**: Sample data enables:
   - EXPLAIN query analysis on realistic datasets
   - Performance optimization demonstrations
   - Index effectiveness testing
   - Query execution time measurements

3. **Feature Validation**: Without sample data, assessors cannot verify:
   - Database functions and procedures
   - Trigger behavior and audit trails
   - MongoDB aggregation pipelines
   - Transaction management and rollbacks

4. **Time Efficiency**: Assessors don't have time to manually create:
   - Multiple books with different genres
   - User accounts with various roles
   - Checkout history and reviews
   - Analytics data for reporting

TROUBLESHOOTING
---------------
1. Port 3000 already in use:
   - Kill existing Node.js processes: taskkill /f /im node.exe
   - Or change PORT in .env file

2. Database connection errors:
   - Verify MySQL and MongoDB are running
   - Check database credentials in .env file
   - Ensure databases exist and are accessible

3. Testing the application:
   - Run performance tests: mysql -u root -p smart_library < performance_testing.sql
   - Run functionality tests: mysql -u root -p smart_library < test_all_functionality.sql
   - Check MongoDB analytics: node setup_mongodb_analytics.js

4. Quick verification (after setup):
   - Open browser: http://localhost:3000
   - Login with test accounts above
   - Verify books are loaded (should see 16+ books with covers)
   - Check analytics dashboard (staff/admin only)
   - Test borrow/return functionality

PROJECT STRUCTURE
-----------------
Smart_Library_Platform/
├── config/                      # Database and configuration files
├── database/                    # SQL scripts and database utilities
│   ├── mysql_schema.sql         # Database schema
│   ├── mysql_functions.sql      # MySQL functions
│   ├── mysql_procedures.sql     # Stored procedures
│   ├── mysql_triggers.sql       # Database triggers
│   ├── mongodb_setup.js         # MongoDB setup
│   └── mongodb_aggregations.js  # Aggregation pipelines
├── middleware/                  # Authentication and validation middleware
├── public/                      # Frontend HTML, CSS, and JavaScript
│   └── uploads/                 # Book cover image uploads
├── routes/                      # API route handlers
├── server.js                    # Main application server
├── package.json                 # Dependencies and scripts
├── populate_sample_data.sql     # Sample data for testing
├── performance_testing.sql      # Performance testing evidence
├── test_all_functionality.sql   # Comprehensive testing
├── setup_mongodb_analytics.js   # MongoDB analytics setup
└── README.txt                   # This file

API ENDPOINTS
-------------
• Books: /api/books, /api/books/:id, /api/books/search
• Users: /api/users, /api/users/:id, /api/users/:id/checkouts  
• Analytics: /api/analytics/overview, /api/analytics/books
• Reviews: /api/reviews/book/:bookId, /api/reviews/user/:userId
• Checkouts: /api/checkouts, /api/checkouts/:id
• Authentication: /api/auth/login, /api/auth/register

VERSION
-------
Smart Library Platform v1.0.0
Built by Lu Duc Thinh
Last Updated: September 2025