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
Demo Video URL: [PLACEHOLDER - Upload your video to RMIT OneDrive and replace this with the actual link]

Video Requirements:
• Total Duration: 25 minutes (5 minutes presentation + 20 minutes demo)
• Storage: Must be uploaded to RMIT OneDrive
• Permissions: Set to allow read access to all RMIT accounts
• Content: Must demonstrate all implemented features
• Format: Any standard video format (MP4, AVI, MOV, etc.)

Demo Features to Show:
• User authentication and role-based access
• Book management (add, edit, delete, search)
• User management and registration
• Checkout and return functionality
• Review system and ratings
• Analytics dashboard and reporting
• File upload for book covers
• Database operations and performance
• MongoDB analytics and aggregations

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
   
   a) MySQL Database:
      - Create a new MySQL database named 'smart_library'
      - Import the schema: mysql -u root -p smart_library < database/mysql_schema.sql
      - Import functions: mysql -u root -p smart_library < database/mysql_functions.sql
      - Import procedures: mysql -u root -p smart_library < database/mysql_procedures.sql
      - Import triggers: mysql -u root -p smart_library < database/mysql_triggers.sql
      - Import sample data: mysql -u root -p smart_library < populate_sample_data.sql
   
   b) MongoDB:
      - Ensure MongoDB is running on localhost:27017
      - Run setup script: node setup_mongodb_analytics.js
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

 USERS
-------------
• Staff: admin/admin123
• Staff: thinh/12345678
• Reader: duc/12345678910
• Reader: Mary/mytra2012@

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

TECHNICAL FEATURES
------------------
• Database Design: Complete MySQL schema with proper relationships
• Optimization: Performance indexes and query optimization
• Functions: 3 custom MySQL functions for business logic
• Stored Procedures: 6 procedures with transaction management
• Triggers: 6 triggers for data integrity and audit trails
• Transaction Management: ACID compliance with rollback support
• Aggregation Pipeline: 5 MongoDB aggregation pipelines for analytics
• Web Application: Full-stack Node.js application with REST API
• File Upload: Book cover image upload functionality
• Authentication: JWT-based authentication with role-based access
• Analytics: Real-time reading analytics and user engagement tracking

VERSION
-------
Smart Library Platform v1.0.0
Built by Lu Duc Thinh
Last Updated: September 2025