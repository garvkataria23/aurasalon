import test from "node:test";
import assert from "node:assert/strict";
import { validateBody, validateResourcePayload } from "../server/validators/request-validator.js";

function runMiddleware(middleware, req) {
  return new Promise((resolve) => {
    middleware(req, {}, (error) => resolve(error || null));
  });
}

test("validateBody rejects missing required fields", async () => {
  const error = await runMiddleware(validateBody({ required: ["clientId", "branchId"] }), { body: { clientId: "client_1" } });
  assert.equal(error.status, 400);
  assert.match(error.message, /branchId/);
});

test("validateBody rejects enum values outside the allowed set", async () => {
  const error = await runMiddleware(validateBody({ enums: { status: ["booked", "completed"] } }), { body: { status: "lost" } });
  assert.equal(error.status, 400);
  assert.match(error.message, /Invalid status/);
});

test("validateResourcePayload accepts complete service payloads", async () => {
  const error = await runMiddleware(validateResourcePayload, {
    params: { resource: "services" },
    body: { name: "Hair spa", category: "Hair", price: 1200, durationMinutes: 45 }
  });
  assert.equal(error, null);
});
