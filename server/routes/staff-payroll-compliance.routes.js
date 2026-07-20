import { Router } from "express";
import { staffPayrollComplianceService } from "../services/staff-payroll-compliance.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffPayrollComplianceRouter = Router();

staffPayrollComplianceRouter.get("/staff-os/payroll-compliance/rules", route((req, res) => res.json(staffPayrollComplianceService.listRules(req.query, req.access))));
staffPayrollComplianceRouter.post("/staff-os/payroll-compliance/rules", route((req, res) => res.status(201).json(staffPayrollComplianceService.createRule(req.body, req.access))));
staffPayrollComplianceRouter.get("/staff-os/payroll-compliance/summary", route((req, res) => res.json(staffPayrollComplianceService.summary(req.query, req.access))));
staffPayrollComplianceRouter.post("/staff-os/payroll-compliance/calculate", route((req, res) => res.status(201).json(staffPayrollComplianceService.calculate(req.body, req.access))));
staffPayrollComplianceRouter.post("/staff-os/payroll-compliance/export", route((req, res) => res.status(201).json(staffPayrollComplianceService.exportCompliance(req.body, req.access))));
staffPayrollComplianceRouter.get("/staff-os/staff/:id/salary-history", route((req, res) => res.json(staffPayrollComplianceService.salaryHistory(req.params.id, req.access))));
staffPayrollComplianceRouter.post("/staff-os/staff/:id/salary-revision", route((req, res) => res.status(201).json(staffPayrollComplianceService.createSalaryRevision(req.params.id, req.body, req.access))));
staffPayrollComplianceRouter.get("/staff-os/staff/:id/salary-revisions", route((req, res) => res.json(staffPayrollComplianceService.salaryHistory(req.params.id, req.access))));
staffPayrollComplianceRouter.post("/staff-os/staff/:id/salary-revisions", route((req, res) => res.status(201).json(staffPayrollComplianceService.createSalaryRevision(req.params.id, req.body, req.access))));
staffPayrollComplianceRouter.post("/staff-os/salary-revisions/:id/approve", route((req, res) => res.json(staffPayrollComplianceService.approveSalaryRevision(req.params.id, req.access))));
staffPayrollComplianceRouter.post("/staff-os/salary-revisions/:id/reject", route((req, res) => res.json(staffPayrollComplianceService.rejectSalaryRevision(req.params.id, req.access))));
staffPayrollComplianceRouter.post("/staff-os/salary-revisions/:id/correction", route((req, res) => res.status(201).json(staffPayrollComplianceService.correctSalaryRevision(req.params.id, req.body, req.access))));
