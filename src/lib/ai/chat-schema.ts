import { z } from "zod";
import { ELEMENT_KEYS, INTERVIEW_STEPS, PRONOUNS } from "../types.ts";

// The request body for /api/chat. The client owns the altar, so each turn it
// sends a compact summary plus the recent conversation.

export const AltarContext = z.object({
  lovedOne: z.object({
    name: z.string().max(120),
    relation: z.string().max(120).optional(),
    isChild: z.boolean(),
    hasPhoto: z.boolean(),
    pronouns: z.enum(PRONOUNS).optional(),
  }),
  alebrije: z.object({
    name: z.string().max(80),
    animal: z.string().max(200),
    color: z.string().max(200),
    place: z.string().max(200),
    personality: z.string().max(1000),
  }),
  mood: z.enum(["festive", "quiet"]),
  memories: z
    .array(z.object({ id: z.string(), text: z.string().max(2000), illustrated: z.boolean() }))
    .max(300),
  objects: z.array(z.string().max(200)).max(200),
  elements: z.array(z.enum(ELEMENT_KEYS)),
  questionsSinceRest: z.number().int().min(0),
});
export type AltarContext = z.infer<typeof AltarContext>;

export const ChatTurn = z.object({
  role: z.enum(["user", "assistant", "note"]),
  text: z.string().max(6000),
  // Only ever set on the newest user message: a photo memory to look at.
  photo: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp);base64,/)
    .max(4_000_000)
    .optional(),
});
export type ChatTurn = z.infer<typeof ChatTurn>;

export const ChatRequest = z.object({
  altar: AltarContext,
  messages: z.array(ChatTurn).min(1).max(80),
});
export type ChatRequest = z.infer<typeof ChatRequest>;

// The interview sends the same altar summary plus where it stands. The name
// may still be empty, before the user has said who the altar is for.
export const InterviewRequest = z.object({
  altar: AltarContext,
  interview: z.object({
    done: z.array(z.enum(INTERVIEW_STEPS)),
    // The user's local hour, for "Buenos días" and friends.
    hour: z.number().int().min(0).max(23),
  }),
  messages: z.array(ChatTurn).max(80),
});
export type InterviewRequest = z.infer<typeof InterviewRequest>;

// Events streamed back as newline-delimited JSON.
export type ChatEvent =
  | { type: "text"; delta: string }
  | { type: "action"; tool: string; callId: string; args: Record<string, unknown> }
  | { type: "error"; message: string }
  | { type: "done" };
