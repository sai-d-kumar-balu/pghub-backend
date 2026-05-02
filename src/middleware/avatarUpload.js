const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const AVATAR_ROOT = path.join(__dirname, "..", "..", "uploads", "avatars");

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function ensureUserDir(userId) {
  const dir = path.join(AVATAR_ROOT, String(userId));
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
      cb(null, ensureUserDir(userId));
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
    req.avatarUploadMeta = {
      fileId,
      storedFilename,
      mimeType: file.mimetype || "",
      originalName: file.originalname || "avatar",
    };
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
  limits: { fileSize: 3 * 1024 * 1024 },
});

module.exports = {
  AVATAR_ROOT,
  uploadAvatarSingle: upload.single("file"),
};

