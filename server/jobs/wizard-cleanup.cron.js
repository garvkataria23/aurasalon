import { wizardStateService } from "../services/wizard-state.service.js";
import { logger } from "../utils/logger.js";

let timer = null;

export function startWizardCleanupCron() {
  if (timer) return timer;
  timer = setInterval(() => {
    try {
      const deleted = wizardStateService.cleanupExpired();
      if (deleted) logger.info("booking_wizard_cleanup", { deleted });
    } catch (error) {
      logger.warn("booking_wizard_cleanup_failed", { error: error.message });
    }
  }, 5 * 60 * 1000);
  timer.unref?.();
  return timer;
}
