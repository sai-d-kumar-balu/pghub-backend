const express = require("express");
const cors = require("cors");
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

const app = express();

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "pghub-backend" });
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
