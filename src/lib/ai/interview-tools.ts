import { z } from "zod";
import type { FunctionTool } from "openai/resources/responses/responses";
import { STARTER_KEYS } from "../../content/starter-objects.ts";
import { ELEMENT_KEYS, INTERVIEW_STEPS, PRONOUNS } from "../types.ts";
import { toolArgs as chatToolArgs } from "./tools.ts";

// The alebrije's tools while it interviews the user. Some set what the user
// told it (name, memories); the rest show something the user answers with a
// tap (choices, the photo card, the object picker).

const memoryText = z
  .string()
  .describe(
    "One single memory, copied from the user's own words. You may only trim leading filler and fix an obvious typo. Never rephrase, never change I/we to they, never add anything.",
  );

export const interviewToolArgs = {
  set_loved_one: z.object({
    name: z.string().describe("The name exactly as the user wrote it, e.g. \"Abuela Rosa\" or \"Amanda\"."),
    pronouns: z
      .enum(PRONOUNS)
      .nullable()
      .describe("How to refer to them. Null when you are not confident; then confirm with the user."),
    pronouns_confident: z
      .boolean()
      .describe("True only when the user said it, a relation word shows it (\"my grandmother\"), or the name is clearly and commonly used for one gender."),
    relation: z.string().nullable().describe("Who they are to the user in the user's words, e.g. \"my grandmother\". Null if not said yet."),
    is_child: z.boolean().nullable().describe("True only when the user signals they were a child. Null if unknown."),
  }),
  offer_choices: z.object({
    mode: z.enum(["yes_no", "single", "multi"]),
    options: z.array(z.string()).min(2).max(6).describe("Short answer labels, 1 to 4 words each."),
    allow_free_text: z.boolean().describe("True if the user may also type their own answer."),
  }),
  request_photo: z.object({}),
  offer_starter_objects: z.object({
    preselect: z
      .array(z.enum(STARTER_KEYS))
      .describe("Starter objects that fit what the user already said. Often empty."),
  }),
  add_objects: z.object({
    objects: z
      .array(
        z.object({
          name: z.string().describe('Short label for the altar, e.g. "Her blue thermos".'),
          description: z.string().describe("One short sentence in the user's words about why it belongs."),
          image_subject: z
            .string()
            .describe("A visual description of the object alone for the illustrator. Never a person, face or body."),
        }),
      )
      .min(1)
      .max(8),
  }),
  save_memories: z.object({
    memories: z.array(z.object({ text: memoryText })).min(1).max(12),
  }),
  extend_memory: z.object({
    memory_id: z.string().describe("Id of the memory the user is continuing."),
    text: memoryText,
  }),
  offer_elements: z.object({
    elements: z.array(z.enum(ELEMENT_KEYS)).min(2).max(8),
  }),
  complete_step: z.object({ step: z.enum(INTERVIEW_STEPS) }),
  finish_interview: z.object({}),
  pause_conversation: chatToolArgs.pause_conversation,
  show_support_resources: chatToolArgs.show_support_resources,
} as const;

export type InterviewToolName = keyof typeof interviewToolArgs;

const descriptions: Record<InterviewToolName, string> = {
  set_loved_one:
    "Record who the ofrenda is for. Call it when the user gives the name, and again whenever you learn or they correct the pronouns, the relation, or that they were a child. Always send every field you know.",
  offer_choices:
    "Show tappable answers under your question, for questions with a short answer (yes or no, she/he/they, who they were to the user). Your message must still ask the question in words. Never use it for memories.",
  request_photo:
    "Show a card where the user can add a photo of their loved one, or say not now. The photo is stored privately for them and is never sent to you.",
  offer_starter_objects:
    "Show a grid of painted objects (mug, guitar, record player, dancing shoes, clay pot, baking things, lemons, plant, paint palette, sun hat, scarf) the user can pick from, plus a field to name their own.",
  add_objects:
    "Propose placing things the user named in their own words (not ones they picked from the grid). One card lists them; nothing is placed until the user agrees. Each is painted in the altar's style.",
  save_memories:
    "Save what the user shared as single memories on the altar. Split a long message into one memory per moment, habit or saying, in the user's own words.",
  extend_memory:
    "Add the user's next words to a memory they are still telling, when their new message clearly continues the last one.",
  offer_elements:
    "Show the traditional ofrenda elements with their meanings, for the user to pick which to place.",
  complete_step:
    "Mark an interview step finished so the conversation moves on. Only when the user is ready to move on.",
  finish_interview:
    "Show the button that opens the finished altar. Only at the very end.",
  pause_conversation: "Offer the user a rest, when emotions run high.",
  show_support_resources:
    "Show crisis support lines. Use when the user shows signs of acute distress, hopelessness, or thoughts of self-harm.",
};

export const interviewTools: FunctionTool[] = (Object.keys(interviewToolArgs) as InterviewToolName[]).map(
  (name) => {
    const parameters: Record<string, unknown> = z.toJSONSchema(interviewToolArgs[name]);
    delete parameters.$schema;
    return { type: "function", name, description: descriptions[name], parameters, strict: true };
  },
);
