const app = require("../src/app");

// Don't initialize database connection here
// Let it initialize lazily when needed

// Export the Express app for Vercel
module.exports = app;
