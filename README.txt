SMART LIBRARY PLATFORM
========================

A comprehensive library management system built with Node.js, Express, MySQL, and MongoDB.

CONTRIBUTION
------------
This project was completed individually by Lu Duc Thinh.
All code, database design, and documentation was developed independently.

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
      - Import sample data: mysql -u root -p smart_library < populate_sample_data.sql
   
   b) MongoDB:
      - Ensure MongoDB is running on localhost:27017
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

4. START THE APPLICATION
   node server.js

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

PROJECT STRUCTURE
-----------------
Smart_Library_Platform/
├── config/                 # Database and configuration files
├── database/              # SQL scripts and database utilities
├── middleware/            # Authentication and validation middleware
├── public/               # Frontend HTML, CSS, and JavaScript
├── routes/               # API route handlers
├── server.js             # Main application server
├── package.json          # Dependencies and scripts
└── README.txt           # This file

VERSION
-------
Smart Library Platform v1.0.0
Built by Lu Duc Thinh
Last Updated: September 2025