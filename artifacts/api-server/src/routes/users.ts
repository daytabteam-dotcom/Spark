import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { CreateUserBody, UpdateUserBody } from "@workspace/api-zod";
import { createInitialBehaviorProfile } from "../lib/personalization";

const router: IRouter = Router();

router.post("/users", async (req, res) => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.issues });
  }
  const [user] = await db
    .insert(usersTable)
    .values({
      name: parsed.data.name,
      selectedCharacterId: parsed.data.selectedCharacterId ?? "entropy-fox",
      difficultyTags: parsed.data.difficultyTags ?? [],
      onboardingAnswers: parsed.data.onboardingAnswers ?? {},
      behaviorProfile: createInitialBehaviorProfile(parsed.data.onboardingAnswers ?? {}),
      onboardingCompletedAt: new Date(),
      profileUpdatedAt: new Date(),
    })
    .returning();
  return res.status(201).json(user);
});

router.get("/users/:userId", async (req, res) => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.params.userId));
  if (!user) return res.status(404).json({ error: "not_found" });
  return res.json(user);
});

router.patch("/users/:userId", async (req, res) => {
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.issues });
  }
  const [user] = await db
    .update(usersTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(usersTable.id, req.params.userId))
    .returning();
  if (!user) return res.status(404).json({ error: "not_found" });
  return res.json(user);
});

export default router;
