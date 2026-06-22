import { Router } from "express";
import { autonomousEnterprisePlatformService } from "../services/autonomous-enterprise-platform.service.js";
import { route } from "./staff-os-route-utils.js";

export const autonomousEnterpriseRouter = Router();

autonomousEnterpriseRouter.get("/ai-ceo/daily-brief", route((req, res) => res.json(autonomousEnterprisePlatformService.listCeoBriefs(req.query, req.access))));
autonomousEnterpriseRouter.post("/ai-ceo/daily-brief", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.generateCeoBrief(req.body, req.access))));
autonomousEnterpriseRouter.get("/ai-ceo/actions", route((req, res) => res.json(autonomousEnterprisePlatformService.listCeoActions(req.query, req.access))));
autonomousEnterpriseRouter.post("/ai-ceo/actions/:id/approve", route((req, res) => res.json(autonomousEnterprisePlatformService.approveCeoAction(req.params.id, req.body, req.access))));

autonomousEnterpriseRouter.get("/approval-hub/requests", route((req, res) => res.json(autonomousEnterprisePlatformService.approvalRequests(req.query, req.access))));
autonomousEnterpriseRouter.post("/approval-hub/requests", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.createApprovalRequest(req.body, req.access))));
autonomousEnterpriseRouter.post("/approval-hub/requests/:id/approve", route((req, res) => res.json(autonomousEnterprisePlatformService.decideApproval(req.params.id, "approve", req.body, req.access))));
autonomousEnterpriseRouter.post("/approval-hub/requests/:id/reject", route((req, res) => res.json(autonomousEnterprisePlatformService.decideApproval(req.params.id, "reject", req.body, req.access))));
autonomousEnterpriseRouter.post("/approval-hub/requests/:id/snooze", route((req, res) => res.json(autonomousEnterprisePlatformService.decideApproval(req.params.id, "snooze", req.body, req.access))));
autonomousEnterpriseRouter.post("/approval-hub/requests/:id/delegate", route((req, res) => res.json(autonomousEnterprisePlatformService.decideApproval(req.params.id, "delegate", req.body, req.access))));
autonomousEnterpriseRouter.post("/approval-hub/requests/:id/require-evidence", route((req, res) => res.json(autonomousEnterprisePlatformService.decideApproval(req.params.id, "evidence", req.body, req.access))));

autonomousEnterpriseRouter.get("/ai-model-router/providers", route((req, res) => res.json(autonomousEnterprisePlatformService.modelProviders(req.query, req.access))));
autonomousEnterpriseRouter.post("/ai-model-router/providers", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.createModelProvider(req.body, req.access))));
autonomousEnterpriseRouter.post("/ai-model-router/route", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.routeModel(req.body, req.access))));
autonomousEnterpriseRouter.get("/ai-model-router/metrics", route((req, res) => res.json(autonomousEnterprisePlatformService.modelMetrics(req.query, req.access))));

autonomousEnterpriseRouter.get("/event-ledger/events", route((req, res) => res.json(autonomousEnterprisePlatformService.ledgerEvents(req.query, req.access))));
autonomousEnterpriseRouter.post("/event-ledger/events", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.appendLedgerEvent(req.body, req.access))));
autonomousEnterpriseRouter.post("/event-ledger/replay", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.replayLedger(req.body, req.access))));

autonomousEnterpriseRouter.get("/war-room/snapshot", route((req, res) => res.json(autonomousEnterprisePlatformService.warRoomSnapshots(req.query, req.access))));
autonomousEnterpriseRouter.post("/war-room/snapshot", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.createWarRoomSnapshot(req.body, req.access))));
autonomousEnterpriseRouter.get("/war-room/alerts", route((req, res) => res.json(autonomousEnterprisePlatformService.warRoomAlerts(req.query, req.access))));

autonomousEnterpriseRouter.get("/digital-twin-v2/scenarios", route((req, res) => res.json(autonomousEnterprisePlatformService.digitalTwinV2Scenarios(req.query, req.access))));
autonomousEnterpriseRouter.post("/digital-twin-v2/forecast", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.forecastDigitalTwinV2(req.body, req.access))));

autonomousEnterpriseRouter.get("/customer-super-graph/:clientId", route((req, res) => res.json(autonomousEnterprisePlatformService.customerSuperGraph(req.params.clientId, req.query, req.access))));
autonomousEnterpriseRouter.post("/customer-super-graph/:clientId/rebuild", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.rebuildCustomerSuperGraph(req.params.clientId, req.body, req.access))));

autonomousEnterpriseRouter.get("/voice-receptionist/calls", route((req, res) => res.json(autonomousEnterprisePlatformService.voiceCalls(req.query, req.access))));
autonomousEnterpriseRouter.post("/voice-receptionist/calls", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.captureVoiceCall(req.body, req.access))));
autonomousEnterpriseRouter.post("/voice-receptionist/calls/:id/handoff", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.handoffVoiceCall(req.params.id, req.body, req.access))));

autonomousEnterpriseRouter.get("/computer-vision/events", route((req, res) => res.json(autonomousEnterprisePlatformService.computerVisionEvents(req.query, req.access))));
autonomousEnterpriseRouter.post("/computer-vision/events", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.createComputerVisionEvent(req.body, req.access))));

autonomousEnterpriseRouter.get("/whatsapp-commerce/sessions", route((req, res) => res.json(autonomousEnterprisePlatformService.whatsappCommerceSessions(req.query, req.access))));
autonomousEnterpriseRouter.post("/whatsapp-commerce/sessions", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.createWhatsappCommerceSession(req.body, req.access))));
autonomousEnterpriseRouter.post("/whatsapp-commerce/sessions/:id/checkout", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.checkoutWhatsappCommerce(req.params.id, req.body, req.access))));

autonomousEnterpriseRouter.get("/owner-mobile/brief", route((req, res) => res.json(autonomousEnterprisePlatformService.ownerMobileBriefs(req.query, req.access))));
autonomousEnterpriseRouter.post("/enterprise-mobile/apps", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.registerEnterpriseMobileApp(req.body, req.access))));

autonomousEnterpriseRouter.get("/franchise-os/units", route((req, res) => res.json(autonomousEnterprisePlatformService.franchiseUnits(req.query, req.access))));
autonomousEnterpriseRouter.post("/franchise-os/units", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.createFranchiseUnit(req.body, req.access))));
autonomousEnterpriseRouter.post("/franchise-os/royalty-runs", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.createRoyaltyRun(req.body, req.access))));

autonomousEnterpriseRouter.get("/financial-brain/findings", route((req, res) => res.json(autonomousEnterprisePlatformService.financialFindings(req.query, req.access))));
autonomousEnterpriseRouter.post("/financial-brain/forecast", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.forecastFinancialBrain(req.body, req.access))));

autonomousEnterpriseRouter.get("/marketplace/connectors", route((req, res) => res.json(autonomousEnterprisePlatformService.providerConnectors(req.query, req.access))));
autonomousEnterpriseRouter.post("/marketplace/connectors", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.createProviderConnector(req.body, req.access))));
autonomousEnterpriseRouter.get("/marketplace/plugins", route((req, res) => res.json(autonomousEnterprisePlatformService.marketplacePlugins(req.query, req.access))));
autonomousEnterpriseRouter.post("/marketplace/plugins", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.createMarketplacePlugin(req.body, req.access))));
autonomousEnterpriseRouter.post("/marketplace/plugins/:id/install", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.installMarketplacePlugin(req.params.id, req.body, req.access))));

autonomousEnterpriseRouter.get("/cloud-hardening/checks", route((req, res) => res.json(autonomousEnterprisePlatformService.cloudReadinessChecks(req.query, req.access))));
autonomousEnterpriseRouter.post("/cloud-hardening/checks", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.runCloudReadinessCheck(req.body, req.access))));
autonomousEnterpriseRouter.post("/cloud-hardening/backup-restore-points", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.createBackupRestorePoint(req.body, req.access))));
autonomousEnterpriseRouter.post("/cloud-hardening/disaster-recovery/run", route((req, res) => res.status(201).json(autonomousEnterprisePlatformService.runDisasterRecovery(req.body, req.access))));
