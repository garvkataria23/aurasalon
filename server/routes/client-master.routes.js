import { Router } from "express";
import { clientMasterService } from "../services/client-master.service.js";
import { route } from "./staff-os-route-utils.js";

export const clientMasterRouter = Router();

const kinds = ["categories", "sources", "preferences", "consultation-templates", "feedback-definitions"];

clientMasterRouter.get("/client-masters/summary", route((req, res) => res.json(clientMasterService.summary(req.query, req.access))));

for (const kind of kinds) {
  clientMasterRouter.get(`/client-masters/${kind}`, route((req, res) => res.json(clientMasterService.list(kind, req.query, req.access))));
  clientMasterRouter.post(`/client-masters/${kind}`, route((req, res) => res.status(201).json(clientMasterService.create(kind, req.body, req.access))));
  clientMasterRouter.get(`/client-masters/${kind}/:id`, route((req, res) => res.json(clientMasterService.get(kind, req.params.id, req.access))));
  clientMasterRouter.patch(`/client-masters/${kind}/:id`, route((req, res) => res.json(clientMasterService.update(kind, req.params.id, req.body, req.access))));
  clientMasterRouter.patch(`/client-masters/${kind}/:id/status`, route((req, res) => res.json(clientMasterService.updateStatus(kind, req.params.id, req.body, req.access))));
}
