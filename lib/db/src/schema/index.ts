import { pgTable, text, integer, timestamp, jsonb, uuid, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const taskStatusEnum = pgEnum("task_status", [
  "open",
  "scheduled",
  "in_progress",
  "paused",
  "completed",
]);

export const resistanceLevelEnum = pgEnum("resistance_level", ["low", "medium", "high"]);

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  selectedCharacterId: text("selected_character_id").notNull().default("entropy-fox"),
  difficultyTags: jsonb("difficulty_tags").$type<string[]>().notNull().default([]),
  onboardingAnswers: jsonb("onboarding_answers").$type<Record<string, unknown>>().notNull().default({}),
  behaviorProfile: jsonb("behavior_profile").$type<Record<string, unknown>>().notNull().default({}),
  behaviorMetrics: jsonb("behavior_metrics").$type<Record<string, unknown>>().notNull().default({}),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  profileUpdatedAt: timestamp("profile_updated_at", { withTimezone: true }),
  xp: integer("xp").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tasksTable = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: taskStatusEnum("status").notNull().default("open"),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  durationMinutes: integer("duration_minutes"),
  resistanceLevel: resistanceLevelEnum("resistance_level").notNull().default("medium"),
  taskType: text("task_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessionsTable = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  characterId: text("character_id").notNull(),
  activeTaskId: uuid("active_task_id").references(() => tasksTable.id, { onDelete: "set null" }),
  startTime: timestamp("start_time", { withTimezone: true }).notNull().defaultNow(),
  endTime: timestamp("end_time", { withTimezone: true }),
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const xpEventsTable = pgTable("xp_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  xpAwarded: integer("xp_awarded").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const behaviorLogTable = pgTable("behavior_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  taskId: uuid("task_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessagesTable = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  characterId: text("character_id").notNull(),
  sessionId: uuid("session_id").references(() => sessionsTable.id, { onDelete: "set null" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  uiBlocks: jsonb("ui_blocks").$type<unknown[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  xp: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export type Task = typeof tasksTable.$inferSelect;
export type Session = typeof sessionsTable.$inferSelect;
export type XpEvent = typeof xpEventsTable.$inferSelect;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
