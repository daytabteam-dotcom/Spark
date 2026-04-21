import { Router, type IRouter } from "express";
import { logBehaviorEvent, refreshUserBehaviorProfile } from "../lib/personalization";

const router: IRouter = Router();

function parseBehaviorEventBody(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  if (typeof data.userId !== "string" || typeof data.eventType !== "string") return null;
  const taskId = typeof data.taskId === "string" ? data.taskId : null;
  const metadata =
    data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
      ? (data.metadata as Record<string, unknown>)
      : {};
  return { userId: data.userId, eventType: data.eventType, taskId, metadata };
}

router.post("/behavior/events", async (req, res) => {
  const parsed = parseBehaviorEventBody(req.body);
  if (!parsed) return res.status(400).json({ error: "invalid_body" });

  await logBehaviorEvent(parsed);
  const user = await refreshUserBehaviorProfile(parsed.userId);
  return res.status(201).json({
    ok: true,
    behaviorProfile: user?.behaviorProfile ?? null,
    behaviorMetrics: user?.behaviorMetrics ?? null,
  });
});

export default router;
