import { INTERVIEW_STEPS, type InterviewStep } from "./types.ts";

// Where the interview stands, worked out the same way in the browser (to know
// what "skip" skips) and on the server (to pick the alebrije's instructions).

export type InterviewPhase = "welcome" | InterviewStep | "finish";

export function interviewPhase(progress: {
  name: string;
  relation?: string;
  pronouns?: string;
  done: readonly InterviewStep[];
}): InterviewPhase {
  if (!progress.name.trim()) return "welcome";
  const done = new Set(progress.done);
  // Knowing who they are to the user, and how to refer to them, completes "who".
  if (progress.relation && progress.pronouns) done.add("who");
  return INTERVIEW_STEPS.find((step) => !done.has(step)) ?? "finish";
}
