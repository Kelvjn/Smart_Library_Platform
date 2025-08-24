// Smart Library Platform - MongoDB Aggregation Pipelines
// Reading Analytics Queries

use('smart_library_nosql');

// 1. Average session time per user
const averageSessionTimePerUser = [
    {
        $match: {
            session_end: { $ne: null },
            session_duration_minutes: { $gt: 0 }
        }
    },
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
            }
        }
    },
    {
        $addFields: {
            unique_books_count: { $size: "$unique_books_read" },
            hours_read: { $round: [{ $divide: ["$total_reading_time", 60] }, 2] },
            avg_session_hours: { $round: [{ $divide: ["$average_session_duration", 60] }, 2] }
        }
    },
    {
        $sort: { average_session_duration: -1 }
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
            _id: 0
        }
    }
];

// 2. Most highlighted books
const mostHighlightedBooks = [
    {
        $match: {
            highlights: { $exists: true, $ne: [] }
        }
    },
    {
        $unwind: "$highlights"
    },
    {
        $group: {
            _id: "$book_id",
            total_highlights: { $sum: 1 },
            unique_users: { $addToSet: "$user_id" },
            highlight_colors: { $addToSet: "$highlights.color" },
            sample_highlights: { 
                $push: {
                    text: "$highlights.text",
                    page: "$highlights.page",
                    color: "$highlights.color",
                    user_id: "$user_id"
                }
            },
            avg_highlight_page: { $avg: "$highlights.page" },
            latest_highlight: { $max: "$highlights.timestamp" }
        }
    },
    {
        $addFields: {
            unique_users_count: { $size: "$unique_users" },
            highlights_per_user: { 
                $round: [
                    { $divide: ["$total_highlights", { $size: "$unique_users" }] }, 
                    2
                ] 
            },
            top_highlights: { $slice: ["$sample_highlights", 5] }
        }
    },
    {
        $sort: { total_highlights: -1 }
    },
    {
        $project: {
            book_id: "$_id",
            total_highlights: 1,
            unique_users_count: 1,
            highlights_per_user: 1,
            highlight_colors: 1,
            avg_highlight_page: { $round: ["$avg_highlight_page", 1] },
            latest_highlight: 1,
            top_highlights: 1,
            _id: 0
        }
    }
];

// 3. Top 10 books by total reading time
const topBooksByReadingTime = [
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
            device_usage: {
                $push: "$device_type"
            },
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
        $sort: { total_reading_time: -1 }
    },
    {
        $limit: 10
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
            device_distribution: 1,
            avg_completion_rate: { $round: ["$avg_completion_rate", 2] },
            first_session: 1,
            last_session: 1,
            _id: 0
        }
    }
];

// 4. Device usage analytics
const deviceUsageAnalytics = [
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
            },
            os_distribution: { $push: "$device_info.os" }
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

// 5. Reading patterns by time of day
const readingPatternsByTime = [
    {
        $addFields: {
            hour_of_day: { $hour: "$session_start" },
            day_of_week: { $dayOfWeek: "$session_start" },
            month: { $month: "$session_start" }
        }
    },
    {
        $group: {
            _id: {
                hour: "$hour_of_day",
                day_of_week: "$day_of_week"
            },
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
                        { case: { $eq: ["$_id.day_of_week", 1] }, then: "Sunday" },
                        { case: { $eq: ["$_id.day_of_week", 2] }, then: "Monday" },
                        { case: { $eq: ["$_id.day_of_week", 3] }, then: "Tuesday" },
                        { case: { $eq: ["$_id.day_of_week", 4] }, then: "Wednesday" },
                        { case: { $eq: ["$_id.day_of_week", 5] }, then: "Thursday" },
                        { case: { $eq: ["$_id.day_of_week", 6] }, then: "Friday" },
                        { case: { $eq: ["$_id.day_of_week", 7] }, then: "Saturday" }
                    ],
                    default: "Unknown"
                }
            }
        }
    },
    {
        $sort: { 
            "_id.day_of_week": 1, 
            "_id.hour": 1 
        }
    },
    {
        $project: {
            hour: "$_id.hour",
            day_of_week: "$_id.day_of_week",
            day_name: 1,
            total_sessions: 1,
            total_reading_time: 1,
            unique_users_count: 1,
            average_session_duration: { $round: ["$average_session_duration", 1] },
            _id: 0
        }
    }
];

// 6. User engagement levels
const userEngagementLevels = [
    {
        $group: {
            _id: "$user_id",
            total_sessions: { $sum: 1 },
            total_reading_time: { $sum: "$session_duration_minutes" },
            unique_books: { $addToSet: "$book_id" },
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
            first_session: { $min: "$session_start" },
            last_session: { $max: "$session_start" },
            average_session_duration: { $avg: "$session_duration_minutes" }
        }
    },
    {
        $addFields: {
            unique_books_count: { $size: "$unique_books" },
            days_active: {
                $divide: [
                    { $subtract: ["$last_session", "$first_session"] },
                    86400000  // milliseconds in a day
                ]
            },
            engagement_score: {
                $add: [
                    { $multiply: ["$total_sessions", 2] },
                    { $multiply: ["$unique_books_count", 5] },
                    { $multiply: ["$total_highlights", 3] },
                    { $multiply: ["$total_bookmarks", 2] }
                ]
            }
        }
    },
    {
        $addFields: {
            days_active_rounded: { $round: ["$days_active", 0] },
            sessions_per_day: {
                $cond: {
                    if: { $gt: ["$days_active", 0] },
                    then: { $round: [{ $divide: ["$total_sessions", "$days_active"] }, 2] },
                    else: "$total_sessions"
                }
            },
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
        $project: {
            user_id: "$_id",
            total_sessions: 1,
            total_reading_time: 1,
            unique_books_count: 1,
            total_highlights: 1,
            total_bookmarks: 1,
            days_active: "$days_active_rounded",
            sessions_per_day: 1,
            average_session_duration: { $round: ["$average_session_duration", 1] },
            engagement_score: { $round: ["$engagement_score", 0] },
            engagement_level: 1,
            first_session: 1,
            last_session: 1,
            _id: 0
        }
    }
];

// 7. Peak reading hours
const peakReadingHours = [
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
        $sort: { total_sessions: -1 }
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

// Function to execute aggregation pipelines
function executeAnalytics() {
    print("=== READING ANALYTICS REPORT ===\n");
    
    print("1. Average Session Time Per User:");
    db.reading_sessions.aggregate(averageSessionTimePerUser).forEach(printjson);
    
    print("\n2. Most Highlighted Books:");
    db.reading_sessions.aggregate(mostHighlightedBooks).forEach(printjson);
    
    print("\n3. Top 10 Books by Total Reading Time:");
    db.reading_sessions.aggregate(topBooksByReadingTime).forEach(printjson);
    
    print("\n4. Device Usage Analytics:");
    db.reading_sessions.aggregate(deviceUsageAnalytics).forEach(printjson);
    
    print("\n5. User Engagement Levels:");
    db.reading_sessions.aggregate(userEngagementLevels).forEach(printjson);
    
    print("\n6. Peak Reading Hours:");
    db.reading_sessions.aggregate(peakReadingHours).forEach(printjson);
}

// Export aggregation pipelines for use in Node.js application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        averageSessionTimePerUser,
        mostHighlightedBooks,
        topBooksByReadingTime,
        deviceUsageAnalytics,
        readingPatternsByTime,
        userEngagementLevels,
        peakReadingHours
    };
}

// Execute analytics if run directly in MongoDB shell
if (typeof print !== 'undefined') {
    executeAnalytics();
}
