const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const TENANT_DOCS_ROOT = path.join(__dirname, "..", "..", "uploads", "tenant-docs");

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function ensureTenantDir(userId) {
  const dir = path.join(TENANT_DOCS_ROOT, String(userId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const userId = req.user?.userId;
    if (!userId) {
      cb(new Error("Missing auth context"));
      return;
    }
    try {
      cb(null, ensureTenantDir(userId));
    } catch (err) {
      cb(err);
    }
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase() || "";
    const fileId = crypto.randomUUID();
    const storedFilename = `${fileId}${ext}`;
    req.tenantDocUploadMeta = {
      fileId,
      storedFilename,
      originalName: file.originalname || "document",
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
  TENANT_DOCS_ROOT,
  uploadTenantDocSingle: upload.single("file"),
};

