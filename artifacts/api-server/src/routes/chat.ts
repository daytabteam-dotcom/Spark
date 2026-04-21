import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, chatMessagesTable, tasksTable, usersTable } from "@workspace/db";
import { SendChatMessageBody } from "@workspace/api-zod";
import { getCharacter } from "../lib/characters";
import { generateText } from "../lib/openai";
import { assistantPersonalizationPrompt, logBehaviorEvent } from "../lib/personalization";

const router: IRouter = Router();

router.post("/chat", async (req, res) => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.issues });
  }
  const { userId, characterId, message, sessionId, activeTaskId } = parsed.data;
  const character = getCharacter(characterId);
  if (!character) return res.status(400).json({ error: "unknown_character" });
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  let activeTaskContext = "";
  if (activeTaskId) {
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, activeTaskId));
    if (task) {
      activeTaskContext = `\nThe user's active focus task is: "${task.title}" (resistance: ${task.resistanceLevel}).`;
    }
  }

  const recent = await db
    .select()
    .from(chatMessagesTable)
    .where(and(eq(chatMessagesTable.userId, userId), eq(chatMessagesTable.characterId, characterId)))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(10);

  const history = recent.reverse().map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));

  await db.insert(chatMessagesTable).values({
    userId,
    characterId,
    sessionId: sessionId ?? null,
    role: "user",
    content: message,
    uiBlocks: [],
  });

  const systemPrompt = `${character.personalityPrompt}${activeTaskContext}

${user ? assistantPersonalizationPrompt(user) : ""}

You may optionally include UI elements by emitting a final code block with this exact format:
\`\`\`uiblocks
{"blocks":[{"type":"options","options":["..."]},{"type":"checklist","items":["..."]}]}
\`\`\`
Valid block types: "options" (quick reply buttons), "checklist" (visible checklist), "timer" (data: {minutes:number}), "celebration" (data: {message:string}).
Keep prose concise (1-4 short sentences). Only include uiblocks when genuinely helpful.`;

  try {
    const fullText = await generateText({
      instructions: systemPrompt,
      maxOutputTokens: 1024,
      input: [...history, { role: "user", content: message }],
    });

    let prose = fullText || "...";
    let uiBlocks: unknown[] = [];
    const fenceMatch = fullText.match(/```uiblocks\s*([\s\S]*?)```/);
    if (fenceMatch) {
      prose = fullText.replace(fenceMatch[0], "").trim();
      try {
        const parsedBlocks = JSON.parse(fenceMatch[1].trim());
        if (Array.isArray(parsedBlocks.blocks)) uiBlocks = parsedBlocks.blocks;
      } catch {
        // ignore malformed
      }
    }

    await db.insert(chatMessagesTable).values({
      userId,
      characterId,
      sessionId: sessionId ?? null,
      role: "assistant",
      content: prose,
      uiBlocks,
    });
    await logBehaviorEvent({
      userId,
      eventType: "chat_interaction",
      taskId: activeTaskId ?? null,
      metadata: { characterId, hasUiBlocks: uiBlocks.length > 0 },
    });

    return res.json({ message: prose, uiBlocks });
  } catch (err) {
    req.log.error({ err }, "chat failed");
    return res.status(500).json({ error: "chat_failed" });
  }
});

router.get("/chat/history", async (req, res) => {
  const userId = req.query["userId"] as string | undefined;
  const characterId = req.query["characterId"] as string | undefined;
  const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
  if (!userId) return res.status(400).json({ error: "userId_required" });
  const conds = [eq(chatMessagesTable.userId, userId)];
  if (characterId) conds.push(eq(chatMessagesTable.characterId, characterId));
  const rows = await db
    .select()
    .from(chatMessagesTable)
    .where(and(...conds))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(limit);
  return res.json(rows.reverse());
});

export default router;
