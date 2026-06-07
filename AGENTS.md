# AGENTS.md — Aura Salon CRM/POS
 
> Read this fully before any task. It has everything: rules, file map, and the exact code patterns to copy.
> **Do NOT scan the repo to "understand the project."** The map + patterns are below. Only open the specific files a task names.
 
---
 
## 1. Project
Multi-tenant salon management SaaS. One repo: **Angular 20 frontend + Express 5 API + SQLite DB**.
 
## 2. Stack (LOCKED — never change, never propose alternatives)
- **Backend:** Express 5, plain **JavaScript ES modules** (`"type": "module"`). NOT TypeScript.
- **DB:** SQLite via **better-sqlite3** — **synchronous** (no `await` on DB calls), WAL mode.
- **Frontend:** Angular 20 standalone components + RxJS + signals.
- **No** Redis, no brokers, no queues. Background work = DB polling only. Don't add Mongo/Postgres/Prisma/ORM.
## 3. Hard rules (breaking these breaks production)
1. **NEVER modify these 4 files** (read them for context only):
   - `server/services/smart-booking.service.js`
   - `server/services/booking-portal.service.js`
   - `server/routes/operations.routes.js`
   - `server/db.js`
   If a task needs them, **STOP and flag it** — do not edit.
2. **Money = INTEGER paise.** ₹150.00 → `15000`. Never floats/rupees in DB or logic. Convert to rupees only at the UI.
3. **Column names are camelCase:** `tenantId`, `branchId`, `clientId`, `staffId`, `createdAt`, `updatedAt`, `startAt`. **NOT snake_case.** (Schema uses `tenantId TEXT`, etc.)
4. **Every tenant-scoped table has `tenantId`**, and most have `branchId`. Default tenant = `tenant_aura`. Never write a query that ignores tenant scope.
5. **better-sqlite3 is sync:** `db.prepare(sql).get(params)` / `.all(params)` / `.run(params)`. Use named params `@name`. No promises.
6. Enhance existing code. **Never migrate or rewrite the architecture.** No new dependencies unless explicitly approved.
## 4. Repo map (use this — don't search)
```
server/
  app.js              # createApp(): all route mounts. Prefix /api/v1 (legacy /api). Public: auth + booking-portal. Rest = authenticateJwt()
  index.js            # entry
  db.js               # ⛔ PROTECTED — schema, migrations, jsonColumns, helpers (listRows/getRow/insertRow/updateRow/deleteRow/columnsFor)
  config/env.js
  middleware/         # auth.js, rbac.js (requirePermission), request-context.js, security.js, error-handler.js, async-handler.js, mobile-response.js
  repositories/       # base.repository.js (BaseRepository), repository-registry.js (repositories, repositoryForResource)
  routes/*.routes.js  # THIN — validate, check permission, call service, emit/audit
  services/*.service.js  # business logic lives HERE
  utils/              # app-error.js (AppError + helpers), logger.js
  validators/         # request-validator.js (validateBody, validateResourcePayload)
src/app/
  pages/*.component.ts   # one standalone component per screen
  shared/ui/             # reusable UI (metric-card, state) + index.ts
  core/                  # api.service.ts, auth-session.service.ts, state/app-state.service.ts
scripts/                 # seed-demo-data.mjs, backup-database.mjs, check-server.mjs
tests/*.test.js          # node --test
```
**Flow:** `route → service → repository → db.js helpers`. Keep routes thin, logic in services.
 
## 5. Multi-tenancy & auth
- Context set in `request-context.js` from headers: `x-tenant-id`, `x-branch-id`, `x-user-id`, `x-user-email`, `x-user-role`.
- Every request has `req.access = { tenantId, role, userId, branchId, branchIds, requestedBranchId }`, plus `req.tenant`, `req.user`.
- Always pass `req.access` into services; services pass `tenantService.accessScope(access, resource)` into repositories. Use `tenantService.assertBranchAccess(access, branchId)` before returning/writing branch data.
- Roles: `owner`, `accountant`, `staff`, `frontDesk`, etc. RBAC via `requirePermission("read"|"write"|...)`.
---
 
## 6. CODE PATTERNS — copy these exactly
 
### Route (`server/routes/x.routes.js`)
```js
import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { validateBody } from "../validators/request-validator.js";
import { xService } from "../services/x.service.js";
 
export const xRouter = Router();
 
xRouter.get(
  "/x",
  requirePermission("read"),
  asyncHandler((req, res) => {
    res.json(xService.list(req.query, req.access));
  })
);
 
xRouter.post(
  "/x",
  requirePermission("write"),
  validateBody({ required: ["name"], enums: { status: ["active", "inactive"] } }),
  asyncHandler((req, res) => {
    const row = xService.create(req.body, req.access);
    res.status(201).json(row);
  })
);
```
Then mount in `app.js`: `app.use("/api/v1", authenticateJwt(), xRouter);`
 
### Service (`server/services/x.service.js`)
```js
import { notFound, badRequest } from "../utils/app-error.js";
import { repositories } from "../repositories/repository-registry.js";
import { tenantService } from "./tenant.service.js";
 
export class XService {
  list(query, access) {
    if (query?.branchId) tenantService.assertBranchAccess(access, query.branchId);
    return repositories.x.list(query, tenantService.accessScope(access, "x"));
  }
 
  get(id, access) {
    const row = repositories.x.getById(id, tenantService.accessScope(access, "x"));
    if (!row) throw notFound("X record not found");
    return row;
  }
 
  create(payload, access) {
    if (payload.branchId) tenantService.assertBranchAccess(access, payload.branchId);
    return repositories.x.create(payload, tenantService.accessScope(access, "x"));
  }
}
export const xService = new XService();
```
 
### Repository — extend BaseRepository (handles tenantId/branchId scoping automatically)
```js
import { BaseRepository } from "./base.repository.js";
export class XRepository extends BaseRepository {
  constructor() { super("x"); }   // "x" = table name
  // add custom queries only when needed:
  // findActive(scope) { return db.prepare("SELECT * FROM x WHERE tenantId = @tenantId AND status = 'active'").all(scope); }
}
```
Register it in `repository-registry.js`.
 
### Errors — throw helpers from `utils/app-error.js` (error-handler.js formats them)
```js
import { notFound, badRequest, conflict, forbidden, unauthorized } from "../utils/app-error.js";
throw badRequest("Missing service ids", { field: "serviceIds" });
// Never res.status(400).send(...) inside services — throw instead.
```
 
### Money (paise) helper pattern
```js
const totalPaise = items.reduce((sum, i) => sum + i.pricePaise * i.qty, 0); // integers only
// UI formats: (totalPaise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" })
```
 
### Frontend — use ApiService (`src/app/core/api.service.ts`), never raw HttpClient
```ts
// resource CRUD (hits /api/v1/<resource>)
this.api.list<Client[]>("clients").subscribe(rows => this.clients.set(rows));
this.api.create("clients", payload).subscribe(...);
this.api.update("clients", id, payload).subscribe(...);
// custom endpoint
this.api.post("finance/close-day", payload).subscribe(...);
```
Headers (tenant/branch/auth) and the `{ success, data, error }` envelope are handled inside ApiService — don't re-add them.
 
### Test (`tests/x.test.js`) — node:test, boot real app, fetch with headers
```js
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
 
test("x endpoint returns scoped data", async () => {
  const server = await new Promise(r => { const s = createApp().listen(0, "127.0.0.1", () => r(s)); });
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/x`, {
      headers: { "x-tenant-id": "tenant_aura", "x-user-role": "owner" }
    });
    assert.equal(res.status, 200);
  } finally {
    await new Promise((res, rej) => server.close(e => e ? rej(e) : res()));
  }
});
```
 
---
 
## 7. Recipe — "add a new API resource/feature"
1. (If new table needed) It must include `tenantId` + `createdAt`/`updatedAt`. **You can't edit `db.js` — flag the exact `CREATE TABLE` SQL for the human to add.**
2. Add `XRepository` and register in `repository-registry.js`.
3. Add `x.service.js` with access-scoped methods (pattern §6).
4. Add `x.routes.js` (thin, validated, permission-checked).
5. Mount router in `app.js` under `/api/v1` with `authenticateJwt()`.
6. Add a `tests/x.test.js`.
7. Frontend: call via `ApiService`.
## 8. Commands
| Action | Command |
|---|---|
| Dev (API+web) | `npm run dev` |
| API only | `npm run api` |
| Web only | `npm run client` (port 4300) |
| Build | `npm run build:client` (→ `ng build`) |
| Test | `npm test` |
| Quality gate | `npm run quality` (check + test + build) |
| Seed demo | `npm run seed:demo` |
 
## 9. Working style (token-efficient)
- One task per run. Do exactly what's asked, nothing extra.
- **Edit in diffs** — change only needed lines. Never rewrite a whole file (especially big ones).
- Match existing style: ES modules, named exports, 2-space indent, double quotes (backend).
- If ambiguous or it needs a protected file → **ask/flag, don't guess.**
## 10. Anti-patterns — ❌ never do this → ✅ do this
 
| ❌ Wrong (Codex often does this) | ✅ Correct (this codebase) |
|---|---|
| `await db.prepare(sql).get()` | `db.prepare(sql).get(params)` — better-sqlite3 is **sync**, no `await` |
| `WHERE tenant_id = ?` / snake_case columns | `WHERE tenantId = @tenantId` — **camelCase + named params** |
| `db.prepare("... WHERE id = '" + id + "'")` | `db.prepare("... WHERE id = @id").get({ id })` — **never string-concat SQL** (injection) |
| Storing price as `149.99` / float | Store `14999` **integer paise**; divide by 100 only in UI |
| `SELECT * FROM clients` (no tenant filter) | Always scope: pass `tenantService.accessScope(access, "clients")` |
| `res.status(404).json({ error: "..." })` in a service | `throw notFound("...")` — services throw, `error-handler.js` formats |
| Business logic inside the route handler | Route stays thin → call `xService.method(req.body, req.access)` |
| Editing `db.js` / `smart-booking.service.js` / `booking-portal.service.js` / `operations.routes.js` | **STOP & flag.** These 4 are protected |
| Adding `mongoose`, `prisma`, `redis`, `bull`, `axios`, TypeScript to backend | Use existing deps only; backend is plain JS ESM + better-sqlite3 |
| Frontend raw `this.http.get("http://localhost:4000/...")` | Use `this.api.list/get/create/post(...)` — headers + envelope handled inside |
| Rewriting a whole file to change 3 lines | Diff-edit only the lines that change |
| `module.exports` / `require(...)` | ESM only: `export`, `import` (`"type": "module"`) |
| Inventing a new folder structure | Follow §4 map: route → service → repository → db helpers |
 
## 11. Codex execution environment
- Base: Universal image, **Node v24**.
- Install: `npm ci --no-audit --no-fund` (lockfile is committed — don't run `npm install` or change `package-lock.json` casually).
- Container caching: ON. Agent internet access: ON.
- Build to verify a change compiles: `npm run build:client` (→ `ng build`).
- Full gate before declaring done: `npm run quality` (server check + tests + build).
- Don't introduce env vars beyond `.env.example`; if a new one is truly needed, flag it.
## 12. Definition of done
- [ ] Only task-relevant files touched
- [ ] No protected file modified
- [ ] Money handled as integer paise
- [ ] Every new query scoped by `tenantId` (camelCase)
- [ ] Errors thrown via `app-error.js` helpers (not raw responses)
- [ ] `npm run quality` would pass (builds, tests green)
- [ ] No new dependencies added without approval