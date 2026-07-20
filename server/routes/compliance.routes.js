import { Router } from "express";
import { bonusComplianceRouter } from "./compliance/bonus.routes.js";
import { complianceDashboardRouter } from "./compliance/dashboard.routes.js";
import { esiComplianceRouter } from "./compliance/esi.routes.js";
import { fyComplianceRouter } from "./compliance/fy.routes.js";
import { gratuityComplianceRouter } from "./compliance/gratuity.routes.js";
import { lwfComplianceRouter } from "./compliance/lwf.routes.js";
import { pfComplianceRouter } from "./compliance/pf.routes.js";
import { ptComplianceRouter } from "./compliance/pt.routes.js";
import { tdsComplianceRouter } from "./compliance/tds.routes.js";

export const statutoryComplianceRouter = Router();

statutoryComplianceRouter.use(pfComplianceRouter);
statutoryComplianceRouter.use(esiComplianceRouter);
statutoryComplianceRouter.use(ptComplianceRouter);
statutoryComplianceRouter.use(tdsComplianceRouter);
statutoryComplianceRouter.use(gratuityComplianceRouter);
statutoryComplianceRouter.use(bonusComplianceRouter);
statutoryComplianceRouter.use(lwfComplianceRouter);
statutoryComplianceRouter.use(complianceDashboardRouter);
statutoryComplianceRouter.use(fyComplianceRouter);
