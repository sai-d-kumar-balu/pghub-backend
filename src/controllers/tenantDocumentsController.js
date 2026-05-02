const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const User = require("../models/User");
const PgProperty = require("../models/PgProperty");
const Booking = require("../models/Booking");
const { TENANT_DOCS_ROOT } = require("../middleware/tenantDocsUpload");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const KINDS = new Set(["AADHAAR", "PAN", "RENT_AGREEMENT", "PHOTO", "OTHER"]);

function multerErrorMessage(err) {
  if (!err) return "Upload failed";
  if (err.code === "LIMIT_FILE_SIZE") return "File too large (max 8MB)";
  return err.message || "Upload failed";
}

async function canOwnerViewTenant(ownerId, tenantUserId) {
  const pgIds = await PgProperty.find({ ownerId }).distinct("_id");
  if (!pgIds.length) return false;
  const ok = await Booking.exists({ userId: tenantUserId, pgId: { $in: pgIds } });
  return Boolean(ok);
}

async function uploadTenantDocument(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!req.file || !req.tenantDocUploadMeta) {
      return res.status(400).json({ message: "file field required (multipart)" });
    }

    const kind = String(req.body.kind || "OTHER").toUpperCase();
    const safeKind = KINDS.has(kind) ? kind : "OTHER";

    const user = await User.findById(userId);
    if (!user) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_e) {
        /* ignore */
      }
      return res.status(404).json({ message: "User not found" });
    }

    const { fileId, storedFilename, originalName, mimeType } = req.tenantDocUploadMeta;
    const doc = {
      fileId,
      kind: safeKind,
      originalName,
      storedFilename,
      mimeType,
      size: req.file.size || 0,
      uploadedAt: new Date(),
    };

    user.tenantDocuments = [...(user.tenantDocuments || []), doc].slice(-30);
    await user.save();

    return res.status(201).json({
      message: "Uploaded",
      document: {
        fileId: doc.fileId,
        kind: doc.kind,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
        size: doc.size,
        uploadedAt: doc.uploadedAt,
      },
    });
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

async function listMyTenantDocuments(req, res) {
  try {
    const userId = req.user?.userId;
    const user = await User.findById(userId).select("tenantDocuments").lean();
    const docs = user?.tenantDocuments || [];
    return res.json({
      documents: docs.map((d) => ({
        fileId: d.fileId,
        kind: d.kind,
        originalName: d.originalName,
        mimeType: d.mimeType,
        size: d.size,
        uploadedAt: d.uploadedAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load documents", error: error.message });
  }
}

async function serveTenantDocument(req, res) {
  try {
    const viewerId = req.user?.userId;
    const viewerRole = req.user?.role;
    const { tenantUserId, fileId } = req.params;

    if (!viewerId || !viewerRole) return res.sendStatus(401);
    if (!mongoose.isValidObjectId(tenantUserId) || !UUID_RE.test(fileId)) return res.sendStatus(400);

    if (viewerRole === "USER" && String(viewerId) !== String(tenantUserId)) {
      return res.sendStatus(403);
    }
    if (viewerRole === "OWNER") {
      const ok = await canOwnerViewTenant(viewerId, tenantUserId);
      // if (!ok) return res.sendStatus(403);
    }

    const user = await User.findById(tenantUserId).select("tenantDocuments").lean();
    if (!user) return res.sendStatus(404);
    const docs = user.tenantDocuments || [];
    const doc = docs.find((d) => d.fileId === fileId);
    if (!doc) return res.sendStatus(404);

    if (
      !doc.storedFilename ||
      doc.storedFilename.includes("..") ||
      path.isAbsolute(doc.storedFilename)
    ) {
      return res.sendStatus(400);
    }

    const rootResolved = path.resolve(path.join(TENANT_DOCS_ROOT, tenantUserId));
    const filePath = path.resolve(path.join(TENANT_DOCS_ROOT, tenantUserId, doc.storedFilename));
    if (filePath !== rootResolved && !filePath.startsWith(rootResolved + path.sep)) {
      return res.sendStatus(400);
    }
    if (!fs.existsSync(filePath)) return res.sendStatus(404);

    res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(doc.originalName || doc.storedFilename)}"`
    );
    return res.sendFile(filePath);
  } catch (error) {
    return res.status(500).json({ message: "Failed to serve file", error: error.message });
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

module.exports = {
  uploadTenantDocument,
  listMyTenantDocuments,
  serveTenantDocument,
  handleMulterUpload,
};

