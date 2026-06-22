import { Router } from "express";
import { staffTaskService } from "../services/staff-task.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffTaskRouter = Router();

staffTaskRouter.get("/staff-os/tasks", route((req, res) => res.json(staffTaskService.listTasks(req.query, req.access))));
staffTaskRouter.post("/staff-os/tasks", route((req, res) => res.status(201).json(staffTaskService.createTask(req.body, req.access))));
staffTaskRouter.patch("/staff-os/tasks/:id", route((req, res) => res.json(staffTaskService.updateTask(req.params.id, req.body, req.access))));
staffTaskRouter.post("/staff-os/tasks/:id/comments", route((req, res) => res.status(201).json(staffTaskService.addTaskComment(req.params.id, req.body, req.access))));
