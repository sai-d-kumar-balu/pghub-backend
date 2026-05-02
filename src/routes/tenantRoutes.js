const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  patchTenantProfile,
  changeTenantPassword,
  listTenantBookings,
  getTenantBooking,
  listTenantPayments,
  listTenantTickets,
  getTenantTicket,
  createTenantTicket,
  listTenantPgContext,
} = require("../controllers/tenantController");

const router = express.Router();

router.use(requireAuth, requireRole("USER"));

router.patch("/profile", patchTenantProfile);
router.post("/account/password", changeTenantPassword);

router.get("/bookings", listTenantBookings);
router.get("/bookings/:bookingId", getTenantBooking);

router.get("/payments", listTenantPayments);

router.get("/tickets", listTenantTickets);
router.get("/tickets/:ticketId", getTenantTicket);
router.post("/tickets", createTenantTicket);

router.get("/context/pgs", listTenantPgContext);

module.exports = router;
