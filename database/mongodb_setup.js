// Smart Library Platform - MongoDB Setup and Configuration
// MongoDB database for reading analytics and session tracking

// Connect to MongoDB and create collections
use('smart_library_nosql');

// Drop existing collections for fresh start (development only)
db.reading_sessions.drop();
db.user_analytics.drop();
db.book_analytics.drop();

// Create reading_sessions collection with schema validation
db.createCollection("reading_sessions", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["user_id", "book_id", "session_start", "device_type"],
            properties: {
                user_id: {
                    bsonType: "int",
                    minimum: 1,
                    description: "Must be a valid user ID from MySQL database"
                },
                book_id: {
                    bsonType: "int", 
                    minimum: 1,
                    description: "Must be a valid book ID from MySQL database"
                },
                session_start: {
                    bsonType: "date",
                    description: "Session start timestamp"
                },
                session_end: {
                    bsonType: ["date", "null"],
                    description: "Session end timestamp (null for active sessions)"
                },
                device_type: {
                    bsonType: "string",
                    enum: ["mobile", "tablet", "desktop", "e-reader"],
                    description: "Device used for reading"
                },
                device_info: {
                    bsonType: "object",
                    properties: {
                        os: { bsonType: "string" },
                        browser: { bsonType: "string" },
                        screen_size: { bsonType: "string" },
                        app_version: { bsonType: "string" }
                    }
                },
                pages_read: {
                    bsonType: "array",
                    items: {
                        bsonType: "int",
                        minimum: 1
                    },
                    description: "Array of page numbers read during session"
                },
                highlights: {
                    bsonType: "array",
                    items: {
                        bsonType: "object",
                        required: ["page", "text", "timestamp"],
                        properties: {
                            page: {
                                bsonType: "int",
                                minimum: 1
                            },
                            text: {
                                bsonType: "string",
                                maxLength: 1000
                            },
                            color: {
                                bsonType: "string",
                                enum: ["yellow", "green", "blue", "pink", "purple"]
                            },
                            timestamp: {
                                bsonType: "date"
                            },
                            note: {
                                bsonType: "string",
                                maxLength: 500
                            }
                        }
                    }
                },
                bookmarks: {
                    bsonType: "array",
                    items: {
                        bsonType: "object",
                        required: ["page", "timestamp"],
                        properties: {
                            page: {
                                bsonType: "int",
                                minimum: 1
                            },
                            timestamp: {
                                bsonType: "date"
                            },
                            note: {
                                bsonType: "string",
                                maxLength: 200
                            }
                        }
                    }
                },
                reading_progress: {
                    bsonType: "object",
                    properties: {
                        current_page: {
                            bsonType: "int",
                            minimum: 1
                        },
                        total_pages: {
                            bsonType: "int",
                            minimum: 1
                        },
                        percentage_complete: {
                            bsonType: "double",
                            minimum: 0,
                            maximum: 100
                        }
                    }
                },
                session_duration_minutes: {
                    bsonType: ["int", "null"],
                    minimum: 0,
                    description: "Calculated session duration in minutes"
                },
                location: {
                    bsonType: "object",
                    properties: {
                        country: { bsonType: "string" },
                        city: { bsonType: "string" },
                        timezone: { bsonType: "string" }
                    }
                },
                quality_metrics: {
                    bsonType: "object",
                    properties: {
                        words_per_minute: {
                            bsonType: "double",
                            minimum: 0
                        },
                        time_on_page_avg: {
                            bsonType: "double",
                            minimum: 0
                        },
                        scroll_pattern: {
                            bsonType: "string",
                            enum: ["linear", "skimming", "intensive", "browsing"]
                        }
                    }
                },
                created_at: {
                    bsonType: "date",
                    description: "Record creation timestamp"
                },
                updated_at: {
                    bsonType: "date",
                    description: "Record update timestamp"
                }
            }
        }
    },
    validationLevel: "moderate",
    validationAction: "warn"
});

// Create indexes for performance optimization
// Primary indexes for queries
db.reading_sessions.createIndex({ "user_id": 1, "session_start": -1 });
db.reading_sessions.createIndex({ "book_id": 1, "session_start": -1 });
db.reading_sessions.createIndex({ "session_start": -1 });
db.reading_sessions.createIndex({ "session_end": 1 });

// Compound indexes for analytics
db.reading_sessions.createIndex({ "user_id": 1, "book_id": 1, "session_start": -1 });
db.reading_sessions.createIndex({ "device_type": 1, "session_start": -1 });
db.reading_sessions.createIndex({ "book_id": 1, "highlights": 1 });

// Sparse indexes for optional fields
db.reading_sessions.createIndex({ "session_duration_minutes": -1 }, { sparse: true });
db.reading_sessions.createIndex({ "reading_progress.percentage_complete": -1 }, { sparse: true });

// Text index for highlight search
db.reading_sessions.createIndex({ "highlights.text": "text", "highlights.note": "text" });

// TTL index for old sessions (optional - remove sessions older than 2 years)
db.reading_sessions.createIndex({ "created_at": 1 }, { expireAfterSeconds: 63072000 }); // 2 years

// Insert sample reading session data
const sampleSessions = [
    {
        user_id: 3,
        book_id: 1,
        session_start: new Date("2024-01-15T09:00:00Z"),
        session_end: new Date("2024-01-15T10:30:00Z"),
        device_type: "desktop",
        device_info: {
            os: "Windows 11",
            browser: "Chrome 120",
            screen_size: "1920x1080",
            app_version: "1.0.0"
        },
        pages_read: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        highlights: [
            {
                page: 3,
                text: "Big Brother is watching you",
                color: "yellow",
                timestamp: new Date("2024-01-15T09:15:00Z"),
                note: "Key theme of surveillance"
            },
            {
                page: 7,
                text: "War is peace. Freedom is slavery. Ignorance is strength.",
                color: "green",
                timestamp: new Date("2024-01-15T09:45:00Z"),
                note: "Orwell's doublethink concept"
            }
        ],
        bookmarks: [
            {
                page: 10,
                timestamp: new Date("2024-01-15T10:30:00Z"),
                note: "Stopped reading here"
            }
        ],
        reading_progress: {
            current_page: 10,
            total_pages: 328,
            percentage_complete: 3.05
        },
        session_duration_minutes: 90,
        location: {
            country: "USA",
            city: "New York",
            timezone: "America/New_York"
        },
        quality_metrics: {
            words_per_minute: 250,
            time_on_page_avg: 9.0,
            scroll_pattern: "linear"
        },
        created_at: new Date("2024-01-15T09:00:00Z"),
        updated_at: new Date("2024-01-15T10:30:00Z")
    },
    {
        user_id: 4,
        book_id: 2,
        session_start: new Date("2024-01-16T14:00:00Z"),
        session_end: new Date("2024-01-16T15:45:00Z"),
        device_type: "tablet",
        device_info: {
            os: "iOS 17",
            browser: "Safari",
            screen_size: "1024x768",
            app_version: "1.0.0"
        },
        pages_read: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
        highlights: [
            {
                page: 18,
                text: "It is a truth universally acknowledged",
                color: "pink",
                timestamp: new Date("2024-01-16T14:20:00Z"),
                note: "Famous opening line"
            }
        ],
        bookmarks: [
            {
                page: 25,
                timestamp: new Date("2024-01-16T15:45:00Z"),
                note: "End of chapter 2"
            }
        ],
        reading_progress: {
            current_page: 25,
            total_pages: 432,
            percentage_complete: 5.79
        },
        session_duration_minutes: 105,
        location: {
            country: "Canada",
            city: "Toronto",
            timezone: "America/Toronto"
        },
        quality_metrics: {
            words_per_minute: 180,
            time_on_page_avg: 9.5,
            scroll_pattern: "intensive"
        },
        created_at: new Date("2024-01-16T14:00:00Z"),
        updated_at: new Date("2024-01-16T15:45:00Z")
    },
    {
        user_id: 3,
        book_id: 1,
        session_start: new Date("2024-01-17T19:30:00Z"),
        session_end: new Date("2024-01-17T20:45:00Z"),
        device_type: "mobile",
        device_info: {
            os: "Android 14",
            browser: "Chrome Mobile",
            screen_size: "393x851",
            app_version: "1.0.0"
        },
        pages_read: [11, 12, 13, 14, 15, 16, 17],
        highlights: [
            {
                page: 14,
                text: "Freedom is the freedom to say that two plus two make four",
                color: "blue",
                timestamp: new Date("2024-01-17T20:00:00Z"),
                note: "Mathematical truth vs political truth"
            }
        ],
        bookmarks: [],
        reading_progress: {
            current_page: 17,
            total_pages: 328,
            percentage_complete: 5.18
        },
        session_duration_minutes: 75,
        location: {
            country: "USA",
            city: "New York",
            timezone: "America/New_York"
        },
        quality_metrics: {
            words_per_minute: 200,
            time_on_page_avg: 10.7,
            scroll_pattern: "linear"
        },
        created_at: new Date("2024-01-17T19:30:00Z"),
        updated_at: new Date("2024-01-17T20:45:00Z")
    },
    {
        user_id: 4,
        book_id: 5,
        session_start: new Date("2024-01-18T11:00:00Z"),
        session_end: new Date("2024-01-18T12:30:00Z"),
        device_type: "e-reader",
        device_info: {
            os: "Kindle OS",
            browser: "Native",
            screen_size: "300x400",
            app_version: "1.0.0"
        },
        pages_read: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        highlights: [
            {
                page: 5,
                text: "He was an old man who fished alone",
                color: "yellow",
                timestamp: new Date("2024-01-18T11:15:00Z"),
                note: "Character introduction"
            },
            {
                page: 8,
                text: "But man is not made for defeat",
                color: "green",
                timestamp: new Date("2024-01-18T11:45:00Z"),
                note: "Theme of perseverance"
            }
        ],
        bookmarks: [
            {
                page: 12,
                timestamp: new Date("2024-01-18T12:30:00Z"),
                note: "Great start to the story"
            }
        ],
        reading_progress: {
            current_page: 12,
            total_pages: 127,
            percentage_complete: 9.45
        },
        session_duration_minutes: 90,
        location: {
            country: "Canada",
            city: "Toronto",
            timezone: "America/Toronto"
        },
        quality_metrics: {
            words_per_minute: 150,
            time_on_page_avg: 7.5,
            scroll_pattern: "linear"
        },
        created_at: new Date("2024-01-18T11:00:00Z"),
        updated_at: new Date("2024-01-18T12:30:00Z")
    }
];

// Insert sample data
db.reading_sessions.insertMany(sampleSessions);

// Create user analytics collection for aggregated data
db.createCollection("user_analytics", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["user_id", "analytics_date"],
            properties: {
                user_id: { bsonType: "int" },
                analytics_date: { bsonType: "date" },
                total_reading_time: { bsonType: "int" },
                total_pages_read: { bsonType: "int" },
                books_read: { bsonType: "array" },
                average_session_duration: { bsonType: "double" },
                device_usage: { bsonType: "object" },
                reading_streak: { bsonType: "int" }
            }
        }
    }
});

// Create book analytics collection
db.createCollection("book_analytics", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["book_id", "analytics_date"],
            properties: {
                book_id: { bsonType: "int" },
                analytics_date: { bsonType: "date" },
                total_reading_time: { bsonType: "int" },
                unique_readers: { bsonType: "int" },
                total_highlights: { bsonType: "int" },
                average_session_duration: { bsonType: "double" },
                completion_rate: { bsonType: "double" },
                device_distribution: { bsonType: "object" }
            }
        }
    }
});

// Create indexes for analytics collections
db.user_analytics.createIndex({ "user_id": 1, "analytics_date": -1 });
db.book_analytics.createIndex({ "book_id": 1, "analytics_date": -1 });

print("MongoDB setup completed successfully!");
print("Collections created: reading_sessions, user_analytics, book_analytics");
print("Sample data inserted into reading_sessions");
print("Indexes created for optimal query performance");

// Verify setup
print("\nVerification:");
print("Reading sessions count:", db.reading_sessions.countDocuments());
print("Sample session:", JSON.stringify(db.reading_sessions.findOne(), null, 2));
