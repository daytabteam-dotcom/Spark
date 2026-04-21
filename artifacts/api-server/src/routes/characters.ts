import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { CHARACTERS } from "../lib/characters";
import { canUseDevFallback, getDevUser } from "../lib/devFallback";

const router: IRouter = Router();

router.get("/characters", async (req, res) => {
  const userId = req.query["userId"] as string | undefined;
  let xp = 0;
  if (userId) {
    try {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
      if (user) xp = user.xp;
    } catch (error) {
      if (!canUseDevFallback(error)) throw error;
      xp = getDevUser(userId)?.xp ?? 0;
    }
  }
  const list = CHARACTERS.map((c) => ({ ...c, isLocked: xp < c.xpRequired }));
  return res.json(list);
});

export default router;
