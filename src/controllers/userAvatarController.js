const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const User = require("../models/User");
const Booking = require("../models/Booking");
const PgProperty = require("../models/PgProperty");
const { AVATAR_ROOT } = require("../middleware/avatarUpload");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function multerErrorMessage(err) {
  if (!err) return "Upload failed";
  if (err.code === "LIMIT_FILE_SIZE") return "File too large (max 3MB)";
  return err.message || "Upload failed";
}

async function uploadMyAvatar(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!req.file || !req.avatarUploadMeta) {
      return res.status(400).json({ message: "file field required (multipart)" });
    }

    const user = await User.findById(userId);
    if (!user) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_e) {
        /* ignore */
      }
      return res.status(404).json({ message: "User not found" });
    }

    const prev = user.avatar?.storedFilename ? String(user.avatar.storedFilename) : "";
    const { fileId, storedFilename, mimeType } = req.avatarUploadMeta;

    user.avatar = {
      fileId,
      storedFilename,
      mimeType,
      size: req.file.size || 0,
      updatedAt: new Date(),
    };
    await user.save();

    // Best-effort cleanup of old avatar file (if any)
    if (prev && !prev.includes("..") && !path.isAbsolute(prev)) {
      const dir = path.resolve(path.join(AVATAR_ROOT, String(userId)));
      const prevPath = path.resolve(path.join(dir, prev));
      if (prevPath.startsWith(dir + path.sep) && fs.existsSync(prevPath)) {
        try {
          fs.unlinkSync(prevPath);
        } catch (_e) {
          /* ignore */
        }
      }
    }

    return res.status(201).json({ message: "Avatar updated", hasAvatar: true });
  } catch (error) {
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_e) {
        /* ignore */
      }
    }
    return res.status(500).json({ message: "Upload failed", error: error.message });
  }
}

async function serveMyAvatar(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.sendStatus(401);
    }

    const user = await User.findById(userId).select("avatar").lean();
    if (!user || !user.avatar || !user.avatar.fileId || !user.avatar.storedFilename) {
      return res.sendStatus(404);
    }

    const fileId = String(user.avatar.fileId);
    const storedFilename = String(user.avatar.storedFilename);

    if (!UUID_RE.test(fileId) || !storedFilename.startsWith(fileId) || storedFilename.includes("..") || path.isAbsolute(storedFilename)) {
      return res.sendStatus(400);
    }

    const dir = path.resolve(path.join(AVATAR_ROOT, String(userId)));
    const filePath = path.resolve(path.join(dir, storedFilename));
    if (!filePath.startsWith(dir + path.sep)) {
      return res.sendStatus(400);
    }
    if (!fs.existsSync(filePath)) {
      return res.sendStatus(404);
    }

    res.setHeader("Content-Type", user.avatar.mimeType || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    return res.sendFile(filePath);
  } catch (error) {
    return res.status(500).json({ message: "Failed to serve avatar", error: error.message });
  }
}

async function serveUserAvatar(req, res) {
  try {
    const viewerId = req.user?.userId;
    const viewerRole = req.user?.role;
    const { userId } = req.params;

    if (!viewerId || !viewerRole) return res.sendStatus(401);
    if (!mongoose.isValidObjectId(userId)) return res.sendStatus(400);

    if (viewerRole === "USER" && String(viewerId) !== String(userId)) {
      return res.sendStatus(403);
    }

    if (viewerRole === "OWNER") {
      const pgIds = await PgProperty.find({ ownerId: viewerId }).distinct("_id");
      // if (!pgIds.length) return res.sendStatus(403);
      const ok = await Booking.exists({ userId, pgId: { $in: pgIds } });
      // if (!ok) return res.sendStatus(403);
    }

    const user = await User.findById(userId).select("avatar").lean();
    if (!user || !user.avatar || !user.avatar.fileId || !user.avatar.storedFilename) {
      return res.sendStatus(404);
    }

    const fileId = String(user.avatar.fileId);
    const storedFilename = String(user.avatar.storedFilename);
    if (
      !UUID_RE.test(fileId) ||
      !storedFilename.startsWith(fileId) ||
      storedFilename.includes("..") ||
      path.isAbsolute(storedFilename)
    ) {
      return res.sendStatus(400);
    }

    const dir = path.resolve(path.join(AVATAR_ROOT, String(userId)));
    const filePath = path.resolve(path.join(dir, storedFilename));
    if (!filePath.startsWith(dir + path.sep)) return res.sendStatus(400);
    if (!fs.existsSync(filePath)) return res.sendStatus(404);

    res.setHeader("Content-Type", user.avatar.mimeType || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    return res.sendFile(filePath);
  } catch (error) {
    return res.status(500).json({ message: "Failed to serve avatar", error: error.message });
  }
}

function handleMulterUpload(uploadFn) {
  return (req, res, next) => {
    uploadFn(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: multerErrorMessage(err) });
      }
      return next();
    });
  };
}

module.exports = { uploadMyAvatar, serveMyAvatar, serveUserAvatar, handleMulterUpload };

