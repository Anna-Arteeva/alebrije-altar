import { agentResponse, toolAction, type ToolResult } from "@/lib/ai/agent-loop";
import { ChatRequest } from "@/lib/ai/chat-schema";
import { blockedReason } from "@/lib/ai/image-prompt";
import { isFaithful } from "@/lib/ai/memory-fidelity";
import { errorResponse, openai } from "@/lib/ai/openai";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { isToolName, toolArgs, tools } from "@/lib/ai/tools";
import type { ElementKey } from "@/lib/types";

// The alebrije's conversation on the altar page. The loop itself lives in
// lib/ai/agent-loop; this route decides what each tool call does.

export const maxDuration = 60;

export async function POST(request: Request) {
  const parsed = ChatRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  let client;
  try {
    client = openai();
  } catch (error) {
    return errorResponse(error);
  }

  const { altar, messages } = parsed.data;
  const state: ToolState = {
    memoryIds: new Set(altar.memories.map((m) => m.id)),
    elements: new Set(altar.elements),
    hasPhoto: !!messages.at(-1)?.photo,
    userWords: messages
      .filter((m) => m.role === "user")
      .slice(-6)
      .map((m) => m.text)
      .join("\n"),
  };

  return agentResponse({
    request,
    client,
    instructions: buildSystemPrompt(altar),
    tools,
    schemas: toolArgs,
    messages,
    onTool: (name, args, callId) => runTool(name, args, callId, state),
  });
}

interface ToolState {
  memoryIds: Set<string>;
  elements: Set<ElementKey>;
  hasPhoto: boolean;
  userWords: string;
}

const SHOWN = "Shown to the user as a suggestion card. They decide; nothing is placed until they agree.";

function runTool(name: string, args: Record<string, unknown>, callId: string, state: ToolState): ToolResult {
  if (!isToolName(name)) return { output: `Unknown tool ${name}.` };
  const action = (extra: Record<string, unknown> = {}) => toolAction(name, callId, { ...args, ...extra });

  switch (name) {
    case "add_memory": {
      // A photo's caption may describe the photo; anything else is the user's words.
      const fromPhoto = state.hasPhoto && args.from_attached_photo === true;
      if (!fromPhoto && !isFaithful(String(args.text), state.userWords)) {
        return { output: "Not saved: it isn't in the user's own words. Copy their exact words and save it again." };
      }
      const memoryId = `m_${crypto.randomUUID().slice(0, 8)}`;
      state.memoryIds.add(memoryId);
      return {
        output: `Saved as memory ${memoryId}. It is now on the altar.`,
        action: action({ memory_id: memoryId, from_attached_photo: fromPhoto }),
      };
    }
    case "suggest_object":
    case "illustrate_memory": {
      if (name === "illustrate_memory" && !state.memoryIds.has(args.memory_id as string)) {
        return { output: "There is no memory with that id." };
      }
      const blocked = blockedReason(args.image_subject as string);
      if (blocked) return { output: `Not shown: ${blocked}` };
      return { output: SHOWN, action: action() };
    }
    case "add_traditional_element": {
      const element = args.element as ElementKey;
      if (state.elements.has(element)) return { output: `${element} is already on the altar.` };
      state.elements.add(element);
      return { output: SHOWN, action: action() };
    }
    case "pause_conversation":
      return { output: "A rest offer is shown to the user.", action: action() };
    case "show_support_resources":
      return { output: "Support lines are shown to the user.", action: action() };
  }
}
