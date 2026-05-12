export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 4000),
  allowedOrigins: (process.env.CORS_ORIGINS || "http://127.0.0.1:4300,http://localhost:4300")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || "1mb",
  logLevel: process.env.LOG_LEVEL || "info",
  jwtSecret: process.env.JWT_SECRET || "dev-only-change-this-mobile-secret",
  encryptionSecret: process.env.ENCRYPTION_SECRET || process.env.JWT_SECRET || "dev-only-change-this-encryption-secret",
  jwtAccessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS || 900),
  jwtRefreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS || 30),
  apiVersion: "v1",
  aiProvider: process.env.AI_PROVIDER || "local",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini"
};
