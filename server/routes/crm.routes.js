import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { customerSegmentationService } from "../services/customer-segmentation.service.js";

export const crmRouter = Router();

crmRouter.get(
  "/crm/segments",
  requirePermission("read", () => "clients"),
  asyncHandler((req, res) => {
    res.json(customerSegmentationService.getSegmentStats(req.access?.tenantId));
  })
);

crmRouter.get(
  "/crm/segments/:segment/customers",
  requirePermission("read", () => "clients"),
  asyncHandler((req, res) => {
    res.json(customerSegmentationService.getCustomersBySegment(
      req.access?.tenantId,
      req.params.segment,
      req.query.limit,
      req.query.offset,
      req.query.sortBy
    ));
  })
);
