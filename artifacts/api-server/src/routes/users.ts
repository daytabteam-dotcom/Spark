import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { CreateUserBody, UpdateUserBody } from "@workspace/api-zod";
import { createInitialBehaviorProfile, ensurePersonalizationSchema } from "../lib/personalization";
import { canUseDevFallback, getDevUser, saveDevUser, updateDevUser } from "../lib/devFallback";

const router: IRouter = Router();

router.post("/users", async (req, res) => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.issues });
  }
  const values = {
    name: parsed.data.name,
    selectedCharacterId: parsed.data.selectedCharacterId ?? "entropy-fox",
    difficultyTags: parsed.data.difficultyTags ?? [],
    onboardingAnswers: parsed.data.onboardingAnswers ?? {},
    behaviorProfile: createInitialBehaviorProfile(parsed.data.onboardingAnswers ?? {}),
    onboardingCompletedAt: new Date(),
    profileUpdatedAt: new Date(),
  };

  try {
    await ensurePersonalizationSchema();
    const [user] = await db.insert(usersTable).values(values).returning();
    return res.status(201).json(user);
  } catch (error) {
    if (!canUseDevFallback(error)) throw error;
    const now = new Date();
    const user = {
      id: randomUUID(),
      ...values,
      behaviorMetrics: {},
      xp: 0,
      createdAt: now,
      updatedAt: now,
    };
    saveDevUser(user);
    return res.status(201).json(user);
  }
});

router.get("/users/:userId", async (req, res) => {
  try {
    await ensurePersonalizationSchema();
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.params.userId));
    if (!user) return res.status(404).json({ error: "not_found" });
    return res.json(user);
  } catch (error) {
    if (!canUseDevFallback(error)) throw error;
    const user = getDevUser(req.params.userId);
    if (!user) return res.status(404).json({ error: "not_found" });
    return res.json(user);
  }
});

router.patch("/users/:userId", async (req, res) => {
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.issues });
  }
  try {
    await ensurePersonalizationSchema();
    const [user] = await db
      .update(usersTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(usersTable.id, req.params.userId))
      .returning();
    if (!user) return res.status(404).json({ error: "not_found" });
    return res.json(user);
  } catch (error) {
    if (!canUseDevFallback(error)) throw error;
    const user = updateDevUser(req.params.userId, parsed.data);
    if (!user) return res.status(404).json({ error: "not_found" });
    return res.json(user);
  }
});

export default router;
