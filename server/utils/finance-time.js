const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function istToday(now = new Date()) {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function istStamp(now = new Date()) {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString();
}

export function epochSeconds(now = new Date()) {
  return Math.floor(now.getTime() / 1000);
}

export function periodOf(date) {
  return normalizeBusinessDate(date).slice(0, 7);
}

export function normalizeBusinessDate(value = istToday(), options = {}) {
  const candidate = String(value || istToday()).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return istToday();
  if (!options.allowFuture && candidate > istToday()) return istToday();
  return candidate;
}
