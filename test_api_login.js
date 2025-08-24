#!/usr/bin/env node

// Smart Library Platform - Test API Login
const http = require('http');

async function testLoginAPI() {
    console.log('🔍 Testing Login API Endpoint');
    console.log('==============================\n');
    
    const loginData = {
        username: 'thinh',
        password: '12345678'
    };
    
    const postData = JSON.stringify(loginData);
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            console.log(`📡 Status: ${res.statusCode}`);
            console.log(`📋 Headers: ${JSON.stringify(res.headers, null, 2)}`);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    console.log(`📄 Response: ${JSON.stringify(response, null, 2)}`);
                    
                    if (res.statusCode === 200) {
                        console.log('✅ Login successful!');
                        console.log(`🎫 Token: ${response.token ? response.token.substring(0, 50) + '...' : 'No token'}`);
                    } else {
                        console.log('❌ Login failed');
                    }
                    
                    resolve(response);
                } catch (error) {
                    console.log('❌ Error parsing response:', error);
                    console.log('📄 Raw response:', data);
                    reject(error);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('❌ Request error:', error);
            reject(error);
        });
        
        req.write(postData);
        req.end();
    });
}

async function testBooksAPI() {
    console.log('\n📚 Testing Books API Endpoint');
    console.log('==============================\n');
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/books?limit=3',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            console.log(`📡 Status: ${res.statusCode}`);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    console.log(`📄 Response: ${JSON.stringify(response, null, 2)}`);
                    
                    if (res.statusCode === 200) {
                        console.log('✅ Books API working!');
                    } else {
                        console.log('❌ Books API failed');
                    }
                    
                    resolve(response);
                } catch (error) {
                    console.log('❌ Error parsing response:', error);
                    console.log('📄 Raw response:', data);
                    reject(error);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('❌ Request error:', error);
            reject(error);
        });
        
        req.end();
    });
}

async function main() {
    console.log('🚀 Testing Smart Library API Endpoints');
    console.log('======================================\n');
    
    try {
        // Test login
        await testLoginAPI();
        
        // Test books API
        await testBooksAPI();
        
        console.log('\n🎯 Summary:');
        console.log('===========');
        console.log('✅ API endpoints are accessible');
        console.log('✅ Login should work with:');
        console.log('   Username: thinh');
        console.log('   Password: 12345678');
        console.log('\n🌐 You can now:');
        console.log('1. Open http://localhost:3000 in your browser');
        console.log('2. Login with the credentials above');
        console.log('3. Bootstrap should now load properly');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

main();
