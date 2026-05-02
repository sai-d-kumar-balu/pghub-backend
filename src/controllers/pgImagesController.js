const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { ensureOwnerPg } = require("./ownerController");
const { PG_IMAGES_ROOT } = require("../middleware/pgImageUpload");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EXT_MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function multerErrorMessage(err) {
  if (!err) return "Upload failed";
  if (err.code === "LIMIT_FILE_SIZE") return "Each image must be 6MB or smaller";
  if (err.code === "LIMIT_UNEXPECTED_FILE") return "Unexpected file field (use \"files\")";
  return err.message || "Upload failed";
}

function publicImageUrl(req, pgId, fileId) {
  const host = req.get("host");
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  return `${proto}://${host}/api/pgs/${pgId}/images/serve/${fileId}`;
}

async function uploadPgImages(req, res) {
  try {
    const { pgId } = req.params;
    const { err, pg } = await ensureOwnerPg(req, pgId);
    if (err) {
      return res.status(err.status).json({ message: err.message });
    }

    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ message: "Add image files (field name: files)" });
    }

    const current = Array.isArray(pg.images) ? pg.images.length : 0;
    const maxAdd = 20 - current;
    if (maxAdd <= 0) {
      for (const f of files) {
        try {
          fs.unlinkSync(f.path);
        } catch (_e) {
          /* ignore */
        }
      }
      return res.status(400).json({ message: "Maximum 20 photos per listing" });
    }

    if (files.length > maxAdd) {
      for (const f of files) {
        try {
          fs.unlinkSync(f.path);
        } catch (_e) {
          /* ignore */
        }
      }
      return res.status(400).json({ message: `You can add at most ${maxAdd} more photo(s)` });
    }

    const metas = req.pgImageUploadMetas || [];
    const urls = metas.map((m) => publicImageUrl(req, pgId, m.fileId));
    pg.images = [...(pg.images || []), ...urls];
    await pg.save();

    return res.status(201).json({ message: "Uploaded", urls, images: pg.images });
  } catch (error) {
    if (req.files?.length) {
      for (const f of req.files) {
        try {
          fs.unlinkSync(f.path);
        } catch (_e) {
          /* ignore */
        }
      }
    }
    return res.status(500).json({ message: "Upload failed", error: error.message });
  }
}

async function servePgImage(req, res) {
  try {
    const { pgId, fileId } = req.params;
    if (!mongoose.isValidObjectId(pgId) || !UUID_RE.test(fileId)) {
      return res.sendStatus(400);
    }

    const dir = path.join(PG_IMAGES_ROOT, pgId);
    const rootResolved = path.resolve(dir);
    if (!fs.existsSync(dir)) {
      return res.sendStatus(404);
    }

    const names = fs.readdirSync(dir);
    const name = names.find((f) => f === fileId || f.startsWith(`${fileId}.`));
    if (!name || name.includes("..")) {
      return res.sendStatus(404);
    }

    const filePath = path.resolve(path.join(dir, name));
    if (!filePath.startsWith(rootResolved + path.sep)) {
      return res.sendStatus(400);
    }
    if (!fs.existsSync(filePath)) {
      return res.sendStatus(404);
    }

    const ext = path.extname(name).toLowerCase();
    const mime = EXT_MIME[ext] || "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.sendFile(filePath);
  } catch (error) {
    return res.status(500).json({ message: "Failed to serve image", error: error.message });
  }
}

module.exports = {
  uploadPgImages,
  servePgImage,
  multerErrorMessage,
};
