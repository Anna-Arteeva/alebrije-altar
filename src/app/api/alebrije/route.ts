import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { CHAT_MODEL, errorResponse, openai } from "@/lib/ai/openai";

// Births the alebrije: three answers in, a name, intro and look out.

const Answers = z.object({
  animal: z.string().trim().min(1).max(200),
  color: z.string().trim().min(1).max(200),
  place: z.string().trim().min(1).max(200),
  lovedOneName: z.string().trim().min(1).max(120),
  isChild: z.boolean(),
});

const Birth = z.object({
  name: z.string().describe("A short, playful Spanish-flavored name, e.g. 'Canelita' or 'Don Chispas'."),
  intro: z
    .string()
    .describe(
      "Two or three short sentences in first person: who you are, what you're made of, and that you'll help build the ofrenda for the loved one. End with a gentle first question about them.",
    ),
  personality: z.string().describe("One sentence of personality notes that will guide how you talk."),
  image_subject: z
    .string()
    .describe("A vivid visual description of the creature for the illustrator, under 70 words: body parts, patterns, colors."),
});

const INSTRUCTIONS = `
You design alebrijes: fantastical Mexican folk-art creatures, a tradition started by Pedro Linares López in 1936.
The user answers three questions and an alebrije is born from them to guide them as they build a Día de Muertos ofrenda for someone they love.
- Write everything in English, whatever language the answers are in. Keep Spanish only for the name and tradition words (ofrenda, cempasúchil), and give a short gloss of those words. Use commas or parentheses, never em dashes.
- Blend the answered animal with one or two other animals into a new hybrid. Weave the color into its patterns and a motif from the place into its markings.
- Never a winged jaguar and never a hairless dog; if the answer is a jaguar or a dog, mix in other creatures so it looks clearly different.
- Never reference any film, studio or existing character.
- Warm, curious, a little playful. If the loved one was a child, keep the intro especially gentle.
- The alebrije is a guide for the living. It never speaks for the person who died.
`.trim();

export const maxDuration = 60;

export async function POST(request: Request) {
  const parsed = Answers.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Please answer all three questions." }, { status: 400 });
  }
  const { animal, color, place, lovedOneName, isChild } = parsed.data;

  try {
    const response = await openai().responses.parse({
      model: CHAT_MODEL,
      instructions: INSTRUCTIONS,
      input: `Animal: ${animal}\nColor: ${color}\nPlace: ${place}\nThe ofrenda is for: ${lovedOneName}${isChild ? " (a child)" : ""}`,
      reasoning: { effort: "low" },
      store: false,
      text: { format: zodTextFormat(Birth, "alebrije") },
    });
    const birth = response.output_parsed;
    if (!birth) throw new Error("No alebrije came back.");
    return Response.json(birth);
  } catch (error) {
    return errorResponse(error);
  }
}
