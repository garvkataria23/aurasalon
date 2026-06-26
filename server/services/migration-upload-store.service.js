import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { dataDir, db } from "../db.js";

const ALLOWED_EXTENSIONS = new Set([".csv", ".xls", ".xlsx", ".zip"]);
const MAX_UPLOAD_BYTES = Number(process.env.MIGRATION_UPLOAD_MAX_BYTES || 180 * 1024 * 1024);
const ROOT_DIR = resolve(dataDir, "migration-uploads");

const now = () => new Date().toISOString();

export const migrationUploadStore = {
  store(payload = {}, access = {}) {
    if (!payload.fileBase64) throw badRequest("fileBase64 is required for migration upload.");
    return this.storeBuffer({
      ...payload,
      buffer: decodeBase64(payload.fileBase64)
    }, access);
  },

  storeBuffer(payload = {}, access = {}) {
    const originalFileName = safeFileName(payload.fileName || payload.originalFileName || "migration-source");
    const extension = extname(originalFileName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw badRequest("Migration upload must be a CSV, Excel, or ZIP file.");
    }
    const buffer = Buffer.isBuffer(payload.buffer) ? payload.buffer : Buffer.from(payload.buffer || []);
    if (!buffer.length) throw badRequest("Migration upload file is empty.");
    if (buffer.length > MAX_UPLOAD_BYTES) throw badRequest("Migration upload exceeds the maximum allowed size.");

    const id = `mgu_${randomUUID().slice(0, 12)}`;
    const tenantId = cleanSegment(access.tenantId || "default");
    const dateFolder = now().slice(0, 10);
    const dir = resolve(ROOT_DIR, tenantId, dateFolder);
    if (!dir.startsWith(ROOT_DIR)) throw badRequest("Invalid migration upload path.");
    mkdirSync(dir, { recursive: true });

    const fileName = `${id}${extension}`;
    const storagePath = resolve(dir, fileName);
    if (!storagePath.startsWith(ROOT_DIR)) throw badRequest("Invalid migration upload path.");
    writeFileSync(storagePath, buffer, { flag: "wx" });

    const row = {
      id,
      tenantId: access.tenantId || "default",
      branchId: access.branchId || "",
      fileName,
      originalFileName,
      extension: extension.slice(1),
      mimeType: cleanText(payload.mimeType || ""),
      sizeBytes: buffer.length,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      storagePath,
      status: "stored",
      purpose: cleanText(payload.purpose || "source") || "source",
      createdBy: access.userId || "system",
      createdAt: now(),
      updatedAt: now()
    };
    db.prepare(`
      INSERT INTO migration_uploads
        (id, tenantId, branchId, fileName, originalFileName, extension, mimeType, sizeBytes, sha256, storagePath, status, purpose, createdBy, createdAt, updatedAt)
      VALUES
        (@id, @tenantId, @branchId, @fileName, @originalFileName, @extension, @mimeType, @sizeBytes, @sha256, @storagePath, @status, @purpose, @createdBy, @createdAt, @updatedAt)
    `).run(row);
    return publicUpload(row);
  },

  createSession(payload = {}, access = {}) {
    const originalFileName = safeFileName(payload.fileName || payload.originalFileName || "migration-source");
    const extension = extname(originalFileName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) throw badRequest("Migration upload must be a CSV, Excel, or ZIP file.");
    const sizeBytes = Number(payload.sizeBytes || 0);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) throw badRequest("Migration upload size is required.");
    if (sizeBytes > MAX_UPLOAD_BYTES) throw badRequest("Migration upload exceeds the maximum allowed size.");

    const id = `mgu_sess_${randomUUID().slice(0, 12)}`;
    const tenantId = cleanSegment(access.tenantId || "default");
    const tempDir = resolve(ROOT_DIR, tenantId, "sessions", id);
    if (!tempDir.startsWith(ROOT_DIR)) throw badRequest("Invalid migration upload session path.");
    mkdirSync(tempDir, { recursive: true });

    const row = {
      id,
      tenantId: access.tenantId || "default",
      branchId: access.branchId || "",
      originalFileName,
      extension: extension.slice(1),
      mimeType: cleanText(payload.mimeType || ""),
      sizeBytes,
      expectedSha256: cleanText(payload.sha256 || payload.expectedSha256 || "").toLowerCase(),
      receivedBytes: 0,
      totalParts: Math.max(1, Number(payload.totalParts || 0)),
      receivedParts: 0,
      status: "open",
      purpose: cleanText(payload.purpose || "source") || "source",
      tempDir,
      uploadRef: "",
      createdBy: access.userId || "system",
      createdAt: now(),
      updatedAt: now(),
      completedAt: ""
    };
    db.prepare(`
      INSERT INTO migration_upload_sessions
        (id, tenantId, branchId, originalFileName, extension, mimeType, sizeBytes, expectedSha256, receivedBytes, totalParts, receivedParts, status, purpose, tempDir, uploadRef, createdBy, createdAt, updatedAt, completedAt)
      VALUES
        (@id, @tenantId, @branchId, @originalFileName, @extension, @mimeType, @sizeBytes, @expectedSha256, @receivedBytes, @totalParts, @receivedParts, @status, @purpose, @tempDir, @uploadRef, @createdBy, @createdAt, @updatedAt, @completedAt)
    `).run(row);
    return publicSession(row);
  },

  storeSessionPart(sessionId, partNumber, payload = {}, access = {}) {
    const session = sessionForWrite(sessionId, access);
    const numericPart = Number(partNumber);
    if (!Number.isInteger(numericPart) || numericPart < 1) throw badRequest("Migration upload part number is invalid.");
    const buffer = Buffer.isBuffer(payload.buffer) ? payload.buffer : Buffer.from(payload.buffer || []);
    if (!buffer.length) throw badRequest("Migration upload part is empty.");

    const storagePath = resolve(session.tempDir, `part-${String(numericPart).padStart(6, "0")}.bin`);
    if (!storagePath.startsWith(resolve(session.tempDir))) throw badRequest("Invalid migration upload part path.");
    writeFileSync(storagePath, buffer);
    const row = {
      sessionId: session.id,
      tenantId: access.tenantId || "default",
      partNumber: numericPart,
      sizeBytes: buffer.length,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      storagePath,
      createdAt: now()
    };
    db.prepare(`
      INSERT INTO migration_upload_parts (sessionId, tenantId, partNumber, sizeBytes, sha256, storagePath, createdAt)
      VALUES (@sessionId, @tenantId, @partNumber, @sizeBytes, @sha256, @storagePath, @createdAt)
      ON CONFLICT(sessionId, partNumber) DO UPDATE SET
        sizeBytes = excluded.sizeBytes,
        sha256 = excluded.sha256,
        storagePath = excluded.storagePath,
        createdAt = excluded.createdAt
    `).run(row);
    refreshSessionProgress(session.id, access);
    const updated = sessionById(session.id, access);
    return { ...publicSession(updated), partNumber: numericPart, partSha256: row.sha256, partSizeBytes: row.sizeBytes };
  },

  sessions(query = {}, access = {}) {
    const status = cleanText(query.status || "");
    const params = { tenantId: access.tenantId || "default", limit: Math.max(1, Math.min(100, Number(query.limit || 25))) };
    const statusWhere = status ? "AND status = @status" : "";
    if (status) params.status = status;
    return db.prepare(`
      SELECT * FROM migration_upload_sessions
      WHERE tenantId = @tenantId ${statusWhere}
      ORDER BY updatedAt DESC, createdAt DESC
      LIMIT @limit
    `).all(params).map((row) => withSessionParts(row, access));
  },

  session(sessionId, access = {}) {
    const row = sessionById(sessionId, access);
    if (!row) throw badRequest("Migration upload session not found.");
    return withSessionParts(row, access);
  },
  completeSession(sessionId, payload = {}, access = {}) {
    const session = sessionForWrite(sessionId, access);
    const parts = db.prepare("SELECT * FROM migration_upload_parts WHERE sessionId = @sessionId AND tenantId = @tenantId ORDER BY partNumber ASC").all({
      sessionId: session.id,
      tenantId: access.tenantId || "default"
    });
    if (!parts.length) throw badRequest("Migration upload session has no uploaded parts.");
    if (session.totalParts && parts.length < Number(session.totalParts)) throw badRequest("Migration upload session is missing parts.");

    const buffers = parts.map((part, index) => {
      if (Number(part.partNumber) !== index + 1) throw badRequest("Migration upload parts must be contiguous.");
      const storagePath = resolve(part.storagePath);
      if (!storagePath.startsWith(resolve(session.tempDir)) || !existsSync(storagePath)) throw badRequest("Migration upload part is unavailable.");
      const buffer = readFileSync(storagePath);
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      if (sha256 !== part.sha256) throw badRequest("Migration upload part integrity check failed.");
      return buffer;
    });
    const buffer = Buffer.concat(buffers);
    if (buffer.length !== Number(session.sizeBytes || 0)) throw badRequest("Migration upload size does not match the session manifest.");
    const actualSha256 = createHash("sha256").update(buffer).digest("hex");
    const expectedSha256 = cleanText(payload.sha256 || session.expectedSha256 || "").toLowerCase();
    if (expectedSha256 && expectedSha256 !== actualSha256) throw badRequest("Migration upload SHA-256 does not match the session manifest.");

    const upload = this.storeBuffer({
      fileName: session.originalFileName,
      mimeType: session.mimeType,
      purpose: session.purpose,
      buffer
    }, access);
    db.prepare(`
      UPDATE migration_upload_sessions
      SET status = 'completed', uploadRef = @uploadRef, receivedBytes = @receivedBytes, receivedParts = @receivedParts, updatedAt = @updatedAt, completedAt = @completedAt
      WHERE id = @id AND tenantId = @tenantId
    `).run({
      id: session.id,
      tenantId: access.tenantId || "default",
      uploadRef: upload.fileRef,
      receivedBytes: buffer.length,
      receivedParts: parts.length,
      updatedAt: now(),
      completedAt: now()
    });
    return { ...upload, sessionId: session.id, uploadedParts: parts.length };
  },
  read(fileRef, access = {}) {
    const id = cleanText(fileRef);
    if (!id) throw badRequest("fileRef is required.");
    const row = db.prepare("SELECT * FROM migration_uploads WHERE id = @id AND tenantId = @tenantId AND status = 'stored'").get({
      id,
      tenantId: access.tenantId || "default"
    });
    if (!row) throw badRequest("Migration upload not found.");
    const storagePath = resolve(row.storagePath);
    if (!storagePath.startsWith(ROOT_DIR) || !existsSync(storagePath)) throw badRequest("Migration upload file is unavailable.");
    const buffer = readFileSync(storagePath);
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    if (sha256 !== row.sha256) throw badRequest("Migration upload integrity check failed.");
    return { ...publicUpload(row), buffer };
  }
};

function sessionById(sessionId, access = {}) {
  const id = cleanText(sessionId);
  if (!id) throw badRequest("Migration upload session is required.");
  return db.prepare("SELECT * FROM migration_upload_sessions WHERE id = @id AND tenantId = @tenantId").get({
    id,
    tenantId: access.tenantId || "default"
  });
}

function sessionForWrite(sessionId, access = {}) {
  const session = sessionById(sessionId, access);
  if (!session) throw badRequest("Migration upload session not found.");
  if (session.status !== "open") throw badRequest("Migration upload session is not open.");
  const tempDir = resolve(session.tempDir);
  if (!tempDir.startsWith(ROOT_DIR)) throw badRequest("Invalid migration upload session path.");
  mkdirSync(tempDir, { recursive: true });
  return { ...session, tempDir };
}

function refreshSessionProgress(sessionId, access = {}) {
  const totals = db.prepare(`
    SELECT COUNT(*) AS receivedParts, COALESCE(SUM(sizeBytes), 0) AS receivedBytes
    FROM migration_upload_parts
    WHERE sessionId = @sessionId AND tenantId = @tenantId
  `).get({ sessionId, tenantId: access.tenantId || "default" });
  db.prepare(`
    UPDATE migration_upload_sessions
    SET receivedParts = @receivedParts, receivedBytes = @receivedBytes, updatedAt = @updatedAt
    WHERE id = @sessionId AND tenantId = @tenantId
  `).run({
    sessionId,
    tenantId: access.tenantId || "default",
    receivedParts: Number(totals?.receivedParts || 0),
    receivedBytes: Number(totals?.receivedBytes || 0),
    updatedAt: now()
  });
}

function withSessionParts(row = {}, access = {}) {
  const parts = db.prepare(`
    SELECT partNumber, sizeBytes, sha256, createdAt
    FROM migration_upload_parts
    WHERE sessionId = @sessionId AND tenantId = @tenantId
    ORDER BY partNumber ASC
  `).all({ sessionId: row.id, tenantId: access.tenantId || "default" });
  const received = new Set(parts.map((part) => Number(part.partNumber)));
  const totalParts = Number(row.totalParts || 0);
  const missingParts = [];
  for (let index = 1; index <= totalParts; index += 1) {
    if (!received.has(index)) missingParts.push(index);
  }
  return { ...publicSession(row), parts, missingParts, resumeAvailable: row.status === "open" && missingParts.length > 0 };
}
function publicSession(row = {}) {
  return {
    sessionId: row.id,
    fileName: row.originalFileName,
    extension: row.extension,
    sizeBytes: Number(row.sizeBytes || 0),
    expectedSha256: row.expectedSha256 || "",
    receivedBytes: Number(row.receivedBytes || 0),
    totalParts: Number(row.totalParts || 0),
    receivedParts: Number(row.receivedParts || 0),
    status: row.status,
    uploadRef: row.uploadRef || "",
    purpose: row.purpose,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
function publicUpload(row) {
  return {
    fileRef: row.id,
    fileName: row.originalFileName,
    storedFileName: row.fileName,
    extension: row.extension,
    sizeBytes: Number(row.sizeBytes || 0),
    sha256: row.sha256,
    status: row.status,
    purpose: row.purpose,
    createdAt: row.createdAt
  };
}

function decodeBase64(value) {
  const source = String(value || "");
  const base64 = source.includes(",") ? source.split(",").pop() : source;
  return Buffer.from(base64, "base64");
}

function safeFileName(value) {
  const name = basename(String(value || "migration-source").replace(/\\/g, "/")).trim();
  return name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 160) || "migration-source";
}

function cleanSegment(value) {
  return String(value || "default").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "default";
}

function cleanText(value) {
  return String(value || "").trim();
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

