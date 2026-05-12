const levels = ["debug", "info", "warn", "error"];
const configuredLevel = process.env.LOG_LEVEL || "info";

function shouldLog(level) {
  return levels.indexOf(level) >= levels.indexOf(configuredLevel);
}

function write(level, message, meta = {}) {
  if (!shouldLog(level)) return;
  const line = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta
  };
  const output = JSON.stringify(line);
  if (level === "error") {
    console.error(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug: (message, meta) => write("debug", message, meta),
  info: (message, meta) => write("info", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  error: (message, meta) => write("error", message, meta)
};
