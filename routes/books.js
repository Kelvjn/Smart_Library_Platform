// Smart Library Platform - Books Routes
const express = require('express');
const { getMySQLConnection, callFunction } = require('../config/database');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/books - Get all books with optional filters
router.get('/', optionalAuth, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const {
            page = 1,
            limit = 20,
            search,
            genre,
            author,
            publisher,
            available_only,
            sort_by = 'title',
            sort_order = 'ASC'
        } = req.query;
        
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const validSortColumns = ['title', 'author', 'publication_date', 'average_rating', 'total_borrowed'];
        const validSortOrders = ['ASC', 'DESC'];
        
        const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'title';
        const sortDirection = validSortOrders.includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'ASC';
        
        // Build WHERE clause
        let whereConditions = ['b.is_active = TRUE'];
        let queryParams = [];
        
        if (available_only === 'true') {
            whereConditions.push('b.available_copies > 0');
        }
        
        if (genre) {
            whereConditions.push('b.genre = ?');
            queryParams.push(genre);
        }
        
        if (publisher) {
            whereConditions.push('b.publisher LIKE ?');
            queryParams.push(`%${publisher}%`);
        }
        
        if (search) {
            whereConditions.push(`(
                b.title LIKE ? OR
                b.description LIKE ? OR
                CONCAT(a.first_name, ' ', a.last_name) LIKE ?
            )`);
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        
        if (author) {
            whereConditions.push(`CONCAT(a.first_name, ' ', a.last_name) LIKE ?`);
            queryParams.push(`%${author}%`);
        }
        
        const whereClause = whereConditions.join(' AND ');
        
        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(DISTINCT b.book_id) as total
            FROM books b
            LEFT JOIN book_authors ba ON b.book_id = ba.book_id
            LEFT JOIN authors a ON ba.author_id = a.author_id
            WHERE ${whereClause}
        `;
        
        const [countResult] = await connection.execute(countQuery, [...queryParams]);
        const totalBooks = countResult[0].total;
        
        // Main query with pagination
        let orderByClause = '';
        if (sortColumn === 'author') {
            orderByClause = `ORDER BY CONCAT(a.first_name, ' ', a.last_name) ${sortDirection}`;
        } else {
            orderByClause = `ORDER BY b.${sortColumn} ${sortDirection}`;
        }
        
        const mainQuery = `
            SELECT DISTINCT
                b.book_id,
                b.title,
                b.isbn,
                b.publisher,
                b.publication_date,
                b.genre,
                b.language,
                b.pages,
                b.description,
                b.total_copies,
                b.available_copies,
                b.is_ebook,
                b.cover_image_url,
                b.average_rating,
                b.total_reviews,
                b.total_borrowed,
                GROUP_CONCAT(
                    CONCAT(a.first_name, ' ', a.last_name)
                    ORDER BY ba.author_order 
                    SEPARATOR ', '
                ) as authors,
                GROUP_CONCAT(
                    a.author_id 
                    ORDER BY ba.author_order 
                    SEPARATOR ','
                ) as author_ids
            FROM books b
            LEFT JOIN book_authors ba ON b.book_id = ba.book_id
            LEFT JOIN authors a ON ba.author_id = a.author_id
            WHERE ${whereClause}
            GROUP BY b.book_id
            ${orderByClause}
            LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
        `;
        
        const [books] = await connection.execute(mainQuery, queryParams);
        
        // Format the response
        const formattedBooks = books.map(book => ({
            ...book,
            authors: book.authors ? book.authors.split(', ') : [],
            author_ids: book.author_ids ? book.author_ids.split(',').map(id => parseInt(id)) : [],
            is_available: book.available_copies > 0,
            availability_status: book.available_copies > 0 ? 'available' : 'unavailable'
        }));
        
        // Get unique genres for filtering
        const [genres] = await connection.execute(
            'SELECT DISTINCT genre FROM books WHERE is_active = TRUE AND genre IS NOT NULL ORDER BY genre'
        );
        
        res.json({
            books: formattedBooks,
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total_books: totalBooks,
                total_pages: Math.ceil(totalBooks / parseInt(limit)),
                has_next: offset + parseInt(limit) < totalBooks,
                has_prev: parseInt(page) > 1
            },
            filters: {
                available_genres: genres.map(g => g.genre)
            }
        });
        
    } catch (error) {
        console.error('Books fetch error:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            code: error.code,
            errno: error.errno,
            sqlState: error.sqlState,
            sqlMessage: error.sqlMessage,
            stack: error.stack
        });
        res.status(500).json({
            error: {
                message: 'Failed to fetch books',
                code: 'BOOKS_FETCH_ERROR',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// GET /api/books/popular - Get popular books
router.get('/popular', optionalAuth, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const { limit = 10, time_period = 'all' } = req.query;
        
        let timeCondition = '';
        if (time_period === 'week') {
            timeCondition = 'AND c.checkout_date >= DATE_SUB(NOW(), INTERVAL 1 WEEK)';
        } else if (time_period === 'month') {
            timeCondition = 'AND c.checkout_date >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
        } else if (time_period === 'year') {
            timeCondition = 'AND c.checkout_date >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
        }
        
        const [books] = await connection.execute(`
            SELECT 
                b.book_id,
                b.title,
                b.cover_image_url,
                b.average_rating,
                b.total_reviews,
                COUNT(c.checkout_id) as recent_checkouts,
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
            ORDER BY recent_checkouts DESC, b.average_rating DESC
            LIMIT ${parseInt(limit)}
        `);
        
        res.json({
            popular_books: books.map(book => ({
                ...book,
                authors: book.authors ? book.authors.split(', ') : []
            })),
            time_period
        });
        
    } catch (error) {
        console.error('Popular books fetch error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to fetch popular books',
                code: 'POPULAR_BOOKS_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// GET /api/books/:id - Get book by ID
router.get('/:id', optionalAuth, async (req, res) => {
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
        
        // Get comprehensive book details with authors
        const [books] = await connection.execute(`
            SELECT 
                b.book_id,
                b.title,
                b.isbn,
                b.isbn13,
                b.isbn10,
                b.publisher,
                b.publication_date,
                b.first_published_date,
                b.copyright_date,
                b.genre,
                b.language,
                b.pages,
                b.description,
                b.total_copies,
                b.available_copies,
                b.is_active,
                b.is_ebook,
                b.cover_image_url,
                b.average_rating,
                b.total_reviews,
                b.total_borrowed,
                b.series_name,
                b.series_order,
                b.part_of_series,
                b.original_title,
                b.translated_from,
                b.translator,
                b.edition,
                b.format_type,
                b.dimensions,
                b.awards,
                b.age_rating,
                b.content_warnings,
                b.country_of_origin,
                b.sequel_to,
                b.prequel_to,
                b.created_at,
                b.updated_at
            FROM books b
            WHERE b.book_id = ? AND b.is_active = TRUE
        `, [bookId]);
        
        if (books.length === 0) {
            return res.status(404).json({
                error: {
                    message: 'Book not found',
                    code: 'BOOK_NOT_FOUND'
                }
            });
        }
        
        const book = books[0];
        
        // Get authors
        const [authors] = await connection.execute(`
            SELECT 
                a.author_id,
                a.first_name,
                a.last_name,
                a.biography,
                a.nationality,
                ba.author_order
            FROM authors a
            JOIN book_authors ba ON a.author_id = ba.author_id
            WHERE ba.book_id = ?
            ORDER BY ba.author_order
        `, [bookId]);
        
        // Get recent reviews (limit to 5 most recent)
        const [reviews] = await connection.execute(`
            SELECT 
                r.review_id,
                r.rating,
                r.comment,
                r.review_date,
                r.helpful_votes,
                u.username,
                u.first_name,
                u.last_name
            FROM reviews r
            JOIN users u ON r.user_id = u.user_id
            WHERE r.book_id = ?
            ORDER BY r.review_date DESC
            LIMIT 5
        `, [bookId]);
        
        // Check availability using available_copies
        const isAvailable = book.available_copies > 0 && book.is_active;
        
        // Get sequel/prequel information
        const [sequelPrequel] = await connection.execute(`
            SELECT 
                sequel.book_id as sequel_id,
                sequel.title as sequel_title,
                sequel.cover_image_url as sequel_cover,
                prequel.book_id as prequel_id,
                prequel.title as prequel_title,
                prequel.cover_image_url as prequel_cover
            FROM books b
            LEFT JOIN books sequel ON b.sequel_to = sequel.book_id
            LEFT JOIN books prequel ON b.prequel_to = prequel.book_id
            WHERE b.book_id = ?
        `, [bookId]);
        
        // Get series books if part of a series
        let seriesBooks = [];
        if (book.series_name) {
            const [series] = await connection.execute(`
                SELECT 
                    b.book_id,
                    b.title,
                    b.series_order,
                    b.cover_image_url,
                    b.publication_date,
                    GROUP_CONCAT(
                        CONCAT(a.first_name, ' ', a.last_name)
                        ORDER BY ba.author_order 
                        SEPARATOR ', '
                    ) as authors
                FROM books b
                LEFT JOIN book_authors ba ON b.book_id = ba.book_id
                LEFT JOIN authors a ON ba.author_id = a.author_id
                WHERE b.series_name = ? AND b.is_active = TRUE
                GROUP BY b.book_id
                ORDER BY COALESCE(b.series_order, 999), b.publication_date
            `, [book.series_name]);
            
            seriesBooks = series.map(seriesBook => ({
                ...seriesBook,
                authors: seriesBook.authors ? seriesBook.authors.split(', ') : [],
                is_current: seriesBook.book_id === bookId
            }));
        }
        
        // Get similar books (same genre, excluding current book and series books)
        const seriesBookIds = seriesBooks.map(sb => sb.book_id);
        const excludeIds = [bookId, ...seriesBookIds].join(',');
        
        const [similarBooks] = await connection.execute(`
            SELECT 
                b.book_id,
                b.title,
                b.cover_image_url,
                b.average_rating,
                GROUP_CONCAT(
                    CONCAT(a.first_name, ' ', a.last_name)
                    ORDER BY ba.author_order 
                    SEPARATOR ', '
                ) as authors
            FROM books b
            LEFT JOIN book_authors ba ON b.book_id = ba.book_id
            LEFT JOIN authors a ON ba.author_id = a.author_id
            WHERE b.genre = ? AND b.book_id NOT IN (${excludeIds}) AND b.is_active = TRUE
            GROUP BY b.book_id
            ORDER BY b.average_rating DESC, b.total_borrowed DESC
            LIMIT 5
        `, [book.genre]);
        
        res.json({
            book: {
                ...book,
                authors: authors.map(author => ({
                    author_id: author.author_id,
                    name: author.name,
                    order: author.author_order
                })),
                is_available: Boolean(isAvailable),
                availability_status: isAvailable ? 'available' : 'unavailable',
                // Add sequel/prequel information
                sequel: sequelPrequel[0]?.sequel_id ? {
                    book_id: sequelPrequel[0].sequel_id,
                    title: sequelPrequel[0].sequel_title,
                    cover_image_url: sequelPrequel[0].sequel_cover
                } : null,
                prequel: sequelPrequel[0]?.prequel_id ? {
                    book_id: sequelPrequel[0].prequel_id,
                    title: sequelPrequel[0].prequel_title,
                    cover_image_url: sequelPrequel[0].prequel_cover
                } : null,
                // Enhanced metadata display formatting
                metadata: {
                    identifiers: {
                        isbn: book.isbn,
                        isbn13: book.isbn13,
                        isbn10: book.isbn10
                    },
                    publication: {
                        publisher: book.publisher,
                        publication_date: book.publication_date,
                        first_published_date: book.first_published_date,
                        copyright_date: book.copyright_date,
                        country_of_origin: book.country_of_origin
                    },
                    physical: {
                        format: book.format_type,
                        pages: book.pages,
                        dimensions: book.dimensions,
                        language: book.language
                    },
                    content: {
                        genre: book.genre,
                        age_rating: book.age_rating,
                        content_warnings: book.content_warnings,
                        awards: book.awards
                    },
                    translation: book.translated_from ? {
                        original_title: book.original_title,
                        translated_from: book.translated_from,
                        translator: book.translator
                    } : null,
                    series: book.part_of_series ? {
                        series_name: book.series_name,
                        series_order: book.series_order,
                        total_books_in_series: seriesBooks.length
                    } : null,
                    edition: book.edition
                }
            },
            reviews: reviews.map(review => ({
                ...review,
                reviewer_name: review.first_name && review.last_name 
                    ? `${review.first_name} ${review.last_name}` 
                    : review.username
            })),
            series_books: seriesBooks,
            similar_books: similarBooks.map(similar => ({
                ...similar,
                authors: similar.authors ? similar.authors.split(', ') : []
            }))
        });
        
    } catch (error) {
        console.error('Book fetch error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to fetch book details',
                code: 'BOOK_FETCH_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// GET /api/books/search/advanced - Advanced search
router.get('/search/advanced', optionalAuth, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const {
            title,
            author_name,
            isbn,
            genre,
            publisher,
            publication_year_from,
            publication_year_to,
            min_rating,
            max_rating,
            available_only,
            is_ebook,
            page = 1,
            limit = 20
        } = req.query;
        
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        let whereConditions = ['b.is_active = TRUE'];
        let queryParams = [];
        
        if (title) {
            whereConditions.push('b.title LIKE ?');
            queryParams.push(`%${title}%`);
        }
        
        if (author_name) {
            whereConditions.push(`CONCAT(a.first_name, ' ', a.last_name) LIKE ?`);
            queryParams.push(`%${author_name}%`);
        }
        
        if (isbn) {
            whereConditions.push('b.isbn = ?');
            queryParams.push(isbn);
        }
        
        if (genre) {
            whereConditions.push('b.genre = ?');
            queryParams.push(genre);
        }
        
        if (publisher) {
            whereConditions.push('b.publisher LIKE ?');
            queryParams.push(`%${publisher}%`);
        }
        
        if (publication_year_from) {
            whereConditions.push('YEAR(b.publication_date) >= ?');
            queryParams.push(parseInt(publication_year_from));
        }
        
        if (publication_year_to) {
            whereConditions.push('YEAR(b.publication_date) <= ?');
            queryParams.push(parseInt(publication_year_to));
        }
        
        if (min_rating) {
            whereConditions.push('b.average_rating >= ?');
            queryParams.push(parseFloat(min_rating));
        }
        
        if (max_rating) {
            whereConditions.push('b.average_rating <= ?');
            queryParams.push(parseFloat(max_rating));
        }
        
        if (available_only === 'true') {
            whereConditions.push('b.available_copies > 0');
        }
        
        if (is_ebook !== undefined) {
            whereConditions.push('b.is_ebook = ?');
            queryParams.push(is_ebook === 'true');
        }
        
        const whereClause = whereConditions.join(' AND ');
        
        // Get count
        const countQuery = `
            SELECT COUNT(DISTINCT b.book_id) as total
            FROM books b
            LEFT JOIN book_authors ba ON b.book_id = ba.book_id
            LEFT JOIN authors a ON ba.author_id = a.author_id
            WHERE ${whereClause}
        `;
        
        const [countResult] = await connection.execute(countQuery, queryParams);
        const totalBooks = countResult[0].total;
        
        // Get books
        const booksQuery = `
            SELECT DISTINCT
                b.book_id,
                b.title,
                b.isbn,
                b.publisher,
                b.publication_date,
                b.genre,
                b.language,
                b.pages,
                b.description,
                b.total_copies,
                b.available_copies,
                b.is_ebook,
                b.cover_image_url,
                b.average_rating,
                b.total_reviews,
                b.total_borrowed,
                GROUP_CONCAT(
                    CONCAT(a.first_name, ' ', a.last_name)
                    ORDER BY ba.author_order 
                    SEPARATOR ', '
                ) as authors
            FROM books b
            LEFT JOIN book_authors ba ON b.book_id = ba.book_id
            LEFT JOIN authors a ON ba.author_id = a.author_id
            WHERE ${whereClause}
            GROUP BY b.book_id
            ORDER BY b.title
            LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
        `;
        
        const [books] = await connection.execute(booksQuery, queryParams);
        
        const formattedBooks = books.map(book => ({
            ...book,
            authors: book.authors ? book.authors.split(', ') : [],
            is_available: book.available_copies > 0
        }));
        
        res.json({
            books: formattedBooks,
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total_books: totalBooks,
                total_pages: Math.ceil(totalBooks / parseInt(limit))
            },
            search_criteria: req.query
        });
        
    } catch (error) {
        console.error('Advanced search error:', error);
        res.status(500).json({
            error: {
                message: 'Advanced search failed',
                code: 'SEARCH_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// GET /api/books/:id/reviews - Get all reviews for a book
router.get('/:id/reviews', async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const bookId = parseInt(req.params.id);
        const { page = 1, limit = 10, sort_by = 'date', sort_order = 'DESC' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        // Validate sort parameters
        const validSortColumns = ['date', 'rating', 'helpful'];
        const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'date';
        const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        
        let orderBy = '';
        switch (sortColumn) {
            case 'date':
                orderBy = `r.review_date ${sortDirection}`;
                break;
            case 'rating':
                orderBy = `r.rating ${sortDirection}`;
                break;
            case 'helpful':
                orderBy = `r.helpful_votes ${sortDirection}`;
                break;
        }
        
        // Get total count
        const [countResult] = await connection.execute(
            'SELECT COUNT(*) as total FROM reviews WHERE book_id = ?',
            [bookId]
        );
        
        // Get reviews
        const [reviews] = await connection.execute(`
            SELECT 
                r.review_id,
                r.rating,
                r.comment,
                r.review_date,
                r.helpful_votes,
                u.username,
                u.first_name,
                u.last_name
            FROM reviews r
            JOIN users u ON r.user_id = u.user_id
            WHERE r.book_id = ?
            ORDER BY ${orderBy}
            LIMIT ${parseInt(limit)} OFFSET ${offset}
        `, [bookId]);
        
        res.json({
            reviews: reviews.map(review => ({
                ...review,
                reviewer_name: review.first_name && review.last_name 
                    ? `${review.first_name} ${review.last_name}` 
                    : review.username
            })),
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total_reviews: countResult[0].total,
                total_pages: Math.ceil(countResult[0].total / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('Reviews fetch error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to fetch reviews',
                code: 'REVIEWS_FETCH_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

module.exports = router;
