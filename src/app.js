const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const env = require("./config/env");
const authRoutes = require("./routes/authRoutes");
const pgRoutes = require("./routes/pgRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const adminRoutes = require("./routes/adminRoutes");
const kycDocumentsRoutes = require("./routes/kycDocumentsRoutes");
const ownerRoutes = require("./routes/ownerRoutes");
const tenantRoutes = require("./routes/tenantRoutes");
const userAvatarRoutes = require("./routes/userAvatarRoutes");
const tenantDocumentsRoutes = require("./routes/tenantDocumentsRoutes");

// Import models
const User = require("./models/User");
const OwnerProfile = require("./models/OwnerProfile");
const PgProperty = require("./models/PgProperty");
const Bed = require("./models/Bed");
const Booking = require("./models/Booking");
const Payment = require("./models/Payment");
const RentCycle = require("./models/RentCycle");
const Ticket = require("./models/Ticket");
const AuditLog = require("./models/AuditLog");
const SavedPaymentMethod = require("./models/SavedPaymentMethod");
const PlatformConfig = require("./models/PlatformConfig");

// Import environment and connection manager
const { ensureConnection, getConnectionStatus } = require("./config/db");

const app = express();

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    // Use centralized connection management
    await ensureConnection();
    const connectionStatus = getConnectionStatus();
    
    let dbStatus = "disconnected";
    let dbConnectionInfo = {};
    
    if (connectionStatus.readyState === 1) {
      dbStatus = "connected";
      dbConnectionInfo = {
        host: connectionStatus.host,
        port: connectionStatus.port,
        name: connectionStatus.name,
        readyState: connectionStatus.readyState
      };
    } else if (connectionStatus.readyState === 2) {
      dbStatus = "connecting";
    } else if (connectionStatus.readyState === 3) {
      dbStatus = "disconnecting";
    }

    res.json({
      status: "ok",
      service: "pghub-backend",
      database: {
        status: dbStatus,
        uri: env.mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'), // Hide credentials
        connectionInfo: dbConnectionInfo,
        readyState: connectionStatus.readyState
      },
      environment: {
        port: env.port,
        clientUrl: env.clientUrl
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      service: "pghub-backend",
      error: error.message
    });
  }
});

app.get("/api/db-test", async (_req, res) => {
  try {
    const startTime = Date.now();
    
    // Use centralized connection management
    await ensureConnection();
    
    // Test database connection with a simple operation
    const testResult = await mongoose.connection.db.admin().ping();
    
    // Test database access and list collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      status: "success",
      message: "Database connection test successful",
      database: {
        status: "connected",
        uri: env.mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'),
        responseTime: `${responseTime}ms`,
        pingResult: testResult,
        connectionInfo: {
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          name: mongoose.connection.name,
          readyState: mongoose.connection.readyState
        },
        collections: collections.map(c => c.name),
        databaseName: mongoose.connection.name
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Database connection test failed",
      error: error.message,
      errorDetails: {
        name: error.name,
        code: error.code,
        codeName: error.codeName,
        timeout: error.timeout,
        message: error.message
      },
      database: {
        status: "disconnected",
        uri: env.mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'),
        readyState: mongoose.connection.readyState
      }
    });
  }
});

app.get("/api/seed-check", async (_req, res) => {
  try {
    // Use centralized connection management
    await ensureConnection();
    
    const startTime = Date.now();
    const userCount = await User.countDocuments();
    const responseTime = Date.now() - startTime;
    
    // Check if the test user exists
    const testUser = await User.findOne({ phone: "9000000003" });
    
    res.json({
      status: "success",
      message: "Database seed check completed",
      database: {
        userCount,
        responseTime: `${responseTime}ms`,
        testUserExists: !!testUser,
        testUser: testUser ? {
          phone: testUser.phone,
          name: testUser.name,
          role: testUser.role
        } : null
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Database seed check failed",
      error: error.message
    });
  }
});

app.get("/api/login-test", async (_req, res) => {
  try {
    // Use centralized connection management
    await ensureConnection();
    
    // Test the exact same query as login
    const startTime = Date.now();
    const user = await User.findOne({ phone: "9000000003" }).maxTimeMS(25000).exec();
    const responseTime = Date.now() - startTime;
    
    res.json({
      status: "success",
      message: "Login query test completed",
      database: {
        userFound: !!user,
        responseTime: `${responseTime}ms`,
        user: user ? {
          phone: user.phone,
          name: user.name,
          role: user.role
        } : null
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Login query test failed",
      error: error.message,
      responseTime: "timeout"
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/pgs", pgRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/kyc-documents", kycDocumentsRoutes);
app.use("/api/owner", ownerRoutes);
app.use("/api/user", tenantRoutes);
app.use("/api/users", userAvatarRoutes);
app.use("/api/tenant-documents", tenantDocumentsRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

module.exports = app;
