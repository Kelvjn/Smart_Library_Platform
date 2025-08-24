#!/usr/bin/env node

// Smart Library Platform - Login Test and Debug Script
const { getMySQLConnection } = require('./config/database');
const { hashPassword, comparePassword } = require('./middleware/auth');

async function testLogin() {
    let connection;
    
    try {
        console.log('🔍 Checking existing users in database...');
        connection = await getMySQLConnection();
        
        // Get all users
        const [users] = await connection.execute(
            'SELECT user_id, username, email, first_name, last_name, user_type, is_active FROM users'
        );
        
        console.log('\n👥 Current Users in Database:');
        console.log('=============================');
        if (users.length === 0) {
            console.log('❌ No users found in database!');
            console.log('\n🔧 Let me create test users for you...');
            await createTestUsers(connection);
        } else {
            users.forEach(user => {
                console.log(`👤 ID: ${user.user_id} | Username: ${user.username} | Email: ${user.email}`);
                console.log(`   Name: ${user.first_name} ${user.last_name} | Type: ${user.user_type} | Active: ${user.is_active ? '✅' : '❌'}`);
                console.log('');
            });
        }
        
        // Test login credentials
        console.log('\n🔐 Testing Login Credentials:');
        console.log('=============================');
        
        // Check if we have any users to test with
        const [testUsers] = await connection.execute('SELECT * FROM users LIMIT 3');
        
        if (testUsers.length === 0) {
            console.log('❌ No users available for testing');
            return;
        }
        
        console.log('📋 Available test accounts:');
        testUsers.forEach(user => {
            console.log(`   Username: ${user.username}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Type: ${user.user_type}`);
            console.log('   Password: Use the original password when account was created');
            console.log('');
        });
        
        console.log('💡 Common Login Issues and Solutions:');
        console.log('====================================');
        console.log('1. ❌ Password Issue: Make sure you\'re using the correct password');
        console.log('2. ❌ Username/Email: Use either username OR email (both work)');
        console.log('3. ❌ Account Inactive: Check if user.is_active = TRUE');
        console.log('4. ❌ Rate Limiting: Wait 15 minutes if too many failed attempts');
        console.log('5. ❌ Server Not Running: Make sure "npm start" is running');
        
    } catch (error) {
        console.error('❌ Error testing login:', error);
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

async function createTestUsers(connection) {
    try {
        console.log('🔧 Creating test users with known passwords...');
        
        // Create test users with simple passwords
        const testUsers = [
            {
                username: 'admin',
                email: 'admin@library.com',
                password: 'admin123',
                firstName: 'Admin',
                lastName: 'User',
                userType: 'admin'
            },
            {
                username: 'librarian',
                email: 'librarian@library.com',
                password: 'librarian123',
                firstName: 'Library',
                lastName: 'Staff',
                userType: 'staff'
            },
            {
                username: 'reader',
                email: 'reader@library.com',
                password: 'reader123',
                firstName: 'Regular',
                lastName: 'Reader',
                userType: 'reader'
            }
        ];
        
        for (const user of testUsers) {
            // Hash the password
            const hashedPassword = await hashPassword(user.password);
            
            // Insert user
            await connection.execute(
                `INSERT INTO users (username, email, password_hash, first_name, last_name, user_type, is_active) 
                 VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
                [user.username, user.email, hashedPassword, user.firstName, user.lastName, user.userType]
            );
            
            console.log(`✅ Created user: ${user.username} (password: ${user.password})`);
        }
        
        console.log('\n🎉 Test users created successfully!');
        console.log('\n🔐 You can now login with:');
        console.log('========================');
        testUsers.forEach(user => {
            console.log(`👤 Username: ${user.username}`);
            console.log(`🔑 Password: ${user.password}`);
            console.log(`📧 Email: ${user.email}`);
            console.log(`👥 Type: ${user.userType}`);
            console.log('');
        });
        
    } catch (error) {
        console.error('❌ Error creating test users:', error);
    }
}

// Test a specific login
async function testSpecificLogin(username, password) {
    let connection;
    
    try {
        console.log(`\n🔐 Testing login for: ${username}`);
        connection = await getMySQLConnection();
        
        // Find user
        const [users] = await connection.execute(
            'SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = TRUE',
            [username, username]
        );
        
        if (users.length === 0) {
            console.log('❌ User not found or inactive');
            return false;
        }
        
        const user = users[0];
        console.log(`✅ User found: ${user.first_name} ${user.last_name} (${user.user_type})`);
        
        // Test password
        const isValidPassword = await comparePassword(password, user.password_hash);
        
        if (isValidPassword) {
            console.log('✅ Password is correct!');
            console.log('🎉 Login should work!');
            return true;
        } else {
            console.log('❌ Password is incorrect');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error testing specific login:', error);
        return false;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

// Main execution
async function main() {
    console.log('🚀 Smart Library Login Diagnosis Tool');
    console.log('=====================================\n');
    
    await testLogin();
    
    // You can test specific credentials here
    console.log('\n🧪 Testing specific login (admin/admin123):');
    await testSpecificLogin('admin', 'admin123');
}

main().catch(console.error);
