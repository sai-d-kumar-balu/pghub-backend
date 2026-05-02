const express = require("express");
const {
  createPg,
  addBed,
  searchPgs,
  getPgDetails,
  blockBed,
  updateBedStatus,
} = require("../controllers/pgController");
const { uploadPgImages, servePgImage, multerErrorMessage } = require("../controllers/pgImagesController");
const { uploadPgImagesArray } = require("../middleware/pgImageUpload");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/search", searchPgs);
router.get("/:pgId/images/serve/:fileId", servePgImage);
router.post(
  "/:pgId/images",
  requireAuth,
  requireRole("OWNER", "ADMIN"),
  (req, res, next) => {
    uploadPgImagesArray(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: multerErrorMessage(err) });
      }
      return next();
    });
  },
  uploadPgImages
);
router.get("/:pgId", getPgDetails);
router.post("/", requireAuth, requireRole("OWNER", "ADMIN"), createPg);
router.post("/:pgId/beds", requireAuth, requireRole("OWNER", "ADMIN"), addBed);
router.post("/beds/:bedId/block", requireAuth, requireRole("USER", "OWNER", "ADMIN"), blockBed);
router.patch(
  "/beds/:bedId/status",
  requireAuth,
  requireRole("OWNER", "ADMIN"),
  updateBedStatus
);

module.exports = router;
