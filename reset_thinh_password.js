const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function resetThinhPassword() {
    console.log('🔧 RESETTING PASSWORD FOR USER "thinh"...\n');
    
    const mysqlConn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '1192004',
        database: 'smart_library'
    });
    
    try {
        // Set a known password for user thinh
        const newPassword = '12345678910';
        const passwordHash = await bcrypt.hash(newPassword, 12);
        
        console.log('🔧 Updating password for user "thinh"...');
        await mysqlConn.execute(
            'UPDATE users SET password_hash = ? WHERE username = ?',
            [passwordHash, 'thinh']
        );
        
        console.log('✅ Password updated successfully!');
        console.log(`   Username: thinh`);
        console.log(`   Password: ${newPassword}`);
        console.log(`   User Type: admin`);
        
        // Verify the update
        const [user] = await mysqlConn.execute(
            'SELECT user_id, username, user_type, is_active FROM users WHERE username = ?',
            ['thinh']
        );
        
        if (user.length > 0) {
            console.log('\n✅ User verification:');
            console.log(`   - ID: ${user[0].user_id}`);
            console.log(`   - Username: ${user[0].username}`);
            console.log(`   - User Type: ${user[0].user_type}`);
            console.log(`   - Active: ${user[0].is_active}`);
        }
        
        console.log('\n🎉 User "thinh" is now ready for login!');
        console.log('   Username: thinh');
        console.log('   Password: 12345678910');
        console.log('   Role: admin');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mysqlConn.end();
    }
}

resetThinhPassword();
