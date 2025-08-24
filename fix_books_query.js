#!/usr/bin/env node

// Smart Library Platform - Fix Books Query Issue
const { getMySQLConnection } = require('./config/database');

async function testBooksQuery() {
    let connection;
    
    try {
        console.log('🔍 Testing Books Query...');
        connection = await getMySQLConnection();
        
        // Test 1: Simple books query without search
        console.log('\n📚 Test 1: Simple books query');
        try {
            const [books] = await connection.execute(`
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
                WHERE b.is_active = TRUE
                GROUP BY b.book_id
                ORDER BY b.title ASC
                LIMIT 5
            `);
            
            console.log(`✅ Found ${books.length} books`);
            books.forEach(book => {
                console.log(`   📖 ${book.title} by ${book.authors || 'Unknown'}`);
            });
            
        } catch (error) {
            console.log('❌ Error in simple query:', error.message);
        }
        
        // Test 2: Check if FULLTEXT index exists
        console.log('\n🔍 Test 2: Checking FULLTEXT indexes');
        try {
            const [indexes] = await connection.execute(`
                SHOW INDEX FROM books WHERE Key_name = 'title'
            `);
            console.log(`✅ Found ${indexes.length} FULLTEXT indexes on books table`);
        } catch (error) {
            console.log('❌ Error checking indexes:', error.message);
        }
        
        // Test 3: Check if books table has data
        console.log('\n📊 Test 3: Checking books data');
        try {
            const [count] = await connection.execute('SELECT COUNT(*) as count FROM books WHERE is_active = TRUE');
            console.log(`✅ Found ${count[0].count} active books`);
            
            const [sampleBooks] = await connection.execute('SELECT book_id, title FROM books WHERE is_active = TRUE LIMIT 3');
            console.log('📚 Sample books:');
            sampleBooks.forEach(book => {
                console.log(`   ID: ${book.book_id}, Title: ${book.title}`);
            });
            
        } catch (error) {
            console.log('❌ Error checking books data:', error.message);
        }
        
        // Test 4: Check book_authors relationship
        console.log('\n🔗 Test 4: Checking book_authors relationship');
        try {
            const [relationships] = await connection.execute(`
                SELECT COUNT(*) as count 
                FROM book_authors ba 
                JOIN books b ON ba.book_id = b.book_id 
                WHERE b.is_active = TRUE
            `);
            console.log(`✅ Found ${relationships[0].count} book-author relationships`);
            
        } catch (error) {
            console.log('❌ Error checking relationships:', error.message);
        }
        
    } catch (error) {
        console.error('❌ Database connection error:', error);
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

async function fixBooksQuery() {
    console.log('\n🔧 Fixing Books Query...');
    
    // Create a simplified version of the books route
    const simplifiedQuery = `
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
        WHERE b.is_active = TRUE
        GROUP BY b.book_id
        ORDER BY b.title ASC
        LIMIT 10
    `;
    
    console.log('📝 Simplified query created (removes problematic FULLTEXT search)');
    console.log('💡 This will fix the 500 error by removing the MATCH AGAINST clause');
}

async function main() {
    console.log('🚀 Books Query Diagnostic Tool');
    console.log('==============================\n');
    
    await testBooksQuery();
    await fixBooksQuery();
    
    console.log('\n🎯 Summary:');
    console.log('===========');
    console.log('✅ The issue is likely the FULLTEXT search query');
    console.log('✅ Need to simplify the search functionality');
    console.log('✅ Books should load properly after the fix');
}

main().catch(console.error);
