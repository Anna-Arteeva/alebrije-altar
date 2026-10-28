import type OpenAI from "openai";
import type {
  FunctionTool,
  ResponseFunctionToolCall,
  ResponseInputItem,
  ResponseOutputItem,
} from "openai/resources/responses/responses";
import type { z } from "zod";
import type { ChatEvent, ChatTurn } from "./chat-schema.ts";
import { CHAT_MODEL } from "./openai.ts";

// The alebrije's agent loop, shared by the altar chat and the interview.
//
// 1. Send the system prompt, the recent conversation and the tools to the model.
// 2. Stream its words to the browser as they arrive.
// 3. If it called tools, validate each call, tell the browser what to show
//    (an "action"), and hand the model a short result.
// 4. Repeat until the model answers without calling tools.
//
// The browser applies actions to the altar and saves it to Supabase.

const MAX_STEPS = 4;

export interface ToolResult {
  output: string;
  action?: ChatEvent;
}

export type ToolHandler = (name: string, args: Record<string, unknown>, callId: string) => ToolResult;

export function agentResponse(options: {
  request: Request;
  client: OpenAI;
  instructions: string;
  tools: FunctionTool[];
  schemas: Record<string, z.ZodType>;
  messages: ChatTurn[];
  onTool: ToolHandler;
}) {
  const { request, client, instructions, tools, schemas, onTool } = options;
  const input: ResponseInputItem[] = options.messages.map(toInputItem);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ChatEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      let wroteText = false;

      try {
        for (let step = 0; step < MAX_STEPS; step++) {
          const response = client.responses.stream(
            {
              model: CHAT_MODEL,
              instructions,
              input,
              tools,
              reasoning: { effort: "low" },
              // Memories are private: don't keep them on OpenAI's side.
              store: false,
              include: ["reasoning.encrypted_content"],
            },
            { signal: request.signal },
          );

          let stepStarted = false;
          for await (const event of response) {
            if (event.type === "response.output_text.delta") {
              if (!stepStarted && wroteText) send({ type: "text", delta: "\n\n" });
              stepStarted = wroteText = true;
              send({ type: "text", delta: event.delta });
            }
          }

          const final = await response.finalResponse();
          const output = final.output as ResponseOutputItem[];
          const calls = output.filter(
            (item): item is ResponseFunctionToolCall => item.type === "function_call",
          );
          if (calls.length === 0) break;

          input.push(...output.flatMap(toReplayItem));
          for (const call of calls) {
            const { output, action } = runCall(call, schemas, onTool);
            if (action) send(action);
            input.push({ type: "function_call_output", call_id: call.call_id, output });
          }
        }
        send({ type: "done" });
      } catch (error) {
        if (!request.signal.aborted) {
          console.error(error);
          send({ type: "error", message: "I lost my words for a moment. Could you try again?" });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// Builds the "action" event the browser applies for a tool call.
export function toolAction(name: string, callId: string, args: Record<string, unknown>): ChatEvent {
  return { type: "action", tool: name, callId, args };
}

function runCall(
  call: ResponseFunctionToolCall,
  schemas: Record<string, z.ZodType>,
  onTool: ToolHandler,
): ToolResult {
  const schema = schemas[call.name];
  if (!schema) return { output: `Unknown tool ${call.name}.` };

  let raw: unknown;
  try {
    raw = JSON.parse(call.arguments);
  } catch {
    return { output: "Arguments were not valid JSON." };
  }
  const result = schema.safeParse(raw);
  if (!result.success) return { output: "Arguments did not match the tool's schema." };
  return onTool(call.name, result.data as Record<string, unknown>, call.call_id);
}

function toInputItem(turn: ChatTurn): ResponseInputItem {
  if (turn.role === "note") return { role: "developer", content: turn.text };
  if (turn.role === "assistant") return { role: "assistant", content: turn.text };
  if (!turn.photo) return { role: "user", content: turn.text };
  return {
    role: "user",
    content: [
      { type: "input_text", text: turn.text || "(The user attached a photo.)" },
      { type: "input_image", image_url: turn.photo, detail: "low" },
    ],
  };
}

// Feeds the model's own output back in for the next step, keeping only the
// fields the API accepts as input.
function toReplayItem(item: ResponseOutputItem): ResponseInputItem[] {
  switch (item.type) {
    case "reasoning":
      return [
        { type: "reasoning", id: item.id, summary: item.summary, encrypted_content: item.encrypted_content },
      ];
    case "function_call":
      return [{ type: "function_call", call_id: item.call_id, name: item.name, arguments: item.arguments }];
    case "message": {
      const text = item.content.map((part) => (part.type === "output_text" ? part.text : "")).join("");
      return text ? [{ role: "assistant", content: text }] : [];
    }
    default:
      return [];
  }
}
