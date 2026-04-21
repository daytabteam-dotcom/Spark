import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";
import { CreateSessionBody, UpdateSessionBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/sessions", async (req, res) => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.issues });
  }
  const [session] = await db
    .insert(sessionsTable)
    .values({
      userId: parsed.data.userId,
      characterId: parsed.data.characterId,
      activeTaskId: parsed.data.activeTaskId ?? null,
    })
    .returning();
  return res.status(201).json(session);
});

router.patch("/sessions/:sessionId", async (req, res) => {
  const parsed = UpdateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.issues });
  }
  const [session] = await db
    .update(sessionsTable)
    .set(parsed.data)
    .where(eq(sessionsTable.id, req.params.sessionId))
    .returning();
  if (!session) return res.status(404).json({ error: "not_found" });
  return res.json(session);
});

export default router;
