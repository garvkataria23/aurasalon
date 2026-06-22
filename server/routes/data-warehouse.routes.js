import { Router } from "express";
import { dataWarehouseService } from "../services/data-warehouse.service.js";
import { route } from "./staff-os-route-utils.js";

export const dataWarehouseRouter = Router();

dataWarehouseRouter.post("/warehouse/refresh", route((req, res) => res.status(201).json(dataWarehouseService.refresh(req.body, req.access))));
dataWarehouseRouter.get("/warehouse/kpis", route((req, res) => res.json(dataWarehouseService.kpis(req.query, req.access))));
dataWarehouseRouter.get("/warehouse/snapshots", route((req, res) => res.json(dataWarehouseService.snapshots(req.query, req.access))));
dataWarehouseRouter.get("/warehouse/facts/:type", route((req, res) => res.json(dataWarehouseService.facts(req.params.type, req.query, req.access))));
