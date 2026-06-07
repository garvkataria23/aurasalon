import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { accountMasterService } from "../services/account-master.service.js";
import { validateBody } from "../validators/request-validator.js";

export const accountMasterRouter = Router();

accountMasterRouter.get(
  "/account-master",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => {
    res.json(accountMasterService.overview(req.query, req.access));
  })
);

accountMasterRouter.get(
  "/account-master/groups",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => {
    res.json(accountMasterService.groups(req.query, req.access));
  })
);

accountMasterRouter.post(
  "/account-master/groups/restore-defaults",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => {
    res.json(accountMasterService.restoreDefaultGroups({ ...req.query, ...req.body }, req.access));
  })
);

accountMasterRouter.post(
  "/account-master/groups",
  requirePermission("write", () => "finance"),
  validateBody({ required: ["groupName"] }),
  asyncHandler((req, res) => {
    res.status(201).json(accountMasterService.createGroup(req.body, req.access));
  })
);

accountMasterRouter.patch(
  "/account-master/groups/:id",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => {
    res.json(accountMasterService.updateGroup(req.params.id, req.body, req.access));
  })
);

accountMasterRouter.delete(
  "/account-master/groups/:id",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => {
    res.json(accountMasterService.deleteGroup(req.params.id, req.access));
  })
);

accountMasterRouter.get(
  "/account-master/accounts",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => {
    res.json(accountMasterService.accounts(req.query, req.access));
  })
);

accountMasterRouter.get(
  "/account-master/accounts/:id",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => {
    res.json(accountMasterService.account(req.params.id, req.access));
  })
);

accountMasterRouter.get(
  "/account-master/ledger",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => {
    res.json(accountMasterService.ledger(req.query, req.access));
  })
);

accountMasterRouter.post(
  "/account-master/accounts",
  requirePermission("write", () => "finance"),
  validateBody({ required: ["accountName"] }),
  asyncHandler((req, res) => {
    res.status(201).json(accountMasterService.createAccount(req.body, req.access));
  })
);

accountMasterRouter.patch(
  "/account-master/accounts/:id",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => {
    res.json(accountMasterService.updateAccount(req.params.id, req.body, req.access));
  })
);

accountMasterRouter.delete(
  "/account-master/accounts/:id",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => {
    res.json(accountMasterService.deleteAccount(req.params.id, req.access));
  })
);
