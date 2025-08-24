#!/usr/bin/env node

// Smart Library Platform - Data Checking Script
// This script provides a comprehensive overview of your library data

const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
require('dotenv').config();

// Console colors for better output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

// Configuration
const mysqlConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '1192004',
    database: process.env.DB_NAME || 'smart_library',
    port: process.env.DB_PORT || 3306
};

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_library_nosql';

// Helper functions
function log(message, color = 'white') {
    console.log(colors[color] + message + colors.reset);
}

function separator(title) {
    console.log('\n' + colors.cyan + '='.repeat(60) + colors.reset);
    console.log(colors.bright + colors.cyan + `📊 ${title}` + colors.reset);
    console.log(colors.cyan + '='.repeat(60) + colors.reset);
}

function section(title) {
    console.log('\n' + colors.yellow + '📋 ' + title + colors.reset);
    console.log(colors.dim + '-'.repeat(50) + colors.reset);
}

async function checkMySQLData() {
    let connection;
    try {
        log('🔌 Connecting to MySQL database...', 'blue');
        connection = await mysql.createConnection(mysqlConfig);
        log('✅ Connected to MySQL successfully!', 'green');

        // Basic counts
        section('Database Overview');
        
        const [tables] = await connection.execute('SHOW TABLES');
        log(`📁 Total tables: ${tables.length}`, 'cyan');
        
        const [bookCount] = await connection.execute('SELECT COUNT(*) as count FROM books');
        const [authorCount] = await connection.execute('SELECT COUNT(*) as count FROM authors');
        const [userCount] = await connection.execute('SELECT COUNT(*) as count FROM users');
        const [checkoutCount] = await connection.execute('SELECT COUNT(*) as count FROM checkouts');
        const [reviewCount] = await connection.execute('SELECT COUNT(*) as count FROM reviews');
        
        log(`📚 Total Books: ${bookCount[0].count}`, 'green');
        log(`✍️  Total Authors: ${authorCount[0].count}`, 'green');
        log(`👥 Total Users: ${userCount[0].count}`, 'green');
        log(`📤 Total Checkouts: ${checkoutCount[0].count}`, 'green');
        log(`⭐ Total Reviews: ${reviewCount[0].count}`, 'green');

        // Books with authors
        section('Complete Book List');
        const [books] = await connection.execute(`
            SELECT 
                b.book_id,
                b.title,
                GROUP_CONCAT(CONCAT(a.first_name, ' ', a.last_name) ORDER BY ba.author_order SEPARATOR ', ') as authors,
                b.genre,
                b.publisher,
                b.total_copies,
                b.available_copies,
                ROUND(b.average_rating, 2) as rating
            FROM books b
            LEFT JOIN book_authors ba ON b.book_id = ba.book_id
            LEFT JOIN authors a ON ba.author_id = a.author_id
            WHERE b.is_active = TRUE
            GROUP BY b.book_id
            ORDER BY b.book_id
        `);

        if (books.length > 0) {
            console.log('\n' + colors.bright + 'ID | Title | Authors | Genre | Copies (Available/Total) | Rating' + colors.reset);
            console.log(colors.dim + '-'.repeat(100) + colors.reset);
            
            books.forEach(book => {
                const id = String(book.book_id).padEnd(3);
                const title = (book.title || 'Unknown').padEnd(30);
                const authors = (book.authors || 'Unknown').padEnd(25);
                const genre = (book.genre || 'N/A').padEnd(15);
                const copies = `${book.available_copies}/${book.total_copies}`.padEnd(8);
                const rating = book.rating > 0 ? `⭐${book.rating}` : 'No rating';
                
                console.log(`${id} | ${title} | ${authors} | ${genre} | ${copies} | ${rating}`);
            });
        } else {
            log('📭 No books found in the database', 'yellow');
        }

        // Genre distribution
        section('Books by Genre');
        const [genres] = await connection.execute(`
            SELECT genre, COUNT(*) as count 
            FROM books 
            WHERE is_active = TRUE 
            GROUP BY genre 
            ORDER BY count DESC
        `);

        if (genres.length > 0) {
            genres.forEach(genre => {
                const bar = '█'.repeat(Math.min(genre.count, 20));
                log(`📖 ${genre.genre}: ${genre.count} books ${colors.green}${bar}${colors.reset}`, 'white');
            });
        }

        // Active checkouts
        section('Current Checkouts');
        const [activeCheckouts] = await connection.execute(`
            SELECT 
                c.checkout_id,
                CONCAT(u.first_name, ' ', u.last_name) as user_name,
                b.title as book_title,
                DATE_FORMAT(c.checkout_date, '%Y-%m-%d') as checkout_date,
                DATE_FORMAT(c.due_date, '%Y-%m-%d') as due_date,
                CASE 
                    WHEN c.due_date < CURDATE() THEN 'OVERDUE'
                    WHEN c.due_date = CURDATE() THEN 'DUE TODAY'
                    ELSE 'ACTIVE'
                END as status
            FROM checkouts c
            JOIN users u ON c.user_id = u.user_id
            JOIN books b ON c.book_id = b.book_id
            WHERE c.is_returned = FALSE
            ORDER BY c.due_date ASC
        `);

        if (activeCheckouts.length > 0) {
            activeCheckouts.forEach(checkout => {
                const statusColor = checkout.status === 'OVERDUE' ? 'red' : 
                                  checkout.status === 'DUE TODAY' ? 'yellow' : 'green';
                log(`📋 ${checkout.user_name} - "${checkout.book_title}" (Due: ${checkout.due_date}) [${checkout.status}]`, statusColor);
            });
        } else {
            log('📭 No active checkouts', 'green');
        }

        // Recent reviews
        section('Recent Reviews');
        const [recentReviews] = await connection.execute(`
            SELECT 
                CONCAT(u.first_name, ' ', u.last_name) as reviewer,
                b.title as book_title,
                r.rating,
                LEFT(r.comment, 100) as comment_preview,
                DATE_FORMAT(r.review_date, '%Y-%m-%d') as review_date
            FROM reviews r
            JOIN users u ON r.user_id = u.user_id
            JOIN books b ON r.book_id = b.book_id
            ORDER BY r.review_date DESC
            LIMIT 5
        `);

        if (recentReviews.length > 0) {
            recentReviews.forEach(review => {
                const stars = '⭐'.repeat(review.rating);
                log(`${stars} "${review.book_title}" by ${review.reviewer} (${review.review_date})`, 'cyan');
                if (review.comment_preview) {
                    log(`   💬 "${review.comment_preview}${review.comment_preview.length >= 100 ? '...' : ''}"`, 'dim');
                }
            });
        } else {
            log('📭 No reviews found', 'yellow');
        }

        await connection.end();
        log('✅ MySQL data check completed!', 'green');
        
    } catch (error) {
        log(`❌ MySQL Error: ${error.message}`, 'red');
        if (connection) await connection.end();
    }
}

async function checkMongoDBData() {
    let client;
    try {
        log('🔌 Connecting to MongoDB...', 'blue');
        client = new MongoClient(mongoUri);
        await client.connect();
        const db = client.db();
        log('✅ Connected to MongoDB successfully!', 'green');

        separator('MongoDB Data (Reading Analytics)');

        // Reading sessions overview
        section('Reading Sessions Overview');
        const sessionsCount = await db.collection('reading_sessions').countDocuments();
        log(`📱 Total reading sessions: ${sessionsCount}`, 'cyan');

        if (sessionsCount > 0) {
            // Recent sessions
            const recentSessions = await db.collection('reading_sessions')
                .find({})
                .sort({ session_start: -1 })
                .limit(5)
                .toArray();

            section('Recent Reading Sessions');
            for (const session of recentSessions) {
                const duration = session.session_duration_minutes || 0;
                const progress = session.reading_progress?.percentage_complete || 0;
                const device = session.device_type || 'unknown';
                
                log(`📱 User ${session.user_id} read Book ${session.book_id} on ${device}`, 'cyan');
                log(`   ⏱️  Duration: ${duration} minutes | Progress: ${progress.toFixed(1)}% | Pages: ${session.pages_read?.length || 0}`, 'dim');
                
                if (session.highlights && session.highlights.length > 0) {
                    log(`   ✨ Highlights: ${session.highlights.length}`, 'yellow');
                }
            }

            // Device usage stats
            section('Device Usage Statistics');
            const deviceStats = await db.collection('reading_sessions').aggregate([
                {
                    $group: {
                        _id: '$device_type',
                        count: { $sum: 1 },
                        totalMinutes: { $sum: '$session_duration_minutes' }
                    }
                },
                { $sort: { count: -1 } }
            ]).toArray();

            deviceStats.forEach(stat => {
                const avgDuration = stat.totalMinutes / stat.count;
                log(`📱 ${stat._id}: ${stat.count} sessions (avg: ${avgDuration.toFixed(1)} min)`, 'green');
            });

            // Highlights summary
            const highlightsCount = await db.collection('reading_sessions').aggregate([
                { $unwind: '$highlights' },
                { $count: 'total' }
            ]).toArray();

            if (highlightsCount.length > 0) {
                section('Highlights Summary');
                log(`✨ Total highlights across all sessions: ${highlightsCount[0].total}`, 'yellow');

                // Most highlighted books
                const topHighlights = await db.collection('reading_sessions').aggregate([
                    { $unwind: '$highlights' },
                    {
                        $group: {
                            _id: '$book_id',
                            highlightCount: { $sum: 1 }
                        }
                    },
                    { $sort: { highlightCount: -1 } },
                    { $limit: 3 }
                ]).toArray();

                log('📚 Most highlighted books:', 'cyan');
                topHighlights.forEach(book => {
                    log(`   Book ${book._id}: ${book.highlightCount} highlights`, 'dim');
                });
            }
        } else {
            log('📭 No reading sessions found', 'yellow');
        }

        // Check other collections
        const userAnalyticsCount = await db.collection('user_analytics').countDocuments();
        const bookAnalyticsCount = await db.collection('book_analytics').countDocuments();
        
        section('Analytics Collections');
        log(`👥 User analytics records: ${userAnalyticsCount}`, 'cyan');
        log(`📚 Book analytics records: ${bookAnalyticsCount}`, 'cyan');

        await client.close();
        log('✅ MongoDB data check completed!', 'green');
        
    } catch (error) {
        log(`❌ MongoDB Error: ${error.message}`, 'red');
        if (client) await client.close();
    }
}

async function main() {
    console.clear();
    separator('Smart Library Platform - Data Overview');
    
    log('🚀 Starting comprehensive data check...', 'bright');
    log(`📅 Timestamp: ${new Date().toLocaleString()}`, 'dim');

    // Check if .env file exists
    try {
        require('fs').accessSync('.env');
        log('✅ .env file found', 'green');
    } catch {
        log('⚠️  .env file not found - using default values', 'yellow');
        log('💡 Create .env file from config.env.example for custom configuration', 'dim');
    }

    await checkMySQLData();
    await checkMongoDBData();

    separator('Data Check Complete');
    log('🎉 All checks completed successfully!', 'bright');
    log('💡 Tips:', 'cyan');
    log('   - Use MySQL commands for detailed book/user management', 'dim');
    log('   - Use MongoDB queries for reading analytics and behavior', 'dim');
    log('   - Check DATA-CHECK-GUIDE.md for manual query examples', 'dim');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    log('\n👋 Exiting data check...', 'yellow');
    process.exit(0);
});

// Run the script
main().catch(error => {
    log(`❌ Fatal error: ${error.message}`, 'red');
    process.exit(1);
});
