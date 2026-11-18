import { Router } from "express";
import type { createStore } from "../database/store.ts";

export function projectRoutes(store: ReturnType<typeof createStore>) {
  const router = Router({ caseSensitive: true, strict: true });

  router.post("/projects/create", (req, res) => {
    const payload: Record<string, unknown> = req.body;
    res.json(store.createProject(payload.name));
  });
  router.post("/projects/update", (req, res) => {
    const payload: Record<string, unknown> = req.body;
    res.json(store.updateProject(payload.id, payload.name));
  });
  // The caller supplies the related issue keys it confirmed for deletion.
  router.post("/projects/delete", (req, res) => {
    const payload: Record<string, unknown> = req.body;
    res.json(store.deleteProject(payload.id, payload.issueKeys));
  });

  return router;
}
