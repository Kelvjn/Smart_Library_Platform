// Smart Library Platform - Authentication Middleware
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getMySQLConnection } = require('../config/database');

// JWT secret key
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '24h';

// Generate JWT token
function generateToken(user) {
    const payload = {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        user_type: user.user_type,
        is_active: user.is_active
    };
    
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE });
}

// Verify JWT token
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
}

// Hash password
async function hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
}

// Compare password
async function comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
}

// Authentication middleware
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: {
                    message: 'Access denied. No token provided.',
                    code: 'NO_TOKEN'
                }
            });
        }
        
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        
        try {
            const decoded = verifyToken(token);
            
            // Verify user still exists and is active in database
            const connection = await getMySQLConnection();
            try {
                const [users] = await connection.execute(
                    'SELECT user_id, username, email, user_type, is_active FROM users WHERE user_id = ? AND is_active = TRUE',
                    [decoded.user_id]
                );
                
                if (users.length === 0) {
                    return res.status(401).json({
                        error: {
                            message: 'User not found or inactive.',
                            code: 'USER_NOT_FOUND'
                        }
                    });
                }
                
                // Add user info to request object
                req.user = users[0];
                next();
                
            } finally {
                connection.release();
            }
            
        } catch (tokenError) {
            return res.status(401).json({
                error: {
                    message: 'Invalid or expired token.',
                    code: 'INVALID_TOKEN'
                }
            });
        }
        
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({
            error: {
                message: 'Authentication failed.',
                code: 'AUTH_ERROR'
            }
        });
    }
};

// Authorization middleware - check user type
const authorize = (allowedRoles = []) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: {
                    message: 'Authentication required.',
                    code: 'NO_AUTH'
                }
            });
        }
        
        if (allowedRoles.length === 0) {
            // If no specific roles required, just need to be authenticated
            return next();
        }
        
        if (!allowedRoles.includes(req.user.user_type)) {
            return res.status(403).json({
                error: {
                    message: 'Insufficient permissions.',
                    code: 'INSUFFICIENT_PERMISSIONS',
                    required: allowedRoles,
                    current: req.user.user_type
                }
            });
        }
        
        next();
    };
};

// Check if user is staff (staff or admin)
const requireStaff = authorize(['staff', 'admin']);

// Check if user is admin
const requireAdmin = authorize(['admin']);

// Optional authentication - doesn't fail if no token provided
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            req.user = null;
            return next();
        }
        
        const token = authHeader.substring(7);
        
        try {
            const decoded = verifyToken(token);
            
            // Verify user still exists and is active
            const connection = await getMySQLConnection();
            try {
                const [users] = await connection.execute(
                    'SELECT user_id, username, email, user_type, is_active FROM users WHERE user_id = ? AND is_active = TRUE',
                    [decoded.user_id]
                );
                
                req.user = users.length > 0 ? users[0] : null;
                next();
                
            } finally {
                connection.release();
            }
            
        } catch (tokenError) {
            req.user = null;
            next();
        }
        
    } catch (error) {
        console.error('Optional authentication error:', error);
        req.user = null;
        next();
    }
};

// User ownership verification - user can only access their own resources
const verifyOwnership = (userIdParam = 'userId') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: {
                    message: 'Authentication required.',
                    code: 'NO_AUTH'
                }
            });
        }
        
        const resourceUserId = parseInt(req.params[userIdParam]);
        
        // Admin and staff can access any user's resources
        if (req.user.user_type === 'admin' || req.user.user_type === 'staff') {
            return next();
        }
        
        // Regular users can only access their own resources
        if (req.user.user_id !== resourceUserId) {
            return res.status(403).json({
                error: {
                    message: 'Access denied. You can only access your own resources.',
                    code: 'OWNERSHIP_REQUIRED'
                }
            });
        }
        
        next();
    };
};

// Rate limiting for authentication endpoints
const authRateLimit = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 50 : 5, // More permissive in development
    message: {
        error: {
            message: 'Too many authentication attempts. Please try again later.',
            code: 'TOO_MANY_AUTH_ATTEMPTS'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true
};

// Validate user input for authentication
const validateAuthInput = {
    login: (req, res, next) => {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                error: {
                    message: 'Username and password are required.',
                    code: 'MISSING_CREDENTIALS'
                }
            });
        }
        
        if (typeof username !== 'string' || typeof password !== 'string') {
            return res.status(400).json({
                error: {
                    message: 'Username and password must be strings.',
                    code: 'INVALID_CREDENTIALS_TYPE'
                }
            });
        }
        
        if (username.length < 3 || username.length > 50) {
            return res.status(400).json({
                error: {
                    message: 'Username must be between 3 and 50 characters.',
                    code: 'INVALID_USERNAME_LENGTH'
                }
            });
        }
        
        if (password.length < 6) {
            return res.status(400).json({
                error: {
                    message: 'Password must be at least 6 characters long.',
                    code: 'INVALID_PASSWORD_LENGTH'
                }
            });
        }
        
        next();
    },
    
    register: (req, res, next) => {
        const { username, email, password, firstName, lastName } = req.body;
        
        if (!username || !email || !password || !firstName || !lastName) {
            return res.status(400).json({
                error: {
                    message: 'All fields are required.',
                    code: 'MISSING_FIELDS'
                }
            });
        }
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid email format.',
                    code: 'INVALID_EMAIL'
                }
            });
        }
        
        // Username validation
        const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({
                error: {
                    message: 'Username must be 3-50 characters and contain only letters, numbers, and underscores.',
                    code: 'INVALID_USERNAME'
                }
            });
        }
        
        // Password strength validation
        if (password.length < 8) {
            return res.status(400).json({
                error: {
                    message: 'Password must be at least 8 characters long.',
                    code: 'WEAK_PASSWORD'
                }
            });
        }
        
        // Name validation
        if (firstName.length < 1 || firstName.length > 50 || lastName.length < 1 || lastName.length > 50) {
            return res.status(400).json({
                error: {
                    message: 'First name and last name must be between 1 and 50 characters.',
                    code: 'INVALID_NAME_LENGTH'
                }
            });
        }
        
        next();
    }
};

// Get user info from token (for client-side use)
async function getUserFromToken(token) {
    try {
        const decoded = verifyToken(token);
        
        const connection = await getMySQLConnection();
        try {
            const [users] = await connection.execute(
                'SELECT user_id, username, email, first_name, last_name, user_type, is_active, registration_date FROM users WHERE user_id = ? AND is_active = TRUE',
                [decoded.user_id]
            );
            
            return users.length > 0 ? users[0] : null;
            
        } finally {
            connection.release();
        }
        
    } catch (error) {
        return null;
    }
}

module.exports = {
    // Token functions
    generateToken,
    verifyToken,
    getUserFromToken,
    
    // Password functions
    hashPassword,
    comparePassword,
    
    // Middleware
    authenticate,
    authorize,
    requireStaff,
    requireAdmin,
    optionalAuth,
    verifyOwnership,
    
    // Validation
    validateAuthInput,
    
    // Rate limiting
    authRateLimit
};
