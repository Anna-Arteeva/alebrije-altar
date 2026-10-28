import { connection } from "next/server";
import { hasOpenAI } from "@/lib/ai/openai";

// Tells the browser whether the AI service is set up, so a copy without keys
// shows its fallbacks instead of failing on the first message.

export async function GET() {
  await connection(); // read the key per request, not once at build
  return Response.json({ ai: hasOpenAI() });
}
