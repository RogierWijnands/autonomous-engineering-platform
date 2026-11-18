import { Router } from "express";
import { InputError, type createStore } from "../database/store.ts";

export function testRoutes(store: ReturnType<typeof createStore>) {
  const router = Router({ caseSensitive: true, strict: true });

  // Fixture replacement is available only in the explicitly enabled test mode.
  router.post("/test/reset", (req, res) => {
    const payload: Record<string, unknown> = req.body;
    if (process.env.JIRA_TEST_MODE !== "1") {
      throw new InputError("Not found.", 404);
    }
    if (!Array.isArray(payload.projects) || !Array.isArray(payload.issues)) {
      throw new InputError("Invalid test data.");
    }
    res.json(store.resetTestData(payload));
  });

  return router;
}
