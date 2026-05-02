const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const PG_IMAGES_ROOT = path.join(__dirname, "..", "..", "uploads", "pg-images");

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function ensurePgDir(pgId) {
  const dir = path.join(PG_IMAGES_ROOT, String(pgId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const pgId = req.params?.pgId;
    if (!pgId) {
      cb(new Error("Missing pg id"));
      return;
    }
    try {
      cb(null, ensurePgDir(pgId));
    } catch (err) {
      cb(err);
    }
  },
  filename(req, file, cb) {
    const rawExt = path.extname(file.originalname || "").toLowerCase();
    const allowedExt = new Set([".jpg", ".jpeg", ".png", ".webp"]);
    const ext = allowedExt.has(rawExt) ? rawExt : ".jpg";
    const fileId = crypto.randomUUID();
    const storedFilename = `${fileId}${ext}`;
    if (!req.pgImageUploadMetas) req.pgImageUploadMetas = [];
    req.pgImageUploadMetas.push({
      fileId,
      storedFilename,
      mimeType: file.mimetype || "",
      originalName: file.originalname || "photo",
    });
    cb(null, storedFilename);
  },
});

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error("Only JPEG, PNG, or WebP images are allowed"));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 6 * 1024 * 1024, files: 12 },
});

module.exports = {
  PG_IMAGES_ROOT,
  uploadPgImagesArray: upload.array("files", 12),
};
