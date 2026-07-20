import { happyHoursAutoSunsetRepo } from "../repositories/happy-hours-auto-sunset.repo.js";
import { logger } from "../utils/logger.js";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export function runOfferAutoSunsetJob() {
  try {
    for (const scope of happyHoursAutoSunsetRepo.listScopes()) {
      try {
        happyHoursAutoSunsetRepo.runAutoSunset({ ...scope, apply: true, source: "job" });
      } catch (error) {
        logger.warn("offer_auto_sunset_branch_skipped", { branchId: scope.branchId, error: error.message });
      }
    }
  } catch (error) {
    logger.warn("offer_auto_sunset_job_skipped", { error: error.message });
  }
}

if (!globalThis.__auraOfferAutoSunsetJobStarted) {
  globalThis.__auraOfferAutoSunsetJobStarted = true;
  const timer = setInterval(runOfferAutoSunsetJob, SIX_HOURS_MS);
  if (typeof timer.unref === "function") timer.unref();
  runOfferAutoSunsetJob();
}
