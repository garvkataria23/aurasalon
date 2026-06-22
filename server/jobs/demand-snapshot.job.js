import { demandSignalsRepo } from "../repositories/demand-signals.repo.js";
import { logger } from "../utils/logger.js";

const ONE_HOUR_MS = 60 * 60 * 1000;

export function captureAllBranches() {
  try {
    for (const scope of demandSignalsRepo.listCaptureScopes()) {
      try {
        demandSignalsRepo.captureSnapshot(scope);
      } catch (error) {
        logger.warn("demand_signals_branch_skipped", { branchId: scope.branchId, error: error.message });
      }
    }
  } catch (error) {
    logger.warn("demand_signals_job_skipped", { error: error.message });
  }
}

if (!globalThis.__auraDemandSnapshotJobStarted) {
  globalThis.__auraDemandSnapshotJobStarted = true;
  const timer = setInterval(captureAllBranches, ONE_HOUR_MS);
  if (typeof timer.unref === "function") timer.unref();
  captureAllBranches();
}
