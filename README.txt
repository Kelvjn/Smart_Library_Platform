SMART LIBRARY PLATFORM
========================

A comprehensive library management system built with Node.js, Express, MySQL, and MongoDB.
Features include user authentication, book management, borrowing/returning, reviews, and analytics.

FEATURES
--------
✅ User Authentication & Authorization
✅ Book Management & Search
✅ Digital Reading Analytics
✅ Review & Rating System
✅ Admin Dashboard
✅ Advanced Search & Filtering
✅ Real-time Availability Tracking
✅ Responsive Web Interface

TECHNOLOGY STACK
----------------
• Backend: Node.js, Express.js
• Database: MySQL (primary), MongoDB (analytics)
• Authentication: JWT tokens with bcrypt
• Frontend: HTML5, CSS3, JavaScript (ES6+)
• Security: Helmet.js, CORS, Rate Limiting
• Styling: Bootstrap 5, Font Awesome

PREREQUISITES
-------------
• Node.js (v16 or higher)
• MySQL Server (v8.0 or higher)
• MongoDB (v5.0 or higher)
• Git

INSTALLATION STEPS
------------------

1. CLONE THE REPOSITORY
   ```
   git clone <repository-url>
   cd Smart_Library_Platform
   ```

2. INSTALL DEPENDENCIES
   ```
   npm install
   ```

3. DATABASE SETUP
   
   a) MySQL Database:
      - Create a new MySQL database named 'smart_library'
      - Import the schema: mysql -u root -p smart_library < database/mysql_schema.sql
      - Import sample data: mysql -u root -p smart_library < populate_sample_data.sql
   
   b) MongoDB:
      - Ensure MongoDB is running on localhost:27017
      - The application will automatically create the 'smart_library_nosql' database

4. ENVIRONMENT CONFIGURATION
   ```
   cp config.env.example .env
   ```
   
   Edit .env file with your database credentials:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password_here
   DB_NAME=smart_library
   MONGODB_URI=mongodb://localhost:27017/smart_library_nosql
   JWT_SECRET=your_super_secret_jwt_key_here
   ```

## 🚀 **Starting the Application**

### **Option 1: Direct Node.js (Recommended for development)**
```bash
node server.js
```

### **Option 2: Windows Batch File (Easiest for Windows users)**
```bash
start_server.bat
```
*Double-click the file or run from command prompt*

### **Option 3: PowerShell Script (Best for Windows users)**
```powershell
.\start_server.ps1
```
*Right-click and "Run with PowerShell" or run from PowerShell*

### **Option 4: Using npm scripts**
```bash
npm start
```

## 🔧 **Troubleshooting Port Conflicts**

If you get "Port 3000 already in use" error:

1. **Use the startup scripts** - They automatically handle port conflicts
2. **Manual fix**: 
   ```bash
   # Stop all Node processes
   taskkill /f /im node.exe
   
   # Or change port in .env file
   PORT=3001
   ```
3. **Wait a few seconds** - Ports take time to be released

PROJECT STRUCTURE
-----------------
```
Smart_Library_Platform/
├── config/                 # Database and configuration files
├── database/              # SQL scripts and database utilities
├── middleware/            # Authentication and validation middleware
├── public/               # Frontend HTML, CSS, and JavaScript
├── routes/               # API route handlers
├── server.js             # Main application server
├── package.json          # Dependencies and scripts
└── README.txt           # This file
```

API ENDPOINTS
-------------
• Authentication: /api/auth/*
• Books: /api/books/*
• Users: /api/users/*
• Checkouts: /api/checkouts/*
• Reviews: /api/reviews/*
• Admin: /api/admin/*
• Analytics: /api/analytics/*

DEFAULT USERS
-------------
• Admin: admin/admin123
• Staff: staff/staff123
• Reader: reader/reader123

TROUBLESHOOTING
---------------
1. Port 3000 already in use:
   - Kill existing Node.js processes: taskkill /f /im node.exe
   - Or change PORT in .env file

2. Database connection errors:
   - Verify MySQL and MongoDB are running
   - Check database credentials in .env file
   - Ensure databases exist and are accessible

3. Frontend not loading:
   - Check browser console for JavaScript errors
   - Verify backend server is running
   - Clear browser cache and cookies

DEVELOPMENT
-----------
• Run tests: npm test
• Development mode: npm run dev
• Code follows ESLint standards
• Uses semantic commit messages

SECURITY FEATURES
-----------------
• JWT-based authentication
• Password hashing with bcrypt
• Rate limiting on API endpoints
• Content Security Policy (CSP)
• Input validation and sanitization
• SQL injection prevention
• XSS protection

PERFORMANCE FEATURES
--------------------
• Database connection pooling
• Efficient SQL queries with indexes
• MongoDB aggregation pipelines
• Image proxy with caching
• Responsive design for all devices

SUPPORT
--------
For issues or questions, please check:
• Project documentation
• API endpoint documentation at /api
• Database schema files in database/ folder

LICENSE
--------
MIT License - see LICENSE file for details

VERSION
--------
Smart Library Platform v1.0.0
Built by Lu Duc Thinh

Last Updated: January 2025
