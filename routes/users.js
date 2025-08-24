// Smart Library Platform - Users Routes
const express = require('express');
const { getMySQLConnection } = require('../config/database');
const { authenticate, verifyOwnership } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/profile - Get current user profile (alternative to auth route)
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
        
        // Get user statistics
        const [checkoutStats] = await connection.execute(
            `SELECT 
                COUNT(*) as total_checkouts,
                COUNT(CASE WHEN is_returned = FALSE THEN 1 END) as active_checkouts,
                COUNT(CASE WHEN is_late = TRUE THEN 1 END) as late_returns,
                SUM(late_fee) as total_late_fees
             FROM checkouts WHERE user_id = ?`,
            [req.user.user_id]
        );
        
        const [reviewStats] = await connection.execute(
            `SELECT 
                COUNT(*) as total_reviews,
                AVG(rating) as average_rating_given
             FROM reviews WHERE user_id = ?`,
            [req.user.user_id]
        );
        
        res.json({
            user: {
                ...user,
                statistics: {
                    ...checkoutStats[0],
                    ...reviewStats[0]
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

// GET /api/users/:id/checkouts - Get user's checkouts
router.get('/:id/checkouts', authenticate, verifyOwnership('id'), async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const userId = parseInt(req.params.id);
        const { status = 'all', page = 1, limit = 20, sort_by = 'checkout_date', sort_order = 'DESC' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        if (isNaN(userId)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid user ID',
                    code: 'INVALID_USER_ID'
                }
            });
        }
        
        // Validate sort parameters
        const validSortColumns = ['checkout_date', 'due_date', 'return_date', 'title'];
        const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'checkout_date';
        const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        
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
        
        // Build sort clause
        let orderByClause = '';
        if (sortColumn === 'title') {
            orderByClause = `ORDER BY b.title ${sortDirection}`;
        } else {
            orderByClause = `ORDER BY c.${sortColumn} ${sortDirection}`;
        }
        
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
                c.notes,
                b.book_id,
                b.title,
                b.isbn,
                b.cover_image_url,
                b.genre,
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
                END as status,
                CASE 
                    WHEN c.is_returned = FALSE THEN DATEDIFF(c.due_date, CURDATE())
                    ELSE NULL
                END as days_until_due,
                CASE 
                    WHEN c.is_returned = FALSE AND c.due_date < CURDATE() THEN DATEDIFF(CURDATE(), c.due_date)
                    ELSE NULL
                END as days_overdue
            FROM checkouts c
            JOIN books b ON c.book_id = b.book_id
            LEFT JOIN book_authors ba ON b.book_id = ba.book_id
            LEFT JOIN authors a ON ba.author_id = a.author_id
            WHERE c.user_id = ? ${statusCondition}
            GROUP BY c.checkout_id
            ${orderByClause}
            LIMIT ? OFFSET ?
        `, [userId, parseInt(limit), offset]);
        
        const formattedCheckouts = checkouts.map(checkout => ({
            ...checkout,
            authors: checkout.authors ? checkout.authors.split(', ') : []
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
                status,
                sort_by: sortColumn,
                sort_order: sortDirection
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

// GET /api/users/:id/reviews - Get user's reviews
router.get('/:id/reviews', authenticate, verifyOwnership('id'), async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const userId = parseInt(req.params.id);
        const { page = 1, limit = 10, sort_by = 'date', sort_order = 'DESC' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        if (isNaN(userId)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid user ID',
                    code: 'INVALID_USER_ID'
                }
            });
        }
        
        // Validate sort parameters
        const validSortColumns = ['date', 'rating'];
        const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'date';
        const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        
        let orderBy = '';
        if (sortColumn === 'date') {
            orderBy = `r.review_date ${sortDirection}`;
        } else if (sortColumn === 'rating') {
            orderBy = `r.rating ${sortDirection}, r.review_date DESC`;
        }
        
        // Get total count
        const [countResult] = await connection.execute(
            'SELECT COUNT(*) as total FROM reviews WHERE user_id = ?',
            [userId]
        );
        
        // Get user's reviews
        const [reviews] = await connection.execute(`
            SELECT 
                r.review_id,
                r.book_id,
                r.rating,
                r.comment,
                r.review_date,
                r.helpful_votes,
                b.title as book_title,
                b.cover_image_url,
                b.genre,
                b.average_rating as book_average_rating,
                GROUP_CONCAT(
                    CONCAT(a.first_name, ' ', a.last_name) 
                    ORDER BY ba.author_order 
                    SEPARATOR ', '
                ) as authors
            FROM reviews r
            JOIN books b ON r.book_id = b.book_id
            LEFT JOIN book_authors ba ON b.book_id = ba.book_id
            LEFT JOIN authors a ON ba.author_id = a.author_id
            WHERE r.user_id = ?
            GROUP BY r.review_id
            ORDER BY ${orderBy}
            LIMIT ? OFFSET ?
        `, [userId, parseInt(limit), offset]);
        
        // Get user's review statistics
        const [reviewStats] = await connection.execute(`
            SELECT 
                COUNT(*) as total_reviews,
                AVG(rating) as average_rating,
                MIN(rating) as min_rating,
                MAX(rating) as max_rating,
                SUM(helpful_votes) as total_helpful_votes,
                COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star_count,
                COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star_count,
                COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star_count,
                COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star_count,
                COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star_count
            FROM reviews 
            WHERE user_id = ?
        `, [userId]);
        
        res.json({
            reviews: reviews.map(review => ({
                ...review,
                authors: review.authors ? review.authors.split(', ') : []
            })),
            statistics: reviewStats[0],
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total_reviews: countResult[0].total,
                total_pages: Math.ceil(countResult[0].total / parseInt(limit))
            },
            filters: {
                sort_by: sortColumn,
                sort_order: sortDirection
            }
        });
        
    } catch (error) {
        console.error('User reviews fetch error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to fetch user reviews',
                code: 'USER_REVIEWS_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// GET /api/users/:id/reading-history - Get user's reading history
router.get('/:id/reading-history', authenticate, verifyOwnership('id'), async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const userId = parseInt(req.params.id);
        const { page = 1, limit = 20, year, genre } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        if (isNaN(userId)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid user ID',
                    code: 'INVALID_USER_ID'
                }
            });
        }
        
        let whereConditions = ['c.user_id = ?'];
        let queryParams = [userId];
        
        if (year) {
            whereConditions.push('YEAR(c.checkout_date) = ?');
            queryParams.push(parseInt(year));
        }
        
        if (genre) {
            whereConditions.push('b.genre = ?');
            queryParams.push(genre);
        }
        
        const whereClause = whereConditions.join(' AND ');
        
        // Get total count
        const [countResult] = await connection.execute(
            `SELECT COUNT(DISTINCT b.book_id) as total 
             FROM checkouts c 
             JOIN books b ON c.book_id = b.book_id 
             WHERE ${whereClause}`,
            queryParams
        );
        
        // Get reading history (unique books)
        const [history] = await connection.execute(`
            SELECT 
                b.book_id,
                b.title,
                b.isbn,
                b.genre,
                b.cover_image_url,
                b.average_rating,
                GROUP_CONCAT(
                    CONCAT(a.first_name, ' ', a.last_name) 
                    ORDER BY ba.author_order 
                    SEPARATOR ', '
                ) as authors,
                COUNT(c.checkout_id) as times_checked_out,
                MIN(c.checkout_date) as first_checkout,
                MAX(c.checkout_date) as last_checkout,
                COUNT(CASE WHEN c.is_returned = TRUE THEN 1 END) as times_returned,
                AVG(CASE WHEN c.is_returned = TRUE THEN DATEDIFF(c.return_date, c.checkout_date) END) as avg_loan_duration,
                r.rating as user_rating,
                r.comment as user_comment,
                r.review_date
            FROM checkouts c
            JOIN books b ON c.book_id = b.book_id
            LEFT JOIN book_authors ba ON b.book_id = ba.book_id
            LEFT JOIN authors a ON ba.author_id = a.author_id
            LEFT JOIN reviews r ON b.book_id = r.book_id AND r.user_id = c.user_id
            WHERE ${whereClause}
            GROUP BY b.book_id
            ORDER BY MAX(c.checkout_date) DESC
            LIMIT ? OFFSET ?
        `, [...queryParams, parseInt(limit), offset]);
        
        // Get reading statistics for the user
        const [readingStats] = await connection.execute(`
            SELECT 
                COUNT(DISTINCT b.book_id) as unique_books_read,
                COUNT(c.checkout_id) as total_checkouts,
                COUNT(DISTINCT b.genre) as genres_explored,
                AVG(CASE WHEN c.is_returned = TRUE THEN DATEDIFF(c.return_date, c.checkout_date) END) as avg_reading_duration,
                COUNT(CASE WHEN r.rating IS NOT NULL THEN 1 END) as books_reviewed,
                AVG(r.rating) as average_rating_given
            FROM checkouts c
            JOIN books b ON c.book_id = b.book_id
            LEFT JOIN reviews r ON b.book_id = r.book_id AND r.user_id = c.user_id
            WHERE c.user_id = ?
        `, [userId]);
        
        // Get favorite genres
        const [favoriteGenres] = await connection.execute(`
            SELECT 
                b.genre,
                COUNT(DISTINCT b.book_id) as books_count,
                COUNT(c.checkout_id) as checkouts_count,
                AVG(r.rating) as avg_rating_given
            FROM checkouts c
            JOIN books b ON c.book_id = b.book_id
            LEFT JOIN reviews r ON b.book_id = r.book_id AND r.user_id = c.user_id
            WHERE c.user_id = ? AND b.genre IS NOT NULL
            GROUP BY b.genre
            ORDER BY books_count DESC, checkouts_count DESC
            LIMIT 5
        `, [userId]);
        
        res.json({
            reading_history: history.map(item => ({
                ...item,
                authors: item.authors ? item.authors.split(', ') : [],
                avg_loan_duration: item.avg_loan_duration ? Math.round(item.avg_loan_duration) : null
            })),
            statistics: readingStats[0],
            favorite_genres: favoriteGenres,
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total_books: countResult[0].total,
                total_pages: Math.ceil(countResult[0].total / parseInt(limit))
            },
            filters: {
                year: year ? parseInt(year) : null,
                genre
            }
        });
        
    } catch (error) {
        console.error('Reading history fetch error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to fetch reading history',
                code: 'READING_HISTORY_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// GET /api/users/:id/dashboard - Get user dashboard data
router.get('/:id/dashboard', authenticate, verifyOwnership('id'), async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid user ID',
                    code: 'INVALID_USER_ID'
                }
            });
        }
        
        // Get current active checkouts
        const [activeCheckouts] = await connection.execute(`
            SELECT 
                c.checkout_id,
                c.due_date,
                b.book_id,
                b.title,
                b.cover_image_url,
                GROUP_CONCAT(
                    CONCAT(a.first_name, ' ', a.last_name) 
                    ORDER BY ba.author_order 
                    SEPARATOR ', '
                ) as authors,
                DATEDIFF(c.due_date, CURDATE()) as days_until_due,
                CASE 
                    WHEN c.due_date < CURDATE() THEN TRUE
                    ELSE FALSE
                END as is_overdue
            FROM checkouts c
            JOIN books b ON c.book_id = b.book_id
            LEFT JOIN book_authors ba ON b.book_id = ba.book_id
            LEFT JOIN authors a ON ba.author_id = a.author_id
            WHERE c.user_id = ? AND c.is_returned = FALSE
            GROUP BY c.checkout_id
            ORDER BY c.due_date ASC
        `, [userId]);
        
        // Get recent reading activity (last 10 checkouts)
        const [recentActivity] = await connection.execute(`
            SELECT 
                c.checkout_id,
                c.checkout_date,
                c.return_date,
                c.is_returned,
                b.book_id,
                b.title,
                b.cover_image_url,
                GROUP_CONCAT(
                    CONCAT(a.first_name, ' ', a.last_name) 
                    ORDER BY ba.author_order 
                    SEPARATOR ', '
                ) as authors
            FROM checkouts c
            JOIN books b ON c.book_id = b.book_id
            LEFT JOIN book_authors ba ON b.book_id = ba.book_id
            LEFT JOIN authors a ON ba.author_id = a.author_id
            WHERE c.user_id = ?
            GROUP BY c.checkout_id
            ORDER BY c.checkout_date DESC
            LIMIT 10
        `, [userId]);
        
        // Get user statistics
        const [userStats] = await connection.execute(`
            SELECT 
                COUNT(DISTINCT CASE WHEN c.is_returned = FALSE THEN c.checkout_id END) as active_checkouts,
                COUNT(c.checkout_id) as total_checkouts,
                COUNT(DISTINCT b.book_id) as unique_books_read,
                COUNT(DISTINCT b.genre) as genres_explored,
                COUNT(r.review_id) as total_reviews,
                AVG(r.rating) as average_rating_given,
                COUNT(CASE WHEN c.is_late = TRUE THEN 1 END) as late_returns,
                SUM(c.late_fee) as total_late_fees
            FROM checkouts c
            JOIN books b ON c.book_id = b.book_id
            LEFT JOIN reviews r ON b.book_id = r.book_id AND r.user_id = c.user_id
            WHERE c.user_id = ?
        `, [userId]);
        
        // Get recent reviews
        const [recentReviews] = await connection.execute(`
            SELECT 
                r.review_id,
                r.rating,
                r.comment,
                r.review_date,
                b.book_id,
                b.title,
                b.cover_image_url,
                GROUP_CONCAT(
                    CONCAT(a.first_name, ' ', a.last_name) 
                    ORDER BY ba.author_order 
                    SEPARATOR ', '
                ) as authors
            FROM reviews r
            JOIN books b ON r.book_id = b.book_id
            LEFT JOIN book_authors ba ON b.book_id = ba.book_id
            LEFT JOIN authors a ON ba.author_id = a.author_id
            WHERE r.user_id = ?
            GROUP BY r.review_id
            ORDER BY r.review_date DESC
            LIMIT 5
        `, [userId]);
        
        // Get reading goals progress (based on this year's activity)
        const currentYear = new Date().getFullYear();
        const [yearlyProgress] = await connection.execute(`
            SELECT 
                COUNT(DISTINCT b.book_id) as books_read_this_year,
                COUNT(c.checkout_id) as checkouts_this_year,
                COUNT(r.review_id) as reviews_this_year
            FROM checkouts c
            JOIN books b ON c.book_id = b.book_id
            LEFT JOIN reviews r ON b.book_id = r.book_id AND r.user_id = c.user_id AND YEAR(r.review_date) = ?
            WHERE c.user_id = ? AND YEAR(c.checkout_date) = ?
        `, [currentYear, userId, currentYear]);
        
        // Format the response
        const dashboardData = {
            user_statistics: userStats[0],
            yearly_progress: {
                ...yearlyProgress[0],
                year: currentYear
            },
            active_checkouts: activeCheckouts.map(checkout => ({
                ...checkout,
                authors: checkout.authors ? checkout.authors.split(', ') : []
            })),
            recent_activity: recentActivity.map(activity => ({
                ...activity,
                authors: activity.authors ? activity.authors.split(', ') : []
            })),
            recent_reviews: recentReviews.map(review => ({
                ...review,
                authors: review.authors ? review.authors.split(', ') : []
            }))
        };
        
        res.json({
            dashboard: dashboardData,
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('User dashboard error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to fetch user dashboard',
                code: 'DASHBOARD_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// GET /api/users/:id/recommendations - Get book recommendations for user
router.get('/:id/recommendations', authenticate, verifyOwnership('id'), async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const userId = parseInt(req.params.id);
        const { limit = 10 } = req.query;
        
        if (isNaN(userId)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid user ID',
                    code: 'INVALID_USER_ID'
                }
            });
        }
        
        // Get user's favorite genres based on reading history
        const [favoriteGenres] = await connection.execute(`
            SELECT b.genre, COUNT(*) as read_count
            FROM checkouts c
            JOIN books b ON c.book_id = b.book_id
            WHERE c.user_id = ? AND b.genre IS NOT NULL
            GROUP BY b.genre
            ORDER BY read_count DESC
            LIMIT 3
        `, [userId]);
        
        // Get books the user hasn't read in their favorite genres
        let recommendations = [];
        
        if (favoriteGenres.length > 0) {
            const genreList = favoriteGenres.map(g => `'${g.genre}'`).join(',');
            
            const [genreRecommendations] = await connection.execute(`
                SELECT 
                    b.book_id,
                    b.title,
                    b.genre,
                    b.average_rating,
                    b.total_reviews,
                    b.cover_image_url,
                    b.description,
                    GROUP_CONCAT(
                        CONCAT(a.first_name, ' ', a.last_name) 
                        ORDER BY ba.author_order 
                        SEPARATOR ', '
                    ) as authors,
                    'favorite_genre' as recommendation_reason
                FROM books b
                LEFT JOIN book_authors ba ON b.book_id = ba.book_id
                LEFT JOIN authors a ON ba.author_id = a.author_id
                WHERE b.genre IN (${genreList})
                AND b.is_active = TRUE
                AND b.available_copies > 0
                AND b.book_id NOT IN (
                    SELECT book_id FROM checkouts WHERE user_id = ?
                )
                GROUP BY b.book_id
                ORDER BY b.average_rating DESC, b.total_reviews DESC
                LIMIT ?
            `, [userId, Math.ceil(parseInt(limit) * 0.7)]);
            
            recommendations = [...genreRecommendations];
        }
        
        // Get highly rated books the user hasn't read
        const remainingLimit = parseInt(limit) - recommendations.length;
        if (remainingLimit > 0) {
            const [popularRecommendations] = await connection.execute(`
                SELECT 
                    b.book_id,
                    b.title,
                    b.genre,
                    b.average_rating,
                    b.total_reviews,
                    b.cover_image_url,
                    b.description,
                    GROUP_CONCAT(
                        CONCAT(a.first_name, ' ', a.last_name) 
                        ORDER BY ba.author_order 
                        SEPARATOR ', '
                    ) as authors,
                    'highly_rated' as recommendation_reason
                FROM books b
                LEFT JOIN book_authors ba ON b.book_id = ba.book_id
                LEFT JOIN authors a ON ba.author_id = a.author_id
                WHERE b.is_active = TRUE
                AND b.available_copies > 0
                AND b.average_rating >= 4.0
                AND b.total_reviews >= 5
                AND b.book_id NOT IN (
                    SELECT book_id FROM checkouts WHERE user_id = ?
                )
                AND b.book_id NOT IN (${recommendations.map(r => r.book_id).join(',') || '0'})
                GROUP BY b.book_id
                ORDER BY b.average_rating DESC, b.total_reviews DESC
                LIMIT ?
            `, [userId, remainingLimit]);
            
            recommendations = [...recommendations, ...popularRecommendations];
        }
        
        res.json({
            recommendations: recommendations.map(book => ({
                ...book,
                authors: book.authors ? book.authors.split(', ') : []
            })),
            recommendation_basis: {
                favorite_genres: favoriteGenres,
                criteria: [
                    'Books in your favorite genres',
                    'Highly rated books (4+ stars)',
                    'Books you haven\'t read before',
                    'Currently available books'
                ]
            },
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('User recommendations error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to fetch recommendations',
                code: 'RECOMMENDATIONS_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

module.exports = router;
