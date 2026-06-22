import { abandonedRecoveryService } from "../services/abandoned-recovery.service.js";
import { logger } from "../utils/logger.js";

let started = false;

export function startAbandonmentDetectorCron() {
  if (started) return;
  started = true;
  setInterval(() => {
    try {
      const detected = abandonedRecoveryService.detectAbandonments();
      const queued = abandonedRecoveryService.processPendingRecoveries();
      if (detected.count || queued.length) {
        logger.info("booking_abandonment_detector", { detected: detected.count, queued: queued.length });
      }
    } catch (error) {
      logger.error("booking_abandonment_detector_failed", { error: error.message });
    }
  }, 15 * 60 * 1000).unref?.();
}
