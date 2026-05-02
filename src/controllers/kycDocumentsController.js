const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");
const OwnerProfile = require("../models/OwnerProfile");
const User = require("../models/User");
const { UPLOAD_ROOT } = require("../middleware/kycUpload");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const KINDS = new Set(["PAN", "AADHAAR", "BANK_PROOF", "OTHER"]);

function multerErrorMessage(err) {
  if (!err) return "Upload failed";
  if (err.code === "LIMIT_FILE_SIZE") return "File too large (max 8MB)";
  return err.message || "Upload failed";
}

async function auditUpload(req, ownerUserId, fileId, kind) {
  await AuditLog.create({
    actorUserId: req.user.userId,
    actorRole: req.user.role,
    entityType: "KycDocument",
    entityId: fileId,
    action: "KYC_DOCUMENT_UPLOAD",
    before: null,
    after: { ownerUserId, kind },
  });
}

function setOwnerContext(req, res, next) {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }
  req.kycOwnerUserId = userId;
  return next();
}

function setOwnerSelfContext(req, res, next) {
  req.kycOwnerUserId = req.user.userId;
  return next();
}

async function uploadKycAdmin(req, res) {
  try {
    if (!req.file || !req.kycUploadMeta) {
      return res.status(400).json({ message: "file field required (multipart)" });
    }
    const kind = String(req.body.kind || "").toUpperCase();
    if (!KINDS.has(kind)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_e) {
        /* ignore */
      }
      return res.status(400).json({ message: "kind must be PAN, AADHAAR, BANK_PROOF, or OTHER" });
    }

    const owner = await User.findById(req.kycOwnerUserId);
    if (!owner || owner.role !== "OWNER") {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_e) {
        /* ignore */
      }
      return res.status(404).json({ message: "Owner not found" });
    }

    let profile = await OwnerProfile.findOne({ userId: req.kycOwnerUserId });
    if (!profile) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_e) {
        /* ignore */
      }
      return res.status(404).json({ message: "Owner profile not found — create profile first" });
    }

    const { fileId, storedFilename, originalName, mimeType } = req.kycUploadMeta;
    const doc = {
      fileId,
      kind,
      originalName,
      storedFilename,
      mimeType,
      size: req.file.size,
      uploadedAt: new Date(),
    };

    profile.kycDocuments.push(doc);
    await profile.save();
    await auditUpload(req, req.kycOwnerUserId, fileId, kind);

    return res.status(201).json({ message: "Uploaded", document: doc });
  } catch (error) {
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_e) {
        /* ignore */
      }
    }
    return res.status(500).json({ message: multerErrorMessage(error), error: error.message });
  }
}

async function uploadKycOwner(req, res) {
  try {
    if (!req.file || !req.kycUploadMeta) {
      return res.status(400).json({ message: "file field required (multipart)" });
    }
    const kind = String(req.body.kind || "").toUpperCase();
    if (!KINDS.has(kind)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_e) {
        /* ignore */
      }
      return res.status(400).json({ message: "kind must be PAN, AADHAAR, BANK_PROOF, or OTHER" });
    }

    const profile = await OwnerProfile.findOne({ userId: req.user.userId });
    if (!profile) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_e) {
        /* ignore */
      }
      return res.status(404).json({ message: "Owner profile not found" });
    }

    const { fileId, storedFilename, originalName, mimeType } = req.kycUploadMeta;
    const doc = {
      fileId,
      kind,
      originalName,
      storedFilename,
      mimeType,
      size: req.file.size,
      uploadedAt: new Date(),
    };

    profile.kycDocuments.push(doc);
    await profile.save();
    await auditUpload(req, req.user.userId, fileId, kind);

    return res.status(201).json({ message: "Uploaded", document: doc });
  } catch (error) {
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_e) {
        /* ignore */
      }
    }
    return res.status(500).json({ message: multerErrorMessage(error), error: error.message });
  }
}

async function serveKycDocument(req, res) {
  try {
    const { ownerUserId, fileId } = req.params;
    if (!mongoose.isValidObjectId(ownerUserId) || !UUID_RE.test(fileId)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    if (req.user.role === "OWNER" && String(req.user.userId) !== String(ownerUserId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const profile = await OwnerProfile.findOne({ userId: ownerUserId }).lean();
    if (!profile) {
      return res.status(404).json({ message: "Not found" });
    }

    const doc = (profile.kycDocuments || []).find((d) => d.fileId === fileId);
    if (!doc) {
      return res.status(404).json({ message: "File not found" });
    }

    if (
      !doc.storedFilename ||
      doc.storedFilename.includes("..") ||
      path.isAbsolute(doc.storedFilename)
    ) {
      return res.status(400).json({ message: "Invalid stored file" });
    }

    const rootResolved = path.resolve(path.join(UPLOAD_ROOT, ownerUserId));
    const filePath = path.resolve(path.join(UPLOAD_ROOT, ownerUserId, doc.storedFilename));
    if (filePath !== rootResolved && !filePath.startsWith(rootResolved + path.sep)) {
      return res.status(400).json({ message: "Invalid path" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Missing on disk" });
    }

    res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.originalName || doc.storedFilename)}"`);
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
  setOwnerContext,
  setOwnerSelfContext,
  uploadKycAdmin,
  uploadKycOwner,
  serveKycDocument,
  handleMulterUpload,
};
