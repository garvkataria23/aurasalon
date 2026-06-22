import { slotReservationService } from "../services/slot-reservation.service.js";
import { logger } from "../utils/logger.js";

let started = false;

export function startSlotCleanupCron() {
  if (started) return;
  started = true;
  setInterval(() => {
    try {
      const result = slotReservationService.expireStaleHolds();
      if (result.count) logger.info("slot_holds_expired", result);
    } catch (error) {
      logger.error("slot_hold_cleanup_failed", { error: error.message });
    }
  }, 60 * 1000);
}

