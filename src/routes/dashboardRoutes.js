const express = require("express");
const {
  getAdminDashboard,
  getOwnerDashboard,
  getUserDashboard,
} = require("../controllers/dashboardController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/owner", requireAuth, requireRole("OWNER", "ADMIN"), getOwnerDashboard);
router.get("/admin", requireAuth, requireRole("ADMIN"), getAdminDashboard);
router.get("/user", requireAuth, requireRole("USER", "OWNER", "ADMIN"), getUserDashboard);

module.exports = router;
