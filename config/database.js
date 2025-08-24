// Smart Library Platform - Database Configuration
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
require('dotenv').config();

// MySQL Connection Pool Configuration
const mysqlConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'library_user',
    password: process.env.DB_PASSWORD || 'library_password',
    database: process.env.DB_NAME || 'smart_library',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    // Enable multiple statements for stored procedures
    multipleStatements: true,
    // Timezone configuration
    timezone: 'Z',
    // Character set
    charset: 'utf8mb4',
    // Additional MySQL 8.4 compatibility options
    supportBigNumbers: true,
    bigNumberStrings: true
};

// Create MySQL connection pool
const mysqlPool = mysql.createPool(mysqlConfig);

// MongoDB Connection Configuration
const mongodbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_library_nosql';
let mongoClient = null;
let mongoDb = null;

// Initialize MongoDB connection
async function initializeMongoDB() {
    try {
        if (!mongoClient) {
            mongoClient = new MongoClient(mongodbUri, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                maxIdleTimeMS: 30000
            });
            
            await mongoClient.connect();
            mongoDb = mongoClient.db();
            console.log('Connected to MongoDB successfully');
        }
        return mongoDb;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

// Get MySQL connection from pool
async function getMySQLConnection() {
    try {
        const connection = await mysqlPool.getConnection();
        return connection;
    } catch (error) {
        console.error('MySQL connection error:', error);
        throw error;
    }
}

// Get MongoDB database instance
async function getMongoDatabase() {
    if (!mongoDb) {
        await initializeMongoDB();
    }
    return mongoDb;
}

// Test database connections
async function testConnections() {
    try {
        // Test MySQL connection
        const mysqlConnection = await getMySQLConnection();
        await mysqlConnection.execute('SELECT 1');
        mysqlConnection.release();
        console.log('MySQL connection test successful');

        // Test MongoDB connection
        const mongodb = await getMongoDatabase();
        await mongodb.admin().ping();
        console.log('MongoDB connection test successful');

        return { mysql: true, mongodb: true };
    } catch (error) {
        console.error('Database connection test failed:', error);
        return { mysql: false, mongodb: false };
    }
}

// Close all database connections
async function closeConnections() {
    try {
        // Close MySQL pool
        await mysqlPool.end();
        console.log('MySQL pool closed');

        // Close MongoDB connection
        if (mongoClient) {
            await mongoClient.close();
            mongoClient = null;
            mongoDb = null;
            console.log('MongoDB connection closed');
        }
    } catch (error) {
        console.error('Error closing database connections:', error);
    }
}

// MySQL transaction helper
async function executeTransaction(queries) {
    const connection = await getMySQLConnection();
    try {
        await connection.beginTransaction();
        
        const results = [];
        for (const query of queries) {
            const [result] = await connection.execute(query.sql, query.params || []);
            results.push(result);
        }
        
        await connection.commit();
        return results;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// MySQL stored procedure helper
async function callStoredProcedure(procedureName, params = []) {
    const connection = await getMySQLConnection();
    try {
        const placeholders = params.map(() => '?').join(', ');
        const sql = `CALL ${procedureName}(${placeholders})`;
        const [results] = await connection.execute(sql, params);
        return results;
    } finally {
        connection.release();
    }
}

// MySQL function helper
async function callFunction(functionName, params = []) {
    const connection = await getMySQLConnection();
    try {
        const placeholders = params.map(() => '?').join(', ');
        const sql = `SELECT ${functionName}(${placeholders}) as result`;
        const [rows] = await connection.execute(sql, params);
        return rows[0]?.result;
    } finally {
        connection.release();
    }
}

// MongoDB aggregation helper
async function executeAggregation(collectionName, pipeline) {
    try {
        const mongodb = await getMongoDatabase();
        const collection = mongodb.collection(collectionName);
        const cursor = collection.aggregate(pipeline);
        return await cursor.toArray();
    } catch (error) {
        console.error('MongoDB aggregation error:', error);
        throw error;
    }
}

// MongoDB document operations helper
class MongoOperations {
    constructor(collectionName) {
        this.collectionName = collectionName;
    }

    async getCollection() {
        const mongodb = await getMongoDatabase();
        return mongodb.collection(this.collectionName);
    }

    async findOne(query, options = {}) {
        const collection = await this.getCollection();
        return await collection.findOne(query, options);
    }

    async find(query, options = {}) {
        const collection = await this.getCollection();
        const cursor = collection.find(query, options);
        return await cursor.toArray();
    }

    async insertOne(document) {
        const collection = await this.getCollection();
        return await collection.insertOne(document);
    }

    async insertMany(documents) {
        const collection = await this.getCollection();
        return await collection.insertMany(documents);
    }

    async updateOne(filter, update, options = {}) {
        const collection = await this.getCollection();
        return await collection.updateOne(filter, update, options);
    }

    async updateMany(filter, update, options = {}) {
        const collection = await this.getCollection();
        return await collection.updateMany(filter, update, options);
    }

    async deleteOne(filter) {
        const collection = await this.getCollection();
        return await collection.deleteOne(filter);
    }

    async deleteMany(filter) {
        const collection = await this.getCollection();
        return await collection.deleteMany(filter);
    }

    async countDocuments(filter = {}) {
        const collection = await this.getCollection();
        return await collection.countDocuments(filter);
    }
}

// Error handling middleware for database operations
function handleDatabaseError(error) {
    console.error('Database operation error:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
        return {
            type: 'DUPLICATE_ENTRY',
            message: 'A record with this information already exists',
            details: error.message
        };
    }
    
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return {
            type: 'FOREIGN_KEY_CONSTRAINT',
            message: 'Referenced record does not exist',
            details: error.message
        };
    }
    
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        return {
            type: 'CONSTRAINT_VIOLATION',
            message: 'Cannot delete record because it is referenced by other records',
            details: error.message
        };
    }
    
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
        return {
            type: 'MONGODB_ERROR',
            message: 'MongoDB operation failed',
            details: error.message
        };
    }
    
    return {
        type: 'DATABASE_ERROR',
        message: 'Database operation failed',
        details: error.message
    };
}

// Health check for databases
async function healthCheck() {
    const health = {
        mysql: { status: 'unknown', latency: null, error: null },
        mongodb: { status: 'unknown', latency: null, error: null },
        timestamp: new Date().toISOString()
    };

    // MySQL health check
    try {
        const start = Date.now();
        const connection = await getMySQLConnection();
        await connection.execute('SELECT 1');
        connection.release();
        health.mysql.status = 'healthy';
        health.mysql.latency = Date.now() - start;
    } catch (error) {
        health.mysql.status = 'unhealthy';
        health.mysql.error = error.message;
    }

    // MongoDB health check
    try {
        const start = Date.now();
        const mongodb = await getMongoDatabase();
        await mongodb.admin().ping();
        health.mongodb.status = 'healthy';
        health.mongodb.latency = Date.now() - start;
    } catch (error) {
        health.mongodb.status = 'unhealthy';
        health.mongodb.error = error.message;
    }

    return health;
}

module.exports = {
    // Connection functions
    getMySQLConnection,
    getMongoDatabase,
    initializeMongoDB,
    testConnections,
    closeConnections,
    
    // Operation helpers
    executeTransaction,
    callStoredProcedure,
    callFunction,
    executeAggregation,
    MongoOperations,
    
    // Utility functions
    handleDatabaseError,
    healthCheck,
    
    // Direct pool access (use sparingly)
    mysqlPool
};
