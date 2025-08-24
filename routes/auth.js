// Smart Library Platform - Authentication Routes
const express = require('express');
const rateLimit = require('express-rate-limit');
const { getMySQLConnection } = require('../config/database');
const { 
    generateToken, 
    hashPassword, 
    comparePassword, 
    authenticate,
    validateAuthInput,
    authRateLimit
} = require('../middleware/auth');

const router = express.Router();

// Rate limiting for auth endpoints
const loginLimiter = rateLimit(authRateLimit);

// POST /api/auth/register - User registration
router.post('/register', validateAuthInput.register, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const { username, email, password, firstName, lastName, phone, address } = req.body;
        
        // Check if username or email already exists
        const [existingUsers] = await connection.execute(
            'SELECT username, email FROM users WHERE username = ? OR email = ?',
            [username, email]
        );
        
        if (existingUsers.length > 0) {
            const existing = existingUsers[0];
            if (existing.username === username) {
                return res.status(409).json({
                    error: {
                        message: 'Username already exists.',
                        code: 'USERNAME_EXISTS'
                    }
                });
            }
            if (existing.email === email) {
                return res.status(409).json({
                    error: {
                        message: 'Email already exists.',
                        code: 'EMAIL_EXISTS'
                    }
                });
            }
        }
        
        // Hash password
        const passwordHash = await hashPassword(password);
        
        // Insert new user
        const [result] = await connection.execute(
            `INSERT INTO users (username, email, password_hash, first_name, last_name, phone, address, user_type) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 'reader')`,
            [username, email, passwordHash, firstName, lastName, phone || null, address || null]
        );
        
        // Get the created user
        const [newUser] = await connection.execute(
            'SELECT user_id, username, email, first_name, last_name, user_type, registration_date FROM users WHERE user_id = ?',
            [result.insertId]
        );
        
        const user = newUser[0];
        const token = generateToken(user);
        
        res.status(201).json({
            message: 'User registered successfully',
            user: {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                user_type: user.user_type,
                registration_date: user.registration_date
            },
            token
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            error: {
                message: 'Registration failed',
                code: 'REGISTRATION_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// POST /api/auth/login - User login
router.post('/login', loginLimiter, validateAuthInput.login, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const { username, password } = req.body;
        
        // Find user by username or email
        const [users] = await connection.execute(
            'SELECT user_id, username, email, password_hash, first_name, last_name, user_type, is_active FROM users WHERE (username = ? OR email = ?) AND is_active = TRUE',
            [username, username]
        );
        
        if (users.length === 0) {
            return res.status(401).json({
                error: {
                    message: 'Invalid credentials.',
                    code: 'INVALID_CREDENTIALS'
                }
            });
        }
        
        const user = users[0];
        
        // Verify password
        const isValidPassword = await comparePassword(password, user.password_hash);
        
        if (!isValidPassword) {
            return res.status(401).json({
                error: {
                    message: 'Invalid credentials.',
                    code: 'INVALID_CREDENTIALS'
                }
            });
        }
        
        // Generate token
        const token = generateToken(user);
        
        res.json({
            message: 'Login successful',
            user: {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                user_type: user.user_type
            },
            token
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: {
                message: 'Login failed',
                code: 'LOGIN_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// GET /api/auth/profile - Get current user profile
router.get('/profile', authenticate, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const [users] = await connection.execute(
            `SELECT user_id, username, email, first_name, last_name, phone, address, 
                    user_type, registration_date, is_active 
             FROM users WHERE user_id = ?`,
            [req.user.user_id]
        );
        
        if (users.length === 0) {
            return res.status(404).json({
                error: {
                    message: 'User not found.',
                    code: 'USER_NOT_FOUND'
                }
            });
        }
        
        const user = users[0];
        
        // Get additional user statistics
        const [checkoutStats] = await connection.execute(
            `SELECT 
                COUNT(*) as total_checkouts,
                COUNT(CASE WHEN is_returned = FALSE THEN 1 END) as active_checkouts,
                COUNT(CASE WHEN is_late = TRUE THEN 1 END) as late_returns
             FROM checkouts WHERE user_id = ?`,
            [req.user.user_id]
        );
        
        const [reviewStats] = await connection.execute(
            'SELECT COUNT(*) as total_reviews FROM reviews WHERE user_id = ?',
            [req.user.user_id]
        );
        
        res.json({
            user: {
                ...user,
                statistics: {
                    total_checkouts: checkoutStats[0].total_checkouts,
                    active_checkouts: checkoutStats[0].active_checkouts,
                    late_returns: checkoutStats[0].late_returns,
                    total_reviews: reviewStats[0].total_reviews
                }
            }
        });
        
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to fetch profile',
                code: 'PROFILE_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// PUT /api/auth/profile - Update user profile
router.put('/profile', authenticate, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const { firstName, lastName, phone, address, email } = req.body;
        const userId = req.user.user_id;
        
        // Validate input
        if (firstName && (firstName.length < 1 || firstName.length > 50)) {
            return res.status(400).json({
                error: {
                    message: 'First name must be between 1 and 50 characters.',
                    code: 'INVALID_FIRST_NAME'
                }
            });
        }
        
        if (lastName && (lastName.length < 1 || lastName.length > 50)) {
            return res.status(400).json({
                error: {
                    message: 'Last name must be between 1 and 50 characters.',
                    code: 'INVALID_LAST_NAME'
                }
            });
        }
        
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    error: {
                        message: 'Invalid email format.',
                        code: 'INVALID_EMAIL'
                    }
                });
            }
            
            // Check if email is already taken by another user
            const [existingEmail] = await connection.execute(
                'SELECT user_id FROM users WHERE email = ? AND user_id != ?',
                [email, userId]
            );
            
            if (existingEmail.length > 0) {
                return res.status(409).json({
                    error: {
                        message: 'Email already exists.',
                        code: 'EMAIL_EXISTS'
                    }
                });
            }
        }
        
        // Build update query dynamically
        const updates = [];
        const values = [];
        
        if (firstName !== undefined) {
            updates.push('first_name = ?');
            values.push(firstName);
        }
        if (lastName !== undefined) {
            updates.push('last_name = ?');
            values.push(lastName);
        }
        if (phone !== undefined) {
            updates.push('phone = ?');
            values.push(phone || null);
        }
        if (address !== undefined) {
            updates.push('address = ?');
            values.push(address || null);
        }
        if (email !== undefined) {
            updates.push('email = ?');
            values.push(email);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({
                error: {
                    message: 'No valid fields to update.',
                    code: 'NO_UPDATES'
                }
            });
        }
        
        values.push(userId);
        
        await connection.execute(
            `UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`,
            values
        );
        
        // Fetch updated user
        const [updatedUser] = await connection.execute(
            `SELECT user_id, username, email, first_name, last_name, phone, address, 
                    user_type, registration_date 
             FROM users WHERE user_id = ?`,
            [userId]
        );
        
        res.json({
            message: 'Profile updated successfully',
            user: updatedUser[0]
        });
        
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to update profile',
                code: 'UPDATE_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// POST /api/auth/change-password - Change user password
router.post('/change-password', authenticate, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.user_id;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                error: {
                    message: 'Current password and new password are required.',
                    code: 'MISSING_PASSWORDS'
                }
            });
        }
        
        if (newPassword.length < 8) {
            return res.status(400).json({
                error: {
                    message: 'New password must be at least 8 characters long.',
                    code: 'WEAK_PASSWORD'
                }
            });
        }
        
        // Get current password hash
        const [users] = await connection.execute(
            'SELECT password_hash FROM users WHERE user_id = ?',
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({
                error: {
                    message: 'User not found.',
                    code: 'USER_NOT_FOUND'
                }
            });
        }
        
        // Verify current password
        const isValidPassword = await comparePassword(currentPassword, users[0].password_hash);
        
        if (!isValidPassword) {
            return res.status(401).json({
                error: {
                    message: 'Current password is incorrect.',
                    code: 'INVALID_CURRENT_PASSWORD'
                }
            });
        }
        
        // Hash new password
        const newPasswordHash = await hashPassword(newPassword);
        
        // Update password
        await connection.execute(
            'UPDATE users SET password_hash = ? WHERE user_id = ?',
            [newPasswordHash, userId]
        );
        
        res.json({
            message: 'Password changed successfully'
        });
        
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to change password',
                code: 'PASSWORD_CHANGE_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// POST /api/auth/logout - User logout (client-side token invalidation)
router.post('/logout', authenticate, (req, res) => {
    // In a more sophisticated implementation, you might maintain a blacklist of tokens
    // For now, we'll just send a success response and let the client handle token removal
    res.json({
        message: 'Logout successful'
    });
});

module.exports = router;
