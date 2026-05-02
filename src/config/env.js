const dotenv = require("dotenv");

dotenv.config();

const env = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/pghub",
  jwtSecret: process.env.JWT_SECRET || "change-this-secret",
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
};

module.exports = env;
