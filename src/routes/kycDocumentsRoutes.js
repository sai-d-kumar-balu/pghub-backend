const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { uploadKycSingle } = require("../middleware/kycUpload");
const {
  setOwnerContext,
  setOwnerSelfContext,
  uploadKycAdmin,
  uploadKycOwner,
  serveKycDocument,
  handleMulterUpload,
} = require("../controllers/kycDocumentsController");

const router = express.Router();

router.post(
  "/admin/:userId",
  requireAuth,
  requireRole("ADMIN"),
  setOwnerContext,
  handleMulterUpload(uploadKycSingle),
  uploadKycAdmin
);

router.post(
  "/owner",
  requireAuth,
  requireRole("OWNER"),
  setOwnerSelfContext,
  handleMulterUpload(uploadKycSingle),
  uploadKycOwner
);

router.get(
  "/serve/:ownerUserId/:fileId",
  requireAuth,
  requireRole("ADMIN", "OWNER"),
  serveKycDocument
);

module.exports = router;
