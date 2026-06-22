const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const TOKEN_RE = /\b(?:sk-[A-Za-z0-9_-]{10,}|(?:api[_-]?key|token|secret|authorization)\s*[:=]\s*["']?[A-Za-z0-9._-]{8,}["']?)/gi;
const INDIA_PHONE_RE = /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d(?:[\s-]?\d){8}(?![\s-]?\d)/g;
const LONG_NUMERIC_ID_RE = /\b\d{9,}\b/g;

function redactString(value) {
  return String(value)
    .replace(EMAIL_RE, "[redacted-email]")
    .replace(TOKEN_RE, "[redacted-token]")
    .replace(INDIA_PHONE_RE, "[redacted-phone]")
    .replace(LONG_NUMERIC_ID_RE, "[redacted-id]");
}

export function redactAiInput(value) {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redactAiInput(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactAiInput(item)]));
  }
  return value;
}
