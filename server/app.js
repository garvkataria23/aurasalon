import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import "./db.js";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { authenticateJwt } from "./middleware/auth.js";
import { mobileApiContext } from "./middleware/mobile-response.js";
import { requestContext } from "./middleware/request-context.js";
import { enterpriseSecurity } from "./middleware/security.js";
import { aiRouter } from "./routes/ai.routes.js";
import { aiMarketingRouter } from "./routes/ai-marketing.routes.js";
import { analyticsRouter } from "./routes/analytics.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { bookingPortalRouter } from "./routes/booking-portal.routes.js";
import { customer360Router } from "./routes/customer-360.routes.js";
import { deploymentRouter } from "./routes/deployment.routes.js";
import { financeEngineRouter } from "./routes/finance-engine.routes.js";
import { futureFeaturesRouter } from "./routes/future-features.routes.js";
import { inventoryIntelligenceRouter } from "./routes/inventory-intelligence.routes.js";
import { mobileRouter } from "./routes/mobile.routes.js";
import { offlineRouter } from "./routes/offline.routes.js";
import { operationsRouter } from "./routes/operations.routes.js";
import { qualityRouter } from "./routes/quality.routes.js";
import { realtimeRouter } from "./routes/realtime.routes.js";
import { resourceRouter } from "./routes/resource.routes.js";
import { saasRouter } from "./routes/saas.routes.js";
import { securityRouter } from "./routes/security.routes.js";
import { smartBookingRouter } from "./routes/smart-booking.routes.js";
import { staffManagementRouter } from "./routes/staff-management.routes.js";
import { superAdminRouter } from "./routes/super-admin.routes.js";
import { whatsappRouter } from "./routes/whatsapp.routes.js";
import { whiteLabelRouter } from "./routes/white-label.routes.js";
import { workflowEngineRouter } from "./routes/workflow-engine.routes.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.allowedOrigins.includes(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Origin not allowed by CORS"));
      }
    })
  );
  app.use(express.json({ limit: env.requestBodyLimit }));
  app.use(requestContext);
  app.use(enterpriseSecurity);

  app.get("/api/versions", (_req, res) => {
    res.json({ current: "v1", supported: ["v1"], legacy: "/api", mobile: "/api/v1" });
  });
  app.use("/api/v1", mobileApiContext);
  app.get("/api/v1/health", (_req, res) => {
    res.json({ ok: true, service: "Aura Salon CRM/POS API", version: "v1", timestamp: new Date().toISOString() });
  });
  app.use("/api/v1", authRouter);
  app.use("/api/v1", authenticateJwt(), mobileRouter);
  app.use("/api/v1", authenticateJwt(), realtimeRouter);
  app.use("/api/v1", authenticateJwt(), superAdminRouter);
  app.use("/api/v1", authenticateJwt(), saasRouter);
  app.use("/api/v1", authenticateJwt(), smartBookingRouter);
  app.use("/api/v1", authenticateJwt(), securityRouter);
  app.use("/api/v1", authenticateJwt(), offlineRouter);
  app.use("/api/v1", authenticateJwt(), whiteLabelRouter);
  app.use("/api/v1", authenticateJwt(), futureFeaturesRouter);
  app.use("/api/v1", authenticateJwt(), workflowEngineRouter);
  app.use("/api/v1", authenticateJwt(), financeEngineRouter);
  app.use("/api/v1", authenticateJwt(), customer360Router);
  app.use("/api/v1", authenticateJwt(), bookingPortalRouter);
  app.use("/api/v1", authenticateJwt(), qualityRouter);
  app.use("/api/v1", authenticateJwt(), deploymentRouter);
  app.use("/api/v1", authenticateJwt(), analyticsRouter);
  app.use("/api/v1", authenticateJwt(), aiRouter);
  app.use("/api/v1", authenticateJwt(), aiMarketingRouter);
  app.use("/api/v1", authenticateJwt(), whatsappRouter);
  app.use("/api/v1", authenticateJwt(), staffManagementRouter);
  app.use("/api/v1", authenticateJwt(), inventoryIntelligenceRouter);
  app.use("/api/v1", authenticateJwt(), operationsRouter);
  app.use("/api/v1", authenticateJwt(), resourceRouter);
  app.use("/api/v1", notFoundHandler);

  app.use("/api", superAdminRouter);
  app.use("/api", saasRouter);
  app.use("/api", smartBookingRouter);
  app.use("/api", securityRouter);
  app.use("/api", offlineRouter);
  app.use("/api", whiteLabelRouter);
  app.use("/api", futureFeaturesRouter);
  app.use("/api", workflowEngineRouter);
  app.use("/api", financeEngineRouter);
  app.use("/api", customer360Router);
  app.use("/api", bookingPortalRouter);
  app.use("/api", qualityRouter);
  app.use("/api", deploymentRouter);
  app.use("/api", analyticsRouter);
  app.use("/api", aiRouter);
  app.use("/api", aiMarketingRouter);
  app.use("/api", whatsappRouter);
  app.use("/api", staffManagementRouter);
  app.use("/api", inventoryIntelligenceRouter);
  app.use("/api", operationsRouter);
  app.use("/api", resourceRouter);

  const clientDist = resolveClientDist();
  if (clientDist) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(join(clientDist, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

function resolveClientDist() {
  const candidates = [
    join(process.cwd(), "dist", "aura-salon-crm-pos", "browser"),
    join(process.cwd(), "dist", "aura-salon-crm-pos")
  ];
  return candidates.find((candidate) => existsSync(join(candidate, "index.html"))) || "";
}
