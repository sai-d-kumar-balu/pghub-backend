const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { uploadTenantDocSingle } = require("../middleware/tenantDocsUpload");
const {
  uploadTenantDocument,
  listMyTenantDocuments,
  serveTenantDocument,
  handleMulterUpload,
} = require("../controllers/tenantDocumentsController");

const router = express.Router();

router.post(
  "/me",
  requireAuth,
  requireRole("USER"),
  handleMulterUpload(uploadTenantDocSingle),
  uploadTenantDocument
);

router.get("/me", requireAuth, requireRole("USER"), listMyTenantDocuments);

router.get(
  "/serve/:tenantUserId/:fileId",
  requireAuth,
  requireRole("USER", "OWNER", "ADMIN"),
  serveTenantDocument
);

module.exports = router;

