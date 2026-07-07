import { repositories } from "../repositories/repository-registry.js";

function timeMs(value) {
  const ms = new Date(value || "").getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function number(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function serviceIds(row = {}) {
  if (Array.isArray(row.serviceIds)) return row.serviceIds.filter(Boolean);
  if (Array.isArray(row.services)) return row.services.map((item) => item?.serviceId || item?.id || item).filter(Boolean);
  if (row.serviceId) return [row.serviceId];
  return [];
}

function serviceFor(row = {}, access = {}) {
  const [serviceId] = serviceIds(row);
  if (!serviceId || !access?.tenantId) return null;
  return repositories.services.getById(serviceId, { tenantId: access.tenantId }) || null;
}

function endMsFor(row = {}, startMs = 0, access = {}) {
  const explicit = timeMs(row.endAt || row.endTime);
  if (explicit) return explicit;
  if (!startMs) return 0;
  const service = serviceFor(row, access);
  const minutes = number(row.durationMinutes || row.duration, service ? serviceTotalMinutes(service) : 30);
  return startMs + Math.max(15, minutes) * 60000;
}

function rangesOverlap(left, right) {
  return left.startMs < right.endMs && left.endMs > right.startMs;
}

export function serviceTotalMinutes(service = {}) {
  return Math.max(15,
    number(service.durationMinutes || service.duration, 30)
    + number(service.processingTimeMin, 0)
    + number(service.cleanupTimeMin || service.bufferAfter, 0)
  );
}

export function staffBusyWindows(row = {}, access = {}) {
  const startMs = timeMs(row.startAt || row.startTime);
  const endMs = endMsFor(row, startMs, access);
  if (!startMs || !endMs || endMs <= startMs) return [];
  const service = serviceFor(row, access);
  const processingMinutes = number(service?.processingTimeMin, 0);
  if (!service || processingMinutes <= 0 || serviceIds(row).length !== 1) {
    return [{ startMs, endMs }];
  }

  const serviceMinutes = number(service.durationMinutes || service.duration, 30);
  const cleanupMinutes = number(service.cleanupTimeMin || service.bufferAfter, 0);
  const serviceEndMs = Math.min(endMs, startMs + serviceMinutes * 60000);
  const windows = serviceEndMs > startMs ? [{ startMs, endMs: serviceEndMs }] : [];
  if (cleanupMinutes > 0) {
    const cleanupStartMs = Math.max(startMs, endMs - cleanupMinutes * 60000);
    if (endMs > cleanupStartMs) windows.push({ startMs: cleanupStartMs, endMs });
  }
  return windows.length ? windows : [{ startMs, endMs }];
}

export function appointmentConflictBlocks(candidate = {}, existing = {}, access = {}) {
  const candidateStartMs = timeMs(candidate.startAt || candidate.startTime);
  const candidateEndMs = endMsFor(candidate, candidateStartMs, access);
  const existingStartMs = timeMs(existing.startAt || existing.startTime);
  const existingEndMs = endMsFor(existing, existingStartMs, access);
  if (!candidateStartMs || !candidateEndMs || !existingStartMs || !existingEndMs) return false;
  const fullOverlap = rangesOverlap(
    { startMs: candidateStartMs, endMs: candidateEndMs },
    { startMs: existingStartMs, endMs: existingEndMs }
  );
  if (!fullOverlap) return false;

  const candidateChair = String(candidate.chair || candidate.chairId || "").trim();
  const existingChair = String(existing.chair || existing.chairId || "").trim();
  if (candidateChair && existingChair && candidateChair === existingChair) return true;

  const candidateStaff = String(candidate.staffId || "").trim();
  const existingStaff = String(existing.staffId || "").trim();
  if (!candidateStaff || candidateStaff !== existingStaff) return false;

  return staffBusyWindows(candidate, access).some((left) =>
    staffBusyWindows(existing, access).some((right) => rangesOverlap(left, right))
  );
}
