export type OnboardingQuestion = {
  id:
    | "main_task_struggle"
    | "energy_pattern"
    | "focus_length"
    | "task_reaction"
    | "support_style"
    | "task_style";
  title: string;
  options: string[];
  otherPrompt: string;
};

export type OnboardingAnswer = {
  selectedOption: string;
  customAnswer?: string;
};

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: "main_task_struggle",
    title: "What usually gets in your way when you want to get something done?",
    options: [
      "Starting is the hardest part",
      "I get distracted in the middle",
      "I leave things unfinished",
      "I avoid difficult tasks",
      "I overthink and get stuck",
      "I jump between too many tasks",
      "My energy changes a lot",
      "Other",
    ],
    otherPrompt: "Tell us what usually happens",
  },
  {
    id: "energy_pattern",
    title: "When do you usually feel most able to get things done?",
    options: [
      "Early in the morning",
      "Late morning / afternoon",
      "Evening",
      "Late at night",
      "It changes every day",
      "I usually feel low energy",
      "Other",
    ],
    otherPrompt: "Tell us more about your energy pattern",
  },
  {
    id: "focus_length",
    title: "Once you start, how long can you usually stay focused?",
    options: [
      "Less than 5 minutes",
      "5-15 minutes",
      "15-30 minutes",
      "30-60 minutes",
      "If I get into it, I can focus for a long time",
      "It really depends on the task",
      "Other",
    ],
    otherPrompt: "What does your focus usually feel like?",
  },
  {
    id: "task_reaction",
    title: "When you have an important task to do, what usually happens first?",
    options: [
      "I do a smaller easier task first",
      "I check my phone or something else",
      "I plan it for too long",
      "I start, then quickly switch",
      "I wait until I feel ready",
      "I begin immediately",
      "Other",
    ],
    otherPrompt: "What usually happens for you?",
  },
  {
    id: "support_style",
    title: "What kind of support helps you most?",
    options: [
      "Gentle and calm",
      "Clear and direct",
      "Encouraging and motivating",
      "Fun and playful",
      "Minimal and quiet",
      "Structured and serious",
      "Other",
    ],
    otherPrompt: "Describe the kind of support you prefer",
  },
  {
    id: "task_style",
    title: "How do you prefer tasks to be shown?",
    options: [
      "Tiny simple steps",
      "A clear checklist",
      "A flexible plan",
      "One priority at a time",
      "Timed focus sessions",
      "Bigger picture first, steps later",
      "Other",
    ],
    otherPrompt: "What feels easier for you?",
  },
];
