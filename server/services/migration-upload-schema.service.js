import { db } from "../db.js";

let ensured = false;

export function ensureMigrationUploadSchema() {
  if (ensured) return;
  db.prepare(`
    CREATE TABLE IF NOT EXISTS migration_uploads (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      fileName TEXT NOT NULL,
      originalFileName TEXT NOT NULL,
      extension TEXT DEFAULT '',
      mimeType TEXT DEFAULT '',
      sizeBytes INTEGER NOT NULL DEFAULT 0,
      sha256 TEXT NOT NULL,
      storagePath TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'stored',
      purpose TEXT NOT NULL DEFAULT 'source',
      createdBy TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `).run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_migration_uploads_tenant_created ON migration_uploads (tenantId, createdAt DESC)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_migration_uploads_tenant_status ON migration_uploads (tenantId, status)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_migration_uploads_tenant_sha ON migration_uploads (tenantId, sha256)").run();
  db.prepare(`
    CREATE TABLE IF NOT EXISTS migration_upload_sessions (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      originalFileName TEXT NOT NULL,
      extension TEXT DEFAULT '',
      mimeType TEXT DEFAULT '',
      sizeBytes INTEGER NOT NULL DEFAULT 0,
      expectedSha256 TEXT DEFAULT '',
      receivedBytes INTEGER NOT NULL DEFAULT 0,
      totalParts INTEGER NOT NULL DEFAULT 0,
      receivedParts INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      purpose TEXT NOT NULL DEFAULT 'source',
      tempDir TEXT NOT NULL,
      uploadRef TEXT DEFAULT '',
      createdBy TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      completedAt TEXT DEFAULT ''
    )
  `).run();
  db.prepare(`
    CREATE TABLE IF NOT EXISTS migration_upload_parts (
      sessionId TEXT NOT NULL,
      tenantId TEXT NOT NULL,
      partNumber INTEGER NOT NULL,
      sizeBytes INTEGER NOT NULL DEFAULT 0,
      sha256 TEXT NOT NULL,
      storagePath TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      PRIMARY KEY (sessionId, partNumber)
    )
  `).run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_migration_upload_sessions_tenant_status ON migration_upload_sessions (tenantId, status, createdAt DESC)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_migration_upload_parts_tenant_session ON migration_upload_parts (tenantId, sessionId)").run();
  ensured = true;
}
