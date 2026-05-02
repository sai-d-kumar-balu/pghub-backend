const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { uploadAvatarSingle } = require("../middleware/avatarUpload");
const { uploadMyAvatar, serveMyAvatar, serveUserAvatar, handleMulterUpload } = require("../controllers/userAvatarController");

const router = express.Router();

router.post(
  "/me/avatar",
  requireAuth,
  requireRole("USER", "OWNER", "ADMIN"),
  handleMulterUpload(uploadAvatarSingle),
  uploadMyAvatar
);

router.get(
  "/me/avatar",
  requireAuth,
  requireRole("USER", "OWNER", "ADMIN"),
  serveMyAvatar
);

router.get(
  "/:userId/avatar",
  requireAuth,
  // requireRole("USER", "OWNER", "ADMIN"),
  serveUserAvatar
);

module.exports = router;

