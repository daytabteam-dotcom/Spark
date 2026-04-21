import type { User } from "@workspace/api-client-react";

type Trait = {
  value?: string | number | boolean;
  confidence?: number;
};

type Profile = Record<string, Trait | unknown>;

function trait(profile: Profile | undefined, key: string, fallback: string): string {
  const value = profile?.[key];
  if (value && typeof value === "object" && "value" in value) {
    return String((value as Trait).value ?? fallback);
  }
  return fallback;
}

export function getAdaptiveTaskCopy(user?: User | null) {
  const profile = user?.behaviorProfile as Profile | undefined;
  const supportStyle = trait(profile, "support_style", "Gentle and calm");
  const taskStyle = trait(profile, "preferred_task_style", "Tiny simple steps");
  const startResistance = trait(profile, "start_resistance_level", "medium");
  const switching = trait(profile, "task_switching_tendency", "medium");

  const placeholder =
    startResistance === "high"
      ? "Drop the messy version here. We will find the first tiny move."
      : switching === "high"
        ? "Put the competing thoughts here. We will pick what matters first."
        : "Type everything in your head. We will turn it into clean tasks.";

  const extractLabel =
    taskStyle.includes("One priority")
      ? "Find my first priority"
      : taskStyle.includes("Tiny")
        ? "Make tiny steps"
        : "Shape my tasks";

  return {
    supportStyle,
    taskStyle,
    placeholder,
    extractLabel,
    emptyState:
      supportStyle.includes("Minimal") ? "Nothing open." : "All clear for the moment.",
  };
}

export function getChatPlaceholder(user?: User | null) {
  const profile = user?.behaviorProfile as Profile | undefined;
  const supportStyle = trait(profile, "support_style", "Gentle and calm");
  if (supportStyle.includes("Direct")) return "What do you need to do?";
  if (supportStyle.includes("Minimal")) return "Message...";
  if (supportStyle.includes("Fun")) return "What are we tackling?";
  return "Tell your companion what is going on...";
}

export function getFocusStartLabel(user?: User | null) {
  const profile = user?.behaviorProfile as Profile | undefined;
  const startResistance = trait(profile, "start_resistance_level", "medium");
  if (startResistance === "high") return "Start with 2 minutes";
  return "Start focus";
}
