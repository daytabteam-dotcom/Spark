import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, tasksTable } from "@workspace/db";
import {
  CreateTaskBody,
  UpdateTaskBody,
  ExtractTasksBody,
  ConfirmExtractedTasksBody,
} from "@workspace/api-zod";
import { generateText } from "../lib/openai";
import {
  findUserById,
  logBehaviorEvent,
  logTaskSwitchIfNeeded,
  taskGenerationPersonalizationPrompt,
} from "../lib/personalization";

const router: IRouter = Router();

router.get("/tasks", async (req, res) => {
  const userId = req.query["userId"] as string | undefined;
  const status = req.query["status"] as string | undefined;
  if (!userId) return res.status(400).json({ error: "userId_required" });
  const conds = [eq(tasksTable.userId, userId)];
  if (status) conds.push(eq(tasksTable.status, status as never));
  const rows = await db
    .select()
    .from(tasksTable)
    .where(and(...conds))
    .orderBy(desc(tasksTable.createdAt));
  return res.json(rows);
});

router.post("/tasks", async (req, res) => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.issues });
  }
  const [task] = await db
    .insert(tasksTable)
    .values({
      userId: parsed.data.userId,
      title: parsed.data.title,
      durationMinutes: parsed.data.durationMinutes ?? null,
      resistanceLevel: parsed.data.resistanceLevel ?? "medium",
      taskType: parsed.data.taskType ?? null,
      scheduledFor: parsed.data.scheduledFor ?? null,
      status: parsed.data.scheduledFor ? "scheduled" : "open",
    })
    .returning();
  await logBehaviorEvent({
    userId: task.userId,
    eventType: "task_generated",
    taskId: task.id,
    metadata: { source: "manual_create", durationMinutes: task.durationMinutes },
  });
  return res.status(201).json(task);
});

router.patch("/tasks/:taskId", async (req, res) => {
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.issues });
  }
  const [before] = await db.select().from(tasksTable).where(eq(tasksTable.id, req.params.taskId));
  const [task] = await db
    .update(tasksTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(tasksTable.id, req.params.taskId))
    .returning();
  if (!task) return res.status(404).json({ error: "not_found" });
  if (before) {
    if (parsed.data.status === "in_progress" && before.status !== "in_progress") {
      await logTaskSwitchIfNeeded(task.userId, task.id);
      await logBehaviorEvent({
        userId: task.userId,
        eventType: "task_started",
        taskId: task.id,
        metadata: {
          startDelaySeconds: Math.max(
            0,
            Math.round((Date.now() - before.createdAt.getTime()) / 1000),
          ),
          durationMinutes: task.durationMinutes,
        },
      });
    }
    if (parsed.data.status === "completed" && before.status !== "completed") {
      await logBehaviorEvent({
        userId: task.userId,
        eventType: "task_completed",
        taskId: task.id,
        metadata: { durationMinutes: task.durationMinutes, resistanceLevel: task.resistanceLevel },
      });
    }
    if (parsed.data.status === "paused") {
      await logBehaviorEvent({
        userId: task.userId,
        eventType: "task_abandoned",
        taskId: task.id,
        metadata: { previousStatus: before.status },
      });
    }
    if (parsed.data.scheduledFor && parsed.data.scheduledFor !== before.scheduledFor) {
      await logBehaviorEvent({
        userId: task.userId,
        eventType: "task_rescheduled",
        taskId: task.id,
      });
    }
    if (parsed.data.title || parsed.data.durationMinutes || parsed.data.resistanceLevel) {
      await logBehaviorEvent({
        userId: task.userId,
        eventType: "plan_edited",
        taskId: task.id,
      });
    }
  }
  return res.json(task);
});

router.delete("/tasks/:taskId", async (req, res) => {
  await db.delete(tasksTable).where(eq(tasksTable.id, req.params.taskId));
  return res.status(204).send();
});

router.post("/tasks/extract", async (req, res) => {
  const parsed = ExtractTasksBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.issues });
  }
  const user = parsed.data.userId ? await findUserById(parsed.data.userId) : null;
  const systemPrompt = `You extract concrete actionable tasks from a person's brain dump. Return ONLY a JSON object with shape:
{"tasks":[{"title":string,"durationMinutes":number|null,"resistanceLevel":"low"|"medium"|"high","taskType":string|null}]}
Rules:
- Each task is a single concrete action, max 60 chars.
- Estimate durationMinutes (5-120) when reasonable, otherwise null.
- resistanceLevel: "high" for emotional/admin/dreaded; "low" for trivial; else "medium".
- taskType: short tag like "email","errand","creative","admin","health" or null.
- Do not invent tasks not implied by the text.
${taskGenerationPersonalizationPrompt(user)}`;
  try {
    const text = await generateText({
      instructions: systemPrompt,
      maxOutputTokens: 1024,
      input: [{ role: "user", content: parsed.data.rawText }],
    });
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    const jsonStr = jsonStart >= 0 ? text.slice(jsonStart, jsonEnd + 1) : "{\"tasks\":[]}";
    const parsedJson = JSON.parse(jsonStr);
    return res.json({ tasks: Array.isArray(parsedJson.tasks) ? parsedJson.tasks : [] });
  } catch (err) {
    req.log.error({ err }, "extract failed");
    return res.status(500).json({ error: "extract_failed" });
  }
});

router.post("/tasks/confirm-extract", async (req, res) => {
  const parsed = ConfirmExtractedTasksBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.issues });
  }
  if (parsed.data.tasks.length === 0) return res.status(201).json([]);
  const rows = await db
    .insert(tasksTable)
    .values(
      parsed.data.tasks.map((t) => ({
        userId: parsed.data.userId,
        title: t.title,
        durationMinutes: t.durationMinutes ?? null,
        resistanceLevel: t.resistanceLevel,
        taskType: t.taskType ?? null,
      })),
    )
    .returning();
  await Promise.all(
    rows.map((task) =>
      logBehaviorEvent({
        userId: task.userId,
        eventType: "task_generated",
        taskId: task.id,
        metadata: { source: "brain_dump", durationMinutes: task.durationMinutes },
      }),
    ),
  );
  return res.status(201).json(rows);
});

export default router;
