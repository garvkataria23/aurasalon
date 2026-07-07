import { ApiRecord } from '../core/api.service';

type TimeWindow = { startMs: number; endMs: number };

function numberValue(value: unknown, fallback = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function timeMs(value: unknown): number {
  const next = new Date(String(value || '')).getTime();
  return Number.isFinite(next) ? next : 0;
}

function serviceIds(row: ApiRecord): string[] {
  if (Array.isArray(row.serviceIds)) return row.serviceIds.map(String).filter(Boolean);
  if (Array.isArray(row.services)) {
    return row.services.map((item: unknown) => typeof item === 'object' && item ? String((item as ApiRecord).serviceId || (item as ApiRecord).id || '') : String(item || '')).filter(Boolean);
  }
  if (row.serviceId) return [String(row.serviceId)];
  return [];
}

function serviceFor(row: ApiRecord, serviceById: Map<string, ApiRecord>): ApiRecord | undefined {
  return serviceById.get(serviceIds(row)[0] || '');
}

export function serviceTotalMinutes(service: ApiRecord | undefined): number {
  return Math.max(15,
    numberValue(service?.durationMinutes || service?.duration, 30)
    + numberValue(service?.processingTimeMin, 0)
    + numberValue(service?.cleanupTimeMin || service?.bufferAfter, 0)
  );
}

function endMsFor(row: ApiRecord, startMs: number, serviceById: Map<string, ApiRecord>): number {
  const explicit = timeMs(row.endAt || row.endTime);
  if (explicit) return explicit;
  if (!startMs) return 0;
  const minutes = numberValue(row.durationMinutes || row.duration, serviceTotalMinutes(serviceFor(row, serviceById)));
  return startMs + Math.max(15, minutes) * 60000;
}

function rangesOverlap(left: TimeWindow, right: TimeWindow): boolean {
  return left.startMs < right.endMs && left.endMs > right.startMs;
}

export function staffBusyWindows(row: ApiRecord, serviceById: Map<string, ApiRecord>): TimeWindow[] {
  const startMs = timeMs(row.startAt || row.startTime);
  const endMs = endMsFor(row, startMs, serviceById);
  if (!startMs || !endMs || endMs <= startMs) return [];
  const service = serviceFor(row, serviceById);
  const processingMinutes = numberValue(service?.processingTimeMin, 0);
  if (!service || processingMinutes <= 0 || serviceIds(row).length !== 1) return [{ startMs, endMs }];

  const serviceMinutes = numberValue(service.durationMinutes || service.duration, 30);
  const cleanupMinutes = numberValue(service.cleanupTimeMin || service.bufferAfter, 0);
  const serviceEndMs = Math.min(endMs, startMs + serviceMinutes * 60000);
  const windows = serviceEndMs > startMs ? [{ startMs, endMs: serviceEndMs }] : [];
  if (cleanupMinutes > 0) {
    const cleanupStartMs = Math.max(startMs, endMs - cleanupMinutes * 60000);
    if (endMs > cleanupStartMs) windows.push({ startMs: cleanupStartMs, endMs });
  }
  return windows.length ? windows : [{ startMs, endMs }];
}

export function appointmentConflictBlocks(candidate: ApiRecord, existing: ApiRecord, serviceById: Map<string, ApiRecord>): boolean {
  const candidateStartMs = timeMs(candidate.startAt || candidate.startTime);
  const candidateEndMs = endMsFor(candidate, candidateStartMs, serviceById);
  const existingStartMs = timeMs(existing.startAt || existing.startTime);
  const existingEndMs = endMsFor(existing, existingStartMs, serviceById);
  if (!candidateStartMs || !candidateEndMs || !existingStartMs || !existingEndMs) return false;
  if (!rangesOverlap({ startMs: candidateStartMs, endMs: candidateEndMs }, { startMs: existingStartMs, endMs: existingEndMs })) return false;

  const candidateChair = String(candidate.chair || candidate.chairId || '').trim();
  const existingChair = String(existing.chair || existing.chairId || '').trim();
  if (candidateChair && existingChair && candidateChair === existingChair) return true;

  const candidateStaff = String(candidate.staffId || '').trim();
  const existingStaff = String(existing.staffId || '').trim();
  if (!candidateStaff || candidateStaff !== existingStaff) return false;
  return staffBusyWindows(candidate, serviceById).some((left) =>
    staffBusyWindows(existing, serviceById).some((right) => rangesOverlap(left, right))
  );
}
