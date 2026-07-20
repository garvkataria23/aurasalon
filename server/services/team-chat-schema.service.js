import { db } from "../db.js";

let schemaReady = false;

export function ensureTeamChatSchema() {
  if (schemaReady) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS staffPrivateConversations (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL,
      staffUserId TEXT NOT NULL,
      ownerUserId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(tenantId, branchId, staffUserId, ownerUserId)
    );
    CREATE TABLE IF NOT EXISTS staffPrivateConversationParticipants (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL,
      conversationId TEXT NOT NULL,
      userId TEXT NOT NULL,
      participantRole TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      UNIQUE(tenantId, branchId, conversationId, userId)
    );
    CREATE TABLE IF NOT EXISTS staffPrivateChatMessages (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL,
      conversationId TEXT NOT NULL,
      senderUserId TEXT NOT NULL,
      senderName TEXT DEFAULT '',
      body TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS staffChatMessageReceipts (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL,
      conversationId TEXT NOT NULL,
      messageId TEXT NOT NULL,
      userId TEXT NOT NULL,
      deliveredAt TEXT NOT NULL DEFAULT '',
      readAt TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(tenantId, branchId, conversationId, messageId, userId)
    );
    CREATE INDEX IF NOT EXISTS idx_staff_private_chat_participant
      ON staffPrivateConversationParticipants(tenantId, branchId, userId, conversationId);
    CREATE INDEX IF NOT EXISTS idx_staff_private_chat_messages
      ON staffPrivateChatMessages(tenantId, branchId, conversationId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_staff_chat_message_receipts
      ON staffChatMessageReceipts(tenantId, branchId, conversationId, messageId, userId);
  `);
  const receiptColumns = new Set(db.prepare("PRAGMA table_info(staffChatMessageReceipts)").all().map((column) => column.name));
  if (!receiptColumns.has("deliveredAt")) db.exec("ALTER TABLE staffChatMessageReceipts ADD COLUMN deliveredAt TEXT NOT NULL DEFAULT ''");
  if (!receiptColumns.has("readAt")) db.exec("ALTER TABLE staffChatMessageReceipts ADD COLUMN readAt TEXT NOT NULL DEFAULT ''");
  db.prepare(`UPDATE staffChatMessageReceipts SET deliveredAt = COALESCE(deliveredAt, ''), readAt = COALESCE(readAt, '')
    WHERE deliveredAt IS NULL OR readAt IS NULL`).run();
  schemaReady = true;
}
