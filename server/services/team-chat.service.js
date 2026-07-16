import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { repositories } from "../repositories/repository-registry.js";
import { can } from "../middleware/rbac.js";
import { badRequest, forbidden, notFound } from "../utils/app-error.js";
import { realtimeService } from "./realtime.service.js";
import { ensureTeamChatSchema } from "./team-chat-schema.service.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${randomUUID().slice(0, 10)}`;

function branchIdFor(access) {
  const branchId = access.requestedBranchId || access.branchId || "";
  if (!branchId) throw badRequest("Branch context is required for team chat");
  return branchId;
}

function currentUser(access) {
  const user = db.prepare(`SELECT id, name, role, staffId FROM tenant_users
    WHERE tenantId = @tenantId AND id = @userId AND status = 'active'`).get({
    tenantId: access.tenantId,
    userId: access.userId
  });
  if (!user) throw notFound("Active chat user not found");
  return user;
}

function ensureTeamThread(tenantId, branchId, userId) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS staffChatThreads (
      id TEXT PRIMARY KEY, tenantId TEXT NOT NULL, branchId TEXT NOT NULL, title TEXT NOT NULL,
      channel TEXT DEFAULT 'branch', createdBy TEXT DEFAULT '', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS staffChatMessages (
      id TEXT PRIMARY KEY, tenantId TEXT NOT NULL, branchId TEXT NOT NULL, threadId TEXT NOT NULL,
      senderStaffId TEXT NOT NULL, senderName TEXT DEFAULT '', body TEXT NOT NULL, createdAt TEXT NOT NULL,
      readByJson TEXT DEFAULT '[]'
    );
  `);
  const existing = db.prepare(`SELECT * FROM staffChatThreads
    WHERE tenantId = @tenantId AND branchId = @branchId AND channel = 'branch'
    ORDER BY createdAt ASC LIMIT 1`).get({ tenantId, branchId });
  if (existing) return existing;
  const createdAt = now();
  const row = {
    id: makeId("thread"), tenantId, branchId, title: "Branch Team Chat", channel: "branch",
    createdBy: userId, createdAt, updatedAt: createdAt
  };
  db.prepare(`INSERT INTO staffChatThreads
    (id, tenantId, branchId, title, channel, createdBy, createdAt, updatedAt)
    VALUES (@id, @tenantId, @branchId, @title, @channel, @createdBy, @createdAt, @updatedAt)`).run(row);
  return row;
}

function privateConversation(conversationId, access, branchId) {
  return db.prepare(`SELECT c.* FROM staffPrivateConversations c
    WHERE c.id = @conversationId AND c.tenantId = @tenantId AND c.branchId = @branchId
      AND EXISTS (
        SELECT 1 FROM staffPrivateConversationParticipants p
        WHERE p.tenantId = c.tenantId AND p.branchId = c.branchId
          AND p.conversationId = c.id AND p.userId = @userId
      )`).get({ conversationId, tenantId: access.tenantId, branchId, userId: access.userId });
}

function participantIds(conversationId, tenantId, branchId) {
  return db.prepare(`SELECT userId FROM staffPrivateConversationParticipants
    WHERE tenantId = @tenantId AND branchId = @branchId AND conversationId = @conversationId
    ORDER BY participantRole DESC, userId ASC`).all({ tenantId, branchId, conversationId }).map((row) => row.userId);
}

function conversationScope(conversationId, access) {
  const branchId = branchIdFor(access);
  const team = ensureTeamThread(access.tenantId, branchId, access.userId);
  if (conversationId === team.id) return { branchId, type: "team", participantUserIds: null };
  if (!privateConversation(conversationId, access, branchId)) throw notFound("Conversation not found");
  return { branchId, type: "private-owner", participantUserIds: participantIds(conversationId, access.tenantId, branchId) };
}

function withReceiptSummaries(messages, access, branchId, conversationId) {
  const receipts = db.prepare(`SELECT messageId,
      SUM(CASE WHEN deliveredAt != '' THEN 1 ELSE 0 END) AS deliveredCount,
      SUM(CASE WHEN readAt != '' THEN 1 ELSE 0 END) AS readCount
    FROM staffChatMessageReceipts
    WHERE tenantId = @tenantId AND branchId = @branchId AND conversationId = @conversationId
    GROUP BY messageId`).all({ tenantId: access.tenantId, branchId, conversationId });
  const byMessage = new Map(receipts.map((receipt) => [receipt.messageId, {
    deliveredCount: Number(receipt.deliveredCount || 0),
    readCount: Number(receipt.readCount || 0)
  }]));
  return messages.map((message) => ({ ...message, receipt: byMessage.get(message.id) || { deliveredCount: 0, readCount: 0 } }));
}

function broadcastConversationEvent(type, payload, access, scope) {
  if (scope.type === "private-owner") {
    realtimeService.sendToUsers(type, payload, { tenantId: access.tenantId, branchId: scope.branchId, userIds: scope.participantUserIds });
    return;
  }
  realtimeService.broadcast(type, payload, { tenantId: access.tenantId, branchId: scope.branchId });
}

function broadcastTyping(payload, access, scope) {
  if (scope.type === "private-owner") {
    realtimeService.sendToUsers("team-chat.typing", payload, { tenantId: access.tenantId, branchId: scope.branchId, userIds: scope.participantUserIds });
    return;
  }
  realtimeService.sendToBranch("team-chat.typing", payload, { tenantId: access.tenantId, branchId: scope.branchId });
}

function privateTitle(row, tenantId, viewerUserId) {
  if (viewerUserId !== row.ownerUserId) return "Owner chat";
  const staff = db.prepare(`SELECT name FROM tenant_users
    WHERE tenantId = @tenantId AND id = @staffUserId AND status = 'active'`).get({
      tenantId,
      staffUserId: row.staffUserId
    });
  return staff?.name ? `${staff.name} · Private` : "Staff conversation · Private";
}

function presentPrivate(row, participantUserIds, tenantId, viewerUserId, messageCount = 0, lastMessageAt = "") {
  return {
    id: row.id,
    type: "private-owner",
    title: privateTitle(row, tenantId, viewerUserId),
    branchId: row.branchId,
    participantUserIds,
    messageCount: Number(messageCount || 0),
    lastMessageAt: lastMessageAt || "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function auditMessage(row, access, type) {
  repositories.auditLogs.create({
    id: makeId("audit"),
    branchId: row.branchId,
    actorUserId: access.userId,
    action: "staff.team_chat_message_sent",
    entityType: type === "team" ? "staffChatMessages" : "staffPrivateChatMessages",
    entityId: row.id,
    severity: "info",
    details: { conversationId: row.conversationId || row.threadId, conversationType: type }
  }, { tenantId: access.tenantId });
}

export const teamChatService = {
  listConversations(access) {
    ensureTeamChatSchema();
    const branchId = branchIdFor(access);
    const team = ensureTeamThread(access.tenantId, branchId, access.userId);
    const teamStats = db.prepare(`SELECT COUNT(*) AS messageCount, MAX(createdAt) AS lastMessageAt
      FROM staffChatMessages WHERE tenantId = @tenantId AND branchId = @branchId AND threadId = @threadId`)
      .get({ tenantId: access.tenantId, branchId, threadId: team.id });
    const privateRows = db.prepare(`SELECT c.*, COUNT(m.id) AS messageCount, MAX(m.createdAt) AS lastMessageAt
      FROM staffPrivateConversations c
      JOIN staffPrivateConversationParticipants p
        ON p.tenantId = c.tenantId AND p.branchId = c.branchId AND p.conversationId = c.id
      LEFT JOIN staffPrivateChatMessages m
        ON m.tenantId = c.tenantId AND m.branchId = c.branchId AND m.conversationId = c.id
      WHERE c.tenantId = @tenantId AND c.branchId = @branchId AND p.userId = @userId
      GROUP BY c.id ORDER BY COALESCE(MAX(m.createdAt), c.updatedAt) DESC`).all({
        tenantId: access.tenantId, branchId, userId: access.userId
      });
    return [{
      id: team.id,
      type: "team",
      title: "Team chat",
      branchId,
      participantUserIds: null,
      messageCount: Number(teamStats.messageCount || 0),
      lastMessageAt: teamStats.lastMessageAt || "",
      createdAt: team.createdAt,
      updatedAt: team.updatedAt
    }, ...privateRows.map((row) => presentPrivate(
      row,
      participantIds(row.id, access.tenantId, branchId),
      access.tenantId,
      access.userId,
      row.messageCount,
      row.lastMessageAt
    ))];
  },

  getOrCreatePrivateOwner(access) {
    ensureTeamChatSchema();
    const branchId = branchIdFor(access);
    const user = currentUser(access);
    if (String(user.role).toLowerCase() === "owner") throw badRequest("Owner cannot create a private conversation with self");
    const owner = db.prepare(`SELECT id, name FROM tenant_users
      WHERE tenantId = @tenantId AND lower(role) = 'owner' AND status = 'active'
      ORDER BY createdAt ASC, id ASC LIMIT 1`).get({ tenantId: access.tenantId });
    if (!owner) throw notFound("Active owner not found");

    const create = db.transaction(() => {
      const existing = db.prepare(`SELECT * FROM staffPrivateConversations
        WHERE tenantId = @tenantId AND branchId = @branchId AND staffUserId = @staffUserId AND ownerUserId = @ownerUserId`)
        .get({ tenantId: access.tenantId, branchId, staffUserId: user.id, ownerUserId: owner.id });
      if (existing) return existing;
      const createdAt = now();
      const row = {
        id: makeId("private_chat"), tenantId: access.tenantId, branchId,
        staffUserId: user.id, ownerUserId: owner.id, createdAt, updatedAt: createdAt
      };
      db.prepare(`INSERT INTO staffPrivateConversations
        (id, tenantId, branchId, staffUserId, ownerUserId, createdAt, updatedAt)
        VALUES (@id, @tenantId, @branchId, @staffUserId, @ownerUserId, @createdAt, @updatedAt)`).run(row);
      const insertParticipant = db.prepare(`INSERT INTO staffPrivateConversationParticipants
        (id, tenantId, branchId, conversationId, userId, participantRole, createdAt)
        VALUES (@id, @tenantId, @branchId, @conversationId, @userId, @participantRole, @createdAt)`);
      insertParticipant.run({ id: makeId("chat_part"), tenantId: access.tenantId, branchId, conversationId: row.id, userId: user.id, participantRole: "staff", createdAt });
      insertParticipant.run({ id: makeId("chat_part"), tenantId: access.tenantId, branchId, conversationId: row.id, userId: owner.id, participantRole: "owner", createdAt });
      return row;
    });
    const row = create();
    return presentPrivate(row, participantIds(row.id, access.tenantId, branchId), access.tenantId, access.userId);
  },

  listMessages(conversationId, access) {
    ensureTeamChatSchema();
    const branchId = branchIdFor(access);
    const team = ensureTeamThread(access.tenantId, branchId, access.userId);
    if (conversationId === team.id) {
      const messages = db.prepare(`SELECT * FROM (SELECT m.id, m.threadId AS conversationId, 'team' AS type,
        COALESCE((SELECT u.id FROM tenant_users u WHERE u.tenantId = m.tenantId
          AND (u.staffId = m.senderStaffId OR u.id = m.senderStaffId) ORDER BY u.id LIMIT 1), m.senderStaffId) AS senderUserId,
        m.senderName, m.body, m.createdAt
        FROM staffChatMessages m
        WHERE m.tenantId = @tenantId AND m.branchId = @branchId AND m.threadId = @conversationId
        ORDER BY m.createdAt DESC LIMIT 200) ORDER BY createdAt ASC`).all({ tenantId: access.tenantId, branchId, conversationId });
      return withReceiptSummaries(messages, access, branchId, conversationId);
    }
    if (!privateConversation(conversationId, access, branchId)) throw notFound("Conversation not found");
    const messages = db.prepare(`SELECT * FROM (SELECT id, conversationId, 'private-owner' AS type, senderUserId, senderName, body, createdAt
      FROM staffPrivateChatMessages
      WHERE tenantId = @tenantId AND branchId = @branchId AND conversationId = @conversationId
      ORDER BY createdAt DESC LIMIT 200) ORDER BY createdAt ASC`).all({ tenantId: access.tenantId, branchId, conversationId });
    return withReceiptSummaries(messages, access, branchId, conversationId);
  },

  sendMessage(conversationId, payload, access) {
    ensureTeamChatSchema();
    const branchId = branchIdFor(access);
    const user = currentUser(access);
    const body = String(payload.body || payload.message || "").trim();
    if (!body) throw badRequest("Message body is required");
    if (body.length > 4000) throw badRequest("Message body must be 4000 characters or fewer");
    const team = ensureTeamThread(access.tenantId, branchId, access.userId);
    if (conversationId === team.id) {
      const row = {
        id: makeId("msg"), tenantId: access.tenantId, branchId, threadId: team.id,
        senderStaffId: user.staffId || user.id, senderName: user.name || "Staff", body,
        createdAt: now(), readByJson: JSON.stringify([user.staffId || user.id])
      };
      db.prepare(`INSERT INTO staffChatMessages
        (id, tenantId, branchId, threadId, senderStaffId, senderName, body, createdAt, readByJson)
        VALUES (@id, @tenantId, @branchId, @threadId, @senderStaffId, @senderName, @body, @createdAt, @readByJson)`).run(row);
      db.prepare(`UPDATE staffChatThreads SET updatedAt = @updatedAt
        WHERE id = @threadId AND tenantId = @tenantId AND branchId = @branchId`)
        .run({ updatedAt: row.createdAt, threadId: team.id, tenantId: access.tenantId, branchId });
      const message = { id: row.id, conversationId: team.id, type: "team", senderUserId: user.id, senderName: row.senderName, body, createdAt: row.createdAt, receipt: { deliveredCount: 0, readCount: 0 } };
      auditMessage({ ...row, conversationId: team.id }, access, "team");
      realtimeService.broadcast("staff-self.chat_message", { message }, { tenantId: access.tenantId, branchId });
      return message;
    }

    const conversation = privateConversation(conversationId, access, branchId);
    if (!conversation) throw notFound("Conversation not found");
    const row = {
      id: makeId("private_msg"), tenantId: access.tenantId, branchId, conversationId,
      senderUserId: user.id, senderName: user.name || "Staff", body, createdAt: now()
    };
    db.prepare(`INSERT INTO staffPrivateChatMessages
      (id, tenantId, branchId, conversationId, senderUserId, senderName, body, createdAt)
      VALUES (@id, @tenantId, @branchId, @conversationId, @senderUserId, @senderName, @body, @createdAt)`).run(row);
    db.prepare(`UPDATE staffPrivateConversations SET updatedAt = @updatedAt
      WHERE id = @conversationId AND tenantId = @tenantId AND branchId = @branchId`)
      .run({ updatedAt: row.createdAt, conversationId, tenantId: access.tenantId, branchId });
    const message = { id: row.id, conversationId, type: "private-owner", senderUserId: user.id, senderName: row.senderName, body, createdAt: row.createdAt, receipt: { deliveredCount: 0, readCount: 0 } };
    auditMessage(row, access, "private-owner");
    realtimeService.sendToUsers("team-chat.private-message", { message }, {
      tenantId: access.tenantId,
      branchId,
      userIds: participantIds(conversationId, access.tenantId, branchId)
    });
    return message;
  },

  markReceipts(conversationId, payload = {}, access) {
    ensureTeamChatSchema();
    const scope = conversationScope(conversationId, access);
    const status = String(payload.status || "").toLowerCase();
    const messageIds = [...new Set(Array.isArray(payload.messageIds) ? payload.messageIds.map(String).filter((id) => id && id.length <= 200) : [])];
    if (!["delivered", "read"].includes(status)) throw badRequest("Receipt status must be delivered or read");
    if (!messageIds.length || messageIds.length > 200) throw badRequest("Between 1 and 200 message IDs are required");

    const findMessage = scope.type === "team"
      ? db.prepare(`SELECT m.id, m.senderStaffId, COALESCE((SELECT u.id FROM tenant_users u WHERE u.tenantId = m.tenantId
          AND (u.staffId = m.senderStaffId OR u.id = m.senderStaffId) ORDER BY u.id LIMIT 1), m.senderStaffId) AS senderUserId
        FROM staffChatMessages m WHERE m.id = @messageId AND m.tenantId = @tenantId AND m.branchId = @branchId AND m.threadId = @conversationId`)
      : db.prepare(`SELECT id, senderUserId FROM staffPrivateChatMessages
        WHERE id = @messageId AND tenantId = @tenantId AND branchId = @branchId AND conversationId = @conversationId`);
    const timestamp = now();
    const findReceipt = db.prepare(`SELECT deliveredAt, readAt FROM staffChatMessageReceipts
      WHERE tenantId = @tenantId AND branchId = @branchId AND conversationId = @conversationId
        AND messageId = @messageId AND userId = @userId`);
    const upsert = db.prepare(`INSERT INTO staffChatMessageReceipts
        (id, tenantId, branchId, conversationId, messageId, userId, deliveredAt, readAt, createdAt, updatedAt)
      VALUES (@id, @tenantId, @branchId, @conversationId, @messageId, @userId, @deliveredAt, @readAt, @createdAt, @updatedAt)
      ON CONFLICT(tenantId, branchId, conversationId, messageId, userId) DO UPDATE SET
        deliveredAt = CASE WHEN staffChatMessageReceipts.deliveredAt = '' THEN excluded.deliveredAt ELSE staffChatMessageReceipts.deliveredAt END,
        readAt = CASE WHEN staffChatMessageReceipts.readAt = '' AND excluded.readAt != '' THEN excluded.readAt ELSE staffChatMessageReceipts.readAt END,
        updatedAt = CASE WHEN staffChatMessageReceipts.readAt = '' AND excluded.readAt != '' THEN excluded.updatedAt ELSE staffChatMessageReceipts.updatedAt END`);
    const mark = db.transaction(() => {
      const acceptedIds = [];
      const advancedIds = [];
      for (const messageId of messageIds) {
        const message = findMessage.get({ messageId, tenantId: access.tenantId, branchId: scope.branchId, conversationId });
        const isTeamSelf = scope.type === "team" && ((access.staffId && message?.senderStaffId === access.staffId) || message?.senderUserId === access.userId);
        if (!message || (scope.type === "private-owner" ? message.senderUserId === access.userId : isTeamSelf)) continue;
        acceptedIds.push(messageId);
        const existing = findReceipt.get({
          tenantId: access.tenantId, branchId: scope.branchId, conversationId, messageId, userId: access.userId
        });
        const advances = !existing || !existing.deliveredAt || (status === "read" && !existing.readAt);
        if (!advances) continue;
        upsert.run({
          id: makeId("chat_receipt"), tenantId: access.tenantId, branchId: scope.branchId, conversationId,
          messageId, userId: access.userId, deliveredAt: timestamp, readAt: status === "read" ? timestamp : "",
          createdAt: timestamp, updatedAt: timestamp
        });
        advancedIds.push(messageId);
      }
      return { acceptedIds, advancedIds };
    });
    const { acceptedIds, advancedIds } = mark();
    const rows = withReceiptSummaries(acceptedIds.map((id) => ({ id })), access, scope.branchId, conversationId)
      .map((message) => ({ messageId: message.id, ...message.receipt }));
    const advanced = new Set(advancedIds);
    const advancedRows = rows.filter((row) => advanced.has(row.messageId));
    if (advancedRows.length) broadcastConversationEvent("team-chat.receipt-updated", { conversationId, receipts: advancedRows }, access, scope);
    return { conversationId, receipts: rows };
  },

  publishTyping(payload = {}, access) {
    ensureTeamChatSchema();
    if (!can(access.role, "write", "appointments", access)) throw forbidden("Chat send permission denied");
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || Object.getPrototypeOf(payload) !== Object.prototype) throw badRequest("Typing payload must be an object");
    const conversationId = typeof payload.conversationId === "string" ? payload.conversationId.trim() : "";
    if (!conversationId || conversationId.length > 200) throw badRequest("Conversation ID must be between 1 and 200 characters");
    if (typeof payload.typing !== "boolean") throw badRequest("Typing status must be boolean");
    const scope = conversationScope(conversationId, access);
    const user = currentUser(access);
    broadcastTyping({
      conversationId,
      userId: user.id,
      name: user.name || "Team member",
      typing: payload.typing === true
    }, access, scope);
  }
};

realtimeService.registerTeamChatCommandHandler((payload, access) => teamChatService.publishTyping(payload, access));
