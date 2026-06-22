function sleep(ms) {
  const buffer = new SharedArrayBuffer(4);
  const view = new Int32Array(buffer);
  Atomics.wait(view, 0, 0, ms);
}

export function withRetry(fn, { maxAttempts = 3, delayMs = 120 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return fn();
    } catch (error) {
      const busy = error?.code === "SQLITE_BUSY" || /SQLITE_BUSY|database is locked/i.test(error?.message || "");
      if (!busy || attempt === maxAttempts - 1) throw error;
      sleep(delayMs * (attempt + 1));
    }
  }
  return undefined;
}

export function withTransaction(db, fn, options) {
  const txn = db.transaction(fn);
  return (...args) => withRetry(() => txn(...args), options);
}
