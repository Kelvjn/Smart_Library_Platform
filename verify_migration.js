const mysql = require('mysql2/promise');

async function verifyMigration() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '1192004',
        database: 'smart_library'
    });

    try {
        console.log('=== VERIFYING AUTHORS TABLE MIGRATION ===\n');

        // Check table structure
        console.log('1. Checking table structure...');
        const [columns] = await connection.execute(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'smart_library' 
            AND TABLE_NAME = 'authors'
            ORDER BY ORDINAL_POSITION
        `);

        console.log('Authors table columns:');
        columns.forEach(col => {
            console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE} ${col.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL'}`);
        });

        // Check data
        console.log('\n2. Checking migrated data...');
        const [authors] = await connection.execute('SELECT * FROM authors ORDER BY author_id');
        
        console.log(`Found ${authors.length} authors:`);
        authors.forEach(author => {
            console.log(`- ID: ${author.author_id}, Name: "${author.name}"`);
        });

        // Check if backup table exists
        console.log('\n3. Checking backup table...');
        const [backupTables] = await connection.execute(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = 'smart_library' 
            AND TABLE_NAME = 'authors_backup'
        `);

        if (backupTables.length > 0) {
            console.log('✅ Backup table exists: authors_backup');
        } else {
            console.log('❌ Backup table not found');
        }

        // Test a query with the new structure
        console.log('\n4. Testing queries with new structure...');
        const [testQuery] = await connection.execute(`
            SELECT 
                b.title,
                GROUP_CONCAT(CONCAT(a.first_name, ' ', a.last_name) ORDER BY ba.author_order SEPARATOR ', ') as authors
            FROM books b
            LEFT JOIN book_authors ba ON b.book_id = ba.book_id
            LEFT JOIN authors a ON ba.author_id = a.author_id
            WHERE b.book_id = 1
            GROUP BY b.book_id
        `);

        if (testQuery.length > 0) {
            console.log('✅ Test query successful:');
            console.log(`Book: "${testQuery[0].title}"`);
            console.log(`Authors: ${testQuery[0].authors}`);
        } else {
            console.log('❌ Test query failed');
        }

        console.log('\n=== MIGRATION VERIFICATION COMPLETED ===');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await connection.end();
    }
}

verifyMigration();
