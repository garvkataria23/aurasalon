import { invoiceNotificationService } from "../services/invoice-notification.service.js";
import { logger } from "../utils/logger.js";

const JOB_KEY = "__auraDailyReportEmailJobStarted";
const INTERVAL_MS = 60 * 1000;

function runDailyReportEmailJob() {
  try {
    const queued = invoiceNotificationService.queueDueDailyReports(new Date());
    if (queued.length) logger.info("daily_report_email_queued", { count: queued.length });
  } catch (error) {
    logger.warn("daily_report_email_failed", { error: error?.message || String(error) });
  }
}

if (!globalThis[JOB_KEY]) {
  globalThis[JOB_KEY] = true;
  const firstRunTimer = setTimeout(runDailyReportEmailJob, INTERVAL_MS);
  const repeatTimer = setInterval(runDailyReportEmailJob, INTERVAL_MS);
  if (typeof firstRunTimer.unref === "function") firstRunTimer.unref();
  if (typeof repeatTimer.unref === "function") repeatTimer.unref();
}
