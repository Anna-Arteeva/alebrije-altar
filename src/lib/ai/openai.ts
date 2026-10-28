import OpenAI from "openai";

// Server-only: the API key never reaches the browser.

export const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-5.5";
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare";

let client: OpenAI | null = null;

export function openai() {
  if (!hasOpenAI()) {
    throw new MissingKeyError();
  }
  client ??= new OpenAI();
  return client;
}

export const hasOpenAI = () => Boolean(process.env.OPENAI_API_KEY);

export class MissingKeyError extends Error {
  constructor() {
    super("Alebrije's voice isn't connected here yet. Add OPENAI_API_KEY to .env.local and restart the server.");
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof MissingKeyError) {
    // The browser shows its own fallback for this code.
    return Response.json({ error: error.message, code: "ai_unavailable" }, { status: 503 });
  }
  console.error(error);
  if (error instanceof OpenAI.APIError) {
    return Response.json(
      { error: "The image or text service had a problem. Please try again." },
      { status: error.status ?? 502 },
    );
  }
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
