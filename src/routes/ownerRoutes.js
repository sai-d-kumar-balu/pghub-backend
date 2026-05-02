const express = require("express");
const {
  getOwnerProfile,
  patchOwnerProfile,
  patchOwnerAccount,
  changeOwnerPassword,
  listOwnerProperties,
  getOwnerPropertyDetail,
  updateOwnerProperty,
  listOwnerBookings,
  listOwnerTickets,
  listOwnerPayouts,
  listOwnerTenants,
  getOwnerTenantDetail,
  listOwnerUpcomingMoveIns,
} = require("../controllers/ownerController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth, requireRole("OWNER", "ADMIN"));

router.get("/profile", getOwnerProfile);
router.patch("/profile", patchOwnerProfile);
router.patch("/account", patchOwnerAccount);
router.post("/account/password", changeOwnerPassword);

router.get("/properties", listOwnerProperties);
router.get("/properties/:pgId", getOwnerPropertyDetail);
router.patch("/properties/:pgId", updateOwnerProperty);

router.get("/bookings", listOwnerBookings);
router.get("/tickets", listOwnerTickets);
router.get("/payouts", listOwnerPayouts);
router.get("/tenants", listOwnerTenants);
router.get("/tenants/:userId", getOwnerTenantDetail);
router.get("/upcoming-moveins", listOwnerUpcomingMoveIns);

module.exports = router;
