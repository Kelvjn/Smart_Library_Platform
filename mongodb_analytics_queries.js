#!/usr/bin/env node

// Smart Library Platform - MongoDB Analytics Queries
// Generate the required reports for reading analytics

const { MongoClient } = require('mongodb');
require('dotenv').config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_library_nosql';

async function generateAnalyticsReports() {
    let client;
    
    try {
        console.log('🔌 Connecting to MongoDB...');
        client = new MongoClient(mongoUri);
        await client.connect();
        const db = client.db();
        console.log('✅ Connected successfully!\n');

        // Report 1: Average session time per user
        console.log('📊 REPORT 1: Average Session Time Per User');
        console.log('==========================================');
        
        const avgSessionTimeQuery = [
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
                    hours_read: { $round: [{ $divide: ["$total_reading_time", 60] }, 2] }
                }
            },
            {
                $sort: { average_session_duration: -1 }
            }
        ];

        const avgSessionResults = await db.collection('reading_sessions').aggregate(avgSessionTimeQuery).toArray();
        
        avgSessionResults.forEach(user => {
            console.log(`👤 User ${user._id}:`);
            console.log(`   📊 Total Sessions: ${user.total_sessions}`);
            console.log(`   ⏱️  Average Session: ${user.average_session_duration.toFixed(1)} minutes`);
            console.log(`   🕐 Total Reading Time: ${user.hours_read} hours`);
            console.log(`   📚 Unique Books: ${user.unique_books_count}`);
            console.log(`   📄 Total Pages: ${user.total_pages_read}`);
            console.log(`   ⏰ Session Range: ${user.shortest_session}-${user.longest_session} minutes\n`);
        });

        // Report 2: Most highlighted books
        console.log('✨ REPORT 2: Most Highlighted Books');
        console.log('===================================');
        
        const mostHighlightedQuery = [
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
                            note: "$highlights.note"
                        }
                    },
                    avg_highlight_page: { $avg: "$highlights.page" }
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
                    }
                }
            },
            {
                $sort: { total_highlights: -1 }
            }
        ];

        const highlightResults = await db.collection('reading_sessions').aggregate(mostHighlightedQuery).toArray();
        
        highlightResults.forEach((book, index) => {
            console.log(`📚 #${index + 1} Book ${book._id}:`);
            console.log(`   ✨ Total Highlights: ${book.total_highlights}`);
            console.log(`   👥 Users Who Highlighted: ${book.unique_users_count}`);
            console.log(`   📊 Highlights per User: ${book.highlights_per_user}`);
            console.log(`   📄 Average Page: ${book.avg_highlight_page.toFixed(1)}`);
            console.log(`   🎨 Colors Used: ${book.highlight_colors.join(', ')}`);
            console.log(`   💭 Sample Highlight: "${book.sample_highlights[0].text}"`);
            console.log(`      📝 Note: ${book.sample_highlights[0].note}\n`);
        });

        // Report 3: Top 10 books by total reading time
        console.log('⏱️  REPORT 3: Top 10 Books by Total Reading Time');
        console.log('===============================================');
        
        const topBooksByTimeQuery = [
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
                    device_usage: { $push: "$device_type" },
                    completion_data: {
                        $push: {
                            $cond: {
                                if: { $ne: ["$reading_progress.percentage_complete", null] },
                                then: "$reading_progress.percentage_complete",
                                else: null
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    unique_readers_count: { $size: "$unique_readers" },
                    hours_read: { $round: [{ $divide: ["$total_reading_time", 60] }, 2] },
                    avg_completion_rate: {
                        $avg: {
                            $filter: {
                                input: "$completion_data",
                                cond: { $ne: ["$$this", null] }
                            }
                        }
                    },
                    device_stats: {
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
                $sort: { total_reading_time: -1 }
            },
            {
                $limit: 10
            }
        ];

        const topBooksResults = await db.collection('reading_sessions').aggregate(topBooksByTimeQuery).toArray();
        
        topBooksResults.forEach((book, index) => {
            console.log(`📖 #${index + 1} Book ${book._id}:`);
            console.log(`   ⏱️  Total Reading Time: ${book.hours_read} hours (${book.total_reading_time} minutes)`);
            console.log(`   📊 Sessions: ${book.total_sessions}`);
            console.log(`   👥 Unique Readers: ${book.unique_readers_count}`);
            console.log(`   📄 Pages Read: ${book.total_pages_read}`);
            console.log(`   ⏰ Avg Session: ${book.average_session_duration.toFixed(1)} minutes`);
            console.log(`   📱 Devices: ${Object.keys(book.device_stats).map(device => `${device}(${book.device_stats[device]})`).join(', ')}`);
            if (book.avg_completion_rate) {
                console.log(`   📈 Avg Progress: ${book.avg_completion_rate.toFixed(1)}%`);
            }
            console.log('');
        });

        // Additional Report: Device Usage Analytics
        console.log('📱 BONUS REPORT: Device Usage Analytics');
        console.log('======================================');
        
        const deviceUsageQuery = [
            {
                $group: {
                    _id: "$device_type",
                    total_sessions: { $sum: 1 },
                    total_reading_time: { $sum: "$session_duration_minutes" },
                    unique_users: { $addToSet: "$user_id" },
                    unique_books: { $addToSet: "$book_id" },
                    average_session_duration: { $avg: "$session_duration_minutes" }
                }
            },
            {
                $addFields: {
                    unique_users_count: { $size: "$unique_users" },
                    unique_books_count: { $size: "$unique_books" },
                    hours_read: { $round: [{ $divide: ["$total_reading_time", 60] }, 2] }
                }
            },
            {
                $sort: { total_sessions: -1 }
            }
        ];

        const deviceResults = await db.collection('reading_sessions').aggregate(deviceUsageQuery).toArray();
        
        deviceResults.forEach(device => {
            console.log(`📱 ${device._id.charAt(0).toUpperCase() + device._id.slice(1)}:`);
            console.log(`   📊 Sessions: ${device.total_sessions}`);
            console.log(`   ⏱️  Total Time: ${device.hours_read} hours`);
            console.log(`   👥 Users: ${device.unique_users_count}`);
            console.log(`   📚 Books: ${device.unique_books_count}`);
            console.log(`   ⏰ Avg Session: ${device.average_session_duration.toFixed(1)} minutes\n`);
        });

        console.log('🎉 All analytics reports generated successfully!');

    } catch (error) {
        console.error('❌ Error generating reports:', error);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

// Run the analytics
generateAnalyticsReports();
