import type { User } from "@workspace/db";

const users = new Map<string, User>();

export function isConnectionUnavailable(error: unknown) {
  const message = collectErrorText(error);
  return (
    message.includes("ECONNREFUSED") ||
    message.includes("connect EPERM") ||
    message.includes("ECONNRESET") ||
    message.includes("Failed query")
  );
}

export function canUseDevFallback(error: unknown) {
  return process.env.NODE_ENV !== "production" && isConnectionUnavailable(error);
}

function collectErrorText(error: unknown): string {
  if (!error || typeof error !== "object") return String(error);
  const err = error as { message?: unknown; cause?: unknown; code?: unknown };
  return [err.message, err.code, collectNestedCause(err.cause)].filter(Boolean).join(" ");
}

function collectNestedCause(cause: unknown): string {
  if (!cause || typeof cause !== "object") return String(cause ?? "");
  const err = cause as { message?: unknown; cause?: unknown; code?: unknown };
  return [err.message, err.code, collectNestedCause(err.cause)].filter(Boolean).join(" ");
}

export function saveDevUser(user: User) {
  users.set(user.id, user);
}

export function getDevUser(userId: string) {
  return users.get(userId) ?? null;
}

export function updateDevUser(userId: string, patch: Partial<User>) {
  const current = users.get(userId);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: new Date() };
  users.set(userId, next);
  return next;
}
