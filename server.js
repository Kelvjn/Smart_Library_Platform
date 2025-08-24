// Smart Library Platform - Main Server
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { testConnections, closeConnections, healthCheck, initializeMongoDB } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const userRoutes = require('./routes/users');
const checkoutRoutes = require('./routes/checkouts');
const reviewRoutes = require('./routes/reviews');
const adminRoutes = require('./routes/admin');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(limiter);

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-domain.com'] 
        : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} - ${req.method} ${req.url} - IP: ${req.ip}`);
    next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const health = await healthCheck();
        const overallStatus = health.mysql.status === 'healthy' && health.mongodb.status === 'healthy';
        
        res.status(overallStatus ? 200 : 503).json({
            status: overallStatus ? 'healthy' : 'unhealthy',
            timestamp: health.timestamp,
            services: {
                mysql: health.mysql,
                mongodb: health.mongodb
            },
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.env.npm_package_version || '1.0.0'
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/users', userRoutes);
app.use('/api/checkouts', checkoutRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API documentation endpoint
app.get('/api', (req, res) => {
    res.json({
        message: 'Smart Library Platform API',
        version: '1.0.0',
        endpoints: {
            auth: {
                'POST /api/auth/login': 'User login',
                'POST /api/auth/register': 'User registration',
                'POST /api/auth/logout': 'User logout',
                'GET /api/auth/profile': 'Get user profile'
            },
            books: {
                'GET /api/books': 'Get all books with optional filters',
                'GET /api/books/:id': 'Get book by ID',
                'GET /api/books/search': 'Search books'
            },
            users: {
                'GET /api/users/profile': 'Get current user profile',
                'PUT /api/users/profile': 'Update user profile',
                'GET /api/users/:id/checkouts': 'Get user checkouts'
            },
            checkouts: {
                'POST /api/checkouts/borrow': 'Borrow a book',
                'PUT /api/checkouts/:id/return': 'Return a book',
                'GET /api/checkouts/user/:userId': 'Get user checkouts'
            },
            reviews: {
                'POST /api/reviews': 'Add a book review',
                'GET /api/reviews/book/:bookId': 'Get book reviews',
                'PUT /api/reviews/:id': 'Update review',
                'DELETE /api/reviews/:id': 'Delete review'
            },
            admin: {
                'POST /api/admin/books': 'Add new book',
                'PUT /api/admin/books/:id': 'Update book',
                'DELETE /api/admin/books/:id': 'Retire book',
                'PUT /api/admin/books/:id/inventory': 'Update inventory',
                'GET /api/admin/reports': 'Get various reports'
            },
            analytics: {
                'GET /api/analytics/reading-sessions': 'Get reading analytics',
                'POST /api/analytics/reading-sessions': 'Log reading session',
                'GET /api/analytics/user-engagement': 'Get user engagement data',
                'GET /api/analytics/book-popularity': 'Get book popularity data'
            }
        },
        documentation: 'Visit /api/docs for detailed API documentation'
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Error occurred:', error);
    
    // Default error response
    let statusCode = 500;
    let message = 'Internal server error';
    let details = null;

    // Handle specific error types
    if (error.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation error';
        details = error.message;
    } else if (error.name === 'UnauthorizedError') {
        statusCode = 401;
        message = 'Unauthorized access';
    } else if (error.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid ID format';
    } else if (error.code === 'ER_DUP_ENTRY') {
        statusCode = 409;
        message = 'Duplicate entry';
        details = 'A record with this information already exists';
    }

    res.status(statusCode).json({
        error: {
            message,
            details: process.env.NODE_ENV === 'development' ? (details || error.message) : undefined,
            timestamp: new Date().toISOString(),
            path: req.url
        }
    });
});

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        error: {
            message: 'API endpoint not found',
            path: req.url,
            method: req.method,
            timestamp: new Date().toISOString()
        }
    });
});

// Handle 404 for other routes (serve frontend)
app.use('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize databases and start server
async function startServer() {
    try {
        console.log('Initializing databases...');
        
        // Test database connections
        const connectionTests = await testConnections();
        
        if (!connectionTests.mysql || !connectionTests.mongodb) {
            console.error('Database connection failed. Please check your database configuration.');
            process.exit(1);
        }

        // Initialize MongoDB
        await initializeMongoDB();
        
        console.log('Database connections established successfully');
        
        // Start the server
        const server = app.listen(PORT, () => {
            console.log(`
🚀 Smart Library Platform Server Started
📍 Server running on port ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
📊 Health check: http://localhost:${PORT}/health
📚 API docs: http://localhost:${PORT}/api
🏠 Web app: http://localhost:${PORT}
            `);
        });

        // Graceful shutdown
        const gracefulShutdown = async (signal) => {
            console.log(`\n${signal} received. Starting graceful shutdown...`);
            
            server.close(async () => {
                console.log('HTTP server closed');
                
                try {
                    await closeConnections();
                    console.log('Database connections closed');
                    console.log('Graceful shutdown completed');
                    process.exit(0);
                } catch (error) {
                    console.error('Error during shutdown:', error);
                    process.exit(1);
                }
            });
        };

        // Handle shutdown signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            gracefulShutdown('UNCAUGHT_EXCEPTION');
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            gracefulShutdown('UNHANDLED_REJECTION');
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
if (require.main === module) {
    startServer();
}

module.exports = app;
