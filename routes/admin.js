// Smart Library Platform - Admin Routes (UPDATED FOR ACTUAL SCHEMA)
const express = require('express');
const { getMySQLConnection } = require('../config/database');
const fs = require('fs');
const path = require('path');
const { authenticate, requireStaff } = require('../middleware/auth');
const upload = require('../middleware/upload');

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
        
        // Convert authors from objects to strings if needed
        const authorNames = authors.map(author => {
            if (typeof author === 'string') {
                return author;
            } else if (author && author.name) {
                return author.name;
            } else {
                throw new Error('Invalid author format');
            }
        });
        
        if (total_copies <= 0) {
            return res.status(400).json({
                error: {
                    message: 'Total copies must be greater than 0',
                    code: 'INVALID_COPIES'
                }
            });
        }
        
        // Prevent duplicate books by ISBN – if exists, auto-increase inventory instead of failing
        try {
            if (isbn) {
                const [dupesByIsbn] = await connection.execute(
                    'SELECT book_id, total_copies, available_copies FROM books WHERE isbn = ? LIMIT 1', [isbn]
                );
                if (dupesByIsbn.length > 0) {
                    const dup = dupesByIsbn[0];
                    const incrementBy = Number(total_copies) || 1;
                    const newTotals = {
                        total_copies: dup.total_copies + incrementBy,
                        available_copies: dup.available_copies + incrementBy
                    };
                    await connection.execute(
                        'UPDATE books SET total_copies = ?, available_copies = ? WHERE book_id = ?',
                        [newTotals.total_copies, newTotals.available_copies, dup.book_id]
                    );
                    try {
                        await connection.execute(
                            'INSERT INTO staff_logs (staff_id, action_type, target_type, target_id, action_description, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [req.user.user_id, 'update_inventory', 'book', dup.book_id, 'Auto-increment inventory on duplicate ISBN', JSON.stringify({ total_copies: dup.total_copies, available_copies: dup.available_copies }), JSON.stringify(newTotals)]
                        );
                    } catch (e) {}
                    const [bookDetails] = await connection.execute('SELECT * FROM books WHERE book_id = ?', [dup.book_id]);
                    return res.status(200).json({ message: 'Existing book found. Inventory increased.', book: bookDetails[0] });
                }
            }
        } catch (dupErr) {
            // If schema varies, continue with normal insert
        }

        await connection.beginTransaction();
        
        try {
            // If client sent a data URL for cover image, persist it to /public/uploads and store the file URL
            let coverUrlToUse = cover_image_url || null;
            try {
                if (cover_image_url && typeof cover_image_url === 'string' && cover_image_url.startsWith('data:image/')) {
                    const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
                    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
                    const ext = cover_image_url.substring(11, cover_image_url.indexOf(';')); // e.g. 'png', 'jpeg'
                    const base64Data = cover_image_url.split(',')[1];
                    const fileName = `cover_${Date.now()}.${ext === 'jpeg' ? 'jpg' : ext}`;
                    const filePath = path.join(uploadsDir, fileName);
                    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
                    coverUrlToUse = `/uploads/${fileName}`;
                }
            } catch (e) {
                // If anything fails, fall back to original URL (or null)
            }

            // Insert the book (robust to older schemas without created_by)
            let bookId;
            try {
                const [bookResult] = await connection.execute(`
                    INSERT INTO books (
                        title, isbn, publisher, publication_date, genre, language, 
                        pages, description, total_copies, available_copies, is_ebook, 
                        cover_image_url, is_active, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)
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
                    is_ebook ? 1 : 0,
                    coverUrlToUse,
                    req.user.user_id
                ]);
                bookId = bookResult.insertId;
            } catch (insertErr) {
                // Fallback for databases without created_by column
                if ((insertErr && insertErr.code === 'ER_BAD_FIELD_ERROR') || (insertErr && /created_by/i.test(insertErr.message))) {
                    console.warn('books.created_by column missing, inserting without it');
                    const [bookResultFallback] = await connection.execute(`
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
                        total_copies,
                        is_ebook ? 1 : 0,
                        coverUrlToUse
                    ]);
                    bookId = bookResultFallback.insertId;
                } else {
                    throw insertErr;
                }
            }
            
            // Add authors
            for (let i = 0; i < authorNames.length; i++) {
                const authorName = authorNames[i];
                let authorId;
                
                // Check if author exists by first_name and last_name
                const nameParts = authorName.trim().split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';
                
                const [existingAuthor] = await connection.execute(
                    'SELECT author_id FROM authors WHERE first_name = ? AND last_name = ?',
                    [firstName, lastName]
                );
                
                if (existingAuthor.length > 0) {
                    authorId = existingAuthor[0].author_id;
                } else {
                    // Create new author
                    const [authorResult] = await connection.execute(
                        'INSERT INTO authors (first_name, last_name) VALUES (?, ?)',
                        [firstName, lastName]
                    );
                    authorId = authorResult.insertId;
                }
                
                // Link book to author
                await connection.execute(
                    'INSERT INTO book_authors (book_id, author_id, author_order) VALUES (?, ?, ?)',
                    [bookId, authorId, i + 1]
                );
            }
            
            // Log the action (tolerate schema differences)
            try {
                await connection.execute(
                    'INSERT INTO staff_logs (staff_id, action_type, target_type, target_id, action_description) VALUES (?, ?, ?, ?, ?)',
                    [req.user.user_id, 'add_book', 'book', bookId, `Book added: ${title.trim()}`]
                );
            } catch (logErr) {
                console.warn('staff_logs insert failed (schema may differ):', logErr.message);
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
                book: bookDetails[0]
            });
            
        } catch (error) {
            await connection.rollback();
            console.error('Add book transaction failed:', error.message);
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
        
        // Update book inventory
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
        
        // Retire the book
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

// PUT /api/admin/books/:id/retire - Alternate retire endpoint used by UI
router.put('/books/:id/retire', authenticate, requireStaff, async (req, res) => {
    const connection = await getMySQLConnection();
    try {
        const bookId = parseInt(req.params.id);
        if (!bookId || isNaN(bookId)) {
            return res.status(400).json({
                error: { message: 'Valid book ID is required', code: 'INVALID_BOOK_ID' }
            });
        }
        const [existingBook] = await connection.execute(
            'SELECT book_id, title FROM books WHERE book_id = ? AND is_active = TRUE',
            [bookId]
        );
        if (existingBook.length === 0) {
            return res.status(404).json({
                error: { message: 'Book not found or already retired', code: 'BOOK_NOT_FOUND' }
            });
        }
        const [activeCheckouts] = await connection.execute(
            'SELECT COUNT(*) as count FROM checkouts WHERE book_id = ? AND is_returned = FALSE',
            [bookId]
        );
        if (activeCheckouts[0].count > 0) {
            return res.status(400).json({
                error: { message: 'Cannot retire book with active checkouts', code: 'ACTIVE_CHECKOUTS' }
            });
        }
        await connection.execute(
            'UPDATE books SET is_active = FALSE, available_copies = 0 WHERE book_id = ?',
            [bookId]
        );
        await connection.execute(
            'INSERT INTO staff_logs (staff_id, action_type, target_type, target_id, action_description) VALUES (?, ?, ?, ?, ?)',
            [req.user.user_id, 'retire_book', 'book', bookId, `Book retired: ${existingBook[0].title}`]
        );
        res.json({ message: 'Book retired successfully' });
    } catch (error) {
        console.error('Retire book (PUT) error:', error);
        res.status(500).json({ error: { message: 'Failed to retire book', code: 'RETIRE_BOOK_ERROR' } });
    } finally {
        connection.release();
    }
});

// GET /api/admin/reports - Get administrative reports
router.get('/reports', authenticate, requireStaff, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const { report_type, start_date, end_date } = req.query;
        // Sanitize limit and date range
        const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 50);
        const now = new Date();
        const defaultStart = `${now.getFullYear()}-01-01`;
        const defaultEnd = `${now.getFullYear()}-12-31`;

        // Normalize date strings from UI (e.g., MM/DD/YYYY) to YYYY-MM-DD for MySQL
        const normalizeDate = (value) => {
            if (!value) return null;
            const d = new Date(value);
            if (isNaN(d.getTime())) return null;
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        const start = normalizeDate(start_date) || defaultStart;
        const end = normalizeDate(end_date) || defaultEnd;
        
        let reportData = {};
        
        switch (report_type) {
            case 'most_borrowed':
                // Most borrowed books within a specific time range
                const [mostBorrowed] = await connection.execute(`
                    SELECT 
                        b.book_id,
                        b.title,
                        COUNT(DISTINCT c.checkout_id) as checkout_count,
                        b.total_borrowed,
                        b.average_rating,
                        GROUP_CONCAT(
                            CONCAT(a.first_name, ' ', a.last_name)
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
                    LIMIT ${limit}
                `, [start, end]);
                
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
                // Top active readers by number of checkouts (only users with actual checkouts)
                const [topReaders] = await connection.execute(`
                    SELECT 
                        u.user_id,
                        u.username,
                        u.first_name,
                        u.last_name,
                        COUNT(c.checkout_id) as total_checkouts,
                        COUNT(CASE WHEN c.is_returned = FALSE THEN 1 END) as active_checkouts
                    FROM users u
                    INNER JOIN checkouts c ON u.user_id = c.user_id
                    WHERE u.user_type = 'reader' 
                      AND u.is_active = TRUE
                      AND c.checkout_date BETWEEN ? AND ?
                    GROUP BY u.user_id, u.username, u.first_name, u.last_name
                    HAVING total_checkouts > 0
                    ORDER BY total_checkouts DESC
                    LIMIT ${limit}
                `, [start, end]);
                
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
                            CONCAT(a.first_name, ' ', a.last_name)
                            ORDER BY ba.author_order 
                            SEPARATOR ', '
                        ) as authors
                    FROM books b
                    LEFT JOIN book_authors ba ON b.book_id = ba.book_id
                    LEFT JOIN authors a ON ba.author_id = a.author_id
                    WHERE b.is_active = TRUE 
                      AND b.total_copies > 0
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
        console.error('Generate report error:', {
            message: error.message,
            stack: error.stack
        });
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

// Debug endpoint to check authentication
router.get('/debug-auth', authenticate, requireStaff, async (req, res) => {
    res.json({
        success: true,
        message: 'Authentication successful',
        user: req.user,
        timestamp: new Date().toISOString()
    });
});

// POST /api/admin/upload-cover - Upload book cover image
router.post('/upload-cover', authenticate, requireStaff, upload.single('coverImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: {
                    message: 'No file uploaded',
                    code: 'NO_FILE'
                }
            });
        }

        // Generate the URL for the uploaded file
        const coverUrl = `/uploads/${req.file.filename}`;
        
        res.json({
            success: true,
            message: 'Cover image uploaded successfully',
            data: {
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                coverUrl: coverUrl,
                fullUrl: `${req.protocol}://${req.get('host')}${coverUrl}`
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to upload cover image',
                code: 'UPLOAD_ERROR',
                details: error.message
            }
        });
    }
});

// PUT /api/admin/books/:id/cover - Update book cover image
router.put('/books/:id/cover', authenticate, requireStaff, async (req, res) => {
    let connection;
    try {
        connection = await getMySQLConnection();
        const bookId = parseInt(req.params.id);
        const { cover_image_url } = req.body;
        
        if (!cover_image_url) {
            return res.status(400).json({
                error: {
                    message: 'Cover image URL is required',
                    code: 'MISSING_COVER_URL'
                }
            });
        }
        
        // Check if book exists
        const [bookRows] = await connection.execute(
            'SELECT book_id, title FROM books WHERE book_id = ?',
            [bookId]
        );
        
        if (bookRows.length === 0) {
            return res.status(404).json({
                error: {
                    message: 'Book not found',
                    code: 'BOOK_NOT_FOUND'
                }
            });
        }
        
        // Update the cover image URL
        await connection.execute(
            'UPDATE books SET cover_image_url = ? WHERE book_id = ?',
            [cover_image_url, bookId]
        );
        
        // Log the action (temporarily disabled for testing)
        console.log('Cover update successful for book:', bookId);
        
        res.json({
            success: true,
            message: 'Book cover updated successfully',
            data: {
                book_id: bookId,
                book_title: bookRows[0].title,
                cover_image_url: cover_image_url
            }
        });
        
    } catch (error) {
        console.error('Update cover error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            bookId: req.params.id,
            coverUrl: req.body.cover_image_url
        });
        res.status(500).json({
            error: {
                message: 'Failed to update book cover',
                code: 'UPDATE_COVER_ERROR',
                details: error.message
            }
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

module.exports = router;
