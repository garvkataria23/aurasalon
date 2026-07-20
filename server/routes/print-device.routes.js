import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { printDeviceService } from "../services/print-device.service.js";

export const printDeviceRouter = Router();

printDeviceRouter.post("/print/jobs", requirePermission("write", () => "invoices"), asyncHandler((req, res) => {
  res.status(201).json(printDeviceService.createJob(req.body, req.access));
}));

printDeviceRouter.get("/print/jobs", requirePermission("read", () => "invoices"), asyncHandler((req, res) => {
  res.json({ rows: printDeviceService.listJobs(req.query, req.access) });
}));

printDeviceRouter.post("/print/jobs/:id/retry", requirePermission("write", () => "invoices"), asyncHandler((req, res) => {
  res.json(printDeviceService.retryJob(req.params.id, req.access));
}));

printDeviceRouter.post("/barcode/resolve", requirePermission("read", () => "products"), asyncHandler((req, res) => {
  res.json(printDeviceService.resolveBarcode(req.body, req.access));
}));

printDeviceRouter.get("/print/devices", requirePermission("read", () => "invoices"), asyncHandler((req, res) => {
  res.json({ rows: printDeviceService.listDevices(req.query, req.access) });
}));

printDeviceRouter.post("/print/devices", requirePermission("write", () => "invoices"), asyncHandler((req, res) => {
  res.status(201).json(printDeviceService.createDevice(req.body, req.access));
}));
