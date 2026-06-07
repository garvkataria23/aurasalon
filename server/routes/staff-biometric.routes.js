import { Router } from "express";
import { staffBiometricService } from "../services/staff-biometric.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffBiometricRouter = Router();

staffBiometricRouter.get("/staff-os/biometric/devices", route((req, res) => res.json(staffBiometricService.listDevices(req.query, req.access))));
staffBiometricRouter.post("/staff-os/biometric/devices", route((req, res) => res.status(201).json(staffBiometricService.registerDevice(req.body, req.access))));
staffBiometricRouter.patch("/staff-os/biometric/devices/:id", route((req, res) => res.json(staffBiometricService.updateDevice(req.params.id, req.body, req.access))));
staffBiometricRouter.post("/staff-os/biometric/devices/:id/sync", route((req, res) => res.json(staffBiometricService.syncDevice(req.params.id, req.body, req.access))));
staffBiometricRouter.post("/staff-os/biometric/process-queue", route((req, res) => res.json(staffBiometricService.processQueue(req.body, req.access))));
staffBiometricRouter.get("/staff-os/biometric/logs", route((req, res) => res.json(staffBiometricService.logs(req.query, req.access))));
staffBiometricRouter.get("/staff-os/biometric/mappings", route((req, res) => res.json(staffBiometricService.listMappings(req.query, req.access))));
staffBiometricRouter.post("/staff-os/biometric/mappings", route((req, res) => res.status(201).json(staffBiometricService.createMapping(req.body, req.access))));
staffBiometricRouter.patch("/staff-os/biometric/mappings/:id/approve", route((req, res) => res.json(staffBiometricService.approveMapping(req.params.id, req.body, req.access))));
staffBiometricRouter.get("/staff-os/biometric/gateway/manifest", route((req, res) => res.json(staffBiometricService.gatewayManifest(req.query, req.access))));
staffBiometricRouter.post("/staff-os/biometric/gateway/register", route((req, res) => res.status(201).json(staffBiometricService.registerGateway(req.body, req.access))));
staffBiometricRouter.post("/staff-os/biometric/gateway/:id/heartbeat", route((req, res) => res.json(staffBiometricService.gatewayHeartbeat(req.params.id, req.body, req.access))));
staffBiometricRouter.post("/staff-os/biometric/gateway/:id/events", route((req, res) => res.status(202).json(staffBiometricService.gatewayEvents(req.params.id, req.body, req.access))));
staffBiometricRouter.get("/staff-os/biometric/consents", route((req, res) => res.json(staffBiometricService.listConsents(req.query, req.access))));
staffBiometricRouter.post("/staff-os/biometric/consents", route((req, res) => res.status(201).json(staffBiometricService.upsertConsent(req.body, req.access))));
staffBiometricRouter.patch("/staff-os/biometric/consents/:id/delete-request", route((req, res) => res.json(staffBiometricService.requestConsentDeletion(req.params.id, req.body, req.access))));
staffBiometricRouter.get("/staff-os/attendance/biometric-center", route((req, res) => res.json(staffBiometricService.attendanceCenter(req.query, req.access))));
staffBiometricRouter.post("/staff-os/attendance/camera-punch", route((req, res) => res.status(201).json(staffBiometricService.cameraPunch(req.body, req.access))));
staffBiometricRouter.get("/staff-os/attendance/risks", route((req, res) => res.json(staffBiometricService.attendanceRisks(req.query, req.access))));
staffBiometricRouter.post("/staff-os/attendance/fraud-scan", route((req, res) => res.json(staffBiometricService.runFraudScan(req.body, req.access))));
staffBiometricRouter.get("/staff-os/attendance/payroll-preview", route((req, res) => res.json(staffBiometricService.payrollPreviewRows(req.query, req.access))));
staffBiometricRouter.post("/staff-os/attendance/payroll-preview", route((req, res) => res.status(201).json(staffBiometricService.payrollAutopilotPreview(req.body, req.access))));
staffBiometricRouter.get("/staff-os/owner-alerts", route((req, res) => res.json(staffBiometricService.ownerAlerts(req.query, req.access))));
