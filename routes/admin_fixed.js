// Smart Library Platform - Admin Routes (FIXED VERSION)
const express = require('express');
const { getMySQLConnection } = require('../config/database');
const { authenticate, requireStaff } = require('../middleware/auth');

const router = express.Router();

// POST /api/admin/books - Add new book
router.post('/books', authenticate, requireStaff, async (req, res) => {
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
            total_copies,
            is_ebook = false,
            cover_image_url,
            authors
        } = req.body;
        
        // Validate required fields
        if (!title || !total_copies || !authors || !Array.isArray(authors) || authors.length === 0) {
            return res.status(400).json({
                error: {
                    message: 'Title, total copies, and at least one author are required',
                    code: 'MISSING_REQUIRED_FIELDS'
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
            // Insert the book (without created_by column for now)
            const [bookResult] = await connection.execute(`
                INSERT INTO books (
                    title, isbn, publisher, publication_date, genre, language, 
                    pages, description, total_copies, available_copies, is_ebook, 
                    cover_image_url, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
            `, [
                title.trim(),
                isbn || null,
                publisher || null,
                publication_date || null,
                genre || null,
                language,
                pages || null,
                description || null,
                total_copies,
                total_copies, // available_copies starts equal to total_copies
                is_ebook,
                cover_image_url || null
            ]);
            
            const bookId = bookResult.insertId;
            
            // Add authors (handle both old and new schema)
            for (let i = 0; i < authors.length; i++) {
                const author = authors[i];
                let authorId;
                
                if (author.author_id) {
                    // Existing author
                    authorId = author.author_id;
                } else if (author.name) {
                    // Check if author exists (handle both schemas)
                    let existingAuthor;
                    try {
                        // Try new schema first (first_name, last_name)
                        [existingAuthor] = await connection.execute(
                            'SELECT author_id FROM authors WHERE first_name = ? AND last_name = ?',
                            [author.name.trim().split(' ')[0], author.name.trim().split(' ').slice(1).join(' ')]
                        );
                    } catch (error) {
                        // Fall back to old schema (name field)
                        [existingAuthor] = await connection.execute(
                            'SELECT author_id FROM authors WHERE name = ?',
                            [author.name.trim()]
                        );
                    }
                    
                    if (existingAuthor.length > 0) {
                        authorId = existingAuthor[0].author_id;
                    } else {
                        // Create new author (handle both schemas)
                        try {
                            // Try new schema first
                            const nameParts = author.name.trim().split(' ');
                            const firstName = nameParts[0] || '';
                            const lastName = nameParts.slice(1).join(' ') || '';
                            
                            const [authorResult] = await connection.execute(
                                'INSERT INTO authors (first_name, last_name) VALUES (?, ?)',
                                [firstName, lastName]
                            );
                            authorId = authorResult.insertId;
                        } catch (error) {
                            // Fall back to old schema
                            const [authorResult] = await connection.execute(
                                'INSERT INTO authors (name) VALUES (?)',
                                [author.name.trim()]
                            );
                            authorId = authorResult.insertId;
                        }
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
            
            // Log the action
            await connection.execute(
                'INSERT INTO staff_logs (staff_id, action_type, target_type, target_id, action_description) VALUES (?, ?, ?, ?, ?)',
                [req.user.user_id, 'add_book', 'book', bookId, `Book added: ${title.trim()}`]
            );
            
            await connection.commit();
            
            // Get the complete book details
            const [bookDetails] = await connection.execute(`
                SELECT 
                    b.*,
                    GROUP_CONCAT(
                        COALESCE(
                            CONCAT(a.first_name, ' ', a.last_name),
                            a.name
                        ) 
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
                book: bookDetails[0]
            });
            
        } catch (error) {
            await connection.rollback();
            throw error;
        }
        
    } catch (error) {
        console.error('Add book error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to add book',
                code: 'ADD_BOOK_FAILED'
            }
        });
    } finally {
        connection.release();
    }
});

// PUT /api/admin/books/:id/inventory - Update book inventory
router.put('/books/:id/inventory', authenticate, requireStaff, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const bookId = parseInt(req.params.id);
        const { total_copies } = req.body;
        
        if (!bookId || isNaN(bookId)) {
            return res.status(400).json({
                error: {
                    message: 'Valid book ID is required',
                    code: 'INVALID_BOOK_ID'
                }
            });
        }
        
        if (!total_copies || total_copies <= 0) {
            return res.status(400).json({
                error: {
                    message: 'Total copies must be greater than 0',
                    code: 'INVALID_COPIES'
                }
            });
        }
        
        // Check if book exists
        const [existingBook] = await connection.execute(
            'SELECT book_id, total_copies, available_copies FROM books WHERE book_id = ? AND is_active = TRUE',
            [bookId]
        );
        
        if (existingBook.length === 0) {
            return res.status(404).json({
                error: {
                    message: 'Book not found or inactive',
                    code: 'BOOK_NOT_FOUND'
                }
            });
        }
        
        const currentTotal = existingBook[0].total_copies;
        const currentAvailable = existingBook[0].available_copies;
        const checkedOut = currentTotal - currentAvailable;
        const newAvailable = total_copies - checkedOut;
        
        if (newAvailable < 0) {
            return res.status(400).json({
                error: {
                    message: 'Cannot reduce inventory below checked out copies',
                    code: 'INSUFFICIENT_INVENTORY'
                }
            });
        }
        
        // Update book inventory directly
        await connection.execute(
            'UPDATE books SET total_copies = ?, available_copies = ? WHERE book_id = ?',
            [total_copies, newAvailable, bookId]
        );
        
        // Log the action
        await connection.execute(
            'INSERT INTO staff_logs (staff_id, action_type, target_type, target_id, action_description, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.user.user_id, 'update_inventory', 'book', bookId, 'Inventory updated', 
             JSON.stringify({total_copies: currentTotal, available_copies: currentAvailable}),
             JSON.stringify({total_copies: total_copies, available_copies: newAvailable})]
        );
        
        // Get updated book details
        const [updatedBook] = await connection.execute(`
            SELECT 
                b.*,
                GROUP_CONCAT(
                    COALESCE(
                        CONCAT(a.first_name, ' ', a.last_name),
                        a.name
                    ) 
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
            message: 'Inventory updated successfully',
            book: updatedBook[0]
        });
        
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
router.delete('/books/:id', authenticate, requireStaff, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const bookId = parseInt(req.params.id);
        
        if (!bookId || isNaN(bookId)) {
            return res.status(400).json({
                error: {
                    message: 'Valid book ID is required',
                    code: 'INVALID_BOOK_ID'
                }
            });
        }
        
        // Check if book exists and is active
        const [existingBook] = await connection.execute(
            'SELECT book_id, title FROM books WHERE book_id = ? AND is_active = TRUE',
            [bookId]
        );
        
        if (existingBook.length === 0) {
            return res.status(404).json({
                error: {
                    message: 'Book not found or already retired',
                    code: 'BOOK_NOT_FOUND'
                }
            });
        }
        
        // Check for active checkouts
        const [activeCheckouts] = await connection.execute(
            'SELECT COUNT(*) as count FROM checkouts WHERE book_id = ? AND is_returned = FALSE',
            [bookId]
        );
        
        if (activeCheckouts[0].count > 0) {
            return res.status(400).json({
                error: {
                    message: 'Cannot retire book with active checkouts',
                    code: 'ACTIVE_CHECKOUTS'
                }
            });
        }
        
        // Retire the book directly
        await connection.execute(
            'UPDATE books SET is_active = FALSE, available_copies = 0 WHERE book_id = ?',
            [bookId]
        );
        
        // Log the action
        await connection.execute(
            'INSERT INTO staff_logs (staff_id, action_type, target_type, target_id, action_description) VALUES (?, ?, ?, ?, ?)',
            [req.user.user_id, 'retire_book', 'book', bookId, `Book retired: ${existingBook[0].title}`]
        );
        
        res.json({
            message: 'Book retired successfully'
        });
        
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

// GET /api/admin/reports - Get administrative reports
router.get('/reports', authenticate, requireStaff, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const { report_type, start_date, end_date } = req.query;
        
        let reportData = {};
        
        switch (report_type) {
            case 'most_borrowed':
                // Most borrowed books within a specific time range
                const [mostBorrowed] = await connection.execute(`
                    SELECT 
                        b.book_id,
                        b.title,
                        COUNT(c.checkout_id) as checkout_count,
                        b.total_borrowed,
                        b.average_rating,
                        GROUP_CONCAT(
                            COALESCE(
                                CONCAT(a.first_name, ' ', a.last_name),
                                a.name
                            ) 
                            ORDER BY ba.author_order 
                            SEPARATOR ', '
                        ) as authors
                    FROM books b
                    LEFT JOIN checkouts c ON b.book_id = c.book_id 
                        AND c.checkout_date BETWEEN ? AND ?
                    LEFT JOIN book_authors ba ON b.book_id = ba.book_id
                    LEFT JOIN authors a ON ba.author_id = a.author_id
                    WHERE b.is_active = TRUE
                    GROUP BY b.book_id, b.title, b.total_borrowed, b.average_rating
                    ORDER BY checkout_count DESC, b.average_rating DESC
                    LIMIT 10
                `, [start_date || '2024-01-01', end_date || '2024-12-31']);
                
                reportData = {
                    most_borrowed_books: mostBorrowed.map(book => ({
                        book_id: book.book_id,
                        title: book.title,
                        authors: book.authors,
                        checkout_count: book.checkout_count,
                        total_borrowed: book.total_borrowed,
                        average_rating: book.average_rating
                    }))
                };
                break;
                
            case 'top_readers':
                // Top active readers by number of checkouts
                const [topReaders] = await connection.execute(`
                    SELECT 
                        u.user_id,
                        u.username,
                        u.first_name,
                        u.last_name,
                        COUNT(c.checkout_id) as total_checkouts,
                        COUNT(CASE WHEN c.is_returned = FALSE THEN 1 END) as active_checkouts
                    FROM users u
                    LEFT JOIN checkouts c ON u.user_id = c.user_id
                    WHERE u.user_type = 'reader' 
                      AND u.is_active = TRUE
                      AND (c.checkout_date IS NULL OR c.checkout_date BETWEEN ? AND ?)
                    GROUP BY u.user_id, u.username, u.first_name, u.last_name
                    ORDER BY total_checkouts DESC
                    LIMIT 10
                `, [start_date || '2024-01-01', end_date || '2024-12-31']);
                
                reportData = {
                    top_readers: topReaders.map(reader => ({
                        user_id: reader.user_id,
                        username: reader.username,
                        name: `${reader.first_name} ${reader.last_name}`,
                        total_checkouts: reader.total_checkouts,
                        active_checkouts: reader.active_checkouts
                    }))
                };
                break;
                
            case 'low_availability':
                // Books with low availability
                const [lowAvailability] = await connection.execute(`
                    SELECT 
                        b.book_id,
                        b.title,
                        b.genre,
                        b.total_copies,
                        b.available_copies,
                        ROUND((b.available_copies / b.total_copies) * 100, 2) as availability_percentage,
                        GROUP_CONCAT(
                            COALESCE(
                                CONCAT(a.first_name, ' ', a.last_name),
                                a.name
                            ) 
                            ORDER BY ba.author_order 
                            SEPARATOR ', '
                        ) as authors
                    FROM books b
                    LEFT JOIN book_authors ba ON b.book_id = ba.book_id
                    LEFT JOIN authors a ON ba.author_id = a.author_id
                    WHERE b.is_active = TRUE 
                      AND (b.available_copies / b.total_copies) < 0.2
                    GROUP BY b.book_id, b.title, b.genre, b.total_copies, b.available_copies
                    ORDER BY availability_percentage ASC
                `);
                
                reportData = {
                    low_availability_books: lowAvailability.map(book => ({
                        book_id: book.book_id,
                        title: book.title,
                        genre: book.genre,
                        total_copies: book.total_copies,
                        available_copies: book.available_copies,
                        availability_percentage: book.availability_percentage,
                        authors: book.authors
                    }))
                };
                break;
                
            default:
                return res.status(400).json({
                    error: {
                        message: 'Invalid report type. Use: most_borrowed, top_readers, or low_availability',
                        code: 'INVALID_REPORT_TYPE'
                    }
                });
        }
        
        res.json({
            report_type,
            data: reportData,
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Generate report error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to generate report',
                code: 'REPORT_GENERATION_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

module.exports = router;
