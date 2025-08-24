// Smart Library Platform - Checkouts Routes
const express = require('express');
const { getMySQLConnection, callStoredProcedure, callFunction } = require('../config/database');
const { authenticate, requireStaff, verifyOwnership } = require('../middleware/auth');

const router = express.Router();

// POST /api/checkouts/borrow - Borrow a book
router.post('/borrow', authenticate, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const { book_id, loan_period_days = 14 } = req.body;
        const user_id = req.user.user_id;
        const staff_id = req.user.user_type === 'staff' || req.user.user_type === 'admin' ? req.user.user_id : 2; // Default staff user
        
        if (!book_id) {
            return res.status(400).json({
                error: {
                    message: 'Book ID is required',
                    code: 'MISSING_BOOK_ID'
                }
            });
        }
        
        const bookId = parseInt(book_id);
        const loanPeriod = parseInt(loan_period_days);
        
        if (isNaN(bookId) || bookId <= 0) {
            return res.status(400).json({
                error: {
                    message: 'Invalid book ID',
                    code: 'INVALID_BOOK_ID'
                }
            });
        }
        
        if (isNaN(loanPeriod) || loanPeriod < 1 || loanPeriod > 30) {
            return res.status(400).json({
                error: {
                    message: 'Loan period must be between 1 and 30 days',
                    code: 'INVALID_LOAN_PERIOD'
                }
            });
        }
        
        // Check if book is available
        const isAvailable = await callFunction('IsBookAvailable', [bookId]);
        
        if (!isAvailable) {
            return res.status(409).json({
                error: {
                    message: 'Book is not available for borrowing',
                    code: 'BOOK_NOT_AVAILABLE'
                }
            });
        }
        
        // Check user's current checkout limit
        const canBorrow = await callFunction('CanUserBorrowMore', [user_id, 5]);
        
        if (!canBorrow) {
            return res.status(409).json({
                error: {
                    message: 'User has reached maximum checkout limit (5 books)',
                    code: 'CHECKOUT_LIMIT_REACHED'
                }
            });
        }
        
        // Call stored procedure to borrow book
        try {
            const [results] = await connection.execute(
                'CALL BorrowBook(?, ?, ?, ?, @result, @checkout_id)',
                [user_id, bookId, staff_id, loanPeriod]
            );
            
            // Get the output parameters
            const [[{ '@result': result, '@checkout_id': checkoutId }]] = await connection.execute(
                'SELECT @result, @checkout_id'
            );
            
            if (result.startsWith('Error:')) {
                return res.status(409).json({
                    error: {
                        message: result,
                        code: 'BORROW_FAILED'
                    }
                });
            }
            
            // Get checkout details
            const [checkoutDetails] = await connection.execute(`
                SELECT 
                    c.checkout_id,
                    c.checkout_date,
                    c.due_date,
                    b.title,
                    b.isbn,
                    GROUP_CONCAT(
                        CONCAT(a.first_name, ' ', a.last_name) 
                        ORDER BY ba.author_order 
                        SEPARATOR ', '
                    ) as authors
                FROM checkouts c
                JOIN books b ON c.book_id = b.book_id
                LEFT JOIN book_authors ba ON b.book_id = ba.book_id
                LEFT JOIN authors a ON ba.author_id = a.author_id
                WHERE c.checkout_id = ?
                GROUP BY c.checkout_id
            `, [checkoutId]);
            
            res.status(201).json({
                message: 'Book borrowed successfully',
                checkout: {
                    ...checkoutDetails[0],
                    authors: checkoutDetails[0].authors ? checkoutDetails[0].authors.split(', ') : []
                }
            });
            
        } catch (procedureError) {
            console.error('Stored procedure error:', procedureError);
            return res.status(500).json({
                error: {
                    message: 'Failed to process book borrowing',
                    code: 'PROCEDURE_ERROR'
                }
            });
        }
        
    } catch (error) {
        console.error('Borrow book error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to borrow book',
                code: 'BORROW_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// PUT /api/checkouts/:id/return - Return a book
router.put('/:id/return', authenticate, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const checkoutId = parseInt(req.params.id);
        const staff_id = req.user.user_type === 'staff' || req.user.user_type === 'admin' ? req.user.user_id : 2;
        
        if (isNaN(checkoutId)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid checkout ID',
                    code: 'INVALID_CHECKOUT_ID'
                }
            });
        }
        
        // Verify ownership if not staff
        if (req.user.user_type === 'reader') {
            const [checkout] = await connection.execute(
                'SELECT user_id FROM checkouts WHERE checkout_id = ?',
                [checkoutId]
            );
            
            if (checkout.length === 0) {
                return res.status(404).json({
                    error: {
                        message: 'Checkout not found',
                        code: 'CHECKOUT_NOT_FOUND'
                    }
                });
            }
            
            if (checkout[0].user_id !== req.user.user_id) {
                return res.status(403).json({
                    error: {
                        message: 'You can only return your own books',
                        code: 'UNAUTHORIZED_RETURN'
                    }
                });
            }
        }
        
        // Call stored procedure to return book
        try {
            const [results] = await connection.execute(
                'CALL ReturnBook(?, ?, @result, @late_fee)',
                [checkoutId, staff_id]
            );
            
            // Get the output parameters
            const [[{ '@result': result, '@late_fee': lateFee }]] = await connection.execute(
                'SELECT @result, @late_fee'
            );
            
            if (result.startsWith('Error:')) {
                return res.status(409).json({
                    error: {
                        message: result,
                        code: 'RETURN_FAILED'
                    }
                });
            }
            
            // Get updated checkout details
            const [checkoutDetails] = await connection.execute(`
                SELECT 
                    c.checkout_id,
                    c.checkout_date,
                    c.due_date,
                    c.return_date,
                    c.is_late,
                    c.late_fee,
                    b.title,
                    b.isbn,
                    GROUP_CONCAT(
                        CONCAT(a.first_name, ' ', a.last_name) 
                        ORDER BY ba.author_order 
                        SEPARATOR ', '
                    ) as authors
                FROM checkouts c
                JOIN books b ON c.book_id = b.book_id
                LEFT JOIN book_authors ba ON b.book_id = ba.book_id
                LEFT JOIN authors a ON ba.author_id = a.author_id
                WHERE c.checkout_id = ?
                GROUP BY c.checkout_id
            `, [checkoutId]);
            
            res.json({
                message: 'Book returned successfully',
                checkout: {
                    ...checkoutDetails[0],
                    authors: checkoutDetails[0].authors ? checkoutDetails[0].authors.split(', ') : []
                },
                late_fee: parseFloat(lateFee)
            });
            
        } catch (procedureError) {
            console.error('Return procedure error:', procedureError);
            return res.status(500).json({
                error: {
                    message: 'Failed to process book return',
                    code: 'PROCEDURE_ERROR'
                }
            });
        }
        
    } catch (error) {
        console.error('Return book error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to return book',
                code: 'RETURN_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// GET /api/checkouts/user/:userId - Get user's checkouts
router.get('/user/:userId', authenticate, verifyOwnership('userId'), async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const userId = parseInt(req.params.userId);
        const { status = 'all', page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        if (isNaN(userId)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid user ID',
                    code: 'INVALID_USER_ID'
                }
            });
        }
        
        let statusCondition = '';
        if (status === 'active') {
            statusCondition = 'AND c.is_returned = FALSE';
        } else if (status === 'returned') {
            statusCondition = 'AND c.is_returned = TRUE';
        } else if (status === 'overdue') {
            statusCondition = 'AND c.is_returned = FALSE AND c.due_date < CURDATE()';
        }
        
        // Get total count
        const [countResult] = await connection.execute(
            `SELECT COUNT(*) as total FROM checkouts c WHERE c.user_id = ? ${statusCondition}`,
            [userId]
        );
        
        // Get checkouts
        const [checkouts] = await connection.execute(`
            SELECT 
                c.checkout_id,
                c.checkout_date,
                c.due_date,
                c.return_date,
                c.is_returned,
                c.is_late,
                c.late_fee,
                b.book_id,
                b.title,
                b.isbn,
                b.cover_image_url,
                GROUP_CONCAT(
                    CONCAT(a.first_name, ' ', a.last_name) 
                    ORDER BY ba.author_order 
                    SEPARATOR ', '
                ) as authors,
                CASE 
                    WHEN c.is_returned = FALSE AND c.due_date < CURDATE() THEN 'overdue'
                    WHEN c.is_returned = FALSE THEN 'active'
                    WHEN c.is_late = TRUE THEN 'returned_late'
                    ELSE 'returned_on_time'
                END as status
            FROM checkouts c
            JOIN books b ON c.book_id = b.book_id
            LEFT JOIN book_authors ba ON b.book_id = ba.book_id
            LEFT JOIN authors a ON ba.author_id = a.author_id
            WHERE c.user_id = ? ${statusCondition}
            GROUP BY c.checkout_id
            ORDER BY c.checkout_date DESC
            LIMIT ? OFFSET ?
        `, [userId, parseInt(limit), offset]);
        
        const formattedCheckouts = checkouts.map(checkout => ({
            ...checkout,
            authors: checkout.authors ? checkout.authors.split(', ') : [],
            days_until_due: checkout.is_returned ? null : Math.ceil((new Date(checkout.due_date) - new Date()) / (1000 * 60 * 60 * 24))
        }));
        
        res.json({
            checkouts: formattedCheckouts,
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total_checkouts: countResult[0].total,
                total_pages: Math.ceil(countResult[0].total / parseInt(limit))
            },
            filters: {
                status
            }
        });
        
    } catch (error) {
        console.error('User checkouts fetch error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to fetch user checkouts',
                code: 'CHECKOUTS_FETCH_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// GET /api/checkouts/:id - Get checkout details
router.get('/:id', authenticate, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const checkoutId = parseInt(req.params.id);
        
        if (isNaN(checkoutId)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid checkout ID',
                    code: 'INVALID_CHECKOUT_ID'
                }
            });
        }
        
        const [checkouts] = await connection.execute(`
            SELECT 
                c.checkout_id,
                c.user_id,
                c.checkout_date,
                c.due_date,
                c.return_date,
                c.is_returned,
                c.is_late,
                c.late_fee,
                c.notes,
                b.book_id,
                b.title,
                b.isbn,
                b.cover_image_url,
                b.description,
                GROUP_CONCAT(
                    CONCAT(a.first_name, ' ', a.last_name) 
                    ORDER BY ba.author_order 
                    SEPARATOR ', '
                ) as authors,
                u.first_name as user_first_name,
                u.last_name as user_last_name,
                u.username,
                staff_checkout.username as checkout_staff,
                staff_return.username as return_staff,
                CASE 
                    WHEN c.is_returned = FALSE AND c.due_date < CURDATE() THEN 'overdue'
                    WHEN c.is_returned = FALSE THEN 'active'
                    WHEN c.is_late = TRUE THEN 'returned_late'
                    ELSE 'returned_on_time'
                END as status
            FROM checkouts c
            JOIN books b ON c.book_id = b.book_id
            JOIN users u ON c.user_id = u.user_id
            LEFT JOIN users staff_checkout ON c.staff_checkout_id = staff_checkout.user_id
            LEFT JOIN users staff_return ON c.staff_return_id = staff_return.user_id
            LEFT JOIN book_authors ba ON b.book_id = ba.book_id
            LEFT JOIN authors a ON ba.author_id = a.author_id
            WHERE c.checkout_id = ?
            GROUP BY c.checkout_id
        `, [checkoutId]);
        
        if (checkouts.length === 0) {
            return res.status(404).json({
                error: {
                    message: 'Checkout not found',
                    code: 'CHECKOUT_NOT_FOUND'
                }
            });
        }
        
        const checkout = checkouts[0];
        
        // Verify ownership if not staff
        if (req.user.user_type === 'reader' && checkout.user_id !== req.user.user_id) {
            return res.status(403).json({
                error: {
                    message: 'You can only view your own checkouts',
                    code: 'UNAUTHORIZED_VIEW'
                }
            });
        }
        
        res.json({
            checkout: {
                ...checkout,
                authors: checkout.authors ? checkout.authors.split(', ') : [],
                user_name: `${checkout.user_first_name} ${checkout.user_last_name}`,
                days_until_due: checkout.is_returned ? null : Math.ceil((new Date(checkout.due_date) - new Date()) / (1000 * 60 * 60 * 24)),
                current_late_fee: checkout.is_returned ? checkout.late_fee : await callFunction('CalculateLateFee', [checkoutId, 1.00])
            }
        });
        
    } catch (error) {
        console.error('Checkout details fetch error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to fetch checkout details',
                code: 'CHECKOUT_DETAILS_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// GET /api/checkouts/overdue - Get overdue checkouts (staff only)
router.get('/overdue', requireStaff, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        // Get total count
        const [countResult] = await connection.execute(
            'SELECT COUNT(*) as total FROM checkouts WHERE is_returned = FALSE AND due_date < CURDATE()'
        );
        
        // Get overdue checkouts
        const [checkouts] = await connection.execute(`
            SELECT 
                c.checkout_id,
                c.checkout_date,
                c.due_date,
                c.late_fee,
                DATEDIFF(CURDATE(), c.due_date) as days_overdue,
                b.book_id,
                b.title,
                b.isbn,
                GROUP_CONCAT(
                    CONCAT(a.first_name, ' ', a.last_name) 
                    ORDER BY ba.author_order 
                    SEPARATOR ', '
                ) as authors,
                u.user_id,
                u.first_name as user_first_name,
                u.last_name as user_last_name,
                u.username,
                u.email,
                u.phone
            FROM checkouts c
            JOIN books b ON c.book_id = b.book_id
            JOIN users u ON c.user_id = u.user_id
            LEFT JOIN book_authors ba ON b.book_id = ba.book_id
            LEFT JOIN authors a ON ba.author_id = a.author_id
            WHERE c.is_returned = FALSE AND c.due_date < CURDATE()
            GROUP BY c.checkout_id
            ORDER BY c.due_date ASC
            LIMIT ? OFFSET ?
        `, [parseInt(limit), offset]);
        
        const formattedCheckouts = checkouts.map(checkout => ({
            ...checkout,
            authors: checkout.authors ? checkout.authors.split(', ') : [],
            user_name: `${checkout.user_first_name} ${checkout.user_last_name}`,
            current_late_fee: checkout.days_overdue * 1.00 // $1 per day
        }));
        
        res.json({
            overdue_checkouts: formattedCheckouts,
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total_overdue: countResult[0].total,
                total_pages: Math.ceil(countResult[0].total / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('Overdue checkouts fetch error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to fetch overdue checkouts',
                code: 'OVERDUE_FETCH_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// GET /api/checkouts/statistics - Get checkout statistics (staff only)
router.get('/statistics', requireStaff, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        // Get overall statistics
        const [totalStats] = await connection.execute(`
            SELECT 
                COUNT(*) as total_checkouts,
                COUNT(CASE WHEN is_returned = FALSE THEN 1 END) as active_checkouts,
                COUNT(CASE WHEN is_returned = FALSE AND due_date < CURDATE() THEN 1 END) as overdue_checkouts,
                COUNT(CASE WHEN is_late = TRUE THEN 1 END) as late_returns,
                AVG(CASE WHEN is_returned = TRUE THEN DATEDIFF(return_date, checkout_date) END) as avg_loan_duration,
                SUM(late_fee) as total_late_fees
            FROM checkouts
        `);
        
        // Get monthly statistics for the last 12 months
        const [monthlyStats] = await connection.execute(`
            SELECT 
                DATE_FORMAT(checkout_date, '%Y-%m') as month,
                COUNT(*) as checkouts_count,
                COUNT(CASE WHEN is_returned = TRUE THEN 1 END) as returns_count,
                COUNT(CASE WHEN is_late = TRUE THEN 1 END) as late_returns_count
            FROM checkouts 
            WHERE checkout_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
            GROUP BY DATE_FORMAT(checkout_date, '%Y-%m')
            ORDER BY month DESC
        `);
        
        // Get most borrowed books
        const [popularBooks] = await connection.execute(`
            SELECT 
                b.book_id,
                b.title,
                COUNT(c.checkout_id) as checkout_count,
                GROUP_CONCAT(
                    CONCAT(a.first_name, ' ', a.last_name) 
                    ORDER BY ba.author_order 
                    SEPARATOR ', '
                ) as authors
            FROM books b
            JOIN checkouts c ON b.book_id = c.book_id
            LEFT JOIN book_authors ba ON b.book_id = ba.book_id
            LEFT JOIN authors a ON ba.author_id = a.author_id
            GROUP BY b.book_id
            ORDER BY checkout_count DESC
            LIMIT 10
        `);
        
        res.json({
            overall_statistics: totalStats[0],
            monthly_trends: monthlyStats,
            most_borrowed_books: popularBooks.map(book => ({
                ...book,
                authors: book.authors ? book.authors.split(', ') : []
            }))
        });
        
    } catch (error) {
        console.error('Checkout statistics error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to fetch checkout statistics',
                code: 'STATISTICS_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

module.exports = router;
