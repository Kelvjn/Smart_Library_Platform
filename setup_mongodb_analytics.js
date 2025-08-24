#!/usr/bin/env node

// Smart Library Platform - MongoDB Analytics Setup
// This script populates MongoDB with sample reading analytics data

const { MongoClient } = require('mongodb');
require('dotenv').config();

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_library_nosql';

// Sample reading sessions data
const sampleReadingSessions = [
    {
        user_id: 1,
        book_id: 1, // To Kill a Mockingbird
        session_start: new Date("2024-01-15T09:00:00Z"),
        session_end: new Date("2024-01-15T10:30:00Z"),
        device_type: "desktop",
        device_info: {
            os: "Windows 11",
            browser: "Chrome 120",
            screen_size: "1920x1080",
            app_version: "1.0.0"
        },
        pages_read: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        highlights: [
            {
                page: 3,
                text: "You never really understand a person until you climb into his skin and walk around in it.",
                color: "yellow",
                timestamp: new Date("2024-01-15T09:15:00Z"),
                note: "Key quote about empathy"
            },
            {
                page: 7,
                text: "The one thing that doesn't abide by majority rule is a person's conscience.",
                color: "green",
                timestamp: new Date("2024-01-15T09:45:00Z"),
                note: "About moral courage"
            },
            {
                page: 12,
                text: "Real courage is when you know you're licked from the start, but you begin anyway.",
                color: "blue",
                timestamp: new Date("2024-01-15T10:15:00Z"),
                note: "Definition of true courage"
            }
        ],
        bookmarks: [
            {
                page: 15,
                timestamp: new Date("2024-01-15T10:30:00Z"),
                note: "Stopped reading here - great chapter"
            }
        ],
        reading_progress: {
            current_page: 15,
            total_pages: 376,
            percentage_complete: 3.99
        },
        session_duration_minutes: 90,
        location: {
            country: "USA",
            city: "New York",
            timezone: "America/New_York"
        },
        quality_metrics: {
            words_per_minute: 250,
            time_on_page_avg: 6.0,
            scroll_pattern: "linear"
        },
        created_at: new Date("2024-01-15T09:00:00Z"),
        updated_at: new Date("2024-01-15T10:30:00Z")
    },
    {
        user_id: 1,
        book_id: 3, // Harry Potter
        session_start: new Date("2024-01-16T14:00:00Z"),
        session_end: new Date("2024-01-16T16:15:00Z"),
        device_type: "tablet",
        device_info: {
            os: "iOS 17",
            browser: "Safari",
            screen_size: "1024x768",
            app_version: "1.0.0"
        },
        pages_read: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
        highlights: [
            {
                page: 4,
                text: "You're a wizard, Harry.",
                color: "pink",
                timestamp: new Date("2024-01-16T14:20:00Z"),
                note: "Iconic moment!"
            },
            {
                page: 12,
                text: "It does not do to dwell on dreams and forget to live.",
                color: "yellow",
                timestamp: new Date("2024-01-16T15:00:00Z"),
                note: "Wise words from Dumbledore"
            },
            {
                page: 18,
                text: "There are all kinds of courage. It takes a great deal of bravery to stand up to our enemies.",
                color: "green",
                timestamp: new Date("2024-01-16T15:30:00Z"),
                note: "About different types of courage"
            },
            {
                page: 22,
                text: "The truth is a beautiful and terrible thing, and should therefore be treated with great caution.",
                color: "blue",
                timestamp: new Date("2024-01-16T16:00:00Z"),
                note: "Profound truth about truth itself"
            }
        ],
        bookmarks: [
            {
                page: 25,
                timestamp: new Date("2024-01-16T16:15:00Z"),
                note: "End of first chapter - excited to continue!"
            }
        ],
        reading_progress: {
            current_page: 25,
            total_pages: 223,
            percentage_complete: 11.21
        },
        session_duration_minutes: 135,
        location: {
            country: "USA",
            city: "New York",
            timezone: "America/New_York"
        },
        quality_metrics: {
            words_per_minute: 200,
            time_on_page_avg: 5.4,
            scroll_pattern: "intensive"
        },
        created_at: new Date("2024-01-16T14:00:00Z"),
        updated_at: new Date("2024-01-16T16:15:00Z")
    },
    {
        user_id: 1,
        book_id: 4, // Lord of the Rings
        session_start: new Date("2024-01-17T19:30:00Z"),
        session_end: new Date("2024-01-17T21:00:00Z"),
        device_type: "mobile",
        device_info: {
            os: "Android 14",
            browser: "Chrome Mobile",
            screen_size: "393x851",
            app_version: "1.0.0"
        },
        pages_read: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
        highlights: [
            {
                page: 8,
                text: "All we have to decide is what to do with the time that is given us.",
                color: "yellow",
                timestamp: new Date("2024-01-17T20:00:00Z"),
                note: "Gandalf's wisdom about time"
            },
            {
                page: 14,
                text: "Even the smallest person can change the course of the future.",
                color: "green",
                timestamp: new Date("2024-01-17T20:30:00Z"),
                note: "About the power of individuals"
            }
        ],
        bookmarks: [
            {
                page: 18,
                timestamp: new Date("2024-01-17T21:00:00Z"),
                note: "Great world-building so far"
            }
        ],
        reading_progress: {
            current_page: 18,
            total_pages: 423,
            percentage_complete: 4.26
        },
        session_duration_minutes: 90,
        location: {
            country: "USA",
            city: "New York",
            timezone: "America/New_York"
        },
        quality_metrics: {
            words_per_minute: 180,
            time_on_page_avg: 5.0,
            scroll_pattern: "linear"
        },
        created_at: new Date("2024-01-17T19:30:00Z"),
        updated_at: new Date("2024-01-17T21:00:00Z")
    },
    {
        user_id: 1,
        book_id: 5, // Dune
        session_start: new Date("2024-01-18T20:00:00Z"),
        session_end: new Date("2024-01-18T22:30:00Z"),
        device_type: "e-reader",
        device_info: {
            os: "Kindle OS",
            browser: "Native",
            screen_size: "300x400",
            app_version: "1.0.0"
        },
        pages_read: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
        highlights: [
            {
                page: 5,
                text: "Fear is the mind-killer.",
                color: "red",
                timestamp: new Date("2024-01-18T20:30:00Z"),
                note: "Iconic litany against fear"
            },
            {
                page: 12,
                text: "He who controls the spice controls the universe.",
                color: "yellow",
                timestamp: new Date("2024-01-18T21:15:00Z"),
                note: "Central theme of the story"
            },
            {
                page: 18,
                text: "The beginning is a very delicate time.",
                color: "blue",
                timestamp: new Date("2024-01-18T22:00:00Z"),
                note: "Opening narration wisdom"
            }
        ],
        bookmarks: [
            {
                page: 22,
                timestamp: new Date("2024-01-18T22:30:00Z"),
                note: "Complex but fascinating world"
            }
        ],
        reading_progress: {
            current_page: 22,
            total_pages: 688,
            percentage_complete: 3.20
        },
        session_duration_minutes: 150,
        location: {
            country: "USA",
            city: "New York",
            timezone: "America/New_York"
        },
        quality_metrics: {
            words_per_minute: 160,
            time_on_page_avg: 6.8,
            scroll_pattern: "intensive"
        },
        created_at: new Date("2024-01-18T20:00:00Z"),
        updated_at: new Date("2024-01-18T22:30:00Z")
    },
    {
        user_id: 1,
        book_id: 3, // Harry Potter (Second session)
        session_start: new Date("2024-01-19T15:00:00Z"),
        session_end: new Date("2024-01-19T17:45:00Z"),
        device_type: "tablet",
        device_info: {
            os: "iOS 17",
            browser: "Safari",
            screen_size: "1024x768",
            app_version: "1.0.0"
        },
        pages_read: [26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50],
        highlights: [
            {
                page: 35,
                text: "It is our choices that show what we truly are, far more than our abilities.",
                color: "yellow",
                timestamp: new Date("2024-01-19T16:00:00Z"),
                note: "Powerful message about character"
            },
            {
                page: 42,
                text: "Happiness can be found even in the darkest of times, if one only remembers to turn on the light.",
                color: "green",
                timestamp: new Date("2024-01-19T16:30:00Z"),
                note: "Hope in darkness"
            },
            {
                page: 48,
                text: "We've all got both light and dark inside us. What matters is the part we choose to act on.",
                color: "blue",
                timestamp: new Date("2024-01-19T17:15:00Z"),
                note: "About moral choices"
            }
        ],
        bookmarks: [
            {
                page: 50,
                timestamp: new Date("2024-01-19T17:45:00Z"),
                note: "Loving this story more and more"
            }
        ],
        reading_progress: {
            current_page: 50,
            total_pages: 223,
            percentage_complete: 22.42
        },
        session_duration_minutes: 165,
        location: {
            country: "USA",
            city: "New York",
            timezone: "America/New_York"
        },
        quality_metrics: {
            words_per_minute: 220,
            time_on_page_avg: 6.6,
            scroll_pattern: "linear"
        },
        created_at: new Date("2024-01-19T15:00:00Z"),
        updated_at: new Date("2024-01-19T17:45:00Z")
    },
    {
        user_id: 1,
        book_id: 8, // Hitchhiker's Guide
        session_start: new Date("2024-01-20T11:00:00Z"),
        session_end: new Date("2024-01-20T12:30:00Z"),
        device_type: "desktop",
        device_info: {
            os: "Windows 11",
            browser: "Chrome 120",
            screen_size: "1920x1080",
            app_version: "1.0.0"
        },
        pages_read: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
        highlights: [
            {
                page: 4,
                text: "Don't Panic.",
                color: "yellow",
                timestamp: new Date("2024-01-20T11:15:00Z"),
                note: "The most important advice in the universe"
            },
            {
                page: 10,
                text: "The answer to the ultimate question of life, the universe, and everything is 42.",
                color: "green",
                timestamp: new Date("2024-01-20T11:45:00Z"),
                note: "Famous answer!"
            },
            {
                page: 16,
                text: "Time is an illusion. Lunchtime doubly so.",
                color: "blue",
                timestamp: new Date("2024-01-20T12:15:00Z"),
                note: "Douglas Adams humor at its best"
            }
        ],
        bookmarks: [
            {
                page: 20,
                timestamp: new Date("2024-01-20T12:30:00Z"),
                note: "Hilarious book so far!"
            }
        ],
        reading_progress: {
            current_page: 20,
            total_pages: 224,
            percentage_complete: 8.93
        },
        session_duration_minutes: 90,
        location: {
            country: "USA",
            city: "New York",
            timezone: "America/New_York"
        },
        quality_metrics: {
            words_per_minute: 240,
            time_on_page_avg: 4.5,
            scroll_pattern: "browsing"
        },
        created_at: new Date("2024-01-20T11:00:00Z"),
        updated_at: new Date("2024-01-20T12:30:00Z")
    }
];

async function setupMongoDBAnalytics() {
    let client;
    
    try {
        console.log('🔌 Connecting to MongoDB...');
        client = new MongoClient(mongoUri);
        await client.connect();
        
        const db = client.db();
        console.log('✅ Connected to MongoDB successfully!');

        // Drop existing collections for fresh start
        console.log('🧹 Clearing existing collections...');
        try {
            await db.collection('reading_sessions').drop();
            await db.collection('user_analytics').drop();
            await db.collection('book_analytics').drop();
        } catch (error) {
            // Collections might not exist, which is fine
        }

        // Create reading_sessions collection with validation
        console.log('📋 Creating reading_sessions collection...');
        await db.createCollection("reading_sessions", {
            validator: {
                $jsonSchema: {
                    bsonType: "object",
                    required: ["user_id", "book_id", "session_start", "device_type"],
                    properties: {
                        user_id: { bsonType: "int", minimum: 1 },
                        book_id: { bsonType: "int", minimum: 1 },
                        session_start: { bsonType: "date" },
                        session_end: { bsonType: ["date", "null"] },
                        device_type: { 
                            bsonType: "string",
                            enum: ["mobile", "tablet", "desktop", "e-reader"]
                        },
                        pages_read: { bsonType: "array" },
                        highlights: { bsonType: "array" },
                        bookmarks: { bsonType: "array" },
                        session_duration_minutes: { bsonType: ["int", "null"] }
                    }
                }
            },
            validationLevel: "moderate"
        });

        // Insert sample reading sessions
        console.log('📚 Inserting sample reading sessions...');
        const result = await db.collection('reading_sessions').insertMany(sampleReadingSessions);
        console.log(`✅ Inserted ${result.insertedCount} reading sessions`);

        // Create indexes for performance
        console.log('🔍 Creating indexes...');
        await db.collection('reading_sessions').createIndex({ "user_id": 1, "session_start": -1 });
        await db.collection('reading_sessions').createIndex({ "book_id": 1, "session_start": -1 });
        await db.collection('reading_sessions').createIndex({ "session_start": -1 });
        await db.collection('reading_sessions').createIndex({ "device_type": 1, "session_start": -1 });
        await db.collection('reading_sessions').createIndex({ "highlights.text": "text" });

        console.log('✅ Indexes created successfully!');

        // Create analytics collections
        console.log('📊 Creating analytics collections...');
        await db.createCollection("user_analytics");
        await db.createCollection("book_analytics");

        // Display summary
        console.log('\n📊 MongoDB Analytics Setup Summary:');
        console.log('=====================================');
        
        const sessionsCount = await db.collection('reading_sessions').countDocuments();
        console.log(`📱 Reading sessions: ${sessionsCount}`);
        
        const uniqueUsers = await db.collection('reading_sessions').distinct('user_id');
        console.log(`👥 Unique users with sessions: ${uniqueUsers.length}`);
        
        const uniqueBooks = await db.collection('reading_sessions').distinct('book_id');
        console.log(`📚 Books with reading data: ${uniqueBooks.length}`);
        
        const totalHighlights = await db.collection('reading_sessions').aggregate([
            { $unwind: '$highlights' },
            { $count: 'total' }
        ]).toArray();
        console.log(`✨ Total highlights: ${totalHighlights[0]?.total || 0}`);

        // Sample analytics queries
        console.log('\n📈 Sample Analytics Results:');
        console.log('============================');
        
        // Average session time per user
        const avgSessionTime = await db.collection('reading_sessions').aggregate([
            {
                $group: {
                    _id: "$user_id",
                    avg_session_duration: { $avg: "$session_duration_minutes" },
                    total_sessions: { $sum: 1 }
                }
            }
        ]).toArray();
        
        console.log('📊 Average session time per user:');
        avgSessionTime.forEach(user => {
            console.log(`   User ${user._id}: ${user.avg_session_duration.toFixed(1)} minutes (${user.total_sessions} sessions)`);
        });

        // Most highlighted books
        const mostHighlighted = await db.collection('reading_sessions').aggregate([
            { $unwind: '$highlights' },
            {
                $group: {
                    _id: '$book_id',
                    highlight_count: { $sum: 1 }
                }
            },
            { $sort: { highlight_count: -1 } },
            { $limit: 5 }
        ]).toArray();
        
        console.log('\n✨ Most highlighted books:');
        mostHighlighted.forEach(book => {
            console.log(`   Book ${book._id}: ${book.highlight_count} highlights`);
        });

        console.log('\n🎉 MongoDB Analytics setup completed successfully!');
        console.log('\n📋 Next Steps:');
        console.log('1. Open MongoDB Compass');
        console.log('2. Connect to: mongodb://localhost:27017');
        console.log('3. Navigate to database: smart_library_nosql');
        console.log('4. Explore the reading_sessions collection');

    } catch (error) {
        console.error('❌ Error setting up MongoDB analytics:', error);
    } finally {
        if (client) {
            await client.close();
            console.log('👋 MongoDB connection closed');
        }
    }
}

// Run the setup
setupMongoDBAnalytics();
