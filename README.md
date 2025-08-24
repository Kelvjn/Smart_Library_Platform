# Smart Library Platform

A comprehensive library management system built with Node.js, MySQL, and MongoDB that combines traditional relational database functionality with modern NoSQL analytics capabilities.

## 🚀 Features

### Core Functionality
- **Book Management**: Complete CRUD operations for books with author relationships
- **User Management**: Reader, staff, and admin role-based access control
- **Checkout System**: Book borrowing and returning with automated tracking
- **Review System**: User reviews and ratings with automatic book rating calculations
- **Search & Discovery**: Advanced book search with multiple filters and sorting options

### Analytics & Insights
- **Reading Analytics**: MongoDB-powered session tracking and user engagement metrics
- **Performance Monitoring**: Reading patterns, device usage, and user behavior analysis
- **Reporting**: Administrative reports for most borrowed books, active readers, and library statistics

### Technical Features
- **Database Integration**: Dual database architecture (MySQL + MongoDB)
- **Transaction Management**: ACID compliance for critical operations
- **Stored Procedures**: Complex business logic encapsulation
- **Triggers**: Automatic data consistency and integrity maintenance
- **Optimization**: Comprehensive indexing and query optimization
- **RESTful API**: Well-structured API endpoints with proper error handling
- **Modern Frontend**: Responsive web interface with Bootstrap and vanilla JavaScript

## 🏗️ Architecture

### Database Design

#### MySQL (Relational Data)
- **Users**: Reader and staff account management
- **Books**: Book catalog with metadata
- **Authors**: Author information with many-to-many book relationships
- **Checkouts**: Book borrowing transactions
- **Reviews**: User reviews and ratings
- **Staff Logs**: Administrative action auditing

#### MongoDB (Analytics Data)
- **Reading Sessions**: Detailed reading behavior tracking
- **User Analytics**: Aggregated user engagement metrics
- **Book Analytics**: Book popularity and usage statistics

### Backend Architecture
- **Node.js/Express**: RESTful API server
- **MySQL2**: Database connectivity with connection pooling
- **MongoDB Driver**: NoSQL operations and aggregation pipelines
- **JWT Authentication**: Secure user authentication
- **Middleware**: Security, rate limiting, and request validation

## 📋 Prerequisites

Before running this application, ensure you have:

- **Node.js** (v14 or higher)
- **MySQL** (v8.0 or higher)
- **MongoDB** (v4.4 or higher)
- **npm** (comes with Node.js)

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd Smart_Library_Platform
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup

#### MySQL Setup
1. Create a MySQL database:
```sql
CREATE DATABASE smart_library CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. Run the schema setup:
```bash
mysql -u root -p smart_library < database/mysql_schema.sql
```

3. Create functions and procedures:
```bash
mysql -u root -p smart_library < database/mysql_functions.sql
mysql -u root -p smart_library < database/mysql_procedures.sql
mysql -u root -p smart_library < database/mysql_triggers.sql
```

#### MongoDB Setup
1. Start MongoDB service
2. Run the MongoDB setup script:
```bash
mongosh < database/mongodb_setup.js
```

### 4. Environment Configuration
1. Copy the example environment file:
```bash
cp config.env.example .env
```

2. Update the `.env` file with your database credentials:
```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=smart_library

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/smart_library_nosql

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRE=24h

# Server Configuration
PORT=3000
NODE_ENV=development
```

### 5. Start the Application
```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

The application will be available at `http://localhost:3000`

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/logout` - User logout

### Book Management
- `GET /api/books` - Get all books with pagination and filters
- `GET /api/books/:id` - Get book details
- `GET /api/books/search/advanced` - Advanced book search
- `GET /api/books/popular` - Get popular books

### Checkout Operations
- `POST /api/checkouts/borrow` - Borrow a book
- `PUT /api/checkouts/:id/return` - Return a book
- `GET /api/checkouts/user/:userId` - Get user's checkouts
- `GET /api/checkouts/overdue` - Get overdue checkouts (staff only)

### Review System
- `POST /api/reviews` - Add a book review
- `GET /api/reviews/book/:bookId` - Get book reviews
- `PUT /api/reviews/:id` - Update review
- `DELETE /api/reviews/:id` - Delete review

### Admin Operations
- `POST /api/admin/books` - Add new book
- `PUT /api/admin/books/:id` - Update book
- `PUT /api/admin/books/:id/inventory` - Update inventory
- `DELETE /api/admin/books/:id` - Retire book
- `GET /api/admin/reports` - Generate reports

### Analytics (MongoDB)
- `POST /api/analytics/reading-sessions` - Log reading session
- `GET /api/analytics/user-engagement` - User engagement metrics
- `GET /api/analytics/book-popularity` - Book popularity analytics
- `GET /api/analytics/reading-patterns` - Reading pattern analysis

## 🔧 Database Functions and Procedures

### MySQL Functions
- `IsBookAvailable(book_id)` - Check book availability
- `IsReturnedOnTime(checkout_id)` - Verify timely return
- `CountBooksInDateRange(start_date, end_date)` - Count borrowed books
- `CalculateLateFee(checkout_id, fee_per_day)` - Calculate late fees

### Stored Procedures
- `BorrowBook()` - Handle book borrowing with concurrency control
- `ReturnBook()` - Process book returns with fee calculation
- `ReviewBook()` - Add user reviews with validation
- `AddBook()` - Add new books with logging
- `UpdateInventory()` - Manage book inventory
- `RetireBook()` - Deactivate books safely

### Database Triggers
- Automatic book metadata updates on checkout/return
- Rating recalculation on review changes
- Data integrity enforcement
- Audit trail maintenance

## 📊 Analytics Features

### Reading Session Tracking
- Session duration and device usage
- Pages read and reading progress
- Highlights and bookmarks
- Location and quality metrics

### Aggregation Pipelines
- Average session time per user
- Most highlighted books
- Top books by reading time
- Device usage patterns
- Reading time analysis

### Reports Available
- Most borrowed books by time period
- Top active readers
- Books with low availability
- Overdue books summary
- Staff activity logs

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-based Access Control**: Reader, staff, and admin permissions
- **Rate Limiting**: API endpoint protection
- **Input Validation**: Comprehensive request validation
- **SQL Injection Prevention**: Parameterized queries
- **CORS Protection**: Cross-origin request security
- **Helmet.js**: Security headers middleware

## 🎨 Frontend Features

- **Responsive Design**: Mobile-friendly Bootstrap interface
- **Interactive Dashboard**: User-specific analytics and statistics
- **Real-time Updates**: Dynamic content loading
- **Advanced Search**: Multi-filter book discovery
- **User Profiles**: Personal reading history and preferences
- **Admin Panel**: Management interface for staff

## 🧪 Testing

### Health Check
Visit `http://localhost:3000/health` to verify both database connections.

### Sample Data
The setup scripts include sample data for testing:
- Demo users (admin, staff, readers)
- Sample books with authors
- Test checkouts and reviews
- MongoDB reading sessions

## 🚀 Performance Optimizations

### Database Indexes
- Composite indexes for complex queries
- Full-text search indexes
- Foreign key indexes
- Date range indexes

### Query Optimization
- Connection pooling
- Aggregation pipeline optimization
- Efficient pagination
- Cached query results

### Application Level
- Middleware optimization
- Response compression
- Static file serving
- Error handling efficiency

## 🔧 Configuration Options

### Environment Variables
- Database connection settings
- JWT configuration
- Server port and environment
- Rate limiting parameters
- Security settings

### Database Configuration
- Connection pool sizes
- Query timeouts
- Character sets and collations
- Index optimization

## 📝 Assignment Requirements Fulfilled

✅ **MySQL & MongoDB Integration**: Dual database architecture
✅ **Book Search**: Advanced search with multiple filters
✅ **Borrow/Return System**: Complete checkout workflow
✅ **Review System**: User ratings and comments
✅ **Admin Features**: Staff management interface
✅ **Reports**: Comprehensive reporting system
✅ **Reading Analytics**: MongoDB-powered analytics
✅ **Database Optimization**: Indexes and performance tuning
✅ **Functions**: Custom MySQL functions
✅ **Stored Procedures**: Business logic encapsulation
✅ **Triggers**: Automatic data maintenance
✅ **Transaction Management**: ACID compliance
✅ **Aggregation Pipelines**: MongoDB analytics
✅ **Web Application**: Full-featured web interface

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify MySQL and MongoDB are running
   - Check connection credentials in `.env`
   - Ensure databases exist and are accessible

2. **Permission Errors**
   - Verify user has appropriate database permissions
   - Check file system permissions for logs

3. **Port Conflicts**
   - Change PORT in `.env` if 3000 is occupied
   - Ensure database ports are available

4. **Module Not Found Errors**
   - Run `npm install` to ensure all dependencies are installed
   - Check Node.js version compatibility

## 📞 Support

For questions or issues, please:
1. Check the troubleshooting section
2. Review the API documentation
3. Create an issue in the repository
4. Contact the development team

---

**Built with ❤️ for modern library management**
