import { agentResponse, toolAction, type ToolResult } from "@/lib/ai/agent-loop";
import { InterviewRequest } from "@/lib/ai/chat-schema";
import { blockedReason } from "@/lib/ai/image-prompt";
import { buildInterviewPrompt, phaseInstructions } from "@/lib/ai/interview-prompt";
import { interviewToolArgs, interviewTools } from "@/lib/ai/interview-tools";
import { isFaithful } from "@/lib/ai/memory-fidelity";
import { errorResponse, openai } from "@/lib/ai/openai";
import { interviewPhase } from "@/lib/interview-phase";
import type { ElementKey, InterviewStep } from "@/lib/types";

// Alebrije's opening interview: who the altar is for, a photo, things they
// loved, memories and the traditional elements. Same agent loop as the altar
// chat; the tools set what the user said or show a card they answer.

export const maxDuration = 60;

// How far back a saved memory may draw its words from.
const SOURCE_TURNS = 6;

export async function POST(request: Request) {
  const parsed = InterviewRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  let client;
  try {
    client = openai();
  } catch (error) {
    return errorResponse(error);
  }

  const body = parsed.data;
  const { altar, interview } = body;
  const phase = interviewPhase({ ...altar.lovedOne, done: interview.done });
  const messages = body.messages.length
    ? body.messages
    : [{ role: "note" as const, text: "The user has just opened the conversation." }];

  const state: ToolState = {
    body,
    memoryIds: new Set(altar.memories.map((m) => m.id)),
    elements: new Set(altar.elements),
    userWords: messages
      .filter((m) => m.role === "user")
      .slice(-SOURCE_TURNS)
      .map((m) => m.text)
      .join("\n"),
  };

  return agentResponse({
    request,
    client,
    instructions: buildInterviewPrompt(body, phase),
    tools: interviewTools,
    schemas: interviewToolArgs,
    messages,
    onTool: (name, args, callId) => runTool(name, args, callId, state),
  });
}

interface ToolState {
  body: InterviewRequest;
  memoryIds: Set<string>;
  elements: Set<ElementKey>;
  userWords: string;
}

const REWRITTEN =
  "was not saved: it isn't in the user's own words. Copy their exact words (only trim filler or fix a typo) and save it again.";

function runTool(name: string, args: Record<string, unknown>, callId: string, state: ToolState): ToolResult {
  const action = (extra: Record<string, unknown> = {}) => toolAction(name, callId, { ...args, ...extra });
  const { altar, interview } = state.body;

  switch (name) {
    case "set_loved_one": {
      const lovedOne = altar.lovedOne;
      lovedOne.name = String(args.name).trim().slice(0, 120) || lovedOne.name;
      // An unsure guess is never stored; the model asks instead.
      const pronouns = args.pronouns_confident ? (args.pronouns as typeof lovedOne.pronouns) : null;
      if (pronouns) lovedOne.pronouns = pronouns;
      if (typeof args.relation === "string" && args.relation.trim()) lovedOne.relation = args.relation.trim().slice(0, 120);
      if (args.is_child === true) lovedOne.isChild = true;
      return {
        output: `Saved. ${pronouns ? "" : "Pronouns not confirmed: use the name and confirm gently. "}${nextStep(state)}`,
        action: action({ pronouns }),
      };
    }

    case "save_memories": {
      const saved: { id: string; text: string }[] = [];
      const notes: string[] = [];
      (args.memories as { text: string }[]).forEach(({ text }, i) => {
        if (!isFaithful(text, state.userWords)) {
          notes.push(`Memory ${i + 1} ${REWRITTEN}`);
          return;
        }
        const id = `m_${crypto.randomUUID().slice(0, 8)}`;
        // A split can start mid-sentence ("her roses were..."); a capital is
        // the only change made to the user's words.
        const kept = text.trim().replace(/^\p{Ll}/u, (c) => c.toUpperCase());
        state.memoryIds.add(id);
        altar.memories.push({ id, text: kept, illustrated: false });
        saved.push({ id, text: kept });
      });
      if (saved.length === 0) return { output: notes.join(" ") };
      return {
        output: [`Saved ${saved.map((m) => m.id).join(", ")} on the altar.`, ...notes].join(" "),
        action: action({ memories: saved }),
      };
    }

    case "extend_memory": {
      const id = String(args.memory_id);
      if (!state.memoryIds.has(id)) return { output: "There is no memory with that id. Use save_memories instead." };
      if (!isFaithful(String(args.text), state.userWords)) return { output: `The addition ${REWRITTEN}` };
      return { output: `Added to ${id}.`, action: action() };
    }

    case "add_objects": {
      const objects = args.objects as { image_subject: string }[];
      const blocked = objects.map((o) => blockedReason(o.image_subject)).find(Boolean);
      if (blocked) return { output: `Not shown: ${blocked}` };
      return { output: "Shown to the user as one card. Nothing is placed until they agree.", action: action() };
    }

    case "offer_elements": {
      const elements = (args.elements as ElementKey[]).filter((e) => !state.elements.has(e));
      if (elements.length === 0) return { output: "Those are all on the altar already." };
      return { output: "The elements are shown for the user to pick.", action: action({ elements }) };
    }

    case "complete_step": {
      const step = args.step as InterviewStep;
      if (!interview.done.includes(step)) interview.done.push(step);
      return { output: `Step "${step}" finished. ${nextStep(state)}`, action: action() };
    }

    case "offer_choices":
      return { output: "The choices are shown under your message.", action: action() };
    case "request_photo":
      return { output: "The photo card is shown. The photo is stored privately for the user and never sent to you.", action: action() };
    case "offer_starter_objects":
      return { output: "The object picker is shown.", action: action() };
    case "finish_interview":
      return { output: "The button to open the altar is shown.", action: action() };
    case "pause_conversation":
      return { output: "A rest offer is shown to the user.", action: action() };
    case "show_support_resources":
      return { output: "Support lines are shown to the user.", action: action() };
    default:
      return { output: `Unknown tool ${name}.` };
  }
}

// After a step changes, the model gets the next step's instructions in the
// tool result, so it can move on within the same reply.
function nextStep({ body }: ToolState) {
  const phase = interviewPhase({ ...body.altar.lovedOne, done: body.interview.done });
  return `Now: ${phaseInstructions(phase, body)}`;
}
