import { WebSocketServer, WebSocket } from "ws";
import { repositories } from "../repositories/repository-registry.js";
import { logger } from "../utils/logger.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { authService } from "./auth.service.js";
import { tenantService } from "./tenant.service.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {}, "");
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function parseSocketRequest(request) {
  const url = new URL(request.url || "", "http://localhost");
  const token = url.searchParams.get("token") || "";
  const branchId = url.searchParams.get("branchId") || "";
  return { url, token, branchId };
}

export class RealtimeService {
  constructor() {
    this.clients = new Map();
    this.wss = null;
  }

  attach(server) {
    this.wss = new WebSocketServer({ noServer: true });
    server.on("upgrade", (request, socket, head) => {
      const { url, token, branchId } = parseSocketRequest(request);
      if (!["/ws", "/api/v1/realtime"].includes(url.pathname)) return;
      try {
        const auth = authService.verifyAccessToken(token);
        const requestedBranchId = branchId || auth.branchId || "";
        if (requestedBranchId) tenantService.assertBranchAccess(auth, requestedBranchId);
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.connect(ws, auth, requestedBranchId);
        });
      } catch {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
      }
    });
    logger.info("realtime_started", { paths: ["/ws", "/api/v1/realtime"] });
  }

  connect(ws, auth, branchId = "") {
    const id = makeId("ws");
    const access = {
      tenantId: auth.tenantId,
      role: auth.role,
      userId: auth.sub,
      branchId,
      branchIds: auth.branchIds || [],
      requestedBranchId: branchId,
      deviceId: auth.deviceId || ""
    };
    const channels = new Set([`tenant:${auth.tenantId}`]);
    if (branchId) channels.add(`branch:${branchId}`);
    const client = { id, ws, auth, access, branchId, channels, connectedAt: now() };
    this.clients.set(id, client);
    this.updateStaffPresence({ status: "online", branchId, deviceId: auth.deviceId || "" }, access);
    this.send(ws, "connection.ready", {
      clientId: id,
      channels: [...channels],
      connectedAt: client.connectedAt
    });
    this.broadcast("staff.status", { userId: auth.sub, status: "online", branchId }, {
      tenantId: auth.tenantId,
      branchId,
      channel: branchId ? `branch:${branchId}` : `tenant:${auth.tenantId}`
    });
    ws.on("message", (message) => this.handleMessage(client, message));
    ws.on("close", () => {
      this.clients.delete(id);
      this.updateStaffPresence({ status: "offline", branchId, deviceId: auth.deviceId || "" }, access);
      this.broadcast("staff.status", { userId: auth.sub, status: "offline", branchId }, {
        tenantId: auth.tenantId,
        branchId,
        channel: branchId ? `branch:${branchId}` : `tenant:${auth.tenantId}`
      });
    });
  }

  handleMessage(client, message) {
    let frame = {};
    try {
      frame = JSON.parse(message.toString());
    } catch {
      this.send(client.ws, "error", { message: "WebSocket message must be valid JSON" });
      return;
    }
    if (frame.type === "subscribe" && frame.channel) {
      client.channels.add(frame.channel);
      this.send(client.ws, "subscription.updated", { channels: [...client.channels] });
      return;
    }
    if (frame.type === "unsubscribe" && frame.channel) {
      client.channels.delete(frame.channel);
      this.send(client.ws, "subscription.updated", { channels: [...client.channels] });
      return;
    }
    try {
      if (frame.type === "staff.status") {
        const presence = this.updateStaffPresence(frame.payload || {}, client.access);
        this.broadcast("staff.status", { presence }, { tenantId: client.access.tenantId, branchId: presence.branchId, channel: presence.branchId ? `branch:${presence.branchId}` : `tenant:${client.access.tenantId}` });
        return;
      }
      if (frame.type === "queue.update" && frame.payload?.id) {
        const item = this.updateQueueItem(frame.payload.id, frame.payload, client.access);
        this.broadcast("queue.updated", { item }, { tenantId: client.access.tenantId, branchId: item.branchId, channel: `branch:${item.branchId}` });
        return;
      }
    } catch (error) {
      this.send(client.ws, "error", { message: error.message || "Realtime command failed" });
      return;
    }
    if (frame.type === "ping") {
      this.send(client.ws, "pong", { at: now() });
    }
  }

  send(ws, type, payload = {}, meta = {}) {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type,
      payload,
      meta: {
        version: "v1",
        timestamp: now(),
        ...meta
      }
    }));
  }

  broadcast(type, payload = {}, { tenantId = "", branchId = "", channel = "" } = {}) {
    const resolvedChannel = channel || (branchId ? `branch:${branchId}` : `tenant:${tenantId}`);
    const event = tenantId
      ? repositories.realtimeEvents.create({
          id: makeId("evt"),
          branchId,
          channel: resolvedChannel,
          type,
          payload
        }, { tenantId })
      : null;
    for (const client of this.clients.values()) {
      if (tenantId && client.access.tenantId !== tenantId) continue;
      if (branchId && client.branchId && client.branchId !== branchId) continue;
      if (resolvedChannel && !client.channels.has(resolvedChannel) && !client.channels.has(`tenant:${tenantId}`)) continue;
      this.send(client.ws, type, payload, { eventId: event?.id, channel: resolvedChannel });
    }
    return event;
  }

  listQueue(query = {}, access) {
    return repositories.realtimeQueue.list(query, scope(access, query.branchId || access.requestedBranchId || ""));
  }

  enqueue(payload = {}, access) {
    const branchId = payload.branchId || access.branchId || "";
    if (!branchId) throw badRequest("branchId is required");
    tenantService.assertBranchAccess(access, branchId);
    const item = repositories.realtimeQueue.create({
      id: makeId("queue"),
      branchId,
      clientId: payload.clientId || "",
      appointmentId: payload.appointmentId || "",
      type: payload.type || "front-desk",
      title: payload.title || "Queue item",
      priority: payload.priority || "normal",
      status: payload.status || "waiting",
      assignedStaffId: payload.assignedStaffId || "",
      payload: payload.payload || {},
      history: [{ at: now(), status: payload.status || "waiting", note: "Created" }]
    }, scope(access, branchId));
    this.broadcast("queue.created", { item }, { tenantId: access.tenantId, branchId, channel: `branch:${branchId}` });
    return item;
  }

  updateQueueItem(id, payload = {}, access) {
    const existing = repositories.realtimeQueue.getById(id, { tenantId: access.tenantId });
    if (!existing) throw notFound("Queue item not found");
    tenantService.assertBranchAccess(access, existing.branchId);
    const history = [
      { at: now(), status: payload.status || existing.status, note: payload.note || "Updated" },
      ...(existing.history || [])
    ].slice(0, 50);
    const item = repositories.realtimeQueue.update(id, {
      status: payload.status ?? existing.status,
      priority: payload.priority ?? existing.priority,
      assignedStaffId: payload.assignedStaffId ?? existing.assignedStaffId,
      payload: payload.payload ?? existing.payload,
      history
    }, { tenantId: access.tenantId });
    this.broadcast("queue.updated", { item }, { tenantId: access.tenantId, branchId: item.branchId, channel: `branch:${item.branchId}` });
    return item;
  }

  updateStaffPresence(payload = {}, access) {
    const branchId = payload.branchId || access.branchId || "";
    const existing = repositories.staffPresence.list({ limit: 10000 }, { tenantId: access.tenantId }).find((item) => item.userId === access.userId);
    const record = {
      userId: access.userId,
      branchId,
      staffId: payload.staffId || "",
      status: payload.status || "online",
      deviceId: payload.deviceId || access.deviceId || "",
      lastSeenAt: now()
    };
    return existing
      ? repositories.staffPresence.update(existing.id, record, { tenantId: access.tenantId })
      : repositories.staffPresence.create({ id: makeId("presence"), ...record }, { tenantId: access.tenantId });
  }

  dashboardUpdated(access, branchId = "", payload = {}) {
    this.broadcast("dashboard.updated", payload, {
      tenantId: access.tenantId,
      branchId,
      channel: branchId ? `branch:${branchId}` : `tenant:${access.tenantId}`
    });
  }

  bookingUpdated(access, appointment, action = "updated") {
    this.broadcast("booking.updated", { action, appointment }, {
      tenantId: access.tenantId,
      branchId: appointment.branchId,
      channel: `branch:${appointment.branchId}`
    });
    this.dashboardUpdated(access, appointment.branchId, { source: "booking", appointmentId: appointment.id });
  }
}

export const realtimeService = new RealtimeService();
