import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, tasksTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  CreateTaskBody,
  UpdateTaskBody,
  ExtractTasksBody,
  ConfirmExtractedTasksBody,
} from "@workspace/api-zod";

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
  return res.status(201).json(task);
});

router.patch("/tasks/:taskId", async (req, res) => {
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.issues });
  }
  const [task] = await db
    .update(tasksTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(tasksTable.id, req.params.taskId))
    .returning();
  if (!task) return res.status(404).json({ error: "not_found" });
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
  const systemPrompt = `You extract concrete actionable tasks from a person's brain dump. Return ONLY a JSON object with shape:
{"tasks":[{"title":string,"durationMinutes":number|null,"resistanceLevel":"low"|"medium"|"high","taskType":string|null}]}
Rules:
- Each task is a single concrete action, max 60 chars.
- Estimate durationMinutes (5-120) when reasonable, otherwise null.
- resistanceLevel: "high" for emotional/admin/dreaded; "low" for trivial; else "medium".
- taskType: short tag like "email","errand","creative","admin","health" or null.
- Do not invent tasks not implied by the text.`;
  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: parsed.data.rawText }],
    });
    const block = msg.content[0];
    const text = block && block.type === "text" ? block.text : "{\"tasks\":[]}";
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
  return res.status(201).json(rows);
});

export default router;
