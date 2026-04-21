import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, xpEventsTable } from "@workspace/db";
import { AwardXpBody } from "@workspace/api-zod";
import { CHARACTERS } from "../lib/characters";

const router: IRouter = Router();

router.post("/xp/award", async (req, res) => {
  const parsed = AwardXpBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.issues });
  }
  const { userId, eventType, xpAwarded } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return res.status(404).json({ error: "not_found" });

  const newXp = user.xp + xpAwarded;
  await db.insert(xpEventsTable).values({ userId, eventType, xpAwarded });
  await db
    .update(usersTable)
    .set({ xp: newXp, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  const justUnlocked = CHARACTERS.find(
    (c) => c.xpRequired > user.xp && c.xpRequired <= newXp,
  );
  return res.json({
    newXp,
    unlockedCharacter: justUnlocked
      ? { ...justUnlocked, isLocked: false }
      : null,
  });
});

export default router;
