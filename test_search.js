#!/usr/bin/env node

// Test search functionality
const http = require('http');

function testSearch(searchTerm = 'harry') {
    console.log(`🔍 Testing search for: "${searchTerm}"`);
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: `/api/books?search=${encodeURIComponent(searchTerm)}&limit=5`,
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
                console.log(`✅ Search working! Found ${response.books?.length || 0} books`);
                
                if (response.books && response.books.length > 0) {
                    console.log('\n📖 Search results:');
                    response.books.forEach((book, index) => {
                        console.log(`   ${index + 1}. ${book.title} by ${book.authors?.join(', ') || 'Unknown'}`);
                    });
                } else {
                    console.log('📝 No books found for this search term');
                }
                
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

// Test different search terms
console.log('🚀 Testing Search Functionality');
console.log('==============================\n');

testSearch('harry');
