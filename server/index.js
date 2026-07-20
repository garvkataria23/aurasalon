console.log("=== INDEX.JS START === pid =", process.pid, "time =", new Date().toISOString());

process.on("uncaughtException", (err) => {
  console.error("=== UNCAUGHT EXCEPTION ===");
  console.error("pid =", process.pid);
  console.error("time =", new Date().toISOString());
  console.error("message =", err.message);
  console.error("stack =", err.stack);
  console.error("=== END UNCAUGHT EXCEPTION ===");
});
process.on("unhandledRejection", (reason) => {
  console.error("=== UNHANDLED REJECTION ===");
  console.error("pid =", process.pid);
  console.error("time =", new Date().toISOString());
  console.error("reason =", reason instanceof Error ? reason.stack : String(reason));
  console.error("=== END UNHANDLED REJECTION ===");
});
process.on("exit", (code) => {
  console.error("=== PROCESS EXIT === pid =", process.pid, "code =", code, "time =", new Date().toISOString());
});
process.on("SIGTERM", () => {
  console.error("=== SIGTERM RECEIVED === pid =", process.pid, "time =", new Date().toISOString());
});
process.on("SIGINT", () => {
  console.error("=== SIGINT RECEIVED === pid =", process.pid, "time =", new Date().toISOString());
});

console.log("=== INDEX.JS: importing modules === pid =", process.pid);
import { env } from "./config/env.js";

async function bootstrap() {
  console.log("=== INDEX.JS: env imported; importing database consumers === pid =", process.pid);
  const [
    { createApp },
    { startAbandonmentDetectorCron },
    { startDashboardCron },
    { startIdempotencyCleanupCron },
    { startReconciliationCron },
    { startSecurityEphemeralGrantsCleanupCron },
    { startSlotCleanupCron },
    { startWizardCleanupCron },
    { realtimeService },
    { logger },
    { startJobWorker }
  ] = await Promise.all([
    import("./app.js"),
    import("./jobs/abandonment-detector.cron.js"),
    import("./jobs/dashboard-cron.js"),
    import("./jobs/idempotency-cleanup.cron.js"),
    import("./jobs/reconciliation-cron.js"),
    import("./jobs/security-ephemeral-grants-cleanup.cron.js"),
    import("./jobs/slot-cleanup.cron.js"),
    import("./jobs/wizard-cleanup.cron.js"),
    import("./services/realtime.service.js"),
    import("./utils/logger.js"),
    import("./workers/job-worker.js")
  ]);
  console.log("=== INDEX.JS: all imports done === pid =", process.pid);

  console.log("=== INDEX.JS: calling createApp() === pid =", process.pid);
  const app = createApp();
  console.log("=== INDEX.JS: createApp() returned === pid =", process.pid);

  console.log("=== INDEX.JS: PORT =", env.port, "HOST =", env.host, "ENV =", env.nodeEnv, "cwd =", process.cwd(), "pid =", process.pid);

  console.log("=== INDEX.JS: calling app.listen() === pid =", process.pid);
  const server = app.listen(env.port, env.host, () => {
    console.log("=== INDEX.JS: app.listen callback fired === pid =", process.pid);
    logger.info("api_started", {
      url: `http://${env.host}:${env.port}`,
      environment: env.nodeEnv
    });
    console.log("=== api_started === PORT =", env.port, "pid =", process.pid);
  });

  server.on("error", (err) => {
    console.error("=== SERVER ERROR === pid =", process.pid);
    console.error("message =", err.message);
    console.error("code =", err.code);
    console.error("stack =", err.stack);
    console.error("=== END SERVER ERROR ===");
  });

  console.log("=== INDEX.JS: attaching realtime === pid =", process.pid);
  realtimeService.attach(server);
  console.log("=== INDEX.JS: starting crons === pid =", process.pid);
  startDashboardCron();
  startAbandonmentDetectorCron();
  startSlotCleanupCron();
  startIdempotencyCleanupCron();
  startWizardCleanupCron();
  startJobWorker();
  startReconciliationCron();
  startSecurityEphemeralGrantsCleanupCron();
  console.log("=== INDEX.JS: all crons started === pid =", process.pid);
}

void bootstrap().catch((err) => {
  console.error("=== BOOTSTRAP FAILED === pid =", process.pid);
  console.error("message =", err.message);
  console.error("stack =", err.stack);
  process.exitCode = 1;
});
