const mongoose = require("mongoose");
const { MongoClient } = require("mongodb");
const env = require("./env");

// Direct MongoDB client for serverless compatibility
let directClient = null;
let directDb = null;

// Centralized connection management
class ConnectionManager {
  constructor() {
    this.isConnected = false;
    this.connectionPromise = null;
    this.useDirectClient = false;
  }

  async getConnection() {
    // For serverless, use direct MongoDB client to avoid Mongoose buffering
    if (this.useDirectClient || process.env.NODE_ENV === 'production') {
      return await this.getDirectConnection();
    }

    // If already connected, return existing connection
    if (this.isConnected && mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    // If connection is in progress, return existing promise
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // Create new connection promise
    this.connectionPromise = this.establishConnection();
    return this.connectionPromise;
  }

  async getDirectConnection() {
    if (directClient && directDb) {
      return { client: directClient, db: directDb };
    }

    try {
      directClient = new MongoClient(env.mongoUri, {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        maxPoolSize: 1,
        minPoolSize: 0,
        maxIdleTimeMS: 30000,
      });

      await directClient.connect();
      directDb = directClient.db();
      
      return { client: directClient, db: directDb };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Direct MongoDB connection failed:", error.message);
      throw error;
    }
  }

  async establishConnection() {
    try {
      await mongoose.connect(env.mongoUri, {
        serverSelectionTimeoutMS: 30000, // Increase to 30 seconds
        socketTimeoutMS: 45000, // Increase socket timeout to 45 seconds
        bufferCommands: false, // Disable mongoose buffering
        maxPoolSize: 1, // Reduce pool size for serverless
        minPoolSize: 0, // No minimum connections for serverless
        maxIdleTimeMS: 30000, // Close idle connections quickly
      });
      
      this.isConnected = true;
      // eslint-disable-next-line no-console
      console.log("MongoDB connected");
      
      // Set up connection event handlers
      mongoose.connection.on('disconnected', () => {
        this.isConnected = false;
        this.connectionPromise = null;
        // eslint-disable-next-line no-console
        console.log('MongoDB disconnected');
      });
      
      mongoose.connection.on('error', (err) => {
        this.isConnected = false;
        this.connectionPromise = null;
        // eslint-disable-next-line no-console
        console.error('MongoDB connection error:', err);
      });

      return mongoose.connection;
    } catch (error) {
      this.isConnected = false;
      this.connectionPromise = null;
      // eslint-disable-next-line no-console
      console.error("MongoDB connection failed:", error.message);
      throw error;
    }
  }

  async ensureConnection() {
    try {
      const connection = await this.getConnection();
      return connection;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to ensure database connection:", error.message);
      
      // Reset connection state and retry once
      this.isConnected = false;
      this.connectionPromise = null;
      
      try {
        // Retry connection with shorter timeout for serverless
        await this.establishConnection();
        return mongoose.connection;
      } catch (retryError) {
        // eslint-disable-next-line no-console
        console.error("Connection retry failed:", retryError.message);
        throw retryError;
      }
    }
  }

  getConnectionStatus() {
    return {
      readyState: mongoose.connection.readyState,
      isConnected: this.isConnected,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    };
  }
}

// Create singleton instance
const connectionManager = new ConnectionManager();

// Legacy function for backward compatibility
async function connectDB() {
  return connectionManager.ensureConnection();
}

module.exports = {
  connectDB,
  getConnection: () => connectionManager.getConnection(),
  ensureConnection: () => connectionManager.ensureConnection(),
  getConnectionStatus: () => connectionManager.getConnectionStatus(),
  getDirectConnection: () => connectionManager.getDirectConnection()
};
