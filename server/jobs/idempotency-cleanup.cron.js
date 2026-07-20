import { cleanupIdempotencyKeys } from "../middleware/idempotency.middleware.js";
import { logger } from "../utils/logger.js";

let started = false;

export function startIdempotencyCleanupCron() {
  if (started) return;
  started = true;
  setInterval(() => {
    try {
      const count = cleanupIdempotencyKeys();
      if (count) logger.info("idempotency_cleanup", { count });
    } catch (error) {
      logger.error("idempotency_cleanup_failed", { error: error.message });
    }
  }, 60 * 60 * 1000);
}

