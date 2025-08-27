// Smart Library Platform - Admin Routes
const express = require('express');
const { getMySQLConnection, callStoredProcedure, callFunction } = require('../config/database');
const { requireStaff, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/admin/books - Add new book
router.post('/books', requireStaff, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const {
            title,
            isbn,
            publisher,
            publication_date,
            genre,
            language = 'English',
            pages,
            description,
            total_copies = 1,
            is_ebook = false,
            cover_image_url,
            authors = []
        } = req.body;
        
        // Validate required fields
        if (!title || !title.trim()) {
            return res.status(400).json({
                error: {
                    message: 'Title is required',
                    code: 'MISSING_TITLE'
                }
            });
        }
        
        if (!authors || authors.length === 0) {
            return res.status(400).json({
                error: {
                    message: 'At least one author is required',
                    code: 'MISSING_AUTHORS'
                }
            });
        }
        
        if (total_copies <= 0) {
            return res.status(400).json({
                error: {
                    message: 'Total copies must be greater than 0',
                    code: 'INVALID_COPIES'
                }
            });
        }
        
        await connection.beginTransaction();
        
        try {
            // Call stored procedure to add book
            const [results] = await connection.execute(
                'CALL AddBook(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @result, @book_id)',
                [
                    title.trim(),
                    isbn || null,
                    publisher || null,
                    publication_date || null,
                    genre || null,
                    language,
                    pages || null,
                    description || null,
                    total_copies,
                    is_ebook,
                    cover_image_url || null,
                    req.user.user_id
                ]
            );
            
            // Get the output parameters
            const [[{ '@result': result, '@book_id': bookId }]] = await connection.execute(
                'SELECT @result, @book_id'
            );
            
            if (result.startsWith('Error:')) {
                await connection.rollback();
                return res.status(400).json({
                    error: {
                        message: result,
                        code: 'ADD_BOOK_FAILED'
                    }
                });
            }
            
            // Add authors
            for (let i = 0; i < authors.length; i++) {
                const author = authors[i];
                let authorId;
                
                if (author.author_id) {
                    // Existing author
                    authorId = author.author_id;
                        } else if (author.name) {
            // New author - check if exists first
            const [existingAuthor] = await connection.execute(
                'SELECT author_id FROM authors WHERE name = ?',
                [author.name.trim()]
            );
            
            if (existingAuthor.length > 0) {
                authorId = existingAuthor[0].author_id;
            } else {
                // Create new author
                const [authorResult] = await connection.execute(
                    'INSERT INTO authors (name) VALUES (?)',
                    [author.name.trim()]
                );
                authorId = authorResult.insertId;
            }
        } else {
            await connection.rollback();
            return res.status(400).json({
                error: {
                    message: 'Author must have name or valid author_id',
                    code: 'INVALID_AUTHOR'
                }
            });
        }
                
                // Link book to author
                await connection.execute(
                    'INSERT INTO book_authors (book_id, author_id, author_order) VALUES (?, ?, ?)',
                    [bookId, authorId, i + 1]
                );
            }
            
            await connection.commit();
            
            // Get the complete book details
            const [bookDetails] = await connection.execute(`
                SELECT 
                    b.*,
                    GROUP_CONCAT(
                        CONCAT(a.first_name, ' ', a.last_name) 
                        ORDER BY ba.author_order 
                        SEPARATOR ', '
                    ) as authors
                FROM books b
                LEFT JOIN book_authors ba ON b.book_id = ba.book_id
                LEFT JOIN authors a ON ba.author_id = a.author_id
                WHERE b.book_id = ?
                GROUP BY b.book_id
            `, [bookId]);
            
            res.status(201).json({
                message: 'Book added successfully',
                book: {
                    ...bookDetails[0],
                    authors: bookDetails[0].authors ? bookDetails[0].authors.split(', ') : []
                }
            });
            
        } catch (transactionError) {
            await connection.rollback();
            throw transactionError;
        }
        
    } catch (error) {
        console.error('Add book error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to add book',
                code: 'ADD_BOOK_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// PUT /api/admin/books/:id - Update book details
router.put('/books/:id', requireStaff, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const bookId = parseInt(req.params.id);
        const {
            title,
            isbn,
            publisher,
            publication_date,
            genre,
            language,
            pages,
            description,
            is_ebook,
            cover_image_url
        } = req.body;
        
        if (isNaN(bookId)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid book ID',
                    code: 'INVALID_BOOK_ID'
                }
            });
        }
        
        // Check if book exists
        const [existingBook] = await connection.execute(
            'SELECT book_id FROM books WHERE book_id = ? AND is_active = TRUE',
            [bookId]
        );
        
        if (existingBook.length === 0) {
            return res.status(404).json({
                error: {
                    message: 'Book not found',
                    code: 'BOOK_NOT_FOUND'
                }
            });
        }
        
        // Build update query dynamically
        const updates = [];
        const values = [];
        
        if (title !== undefined) {
            if (!title.trim()) {
                return res.status(400).json({
                    error: {
                        message: 'Title cannot be empty',
                        code: 'EMPTY_TITLE'
                    }
                });
            }
            updates.push('title = ?');
            values.push(title.trim());
        }
        
        if (isbn !== undefined) {
            // Check if ISBN is already used by another book
            if (isbn) {
                const [duplicateISBN] = await connection.execute(
                    'SELECT book_id FROM books WHERE isbn = ? AND book_id != ?',
                    [isbn, bookId]
                );
                if (duplicateISBN.length > 0) {
                    return res.status(409).json({
                        error: {
                            message: 'ISBN already exists',
                            code: 'DUPLICATE_ISBN'
                        }
                    });
                }
            }
            updates.push('isbn = ?');
            values.push(isbn || null);
        }
        
        if (publisher !== undefined) {
            updates.push('publisher = ?');
            values.push(publisher || null);
        }
        
        if (publication_date !== undefined) {
            updates.push('publication_date = ?');
            values.push(publication_date || null);
        }
        
        if (genre !== undefined) {
            updates.push('genre = ?');
            values.push(genre || null);
        }
        
        if (language !== undefined) {
            updates.push('language = ?');
            values.push(language || 'English');
        }
        
        if (pages !== undefined) {
            updates.push('pages = ?');
            values.push(pages || null);
        }
        
        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description || null);
        }
        
        if (is_ebook !== undefined) {
            updates.push('is_ebook = ?');
            values.push(Boolean(is_ebook));
        }
        
        if (cover_image_url !== undefined) {
            updates.push('cover_image_url = ?');
            values.push(cover_image_url || null);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({
                error: {
                    message: 'No valid fields to update',
                    code: 'NO_UPDATES'
                }
            });
        }
        
        values.push(bookId);
        
        // Update the book
        await connection.execute(
            `UPDATE books SET ${updates.join(', ')} WHERE book_id = ?`,
            values
        );
        
        // Log the action
        await connection.execute(
            'INSERT INTO staff_logs (staff_id, action_type, target_type, target_id, action_description) VALUES (?, ?, ?, ?, ?)',
            [req.user.user_id, 'update_inventory', 'book', bookId, `Book details updated: ${updates.join(', ')}`]
        );
        
        // Get updated book details
        const [updatedBook] = await connection.execute(`
            SELECT 
                b.*,
                GROUP_CONCAT(
                    CONCAT(a.first_name, ' ', a.last_name)
                    ORDER BY ba.author_order 
                    SEPARATOR ', '
                ) as authors
            FROM books b
            LEFT JOIN book_authors ba ON b.book_id = ba.book_id
            LEFT JOIN authors a ON ba.author_id = a.author_id
            WHERE b.book_id = ?
            GROUP BY b.book_id
        `, [bookId]);
        
        res.json({
            message: 'Book updated successfully',
            book: {
                ...updatedBook[0],
                authors: updatedBook[0].authors ? updatedBook[0].authors.split(', ') : []
            }
        });
        
    } catch (error) {
        console.error('Update book error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to update book',
                code: 'UPDATE_BOOK_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// PUT /api/admin/books/:id/inventory - Update book inventory
router.put('/books/:id/inventory', requireStaff, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const bookId = parseInt(req.params.id);
        const { total_copies } = req.body;
        
        if (isNaN(bookId)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid book ID',
                    code: 'INVALID_BOOK_ID'
                }
            });
        }
        
        if (!total_copies || isNaN(total_copies) || total_copies <= 0) {
            return res.status(400).json({
                error: {
                    message: 'Total copies must be a positive number',
                    code: 'INVALID_TOTAL_COPIES'
                }
            });
        }
        
        // Call stored procedure to update inventory
        try {
            const [results] = await connection.execute(
                'CALL UpdateInventory(?, ?, ?, @result)',
                [bookId, parseInt(total_copies), req.user.user_id]
            );
            
            // Get the output parameter
            const [[{ '@result': result }]] = await connection.execute('SELECT @result');
            
            if (result.startsWith('Error:')) {
                return res.status(400).json({
                    error: {
                        message: result,
                        code: 'UPDATE_INVENTORY_FAILED'
                    }
                });
            }
            
            // Get updated book details
            const [updatedBook] = await connection.execute(
                'SELECT book_id, title, total_copies, available_copies FROM books WHERE book_id = ?',
                [bookId]
            );
            
            res.json({
                message: 'Inventory updated successfully',
                book: updatedBook[0]
            });
            
        } catch (procedureError) {
            console.error('Inventory procedure error:', procedureError);
            return res.status(500).json({
                error: {
                    message: 'Failed to process inventory update',
                    code: 'PROCEDURE_ERROR'
                }
            });
        }
        
    } catch (error) {
        console.error('Update inventory error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to update inventory',
                code: 'UPDATE_INVENTORY_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// DELETE /api/admin/books/:id - Retire a book
router.delete('/books/:id', requireStaff, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const bookId = parseInt(req.params.id);
        
        if (isNaN(bookId)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid book ID',
                    code: 'INVALID_BOOK_ID'
                }
            });
        }
        
        // Call stored procedure to retire book
        try {
            const [results] = await connection.execute(
                'CALL RetireBook(?, ?, @result)',
                [bookId, req.user.user_id]
            );
            
            // Get the output parameter
            const [[{ '@result': result }]] = await connection.execute('SELECT @result');
            
            if (result.startsWith('Error:')) {
                return res.status(400).json({
                    error: {
                        message: result,
                        code: 'RETIRE_BOOK_FAILED'
                    }
                });
            }
            
            res.json({
                message: 'Book retired successfully'
            });
            
        } catch (procedureError) {
            console.error('Retire book procedure error:', procedureError);
            return res.status(500).json({
                error: {
                    message: 'Failed to process book retirement',
                    code: 'PROCEDURE_ERROR'
                }
            });
        }
        
    } catch (error) {
        console.error('Retire book error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to retire book',
                code: 'RETIRE_BOOK_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// GET /api/admin/reports - Get various administrative reports
router.get('/reports', requireStaff, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const { report_type, start_date, end_date, limit = 10 } = req.query;
        
        let reportData = {};
        
        switch (report_type) {
            case 'most_borrowed':
                // Most borrowed books within a specific time range
                let timeCondition = '';
                let timeParams = [];
                
                if (start_date && end_date) {
                    timeCondition = 'AND c.checkout_date BETWEEN ? AND ?';
                    timeParams = [start_date, end_date];
                }
                
                const [mostBorrowed] = await connection.execute(`
                    SELECT 
                        b.book_id,
                        b.title,
                        b.isbn,
                        COUNT(c.checkout_id) as checkout_count,
                        GROUP_CONCAT(
                            CONCAT(a.first_name, ' ', a.last_name) 
                            ORDER BY ba.author_order 
                            SEPARATOR ', '
                        ) as authors
                    FROM books b
                    LEFT JOIN checkouts c ON b.book_id = c.book_id ${timeCondition}
                    LEFT JOIN book_authors ba ON b.book_id = ba.book_id
                    LEFT JOIN authors a ON ba.author_id = a.author_id
                    WHERE b.is_active = TRUE
                    GROUP BY b.book_id
                    HAVING checkout_count > 0
                    ORDER BY checkout_count DESC
                    LIMIT ?
                `, [...timeParams, parseInt(limit)]);
                
                reportData = {
                    most_borrowed_books: mostBorrowed.map(book => ({
                        ...book,
                        authors: book.authors ? book.authors.split(', ') : []
                    })),
                    time_range: { start_date, end_date }
                };
                break;
                
            case 'top_readers':
                // Top active readers by number of checkouts
                let readerTimeCondition = '';
                let readerTimeParams = [];
                
                if (start_date && end_date) {
                    readerTimeCondition = 'AND c.checkout_date BETWEEN ? AND ?';
                    readerTimeParams = [start_date, end_date];
                }
                
                const [topReaders] = await connection.execute(`
                    SELECT 
                        u.user_id,
                        u.username,
                        u.first_name,
                        u.last_name,
                        u.email,
                        COUNT(c.checkout_id) as checkout_count,
                        COUNT(CASE WHEN c.is_returned = FALSE THEN 1 END) as active_checkouts,
                        COUNT(CASE WHEN c.is_late = TRUE THEN 1 END) as late_returns
                    FROM users u
                    LEFT JOIN checkouts c ON u.user_id = c.user_id ${readerTimeCondition}
                    WHERE u.user_type = 'reader' AND u.is_active = TRUE
                    GROUP BY u.user_id
                    HAVING checkout_count > 0
                    ORDER BY checkout_count DESC
                    LIMIT ?
                `, [...readerTimeParams, parseInt(limit)]);
                
                reportData = {
                    top_active_readers: topReaders.map(reader => ({
                        ...reader,
                        display_name: reader.first_name && reader.last_name 
                            ? `${reader.first_name} ${reader.last_name}` 
                            : reader.username
                    })),
                    time_range: { start_date, end_date }
                };
                break;
                
            case 'low_availability':
                // Books with low availability
                const [lowAvailability] = await connection.execute(`
                    SELECT 
                        b.book_id,
                        b.title,
                        b.isbn,
                        b.total_copies,
                        b.available_copies,
                        ROUND((b.available_copies / b.total_copies) * 100, 2) as availability_percentage,
                        GROUP_CONCAT(
                            CONCAT(a.first_name, ' ', a.last_name) 
                            ORDER BY ba.author_order 
                            SEPARATOR ', '
                        ) as authors
                    FROM books b
                    LEFT JOIN book_authors ba ON b.book_id = ba.book_id
                    LEFT JOIN authors a ON ba.author_id = a.author_id
                    WHERE b.is_active = TRUE 
                    AND b.total_copies > 0
                    AND (b.available_copies / b.total_copies) <= 0.2
                    GROUP BY b.book_id
                    ORDER BY availability_percentage ASC
                    LIMIT ?
                `, [parseInt(limit)]);
                
                reportData = {
                    low_availability_books: lowAvailability.map(book => ({
                        ...book,
                        authors: book.authors ? book.authors.split(', ') : []
                    }))
                };
                break;
                
            case 'overdue_summary':
                // Overdue books summary
                const [overdueSummary] = await connection.execute(`
                    SELECT 
                        COUNT(*) as total_overdue,
                        SUM(DATEDIFF(CURDATE(), c.due_date)) as total_overdue_days,
                        AVG(DATEDIFF(CURDATE(), c.due_date)) as avg_days_overdue,
                        SUM(DATEDIFF(CURDATE(), c.due_date) * 1.00) as total_potential_fees
                    FROM checkouts c
                    WHERE c.is_returned = FALSE AND c.due_date < CURDATE()
                `);
                
                const [overdueByUser] = await connection.execute(`
                    SELECT 
                        u.user_id,
                        u.username,
                        u.first_name,
                        u.last_name,
                        COUNT(c.checkout_id) as overdue_count,
                        AVG(DATEDIFF(CURDATE(), c.due_date)) as avg_days_overdue
                    FROM users u
                    JOIN checkouts c ON u.user_id = c.user_id
                    WHERE c.is_returned = FALSE AND c.due_date < CURDATE()
                    GROUP BY u.user_id
                    ORDER BY overdue_count DESC, avg_days_overdue DESC
                    LIMIT ?
                `, [parseInt(limit)]);
                
                reportData = {
                    summary: overdueSummary[0],
                    top_overdue_users: overdueByUser.map(user => ({
                        ...user,
                        display_name: user.first_name && user.last_name 
                            ? `${user.first_name} ${user.last_name}` 
                            : user.username
                    }))
                };
                break;
                
            case 'staff_activity':
                // Staff activity log
                let activityTimeCondition = '';
                let activityTimeParams = [];
                
                if (start_date && end_date) {
                    activityTimeCondition = 'AND sl.action_date BETWEEN ? AND ?';
                    activityTimeParams = [start_date, end_date];
                }
                
                const [staffActivity] = await connection.execute(`
                    SELECT 
                        sl.log_id,
                        sl.action_type,
                        sl.target_type,
                        sl.target_id,
                        sl.action_description,
                        sl.action_date,
                        u.username as staff_username,
                        u.first_name as staff_first_name,
                        u.last_name as staff_last_name
                    FROM staff_logs sl
                    JOIN users u ON sl.staff_id = u.user_id
                    WHERE 1=1 ${activityTimeCondition}
                    ORDER BY sl.action_date DESC
                    LIMIT ?
                `, [...activityTimeParams, parseInt(limit)]);
                
                reportData = {
                    staff_activities: staffActivity.map(activity => ({
                        ...activity,
                        staff_name: activity.staff_first_name && activity.staff_last_name 
                            ? `${activity.staff_first_name} ${activity.staff_last_name}` 
                            : activity.staff_username
                    })),
                    time_range: { start_date, end_date }
                };
                break;
                
            default:
                return res.status(400).json({
                    error: {
                        message: 'Invalid report type',
                        code: 'INVALID_REPORT_TYPE',
                        available_types: [
                            'most_borrowed',
                            'top_readers', 
                            'low_availability',
                            'overdue_summary',
                            'staff_activity'
                        ]
                    }
                });
        }
        
        res.json({
            report_type,
            generated_at: new Date().toISOString(),
            data: reportData
        });
        
    } catch (error) {
        console.error('Reports error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to generate report',
                code: 'REPORT_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// GET /api/admin/users - Get all users (admin only)
router.get('/users', requireAdmin, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const { page = 1, limit = 20, user_type, is_active, search } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        let whereConditions = [];
        let queryParams = [];
        
        if (user_type) {
            whereConditions.push('user_type = ?');
            queryParams.push(user_type);
        }
        
        if (is_active !== undefined) {
            whereConditions.push('is_active = ?');
            queryParams.push(is_active === 'true');
        }
        
        if (search) {
            whereConditions.push('(username LIKE ? OR email LIKE ? OR CONCAT(first_name, " ", last_name) LIKE ?)');
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        
        // Get total count
        const [countResult] = await connection.execute(
            `SELECT COUNT(*) as total FROM users ${whereClause}`,
            queryParams
        );
        
        // Get users
        const [users] = await connection.execute(`
            SELECT 
                user_id,
                username,
                email,
                first_name,
                last_name,
                phone,
                user_type,
                is_active,
                registration_date,
                (SELECT COUNT(*) FROM checkouts WHERE user_id = users.user_id) as total_checkouts,
                (SELECT COUNT(*) FROM checkouts WHERE user_id = users.user_id AND is_returned = FALSE) as active_checkouts,
                (SELECT COUNT(*) FROM reviews WHERE user_id = users.user_id) as total_reviews
            FROM users
            ${whereClause}
            ORDER BY registration_date DESC
            LIMIT ? OFFSET ?
        `, [...queryParams, parseInt(limit), offset]);
        
        res.json({
            users,
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total_users: countResult[0].total,
                total_pages: Math.ceil(countResult[0].total / parseInt(limit))
            },
            filters: {
                user_type,
                is_active,
                search
            }
        });
        
    } catch (error) {
        console.error('Users fetch error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to fetch users',
                code: 'USERS_FETCH_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// PUT /api/admin/users/:id - Update user (admin only)
router.put('/users/:id', requireAdmin, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const userId = parseInt(req.params.id);
        const { user_type, is_active } = req.body;
        
        if (isNaN(userId)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid user ID',
                    code: 'INVALID_USER_ID'
                }
            });
        }
        
        // Check if user exists
        const [existingUser] = await connection.execute(
            'SELECT user_id, user_type, is_active FROM users WHERE user_id = ?',
            [userId]
        );
        
        if (existingUser.length === 0) {
            return res.status(404).json({
                error: {
                    message: 'User not found',
                    code: 'USER_NOT_FOUND'
                }
            });
        }
        
        const updates = [];
        const values = [];
        
        if (user_type !== undefined) {
            if (!['reader', 'staff', 'admin'].includes(user_type)) {
                return res.status(400).json({
                    error: {
                        message: 'Invalid user type',
                        code: 'INVALID_USER_TYPE'
                    }
                });
            }
            updates.push('user_type = ?');
            values.push(user_type);
        }
        
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            values.push(Boolean(is_active));
        }
        
        if (updates.length === 0) {
            return res.status(400).json({
                error: {
                    message: 'No valid fields to update',
                    code: 'NO_UPDATES'
                }
            });
        }
        
        values.push(userId);
        
        // Update user
        await connection.execute(
            `UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`,
            values
        );
        
        // Log the action
        await connection.execute(
            'INSERT INTO staff_logs (staff_id, action_type, target_type, target_id, action_description, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                req.user.user_id,
                'manage_user',
                'user',
                userId,
                'User account updated',
                JSON.stringify(existingUser[0]),
                JSON.stringify({ user_type, is_active })
            ]
        );
        
        // Get updated user
        const [updatedUser] = await connection.execute(
            'SELECT user_id, username, email, first_name, last_name, user_type, is_active FROM users WHERE user_id = ?',
            [userId]
        );
        
        res.json({
            message: 'User updated successfully',
            user: updatedUser[0]
        });
        
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to update user',
                code: 'UPDATE_USER_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

module.exports = router;
