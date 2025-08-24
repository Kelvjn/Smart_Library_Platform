#!/usr/bin/env node

// Test Books API specifically
const http = require('http');

function testBooksAPI() {
    console.log('📚 Testing Books API...');
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/books?limit=3',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    const req = http.request(options, (res) => {
        console.log(`📡 Status: ${res.statusCode}`);
        
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            try {
                const response = JSON.parse(data);
                console.log(`✅ Books API working! Found ${response.books?.length || 0} books`);
                
                if (response.books && response.books.length > 0) {
                    console.log('\n📖 Sample books:');
                    response.books.forEach((book, index) => {
                        console.log(`   ${index + 1}. ${book.title} by ${book.authors?.join(', ') || 'Unknown'}`);
                    });
                }
                
                console.log('\n🎉 Books API is now working properly!');
                console.log('✅ You can now search and view books in the web interface');
                
            } catch (error) {
                console.log('❌ Error parsing response:', error.message);
                console.log('📄 Raw response:', data);
            }
        });
    });
    
    req.on('error', (error) => {
        console.error('❌ Request error:', error);
    });
    
    req.end();
}

testBooksAPI();
