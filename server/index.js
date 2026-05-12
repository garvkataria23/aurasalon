import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { realtimeService } from "./services/realtime.service.js";
import { logger } from "./utils/logger.js";

const app = createApp();

const server = app.listen(env.port, env.host, () => {
  logger.info("api_started", {
    url: `http://${env.host}:${env.port}`,
    environment: env.nodeEnv
  });
});

realtimeService.attach(server);
