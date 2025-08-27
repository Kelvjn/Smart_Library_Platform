// Smart Library Platform - Reviews Routes
const express = require('express');
const { getMySQLConnection, callStoredProcedure } = require('../config/database');
const { authenticate, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/reviews - Add a book review
router.post('/', authenticate, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const { book_id, rating, comment } = req.body;
        const user_id = req.user.user_id;
        
        // Validate input
        if (!book_id || !rating) {
            return res.status(400).json({
                error: {
                    message: 'Book ID and rating are required',
                    code: 'MISSING_REQUIRED_FIELDS'
                }
            });
        }
        
        const bookId = parseInt(book_id);
        const userRating = parseInt(rating);
        
        if (isNaN(bookId) || bookId <= 0) {
            return res.status(400).json({
                error: {
                    message: 'Invalid book ID',
                    code: 'INVALID_BOOK_ID'
                }
            });
        }
        
        if (isNaN(userRating) || userRating < 1 || userRating > 5) {
            return res.status(400).json({
                error: {
                    message: 'Rating must be between 1 and 5',
                    code: 'INVALID_RATING'
                }
            });
        }
        
        if (comment && comment.length > 1000) {
            return res.status(400).json({
                error: {
                    message: 'Comment must be less than 1000 characters',
                    code: 'COMMENT_TOO_LONG'
                }
            });
        }
        
        // Implement review creation with a safe transaction (no stored procedure)
        try {
            await connection.beginTransaction();

            // Ensure the book exists and is active
            const [bookRows] = await connection.execute(
                'SELECT book_id, average_rating, total_reviews FROM books WHERE book_id = ? AND is_active = TRUE',
                [bookId]
            );
            if (bookRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    error: {
                        message: 'Error: book not found',
                        code: 'BOOK_NOT_FOUND'
                    }
                });
            }

            // Ensure the user has borrowed this book at least once
            const [borrowCheck] = await connection.execute(
                'SELECT 1 FROM checkouts WHERE user_id = ? AND book_id = ? LIMIT 1',
                [user_id, bookId]
            );
            if (borrowCheck.length === 0) {
                await connection.rollback();
                return res.status(403).json({
                    error: {
                        message: 'Error: user must borrow this book before reviewing',
                        code: 'MUST_BORROW_FIRST'
                    }
                });
            }

            // Ensure the user hasn't already reviewed this book
            const [existing] = await connection.execute(
                'SELECT review_id FROM reviews WHERE user_id = ? AND book_id = ? LIMIT 1',
                [user_id, bookId]
            );
            if (existing.length > 0) {
                await connection.rollback();
                return res.status(409).json({
                    error: {
                        message: 'Error: user has already reviewed this book',
                        code: 'ALREADY_REVIEWED'
                    }
                });
            }

            // Insert the review
            const [insertRes] = await connection.execute(
                'INSERT INTO reviews (user_id, book_id, rating, comment, review_date, helpful_votes) VALUES (?, ?, ?, ?, NOW(), 0)',
                [user_id, bookId, userRating, comment || null]
            );
            const reviewId = insertRes.insertId;

            // Update book aggregates
            await connection.execute(
                `UPDATE books 
                 SET total_reviews = COALESCE(total_reviews, 0) + 1,
                     average_rating = ROUND(((COALESCE(average_rating, 0) * COALESCE(total_reviews, 0)) + ?) / (COALESCE(total_reviews, 0) + 1), 2)
                 WHERE book_id = ?`,
                [userRating, bookId]
            );

            await connection.commit();

            // Get the created review with user info
            const [reviewDetails] = await connection.execute(`
                SELECT 
                    r.review_id,
                    r.rating,
                    r.comment,
                    r.review_date,
                    r.helpful_votes,
                    b.title as book_title,
                    u.username,
                    u.first_name,
                    u.last_name
                FROM reviews r
                JOIN books b ON r.book_id = b.book_id
                JOIN users u ON r.user_id = u.user_id
                WHERE r.review_id = ?
            `, [reviewId]);

            return res.status(201).json({
                message: 'Review added successfully',
                review: {
                    ...reviewDetails[0],
                    reviewer_name: reviewDetails[0].first_name && reviewDetails[0].last_name
                        ? `${reviewDetails[0].first_name} ${reviewDetails[0].last_name}`
                        : reviewDetails[0].username
                }
            });

        } catch (txError) {
            await connection.rollback();
            console.error('Review transaction error:', txError);
            return res.status(500).json({
                error: {
                    message: 'Failed to process review',
                    code: 'TRANSACTION_ERROR',
                    details: txError.message
                }
            });
        }
        
    } catch (error) {
        console.error('Add review error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to add review',
                code: 'REVIEW_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// GET /api/reviews/book/:bookId - Get reviews for a specific book
router.get('/book/:bookId', optionalAuth, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const bookId = parseInt(req.params.bookId);
        const { page = 1, limit = 10, sort_by = 'date', sort_order = 'DESC' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        if (isNaN(bookId)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid book ID',
                    code: 'INVALID_BOOK_ID'
                }
            });
        }
        
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
                orderBy = `r.rating ${sortDirection}, r.review_date DESC`;
                break;
            case 'helpful':
                orderBy = `r.helpful_votes ${sortDirection}, r.review_date DESC`;
                break;
        }
        
        // Get total count
        const [countResult] = await connection.execute(
            'SELECT COUNT(*) as total FROM reviews WHERE book_id = ?',
            [bookId]
        );
        
        // Get rating distribution
        const [ratingDistribution] = await connection.execute(`
            SELECT 
                rating,
                COUNT(*) as count
            FROM reviews 
            WHERE book_id = ?
            GROUP BY rating
            ORDER BY rating DESC
        `, [bookId]);
        
        // Get reviews
        const reviewsQuery = `
            SELECT 
                r.review_id,
                r.user_id,
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
            LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
        `;
        
        const [reviews] = await connection.execute(reviewsQuery, [bookId]);
        
        // Check if current user has reviewed this book
        let userReview = null;
        if (req.user) {
            const [userReviewResult] = await connection.execute(
                'SELECT review_id, rating, comment, review_date FROM reviews WHERE user_id = ? AND book_id = ?',
                [req.user.user_id, bookId]
            );
            userReview = userReviewResult.length > 0 ? userReviewResult[0] : null;
        }
        
        res.json({
            reviews: reviews.map(review => ({
                ...review,
                reviewer_name: review.first_name && review.last_name 
                    ? `${review.first_name} ${review.last_name}` 
                    : review.username,
                is_own_review: req.user ? review.user_id === req.user.user_id : false
            })),
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total_reviews: countResult[0].total,
                total_pages: Math.ceil(countResult[0].total / parseInt(limit))
            },
            rating_distribution: ratingDistribution,
            user_review: userReview,
            filters: {
                sort_by: sortColumn,
                sort_order: sortDirection
            }
        });
        
    } catch (error) {
        console.error('Book reviews fetch error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to fetch book reviews',
                code: 'REVIEWS_FETCH_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// GET /api/reviews/user - Get current user's reviews
router.get('/user', authenticate, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const userId = req.user.user_id;
        const { page = 1, limit = 10 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        // Get total count
        const [countResult] = await connection.execute(
            'SELECT COUNT(*) as total FROM reviews WHERE user_id = ?',
            [userId]
        );
        
        // Get user's reviews
        const reviewQuery = `
            SELECT 
                r.review_id,
                r.book_id,
                r.rating,
                r.comment,
                r.review_date,
                r.helpful_votes,
                b.title as book_title,
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
            LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
        `;
        
        const [reviews] = await connection.execute(reviewQuery, [userId]);
        
        // Get user's review statistics
        const [reviewStats] = await connection.execute(`
            SELECT 
                COUNT(*) as total_reviews,
                AVG(rating) as average_rating,
                MIN(rating) as min_rating,
                MAX(rating) as max_rating,
                SUM(helpful_votes) as total_helpful_votes
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
            }
        });
        
    } catch (error) {
        console.error('User reviews fetch error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to fetch user reviews',
                code: 'REVIEWS_FETCH_ERROR'
            }
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// GET /api/reviews/user/:userId - Get reviews by a specific user
router.get('/user/:userId', optionalAuth, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const userId = parseInt(req.params.userId);
        const { page = 1, limit = 10 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        if (isNaN(userId)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid user ID',
                    code: 'INVALID_USER_ID'
                }
            });
        }
        
        // Check if user exists
        const [userExists] = await connection.execute(
            'SELECT username, first_name, last_name FROM users WHERE user_id = ? AND is_active = TRUE',
            [userId]
        );
        
        if (userExists.length === 0) {
            return res.status(404).json({
                error: {
                    message: 'User not found',
                    code: 'USER_NOT_FOUND'
                }
            });
        }
        
        const user = userExists[0];
        
        // Get total count
        const [countResult] = await connection.execute(
            'SELECT COUNT(*) as total FROM reviews WHERE user_id = ?',
            [userId]
        );
        
        // Get user's reviews
        const userReviewsQuery = `
            SELECT 
                r.review_id,
                r.book_id,
                r.rating,
                r.comment,
                r.review_date,
                r.helpful_votes,
                b.title as book_title,
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
            LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
        `;
        
        const [reviews] = await connection.execute(userReviewsQuery, [userId]);
        
        // Get user's review statistics
        const [reviewStats] = await connection.execute(`
            SELECT 
                COUNT(*) as total_reviews,
                AVG(rating) as average_rating,
                MIN(rating) as min_rating,
                MAX(rating) as max_rating,
                SUM(helpful_votes) as total_helpful_votes
            FROM reviews 
            WHERE user_id = ?
        `, [userId]);
        
        res.json({
            user: {
                user_id: userId,
                username: user.username,
                display_name: user.first_name && user.last_name 
                    ? `${user.first_name} ${user.last_name}` 
                    : user.username
            },
            reviews: reviews.map(review => ({
                ...review,
                authors: review.authors ? review.authors.split(', ') : [],
                is_own_review: req.user ? userId === req.user.user_id : false
            })),
            statistics: reviewStats[0],
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total_reviews: countResult[0].total,
                total_pages: Math.ceil(countResult[0].total / parseInt(limit))
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

// PUT /api/reviews/:id - Update a review
router.put('/:id', authenticate, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const reviewId = parseInt(req.params.id);
        const { rating, comment } = req.body;
        
        if (isNaN(reviewId)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid review ID',
                    code: 'INVALID_REVIEW_ID'
                }
            });
        }
        
        // Check if review exists and belongs to user
        const [existingReview] = await connection.execute(
            'SELECT user_id, book_id, rating, comment FROM reviews WHERE review_id = ?',
            [reviewId]
        );
        
        if (existingReview.length === 0) {
            return res.status(404).json({
                error: {
                    message: 'Review not found',
                    code: 'REVIEW_NOT_FOUND'
                }
            });
        }
        
        if (existingReview[0].user_id !== req.user.user_id) {
            return res.status(403).json({
                error: {
                    message: 'You can only update your own reviews',
                    code: 'UNAUTHORIZED_UPDATE'
                }
            });
        }
        
        // Validate new values
        const updates = [];
        const values = [];
        
        if (rating !== undefined) {
            const userRating = parseInt(rating);
            if (isNaN(userRating) || userRating < 1 || userRating > 5) {
                return res.status(400).json({
                    error: {
                        message: 'Rating must be between 1 and 5',
                        code: 'INVALID_RATING'
                    }
                });
            }
            updates.push('rating = ?');
            values.push(userRating);
        }
        
        if (comment !== undefined) {
            if (comment && comment.length > 1000) {
                return res.status(400).json({
                    error: {
                        message: 'Comment must be less than 1000 characters',
                        code: 'COMMENT_TOO_LONG'
                    }
                });
            }
            updates.push('comment = ?');
            values.push(comment || null);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({
                error: {
                    message: 'No valid fields to update',
                    code: 'NO_UPDATES'
                }
            });
        }
        
        values.push(reviewId);
        
        // Update the review
        await connection.execute(
            `UPDATE reviews SET ${updates.join(', ')} WHERE review_id = ?`,
            values
        );
        
        // Get updated review details
        const [updatedReview] = await connection.execute(`
            SELECT 
                r.review_id,
                r.rating,
                r.comment,
                r.review_date,
                r.helpful_votes,
                b.title as book_title,
                u.username,
                u.first_name,
                u.last_name
            FROM reviews r
            JOIN books b ON r.book_id = b.book_id
            JOIN users u ON r.user_id = u.user_id
            WHERE r.review_id = ?
        `, [reviewId]);
        
        res.json({
            message: 'Review updated successfully',
            review: {
                ...updatedReview[0],
                reviewer_name: updatedReview[0].first_name && updatedReview[0].last_name 
                    ? `${updatedReview[0].first_name} ${updatedReview[0].last_name}` 
                    : updatedReview[0].username
            }
        });
        
    } catch (error) {
        console.error('Update review error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to update review',
                code: 'UPDATE_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// DELETE /api/reviews/:id - Delete a review
router.delete('/:id', authenticate, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const reviewId = parseInt(req.params.id);
        
        if (isNaN(reviewId)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid review ID',
                    code: 'INVALID_REVIEW_ID'
                }
            });
        }
        
        // Check if review exists and belongs to user (or user is staff/admin)
        const [existingReview] = await connection.execute(
            'SELECT user_id FROM reviews WHERE review_id = ?',
            [reviewId]
        );
        
        if (existingReview.length === 0) {
            return res.status(404).json({
                error: {
                    message: 'Review not found',
                    code: 'REVIEW_NOT_FOUND'
                }
            });
        }
        
        const canDelete = existingReview[0].user_id === req.user.user_id || 
                         req.user.user_type === 'staff' || 
                         req.user.user_type === 'admin';
        
        if (!canDelete) {
            return res.status(403).json({
                error: {
                    message: 'You can only delete your own reviews',
                    code: 'UNAUTHORIZED_DELETE'
                }
            });
        }
        
        // Delete the review
        await connection.execute('DELETE FROM reviews WHERE review_id = ?', [reviewId]);
        
        res.json({
            message: 'Review deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete review error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to delete review',
                code: 'DELETE_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// POST /api/reviews/:id/helpful - Mark a review as helpful
router.post('/:id/helpful', authenticate, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const reviewId = parseInt(req.params.id);
        
        if (isNaN(reviewId)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid review ID',
                    code: 'INVALID_REVIEW_ID'
                }
            });
        }
        
        // Check if review exists
        const [review] = await connection.execute(
            'SELECT user_id FROM reviews WHERE review_id = ?',
            [reviewId]
        );
        
        if (review.length === 0) {
            return res.status(404).json({
                error: {
                    message: 'Review not found',
                    code: 'REVIEW_NOT_FOUND'
                }
            });
        }
        
        // Users can't mark their own reviews as helpful
        if (review[0].user_id === req.user.user_id) {
            return res.status(400).json({
                error: {
                    message: 'You cannot mark your own review as helpful',
                    code: 'CANNOT_MARK_OWN_REVIEW'
                }
            });
        }
        
        // Increment helpful votes
        await connection.execute(
            'UPDATE reviews SET helpful_votes = helpful_votes + 1 WHERE review_id = ?',
            [reviewId]
        );
        
        // Get updated vote count
        const [updatedReview] = await connection.execute(
            'SELECT helpful_votes FROM reviews WHERE review_id = ?',
            [reviewId]
        );
        
        res.json({
            message: 'Review marked as helpful',
            helpful_votes: updatedReview[0].helpful_votes
        });
        
    } catch (error) {
        console.error('Mark helpful error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to mark review as helpful',
                code: 'HELPFUL_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

// GET /api/reviews/recent - Get recent reviews across all books
router.get('/recent', optionalAuth, async (req, res) => {
    const connection = await getMySQLConnection();
    
    try {
        const { limit = 10 } = req.query;
        
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
                u.username,
                u.first_name,
                u.last_name,
                GROUP_CONCAT(
                    CONCAT(a.first_name, ' ', a.last_name) 
                    ORDER BY ba.author_order 
                    SEPARATOR ', '
                ) as authors
            FROM reviews r
            JOIN books b ON r.book_id = b.book_id
            JOIN users u ON r.user_id = u.user_id
            LEFT JOIN book_authors ba ON b.book_id = ba.book_id
            LEFT JOIN authors a ON ba.author_id = a.author_id
            WHERE b.is_active = TRUE
            GROUP BY r.review_id
            ORDER BY r.review_date DESC
            LIMIT ?
        `, [parseInt(limit)]);
        
        res.json({
            recent_reviews: reviews.map(review => ({
                ...review,
                authors: review.authors ? review.authors.split(', ') : [],
                reviewer_name: review.first_name && review.last_name 
                    ? `${review.first_name} ${review.last_name}` 
                    : review.username
            }))
        });
        
    } catch (error) {
        console.error('Recent reviews fetch error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to fetch recent reviews',
                code: 'RECENT_REVIEWS_ERROR'
            }
        });
    } finally {
        connection.release();
    }
});

module.exports = router;
