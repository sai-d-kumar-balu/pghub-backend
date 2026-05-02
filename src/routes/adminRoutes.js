const express = require("express");
const {
  listKycQueue,
  getKycOwnerDetail,
  updateKyc,
  listPropertiesAdmin,
  updatePropertyAdmin,
  listBedsAdmin,
  listInventoryAdmin,
  updateBedAdmin,
  listOwnerCommissions,
  updateOwnerCommission,
  listPaymentsAdmin,
  listDisputes,
  updateTicketAdmin,
  listUsersAdmin,
  getUserAdminDetail,
  updateUserAdmin,
  listAuditLogs,
  getPlatformConfig,
  putPlatformConfig,
  getReports,
} = require("../controllers/adminController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth, requireRole("ADMIN"));

router.get("/kyc", listKycQueue);
router.get("/kyc/:userId", getKycOwnerDetail);
router.patch("/kyc/:userId", updateKyc);

router.get("/properties", listPropertiesAdmin);
router.patch("/properties/:id", updatePropertyAdmin);

router.get("/beds", listBedsAdmin);
router.get("/inventory", listInventoryAdmin);
router.patch("/beds/:id", updateBedAdmin);

router.get("/owners/commission", listOwnerCommissions);
router.patch("/owners/:userId/commission", updateOwnerCommission);

router.get("/payments", listPaymentsAdmin);
router.get("/disputes", listDisputes);
router.patch("/tickets/:id", updateTicketAdmin);

router.get("/users", listUsersAdmin);
router.get("/users/:id", getUserAdminDetail);
router.patch("/users/:id", updateUserAdmin);

router.get("/audit", listAuditLogs);
router.get("/config", getPlatformConfig);
router.put("/config", putPlatformConfig);
router.get("/reports", getReports);

module.exports = router;
