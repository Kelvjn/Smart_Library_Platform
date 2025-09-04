// Smart Library Platform - Analytics Routes (MongoDB)
const express = require('express');
const { executeAggregation, MongoOperations } = require('../config/database');
const { authenticate, requireStaff, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Initialize MongoDB operations for reading sessions
const readingSessionsOps = new MongoOperations('reading_sessions');

// POST /api/analytics/reading-sessions - Log a reading session
router.post('/reading-sessions', authenticate, async (req, res) => {
    try {
        const {
            book_id,
            session_start,
            session_end,
            device_type,
            device_info,
            pages_read,
            highlights,
            bookmarks,
            reading_progress,
            location,
            quality_metrics
        } = req.body;
        
        const user_id = req.user.user_id;
        
        // Validate required fields
        if (!book_id || !device_type) {
            return res.status(400).json({
                error: {
                    message: 'Book ID and device type are required',
                    code: 'MISSING_REQUIRED_FIELDS'
                }
            });
        }
        
        if (!['mobile', 'tablet', 'desktop', 'e-reader'].includes(device_type)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid device type',
                    code: 'INVALID_DEVICE_TYPE'
                }
            });
        }
        
        // Calculate session duration if both start and end are provided
        let sessionDurationMinutes = null;
        if (session_start && session_end) {
            const startTime = new Date(session_start);
            const endTime = new Date(session_end);
            sessionDurationMinutes = Math.round((endTime - startTime) / (1000 * 60));
        }
        
        // Create session document
        const sessionDocument = {
            user_id: parseInt(user_id),
            book_id: parseInt(book_id),
            session_start: session_start ? new Date(session_start) : new Date(),
            session_end: session_end ? new Date(session_end) : null,
            device_type,
            device_info: device_info || {},
            pages_read: pages_read || [],
            highlights: highlights || [],
            bookmarks: bookmarks || [],
            reading_progress: reading_progress || {},
            session_duration_minutes: sessionDurationMinutes,
            location: location || {},
            quality_metrics: quality_metrics || {},
            created_at: new Date(),
            updated_at: new Date()
        };
        
        // Validate highlights format
        if (sessionDocument.highlights.length > 0) {
            for (const highlight of sessionDocument.highlights) {
                if (!highlight.page || !highlight.text || !highlight.timestamp) {
                    return res.status(400).json({
                        error: {
                            message: 'Highlights must have page, text, and timestamp',
                            code: 'INVALID_HIGHLIGHT_FORMAT'
                        }
                    });
                }
                highlight.timestamp = new Date(highlight.timestamp);
            }
        }
        
        // Validate bookmarks format
        if (sessionDocument.bookmarks.length > 0) {
            for (const bookmark of sessionDocument.bookmarks) {
                if (!bookmark.page || !bookmark.timestamp) {
                    return res.status(400).json({
                        error: {
                            message: 'Bookmarks must have page and timestamp',
                            code: 'INVALID_BOOKMARK_FORMAT'
                        }
                    });
                }
                bookmark.timestamp = new Date(bookmark.timestamp);
            }
        }
        
        const result = await readingSessionsOps.insertOne(sessionDocument);
        
        res.status(201).json({
            message: 'Reading session logged successfully',
            session_id: result.insertedId,
            session: sessionDocument
        });
        
    } catch (error) {
        console.error('Log reading session error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to log reading session',
                code: 'LOG_SESSION_ERROR'
            }
        });
    }
});

// PUT /api/analytics/reading-sessions/:id - Update a reading session
router.put('/reading-sessions/:id', authenticate, async (req, res) => {
    try {
        const { ObjectId } = require('mongodb');
        const sessionId = req.params.id;
        const user_id = req.user.user_id;
        
        if (!ObjectId.isValid(sessionId)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid session ID',
                    code: 'INVALID_SESSION_ID'
                }
            });
        }
        
        // Check if session belongs to user
        const existingSession = await readingSessionsOps.findOne({
            _id: new ObjectId(sessionId),
            user_id: user_id
        });
        
        if (!existingSession) {
            return res.status(404).json({
                error: {
                    message: 'Reading session not found',
                    code: 'SESSION_NOT_FOUND'
                }
            });
        }
        
        const {
            session_end,
            pages_read,
            highlights,
            bookmarks,
            reading_progress,
            quality_metrics
        } = req.body;
        
        const updateFields = { updated_at: new Date() };
        
        if (session_end) {
            updateFields.session_end = new Date(session_end);
            // Calculate duration
            if (existingSession.session_start) {
                const duration = Math.round((updateFields.session_end - existingSession.session_start) / (1000 * 60));
                updateFields.session_duration_minutes = duration;
            }
        }
        
        if (pages_read) {
            updateFields.pages_read = pages_read;
        }
        
        if (highlights) {
            // Validate and format highlights
            for (const highlight of highlights) {
                if (highlight.timestamp) {
                    highlight.timestamp = new Date(highlight.timestamp);
                }
            }
            updateFields.highlights = highlights;
        }
        
        if (bookmarks) {
            // Validate and format bookmarks
            for (const bookmark of bookmarks) {
                if (bookmark.timestamp) {
                    bookmark.timestamp = new Date(bookmark.timestamp);
                }
            }
            updateFields.bookmarks = bookmarks;
        }
        
        if (reading_progress) {
            updateFields.reading_progress = reading_progress;
        }
        
        if (quality_metrics) {
            updateFields.quality_metrics = quality_metrics;
        }
        
        await readingSessionsOps.updateOne(
            { _id: new ObjectId(sessionId) },
            { $set: updateFields }
        );
        
        const updatedSession = await readingSessionsOps.findOne({
            _id: new ObjectId(sessionId)
        });
        
        res.json({
            message: 'Reading session updated successfully',
            session: updatedSession
        });
        
    } catch (error) {
        console.error('Update reading session error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to update reading session',
                code: 'UPDATE_SESSION_ERROR'
            }
        });
    }
});

// GET /api/analytics/user-engagement - Get user engagement analytics
router.get('/user-engagement', authenticate, requireStaff, async (req, res) => {
    try {
        const { user_id, limit = 20 } = req.query;
        
        let pipeline = [
            {
                $match: {
                    session_end: { $ne: null },
                    session_duration_minutes: { $gt: 0 }
                }
            }
        ];
        
        // Filter by specific user if provided
        if (user_id) {
            pipeline[0].$match.user_id = parseInt(user_id);
        }
        
        pipeline.push(
            {
                $group: {
                    _id: "$user_id",
                    total_sessions: { $sum: 1 },
                    total_reading_time: { $sum: "$session_duration_minutes" },
                    average_session_duration: { $avg: "$session_duration_minutes" },
                    longest_session: { $max: "$session_duration_minutes" },
                    shortest_session: { $min: "$session_duration_minutes" },
                    unique_books_read: { $addToSet: "$book_id" },
                    last_reading_session: { $max: "$session_start" },
                    total_pages_read: { 
                        $sum: { 
                            $size: { 
                                $ifNull: ["$pages_read", []] 
                            } 
                        } 
                    },
                    total_highlights: {
                        $sum: {
                            $size: {
                                $ifNull: ["$highlights", []]
                            }
                        }
                    },
                    total_bookmarks: {
                        $sum: {
                            $size: {
                                $ifNull: ["$bookmarks", []]
                            }
                        }
                    },
                    device_usage: { $push: "$device_type" }
                }
            },
            {
                $addFields: {
                    unique_books_count: { $size: "$unique_books_read" },
                    hours_read: { $round: [{ $divide: ["$total_reading_time", 60] }, 2] },
                    avg_session_hours: { $round: [{ $divide: ["$average_session_duration", 60] }, 2] },
                    engagement_score: {
                        $add: [
                            { $multiply: ["$total_sessions", 2] },
                            { $multiply: ["$unique_books_count", 5] },
                            { $multiply: ["$total_highlights", 3] },
                            { $multiply: ["$total_bookmarks", 2] }
                        ]
                    },
                    device_distribution: {
                        $arrayToObject: {
                            $map: {
                                input: { $setUnion: ["$device_usage", []] },
                                as: "device",
                                in: {
                                    k: "$$device",
                                    v: {
                                        $size: {
                                            $filter: {
                                                input: "$device_usage",
                                                cond: { $eq: ["$$this", "$$device"] }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    engagement_level: {
                        $switch: {
                            branches: [
                                { case: { $gte: ["$engagement_score", 100] }, then: "High" },
                                { case: { $gte: ["$engagement_score", 50] }, then: "Medium" },
                                { case: { $gte: ["$engagement_score", 20] }, then: "Low" }
                            ],
                            default: "Very Low"
                        }
                    }
                }
            },
            {
                $sort: { engagement_score: -1 }
            },
            {
                $limit: parseInt(limit)
            },
            {
                $project: {
                    user_id: "$_id",
                    total_sessions: 1,
                    total_reading_time_minutes: "$total_reading_time",
                    hours_read: 1,
                    average_session_duration_minutes: { $round: ["$average_session_duration", 1] },
                    avg_session_hours: 1,
                    longest_session_minutes: "$longest_session",
                    shortest_session_minutes: "$shortest_session",
                    unique_books_count: 1,
                    last_reading_session: 1,
                    total_pages_read: 1,
                    total_highlights: 1,
                    total_bookmarks: 1,
                    engagement_score: { $round: ["$engagement_score", 0] },
                    engagement_level: 1,
                    device_distribution: 1,
                    _id: 0
                }
            }
        );
        
        const results = await executeAggregation('reading_sessions', pipeline);
        
        res.json({
            user_engagement: results,
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('User engagement analytics error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to fetch user engagement analytics',
                code: 'ENGAGEMENT_ANALYTICS_ERROR'
            }
        });
    }
});

// GET /api/analytics/book-popularity - Get book popularity analytics
router.get('/book-popularity', optionalAuth, async (req, res) => {
    try {
        const { limit = 10, metric = 'reading_time' } = req.query;
        
        let sortField = 'total_reading_time';
        if (metric === 'highlights') {
            sortField = 'total_highlights';
        } else if (metric === 'sessions') {
            sortField = 'total_sessions';
        } else if (metric === 'unique_readers') {
            sortField = 'unique_readers_count';
        }
        
        const pipeline = [
            {
                $match: {
                    session_duration_minutes: { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: "$book_id",
                    total_reading_time: { $sum: "$session_duration_minutes" },
                    total_sessions: { $sum: 1 },
                    unique_readers: { $addToSet: "$user_id" },
                    average_session_duration: { $avg: "$session_duration_minutes" },
                    total_pages_read: { 
                        $sum: { 
                            $size: { 
                                $ifNull: ["$pages_read", []] 
                            } 
                        } 
                    },
                    total_highlights: {
                        $sum: {
                            $size: {
                                $ifNull: ["$highlights", []]
                            }
                        }
                    },
                    device_usage: { $push: "$device_type" },
                    completion_data: {
                        $push: {
                            $cond: {
                                if: { $ne: ["$reading_progress.percentage_complete", null] },
                                then: "$reading_progress.percentage_complete",
                                else: null
                            }
                        }
                    },
                    first_session: { $min: "$session_start" },
                    last_session: { $max: "$session_start" }
                }
            },
            {
                $addFields: {
                    unique_readers_count: { $size: "$unique_readers" },
                    hours_read: { $round: [{ $divide: ["$total_reading_time", 60] }, 2] },
                    avg_session_hours: { $round: [{ $divide: ["$average_session_duration", 60] }, 2] },
                    device_distribution: {
                        $arrayToObject: {
                            $map: {
                                input: { $setUnion: ["$device_usage", []] },
                                as: "device",
                                in: {
                                    k: "$$device",
                                    v: {
                                        $size: {
                                            $filter: {
                                                input: "$device_usage",
                                                cond: { $eq: ["$$this", "$$device"] }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    avg_completion_rate: {
                        $avg: {
                            $filter: {
                                input: "$completion_data",
                                cond: { $ne: ["$$this", null] }
                            }
                        }
                    }
                }
            },
            {
                $sort: { [sortField]: -1 }
            },
            {
                $limit: parseInt(limit)
            },
            {
                $project: {
                    book_id: "$_id",
                    total_reading_time_minutes: "$total_reading_time",
                    hours_read: 1,
                    total_sessions: 1,
                    unique_readers_count: 1,
                    average_session_duration_minutes: { $round: ["$average_session_duration", 1] },
                    avg_session_hours: 1,
                    total_pages_read: 1,
                    total_highlights: 1,
                    device_distribution: 1,
                    avg_completion_rate: { $round: ["$avg_completion_rate", 2] },
                    first_session: 1,
                    last_session: 1,
                    _id: 0
                }
            }
        ];
        
        const results = await executeAggregation('reading_sessions', pipeline);
        
        res.json({
            book_popularity: results,
            metric_used: metric,
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Book popularity analytics error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to fetch book popularity analytics',
                code: 'POPULARITY_ANALYTICS_ERROR'
            }
        });
    }
});

// GET /api/analytics/reading-patterns - Get reading patterns analytics
router.get('/reading-patterns', authenticate, requireStaff, async (req, res) => {
    try {
        const { pattern_type = 'time_of_day' } = req.query;
        
        let pipeline = [];
        
        if (pattern_type === 'time_of_day') {
            pipeline = [
                {
                    $addFields: {
                        hour_of_day: { $hour: "$session_start" }
                    }
                },
                {
                    $group: {
                        _id: "$hour_of_day",
                        total_sessions: { $sum: 1 },
                        total_reading_time: { $sum: "$session_duration_minutes" },
                        unique_users: { $addToSet: "$user_id" },
                        average_session_duration: { $avg: "$session_duration_minutes" }
                    }
                },
                {
                    $addFields: {
                        unique_users_count: { $size: "$unique_users" },
                        hour_label: {
                            $concat: [
                                { $toString: "$_id" },
                                ":00"
                            ]
                        }
                    }
                },
                {
                    $sort: { _id: 1 }
                },
                {
                    $project: {
                        hour: "$_id",
                        hour_label: 1,
                        total_sessions: 1,
                        total_reading_time: 1,
                        unique_users_count: 1,
                        average_session_duration: { $round: ["$average_session_duration", 1] },
                        _id: 0
                    }
                }
            ];
        } else if (pattern_type === 'day_of_week') {
            pipeline = [
                {
                    $addFields: {
                        day_of_week: { $dayOfWeek: "$session_start" }
                    }
                },
                {
                    $group: {
                        _id: "$day_of_week",
                        total_sessions: { $sum: 1 },
                        total_reading_time: { $sum: "$session_duration_minutes" },
                        unique_users: { $addToSet: "$user_id" },
                        average_session_duration: { $avg: "$session_duration_minutes" }
                    }
                },
                {
                    $addFields: {
                        unique_users_count: { $size: "$unique_users" },
                        day_name: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ["$_id", 1] }, then: "Sunday" },
                                    { case: { $eq: ["$_id", 2] }, then: "Monday" },
                                    { case: { $eq: ["$_id", 3] }, then: "Tuesday" },
                                    { case: { $eq: ["$_id", 4] }, then: "Wednesday" },
                                    { case: { $eq: ["$_id", 5] }, then: "Thursday" },
                                    { case: { $eq: ["$_id", 6] }, then: "Friday" },
                                    { case: { $eq: ["$_id", 7] }, then: "Saturday" }
                                ],
                                default: "Unknown"
                            }
                        }
                    }
                },
                {
                    $sort: { _id: 1 }
                },
                {
                    $project: {
                        day_of_week: "$_id",
                        day_name: 1,
                        total_sessions: 1,
                        total_reading_time: 1,
                        unique_users_count: 1,
                        average_session_duration: { $round: ["$average_session_duration", 1] },
                        _id: 0
                    }
                }
            ];
        } else if (pattern_type === 'device_usage') {
            pipeline = [
                {
                    $group: {
                        _id: "$device_type",
                        total_sessions: { $sum: 1 },
                        total_reading_time: { $sum: "$session_duration_minutes" },
                        unique_users: { $addToSet: "$user_id" },
                        unique_books: { $addToSet: "$book_id" },
                        average_session_duration: { $avg: "$session_duration_minutes" },
                        total_pages_read: { 
                            $sum: { 
                                $size: { 
                                    $ifNull: ["$pages_read", []] 
                                } 
                            } 
                        }
                    }
                },
                {
                    $addFields: {
                        unique_users_count: { $size: "$unique_users" },
                        unique_books_count: { $size: "$unique_books" },
                        hours_read: { $round: [{ $divide: ["$total_reading_time", 60] }, 2] },
                        avg_session_hours: { $round: [{ $divide: ["$average_session_duration", 60] }, 2] }
                    }
                },
                {
                    $sort: { total_sessions: -1 }
                },
                {
                    $project: {
                        device_type: "$_id",
                        total_sessions: 1,
                        hours_read: 1,
                        unique_users_count: 1,
                        unique_books_count: 1,
                        avg_session_hours: 1,
                        total_pages_read: 1,
                        _id: 0
                    }
                }
            ];
        } else {
            return res.status(400).json({
                error: {
                    message: 'Invalid pattern type',
                    code: 'INVALID_PATTERN_TYPE',
                    available_types: ['time_of_day', 'day_of_week', 'device_usage']
                }
            });
        }
        
        const results = await executeAggregation('reading_sessions', pipeline);
        
        res.json({
            reading_patterns: results,
            pattern_type,
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Reading patterns analytics error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to fetch reading patterns analytics',
                code: 'PATTERNS_ANALYTICS_ERROR'
            }
        });
    }
});

// GET /api/analytics/highlights - Get highlight analytics
router.get('/highlights', authenticate, requireStaff, async (req, res) => {
    try {
        const { book_id, limit = 20 } = req.query;
        
        let matchStage = { highlights: { $exists: true, $ne: [] } };
        if (book_id) {
            matchStage.book_id = parseInt(book_id);
        }
        
        const pipeline = [
            { $match: matchStage },
            { $unwind: "$highlights" },
            {
                $group: {
                    _id: {
                        book_id: "$book_id",
                        text: "$highlights.text"
                    },
                    highlight_count: { $sum: 1 },
                    unique_users: { $addToSet: "$user_id" },
                    colors_used: { $addToSet: "$highlights.color" },
                    pages: { $addToSet: "$highlights.page" },
                    latest_highlight: { $max: "$highlights.timestamp" },
                    sample_notes: {
                        $push: {
                            $cond: {
                                if: { $ne: ["$highlights.note", null] },
                                then: "$highlights.note",
                                else: null
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    unique_users_count: { $size: "$unique_users" },
                    popularity_score: {
                        $multiply: ["$highlight_count", { $size: "$unique_users" }]
                    }
                }
            },
            {
                $sort: { popularity_score: -1 }
            },
            {
                $limit: parseInt(limit)
            },
            {
                $project: {
                    book_id: "$_id.book_id",
                    highlight_text: "$_id.text",
                    highlight_count: 1,
                    unique_users_count: 1,
                    colors_used: 1,
                    pages: 1,
                    latest_highlight: 1,
                    popularity_score: 1,
                    sample_notes: {
                        $filter: {
                            input: "$sample_notes",
                            cond: { $ne: ["$$this", null] }
                        }
                    },
                    _id: 0
                }
            }
        ];
        
        const results = await executeAggregation('reading_sessions', pipeline);
        
        res.json({
            popular_highlights: results,
            book_filter: book_id ? parseInt(book_id) : null,
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Highlights analytics error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to fetch highlights analytics',
                code: 'HIGHLIGHTS_ANALYTICS_ERROR'
            }
        });
    }
});

// GET /api/analytics/dashboard - Get dashboard summary analytics
router.get('/dashboard', authenticate, requireStaff, async (req, res) => {
    try {
        // Get basic statistics
        const totalSessions = await readingSessionsOps.countDocuments();
        const activeSessions = await readingSessionsOps.countDocuments({ session_end: null });
        
        // Get today's activity
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayActivity = await executeAggregation('reading_sessions', [
            {
                $match: {
                    session_start: {
                        $gte: today,
                        $lt: tomorrow
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    sessions_today: { $sum: 1 },
                    unique_users_today: { $addToSet: "$user_id" },
                    unique_books_today: { $addToSet: "$book_id" },
                    total_reading_time_today: { $sum: "$session_duration_minutes" }
                }
            }
        ]);
        
        // Get device distribution
        const deviceStats = await executeAggregation('reading_sessions', [
            {
                $group: {
                    _id: "$device_type",
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);
        
        // Get recent highlights
        const recentHighlights = await executeAggregation('reading_sessions', [
            { $match: { highlights: { $exists: true, $ne: [] } } },
            { $unwind: "$highlights" },
            { $sort: { "highlights.timestamp": -1 } },
            { $limit: 5 },
            {
                $project: {
                    user_id: 1,
                    book_id: 1,
                    highlight_text: "$highlights.text",
                    highlight_page: "$highlights.page",
                    highlight_color: "$highlights.color",
                    highlight_timestamp: "$highlights.timestamp"
                }
            }
        ]);
        
        const dashboardData = {
            summary: {
                total_sessions: totalSessions,
                active_sessions: activeSessions,
                sessions_today: todayActivity.length > 0 ? todayActivity[0].sessions_today : 0,
                unique_users_today: todayActivity.length > 0 ? todayActivity[0].unique_users_today.length : 0,
                unique_books_today: todayActivity.length > 0 ? todayActivity[0].unique_books_today.length : 0,
                total_reading_time_today: todayActivity.length > 0 ? todayActivity[0].total_reading_time_today : 0
            },
            device_distribution: deviceStats.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {}),
            recent_highlights: recentHighlights
        };
        
        res.json({
            dashboard: dashboardData,
            generated_at: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Dashboard analytics error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to fetch dashboard analytics',
                code: 'DASHBOARD_ANALYTICS_ERROR'
            }
        });
    }
});

module.exports = router;
