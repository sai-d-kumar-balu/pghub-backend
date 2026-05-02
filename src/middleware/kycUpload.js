const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads", "kyc");

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function ensureOwnerDir(ownerUserId) {
  const dir = path.join(UPLOAD_ROOT, ownerUserId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const ownerUserId = req.kycOwnerUserId;
    if (!ownerUserId) {
      cb(new Error("Missing owner context"));
      return;
    }
    try {
      cb(null, ensureOwnerDir(ownerUserId));
    } catch (err) {
      cb(err);
    }
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || "") || "";
    const fileId = crypto.randomUUID();
    const storedFilename = `${fileId}${ext}`;
    _req.kycUploadMeta = {
      fileId,
      storedFilename,
      ext,
      originalName: file.originalname || "upload",
      mimeType: file.mimetype || "",
    };
    cb(null, storedFilename);
  },
});

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error("Only JPEG, PNG, WebP, or PDF files are allowed"));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 },
});

module.exports = {
  UPLOAD_ROOT,
  uploadKycSingle: upload.single("file"),
  ALLOWED_MIME,
};
