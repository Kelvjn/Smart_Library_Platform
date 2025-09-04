/**
 * Smart Library Platform - Main Server
 * 
 * A comprehensive library management system built with Node.js and Express.
 * Features include user authentication, book management, borrowing/returning,
 * reviews, and analytics with both MySQL and MongoDB integration.
 * 
 * @author Smart Library Platform Team
 * @version 1.0.0
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { testConnections, closeConnections, healthCheck, getPoolStatus, initializeMongoDB } = require('./config/database');

// Enhanced port management functions
const isPortAvailable = (port) => {
    return new Promise((resolve) => {
        const net = require('net');
        const server = net.createServer();
        
        server.listen(port, () => {
            server.once('close', () => {
                resolve(true);
            });
            server.close();
        });
        
        server.on('error', () => {
            resolve(false);
        });
    });
};

// Kill processes on a specific port (Windows)
const killProcessOnPort = async (port) => {
    return new Promise((resolve) => {
        const { exec } = require('child_process');
        exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
            if (error || !stdout.trim()) {
                resolve(false);
                return;
            }
            
            const lines = stdout.trim().split('\n');
            const pids = new Set();
            
            lines.forEach(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 5) {
                    const pid = parts[parts.length - 1];
                    if (pid && pid !== '0') {
                        pids.add(pid);
                    }
                }
            });
            
            if (pids.size === 0) {
                resolve(false);
                return;
            }
            
            console.log(`🔧 Found ${pids.size} process(es) using port ${port}, attempting to terminate...`);
            
            let completed = 0;
            const total = pids.size;
            
            pids.forEach(pid => {
                exec(`taskkill /F /PID ${pid}`, (killError) => {
                    completed++;
                    if (killError) {
                        console.log(`⚠️  Could not kill process ${pid}: ${killError.message}`);
                    } else {
                        console.log(`✅ Terminated process ${pid}`);
                    }
                    
                    if (completed === total) {
                        // Wait a moment for processes to fully terminate
                        setTimeout(() => resolve(true), 2000);
                    }
                });
            });
        });
    });
};

// Find next available port
const findAvailablePort = async (startPort, maxAttempts = 10) => {
    for (let i = 0; i < maxAttempts; i++) {
        const port = startPort + i;
        const available = await isPortAvailable(port);
        if (available) {
            return port;
        }
    }
    return null;
};

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
const http = require('http');
const https = require('https');

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:", "blob:", "https://covers.openlibrary.org", "https://upload.wikimedia.org", "https://images-na.ssl-images-amazon.com"],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Rate limiting - more permissive for development
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // Increased to 1000 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for certain routes in development
        if (process.env.NODE_ENV !== 'production') {
            return req.url.startsWith('/api/books') || req.url.startsWith('/img');
        }
        return false;
    }
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
app.use(express.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const userAgent = req.get('User-Agent') || 'Unknown';
    const ip = req.ip || req.connection.remoteAddress || 'Unknown';
    
    console.log(`${timestamp} - ${req.method} ${req.url} - IP: ${ip} - User-Agent: ${userAgent.substring(0, 100)}`);
    
    // Add request start time for performance monitoring
    req.startTime = Date.now();
    
    // Log response time when request completes
    res.on('finish', () => {
        const duration = Date.now() - req.startTime;
        console.log(`${timestamp} - ${req.method} ${req.url} - Status: ${res.statusCode} - Duration: ${duration}ms`);
    });
    
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

// Pool status endpoint
app.get('/pool-status', (req, res) => {
    try {
        const poolStatus = getPoolStatus();
        res.json({
            timestamp: new Date().toISOString(),
            pools: poolStatus
        });
    } catch (error) {
        res.status(500).json({
            error: {
                message: 'Failed to get pool status',
                details: error.message,
                timestamp: new Date().toISOString()
            }
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

// Image proxy to avoid external host hotlink 403s
// Usage: /img?url=https%3A%2F%2Fexample.com%2Fcover.jpg
app.get('/img', async (req, res) => {
    try {
        const imageUrl = req.query.url;
        if (!imageUrl) {
            return res.status(400).send('Missing url parameter');
        }
        
        console.log('Image proxy request for:', imageUrl);
        
        const parsed = new URL(imageUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return res.status(400).send('Invalid protocol');
        }
        
        // Allow common book cover hosts
        const allowedHosts = new Set([
            'images-na.ssl-images-amazon.com',
            'upload.wikimedia.org',
            'covers.openlibrary.org',
            'images.unsplash.com',
            'm.media-amazon.com',
            'images.amazon.com',
            'prodimage.images-bn.com'
        ]);
        
        // For development, allow more hosts
        if (process.env.NODE_ENV !== 'production' || allowedHosts.has(parsed.host)) {
            // Set cache headers
            res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
            res.setHeader('Access-Control-Allow-Origin', '*');

            const client = parsed.protocol === 'http:' ? http : https;
            const request = client.get(imageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Referer': 'https://www.goodreads.com/',
                    'Sec-Fetch-Dest': 'image',
                    'Sec-Fetch-Mode': 'no-cors',
                    'Sec-Fetch-Site': 'cross-site'
                }
            }, (upstream) => {
                console.log(`Image proxy response: ${upstream.statusCode} for ${imageUrl}`);
                
                if (upstream.statusCode && upstream.statusCode >= 400) {
                    console.error(`Image proxy error ${upstream.statusCode} for ${imageUrl}`);
                    if (!res.headersSent) {
                        res.status(upstream.statusCode).end();
                    }
                    upstream.resume();
                    return;
                }
                
                // Forward content type if present
                const contentType = upstream.headers['content-type'] || 'image/jpeg';
                res.setHeader('Content-Type', contentType);
                
                // Forward content length if present
                if (upstream.headers['content-length']) {
                    res.setHeader('Content-Length', upstream.headers['content-length']);
                }
                
                upstream.pipe(res);
                
                upstream.on('error', (err) => {
                    console.error('Image proxy upstream error:', err.message);
                    if (!res.headersSent) {
                        res.status(502).send('Upstream error');
                    }
                });
            });

            request.on('error', (err) => {
                console.error('Image proxy request error:', err.message);
                if (!res.headersSent) {
                    res.status(502).send('Proxy error');
                }
            });
            
            request.setTimeout(10000, () => {
                console.error('Image proxy timeout for:', imageUrl);
                request.destroy();
                if (!res.headersSent) {
                    res.status(504).send('Timeout');
                }
            });
        } else {
            res.status(403).send('Host not allowed: ' + parsed.host);
        }
    } catch (err) {
        console.error('Image proxy failure:', err);
        res.status(500).send('Server error');
    }
});

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

/**
 * Initialize databases and start the Express server
 * Sets up MySQL and MongoDB connections, then starts the HTTP server
 * with proper error handling and graceful shutdown capabilities
 */
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
        
        // Enhanced port conflict resolution
        let finalPort = PORT;
        const portAvailable = await isPortAvailable(PORT);
        
        if (!portAvailable) {
            console.log(`⚠️  Port ${PORT} is not available. Attempting automatic resolution...`);
            
            // Try to kill processes on the port
            const killed = await killProcessOnPort(PORT);
            if (killed) {
                console.log(`✅ Successfully cleared port ${PORT}`);
                // Wait a moment for the port to be fully released
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Check if port is now available
                const nowAvailable = await isPortAvailable(PORT);
                if (nowAvailable) {
                    console.log(`✅ Port ${PORT} is now available`);
                } else {
                    console.log(`⚠️  Port ${PORT} still not available, finding alternative...`);
                    finalPort = await findAvailablePort(PORT);
                    if (!finalPort) {
                        console.error(`❌ Could not find any available port starting from ${PORT}`);
                        process.exit(1);
                    }
                    console.log(`✅ Found available port: ${finalPort}`);
                }
            } else {
                console.log(`⚠️  Could not clear port ${PORT}, finding alternative...`);
                finalPort = await findAvailablePort(PORT);
                if (!finalPort) {
                    console.error(`❌ Could not find any available port starting from ${PORT}`);
                    process.exit(1);
                }
                console.log(`✅ Found available port: ${finalPort}`);
            }
        }
        
        // Start the server
        const server = app.listen(finalPort, () => {
            console.log(`
🚀 Smart Library Platform Server Started
📍 Server running on port ${finalPort}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
        📊 Health check: http://localhost:${finalPort}/health
        🔌 Pool status: http://localhost:${finalPort}/pool-status
📚 API docs: http://localhost:${finalPort}/api
🏠 Web app: http://localhost:${finalPort}
            `);
        }).on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Port ${finalPort} is still in use after resolution attempts.`);
                console.log('💡 This should not happen with the enhanced port management.');
                console.log('   Please check for system-level port conflicts.');
                process.exit(1);
            } else {
                console.error('❌ Server failed to start:', error.message);
                process.exit(1);
            }
        });

        // Graceful shutdown
        const gracefulShutdown = async (signal) => {
            console.log(`\n${signal} received. Starting graceful shutdown...`);
            
            // Set a timeout for graceful shutdown
            const shutdownTimeout = setTimeout(() => {
                console.error('Forced shutdown due to timeout');
                process.exit(1);
            }, 30000); // 30 seconds timeout
            
            server.close(async () => {
                console.log('HTTP server closed');
                
                try {
                    await closeConnections();
                    console.log('Database connections closed');
                    clearTimeout(shutdownTimeout);
                    console.log('Graceful shutdown completed');
                    process.exit(0);
                } catch (error) {
                    console.error('Error during shutdown:', error);
                    clearTimeout(shutdownTimeout);
                    process.exit(1);
                }
            });
            
            // Handle cases where server.close() doesn't work
            server.on('error', (error) => {
                console.error('Server error during shutdown:', error);
                clearTimeout(shutdownTimeout);
                process.exit(1);
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
