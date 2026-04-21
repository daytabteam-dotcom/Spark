import { and, eq, sql } from "drizzle-orm";
import { behaviorLogTable, db, tasksTable, usersTable, type User } from "@workspace/db";

type OnboardingAnswer = {
  selectedOption?: string;
  selectedOptions?: string[];
  customAnswer?: string;
};

type OnboardingAnswers = Record<string, OnboardingAnswer | string | unknown | undefined>;

type Trait = {
  value: string | number | boolean;
  confidence: number;
  lastUpdatedFrom: "onboarding" | "behavior" | "system";
  updatedAt: string;
  changeHistory: Array<{
    value: string | number | boolean;
    confidence: number;
    source: "onboarding" | "behavior" | "system";
    at: string;
    reason: string;
  }>;
};

export type BehaviorProfile = {
  profileVersion: number;
  adaptiveTypes: Trait;
  primary_struggle: Trait;
  secondary_struggle: Trait;
  support_style: Trait;
  preferred_task_style: Trait;
  energy_pattern: Trait;
  focus_capacity: Trait;
  avoidance_risk: Trait;
  task_switching_tendency: Trait;
  perfectionism_tendency: Trait;
  start_resistance_level: Trait;
  overwhelm_sensitivity: Trait;
  lastRefinedAt: string;
};

export type BehaviorMetrics = {
  task_switch_count: number;
  task_abandon_count: number;
  average_task_start_delay: number | null;
  repeated_reschedule_count: number;
  microtask_completion_rate: number | null;
  preferred_completion_window: string | null;
  flow_abandon_count: number;
  planning_without_action_score: number;
  first_three_day_window_active: boolean;
  events_count: number;
};

const nowIso = () => new Date().toISOString();

let schemaReady: Promise<void> | null = null;

export function ensurePersonalizationSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_answers" jsonb NOT NULL DEFAULT '{}'::jsonb`);
    await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "behavior_profile" jsonb NOT NULL DEFAULT '{}'::jsonb`);
    await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "behavior_metrics" jsonb NOT NULL DEFAULT '{}'::jsonb`);
    await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" timestamp with time zone`);
    await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_updated_at" timestamp with time zone`);
  })();
  return schemaReady;
}

function option(answers: OnboardingAnswers, key: string): string {
  const value = answers[key];
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return "";
  const answer = value as OnboardingAnswer;
  if (Array.isArray(answer.selectedOptions)) {
    const selected = answer.selectedOptions.filter((item) => item !== "Other");
    if (answer.selectedOptions.includes("Other") && answer.customAnswer) {
      selected.push(answer.customAnswer);
    }
    return selected.join(", ");
  }
  return answer.selectedOption === "Other"
    ? (answer.customAnswer ?? answer.selectedOption ?? "")
    : (answer.selectedOption ?? "");
}

function trait(
  value: string | number | boolean,
  confidence: number,
  source: "onboarding" | "behavior" | "system",
  reason: string,
): Trait {
  const at = nowIso();
  return {
    value,
    confidence,
    lastUpdatedFrom: source,
    updatedAt: at,
    changeHistory: [{ value, confidence, source, at, reason }],
  };
}

function updateTrait(
  current: Trait,
  value: string | number | boolean,
  confidenceDelta: number,
  source: "behavior" | "onboarding" | "system",
  reason: string,
): Trait {
  const at = nowIso();
  const confidence = Math.max(0.05, Math.min(0.98, current.confidence + confidenceDelta));
  return {
    ...current,
    value,
    confidence,
    lastUpdatedFrom: source,
    updatedAt: at,
    changeHistory: [
      ...current.changeHistory.slice(-8),
      { value, confidence, source, at, reason },
    ],
  };
}

function struggleType(value: string): string {
  const lower = value.toLowerCase();
  if (lower.includes("start")) return "Starter";
  if (lower.includes("distracted") || lower.includes("jump") || lower.includes("switch")) return "Switcher";
  if (lower.includes("unfinished")) return "Finisher-risk";
  if (lower.includes("avoid") || lower.includes("difficult")) return "Avoider";
  if (lower.includes("overthink")) return "Perfection loop";
  if (lower.includes("energy")) return "Energy-fluctuation type";
  return "Adaptive starter";
}

export function createInitialBehaviorProfile(answers: OnboardingAnswers): BehaviorProfile {
  const primary = option(answers, "main_task_struggle") || "Starting is the hardest part";
  const taskReaction = option(answers, "task_reaction");
  const energy = option(answers, "energy_pattern") || "It changes every day";
  const focus = option(answers, "focus_length") || "It really depends on the task";
  const support = option(answers, "support_style") || "Gentle and calm";
  const taskStyle = option(answers, "task_style") || "Tiny simple steps";

  const adaptiveTypes = [struggleType(primary)];
  if (energy.toLowerCase().includes("changes") || energy.toLowerCase().includes("low")) {
    adaptiveTypes.push("Energy-fluctuation type");
  }
  if (focus.toLowerCase().includes("long time")) adaptiveTypes.push("Hyperfocus type");

  const startResistance =
    primary.includes("Starting") || taskReaction.includes("wait") ? "high" : "medium";
  const switching =
    primary.includes("distracted") || primary.includes("jump") || taskReaction.includes("switch")
      ? "high"
      : "medium";
  const perfectionism =
    primary.includes("overthink") || taskReaction.includes("plan it for too long")
      ? "high"
      : "low";
  const avoidance =
    primary.includes("avoid") || taskReaction.includes("wait until")
      ? "high"
      : "medium";
  const overwhelm =
    taskStyle.includes("Tiny") || taskStyle.includes("One priority") || primary.includes("too many")
      ? "high"
      : "medium";

  return {
    profileVersion: 1,
    adaptiveTypes: trait(adaptiveTypes.join(", "), 0.68, "onboarding", "Initial setup answers"),
    primary_struggle: trait(primary, 0.72, "onboarding", "Main task struggle answer"),
    secondary_struggle: trait(taskReaction || "Still learning", 0.48, "onboarding", "Task reaction answer"),
    support_style: trait(support, 0.78, "onboarding", "Preferred support style"),
    preferred_task_style: trait(taskStyle, 0.76, "onboarding", "Preferred task presentation"),
    energy_pattern: trait(energy, 0.7, "onboarding", "Energy pattern answer"),
    focus_capacity: trait(focus, 0.68, "onboarding", "Focus length answer"),
    avoidance_risk: trait(avoidance, 0.58, "onboarding", "Inferred from setup answers"),
    task_switching_tendency: trait(switching, 0.58, "onboarding", "Inferred from setup answers"),
    perfectionism_tendency: trait(perfectionism, 0.54, "onboarding", "Inferred from setup answers"),
    start_resistance_level: trait(startResistance, 0.62, "onboarding", "Inferred from setup answers"),
    overwhelm_sensitivity: trait(overwhelm, 0.58, "onboarding", "Inferred from setup answers"),
    lastRefinedAt: nowIso(),
  };
}

function completionWindow(date: Date): string {
  const hour = date.getHours();
  if (hour < 11) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "late_night";
}

export async function computeBehaviorMetrics(userId: string, createdAt: Date): Promise<BehaviorMetrics> {
  const [logs, tasks] = await Promise.all([
    db.select().from(behaviorLogTable).where(eq(behaviorLogTable.userId, userId)),
    db.select().from(tasksTable).where(eq(tasksTable.userId, userId)),
  ]);

  const startDelays = logs
    .filter((log) => log.eventType === "task_started")
    .map((log) => Number((log.metadata as Record<string, unknown>).startDelaySeconds))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const microtasks = tasks.filter((task) => (task.durationMinutes ?? 999) <= 15);
  const completedMicrotasks = microtasks.filter((task) => task.status === "completed");
  const completionWindows: Record<string, number> = {};

  tasks.forEach((task) => {
    if (task.status !== "completed" || !task.endTime) return;
    const window = completionWindow(new Date(task.endTime));
    completionWindows[window] = (completionWindows[window] ?? 0) + 1;
  });

  const preferredWindow = Object.entries(completionWindows).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const editCount = logs.filter((log) => log.eventType === "plan_edited").length;
  const actionCount = logs.filter((log) => ["task_started", "task_completed"].includes(log.eventType)).length;

  return {
    task_switch_count: logs.filter((log) => log.eventType === "task_switched").length,
    task_abandon_count:
      logs.filter((log) => log.eventType === "task_abandoned").length +
      tasks.filter((task) => task.status === "paused").length,
    average_task_start_delay:
      startDelays.length > 0
        ? Math.round(startDelays.reduce((sum, value) => sum + value, 0) / startDelays.length)
        : null,
    repeated_reschedule_count: logs.filter((log) => log.eventType === "task_rescheduled").length,
    microtask_completion_rate:
      microtasks.length > 0 ? completedMicrotasks.length / microtasks.length : null,
    preferred_completion_window: preferredWindow,
    flow_abandon_count: logs.filter((log) => ["flow_abandoned", "task_abandoned"].includes(log.eventType)).length,
    planning_without_action_score: actionCount === 0 ? editCount : editCount / actionCount,
    first_three_day_window_active: Date.now() - createdAt.getTime() < 3 * 24 * 60 * 60 * 1000,
    events_count: logs.length,
  };
}

export function refineProfileWithBehavior(
  profile: BehaviorProfile,
  metrics: BehaviorMetrics,
): BehaviorProfile {
  let next = { ...profile, lastRefinedAt: nowIso() };
  const types = new Set(String(next.adaptiveTypes.value).split(",").map((item) => item.trim()).filter(Boolean));

  if ((metrics.average_task_start_delay ?? 0) > 10 * 60) {
    next.start_resistance_level = updateTrait(next.start_resistance_level, "high", 0.12, "behavior", "Long delay before starting tasks");
    types.add("Starter");
  }
  if (metrics.task_switch_count >= 3) {
    next.task_switching_tendency = updateTrait(next.task_switching_tendency, "high", 0.14, "behavior", "Frequent task switching");
    types.add("Switcher");
  }
  if (metrics.task_abandon_count >= 2 || metrics.flow_abandon_count >= 2) {
    next.avoidance_risk = updateTrait(next.avoidance_risk, "high", 0.1, "behavior", "Repeated abandoned or paused tasks");
    types.add("Avoider");
  }
  if (metrics.microtask_completion_rate != null && metrics.microtask_completion_rate >= 0.65) {
    next.preferred_task_style = updateTrait(next.preferred_task_style, "Tiny simple steps", 0.08, "behavior", "Micro tasks are completed more reliably");
    next.overwhelm_sensitivity = updateTrait(next.overwhelm_sensitivity, "high", 0.06, "behavior", "Small tasks perform better than large tasks");
  }
  if (metrics.planning_without_action_score >= 2) {
    next.perfectionism_tendency = updateTrait(next.perfectionism_tendency, "high", 0.1, "behavior", "Plans are edited repeatedly before action");
    types.add("Perfection loop");
  }
  if (metrics.preferred_completion_window) {
    next.energy_pattern = updateTrait(next.energy_pattern, metrics.preferred_completion_window, 0.06, "behavior", "Completion activity clusters in this time window");
  }

  next.adaptiveTypes = updateTrait(
    next.adaptiveTypes,
    Array.from(types).join(", "),
    metrics.events_count > 0 ? 0.06 : 0,
    "behavior",
    "Behavior signals refined adaptive traits",
  );

  return next;
}

export async function refreshUserBehaviorProfile(userId: string): Promise<User | null> {
  await ensurePersonalizationSchema();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return null;

  const profile = (Object.keys(user.behaviorProfile ?? {}).length > 0
    ? user.behaviorProfile
    : createInitialBehaviorProfile(user.onboardingAnswers as OnboardingAnswers)) as BehaviorProfile;
  const metrics = await computeBehaviorMetrics(userId, user.createdAt);
  const behaviorProfile = refineProfileWithBehavior(profile, metrics);

  const [updated] = await db
    .update(usersTable)
    .set({ behaviorMetrics: metrics, behaviorProfile, profileUpdatedAt: new Date(), updatedAt: new Date() })
    .where(eq(usersTable.id, userId))
    .returning();

  return updated ?? null;
}

export async function logBehaviorEvent(input: {
  userId: string;
  eventType: string;
  taskId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await ensurePersonalizationSchema();
  await db.insert(behaviorLogTable).values({
    userId: input.userId,
    eventType: input.eventType,
    taskId: input.taskId ?? null,
    metadata: input.metadata ?? {},
  });
  await refreshUserBehaviorProfile(input.userId);
}

export function assistantPersonalizationPrompt(user: Pick<User, "behaviorProfile" | "behaviorMetrics">): string {
  const profile = user.behaviorProfile as Partial<BehaviorProfile>;
  const metrics = user.behaviorMetrics as Partial<BehaviorMetrics>;
  const support = profile.support_style?.value ?? "Gentle and calm";
  const taskStyle = profile.preferred_task_style?.value ?? "Tiny simple steps";
  const types = profile.adaptiveTypes?.value ?? "Adaptive starter";

  return `Personalization:
- Adaptive traits: ${types}. These are flexible working patterns, not fixed labels.
- Support style: ${support}. Match this tone in every reply.
- Preferred task presentation: ${taskStyle}.
- Start resistance: ${profile.start_resistance_level?.value ?? "medium"}.
- Task switching tendency: ${profile.task_switching_tendency?.value ?? "medium"}.
- Avoidance risk: ${profile.avoidance_risk?.value ?? "medium"}.
- Overwhelm sensitivity: ${profile.overwhelm_sensitivity?.value ?? "medium"}.
- Energy pattern: ${profile.energy_pattern?.value ?? "still learning"}.
- Focus capacity: ${profile.focus_capacity?.value ?? "still learning"}.
- Recent behavior signals: task_switch_count=${metrics.task_switch_count ?? 0}, task_abandon_count=${metrics.task_abandon_count ?? 0}, average_task_start_delay=${metrics.average_task_start_delay ?? "unknown"} seconds.

Adaptation rules:
- For start resistance, offer one tiny first action and reduce setup friction.
- For switching, keep one priority visible and use gentle refocus language.
- For avoidance, lower emotional weight and avoid guilt.
- For perfectionism, limit over-planning and invite imperfect progress.
- For low energy, suggest lighter versions and easy wins.
- For hyperfocus, include stopping points and transition cues.
- Do not call this a personality test and do not overuse the word AI.`;
}

export function taskGenerationPersonalizationPrompt(user?: Pick<User, "behaviorProfile" | "behaviorMetrics"> | null): string {
  if (!user) return "";
  const profile = user.behaviorProfile as Partial<BehaviorProfile>;
  return `
Personalize extracted tasks for this user:
- Preferred task style: ${profile.preferred_task_style?.value ?? "Tiny simple steps"}.
- Start resistance: ${profile.start_resistance_level?.value ?? "medium"}.
- Overwhelm sensitivity: ${profile.overwhelm_sensitivity?.value ?? "medium"}.
- Task switching tendency: ${profile.task_switching_tendency?.value ?? "medium"}.
- If overwhelm or start resistance is high, create smaller, concrete first-step tasks.
- If task switching is high, avoid creating many competing tasks from one vague idea.
- If perfectionism is high, keep subtasks practical and progress-oriented.`;
}

export async function findUserById(userId: string): Promise<User | null> {
  await ensurePersonalizationSchema();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return user ?? null;
}

export async function logTaskSwitchIfNeeded(userId: string, taskId: string): Promise<void> {
  const recentStarts = await db
    .select()
    .from(behaviorLogTable)
    .where(and(eq(behaviorLogTable.userId, userId), eq(behaviorLogTable.eventType, "task_started")));
  const last = recentStarts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (last?.taskId && last.taskId !== taskId && Date.now() - last.createdAt.getTime() < 30 * 60 * 1000) {
    await logBehaviorEvent({
      userId,
      eventType: "task_switched",
      taskId,
      metadata: { previousTaskId: last.taskId },
    });
  }
}
