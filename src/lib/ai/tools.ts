import { z } from "zod";
import type { FunctionTool } from "openai/resources/responses/responses";
import { ELEMENT_KEYS } from "../types.ts";

// The alebrije's tools. Each one changes the altar, and anything that adds a
// visible thing beyond the user's own words is a proposal the user confirms.

export const toolArgs = {
  add_memory: z.object({
    text: z
      .string()
      .describe(
        "The memory copied from the user's own words. You may only trim leading filler and fix an obvious typo. Never rephrase, never change I/we to they, never add facts or embellish.",
      ),
    from_attached_photo: z
      .boolean()
      .describe("True when this memory is about the photo the user attached in their latest message."),
  }),
  suggest_object: z.object({
    name: z.string().describe('Short label for the altar, e.g. "Her blue thermos".'),
    description: z.string().describe("One sentence in the user's words about why it belongs."),
    image_subject: z
      .string()
      .describe("A visual description of the object alone for the illustrator. Never a person, face or body."),
  }),
  illustrate_memory: z.object({
    memory_id: z.string().describe("Id of a memory that fits the illustration rules."),
    image_subject: z
      .string()
      .describe("A visual description of the scene or thing to paint. Never the loved one or any person."),
  }),
  add_traditional_element: z.object({
    element: z.enum(ELEMENT_KEYS),
    reason: z.string().describe("One short, warm sentence connecting the element to what the user shared."),
  }),
  pause_conversation: z.object({
    reason: z.string().describe("Short, gentle reason, e.g. that you have gathered a lot together."),
  }),
  show_support_resources: z.object({}),
} as const;

export type ToolName = keyof typeof toolArgs;
export type ToolArgs<T extends ToolName> = z.infer<(typeof toolArgs)[T]>;

const descriptions: Record<ToolName, string> = {
  add_memory:
    "Save something the user shared (a story, saying, moment, habit) as a memory on the altar. Use once per distinct memory, right after they share it; split a long message into several calls.",
  suggest_object:
    "Propose placing a tangible thing that belonged to or represents the loved one on the altar. The user sees a confirm card; nothing is placed until they agree.",
  illustrate_memory:
    "Propose painting a small illustration for a memory. Only for objects, food, places, animals or simple scenes. Never for feelings, sayings, private memories, or anything showing the person. The user confirms first.",
  add_traditional_element:
    "Propose adding a traditional ofrenda element that connects to the conversation. The user confirms first. Do not propose elements already on the altar.",
  pause_conversation:
    "Offer the user a rest. Use after about four or five questions, or when emotions run high.",
  show_support_resources:
    "Show crisis support lines. Use when the user shows signs of acute distress, hopelessness, or thoughts of self-harm.",
};

export const tools: FunctionTool[] = (Object.keys(toolArgs) as ToolName[]).map((name) => {
  const parameters: Record<string, unknown> = z.toJSONSchema(toolArgs[name]);
  delete parameters.$schema;
  return { type: "function", name, description: descriptions[name], parameters, strict: true };
});

export function isToolName(name: string): name is ToolName {
  return name in toolArgs;
}
