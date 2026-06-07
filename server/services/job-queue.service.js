import { db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
}

function asJson(value) {
  return typeof value === "string" ? value : JSON.stringify(value || {});
}

function nextAttemptAt(attempts) {
  const minutes = [1, 5, 30][Math.min(Math.max(Number(attempts || 1) - 1, 0), 2)];
  return new Date(Date.now() + minutes * 60000).toISOString();
}

export const jobQueueService = {
  enqueue(input, jobTypeArg, payloadArg = {}, scheduledAtArg = "") {
    const options = typeof input === "object" && input !== null
      ? input
      : { tenantId: input, jobType: jobTypeArg, payload: payloadArg, scheduledAt: scheduledAtArg };
    const { tenantId, jobType } = options;
    const payload = options.payload || {};
    const scheduledAt = options.scheduledAt || "";
    if (!tenantId || !jobType) throw badRequest("tenantId and jobType are required");
    const row = {
      id: makeId("job"),
      tenantId,
      jobType,
      payload: asJson(payload),
      status: "pending",
      attempts: 0,
      maxAttempts: Number(options.maxAttempts || payload.maxAttempts || 3),
      scheduledAt: scheduledAt || new Date().toISOString(),
      priority: Number(options.priority || payload.priority || 5)
    };
    db.prepare(
      `INSERT INTO job_queue (id, tenantId, jobType, payload, status, attempts, maxAttempts, scheduledAt, priority)
       VALUES (@id, @tenantId, @jobType, @payload, @status, @attempts, @maxAttempts, @scheduledAt, @priority)`
    ).run(row);
    return { ...row, payload };
  },

  nextPending(limit = 10) {
    return db.prepare(
      `SELECT * FROM job_queue
       WHERE status = 'pending' AND scheduledAt <= ?
       ORDER BY priority ASC, scheduledAt ASC
       LIMIT ?`
    ).all(new Date().toISOString(), Number(limit || 10)).map(parseJob);
  },

  markRunning(jobId) {
    db.prepare("UPDATE job_queue SET status = 'running', attempts = attempts + 1, startedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(jobId);
  },

  markCompleted(jobId) {
    db.prepare("UPDATE job_queue SET status = 'completed', completedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(jobId);
  },

  markFailed(jobId, error) {
    const job = db.prepare("SELECT * FROM job_queue WHERE id = ?").get(jobId);
    if (!job) return;
    const attempts = Number(job.attempts || 0);
    const maxAttempts = Number(job.maxAttempts || 3);
    if (attempts < maxAttempts) {
      db.prepare(
        `UPDATE job_queue
         SET status = 'pending', scheduledAt = ?, lastError = ?, updatedAt = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(nextAttemptAt(attempts), String(error?.message || error || "Job failed").slice(0, 500), jobId);
      return;
    }
    db.prepare("UPDATE job_queue SET status = 'dead_letter', lastError = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?")
      .run(String(error?.message || error || "Job failed").slice(0, 500), jobId);
  },

  getStats(tenantId) {
    const rows = db.prepare("SELECT status, COUNT(*) count FROM job_queue WHERE tenantId = ? GROUP BY status").all(tenantId);
    return rows.reduce((acc, row) => {
      acc[row.status] = Number(row.count || 0);
      return acc;
    }, { pending: 0, running: 0, completed: 0, failed: 0, dead_letter: 0 });
  },

  cleanup() {
    return db.prepare("DELETE FROM job_queue WHERE status = 'completed' AND completedAt < datetime('now', '-7 days')").run().changes || 0;
  },

  list(access, query = {}) {
    const status = query.status || "";
    const jobType = query.jobType || "";
    const limit = Math.min(Number(query.limit || 50), 200);
    return db.prepare(
      `SELECT * FROM job_queue
       WHERE tenantId = ?
         AND (? = '' OR status = ?)
         AND (? = '' OR jobType = ?)
       ORDER BY scheduledAt DESC
       LIMIT ?`
    ).all(access.tenantId, status, status, jobType, jobType, limit).map(parseJob);
  },

  retry(access, id) {
    const job = db.prepare("SELECT * FROM job_queue WHERE id = ? AND tenantId = ?").get(id, access.tenantId);
    if (!job) throw notFound("Job not found");
    db.prepare("UPDATE job_queue SET status = 'pending', scheduledAt = CURRENT_TIMESTAMP, lastError = '', updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    return { retried: true };
  },

  delete(access, id) {
    const result = db.prepare("DELETE FROM job_queue WHERE id = ? AND tenantId = ?").run(id, access.tenantId);
    return { deleted: result.changes > 0 };
  }
};

function parseJob(row) {
  try {
    return { ...row, payload: JSON.parse(row.payload || "{}") };
  } catch {
    return { ...row, payload: {} };
  }
}
