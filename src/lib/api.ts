"use client";

import type { ChatEvent } from "@/lib/ai/chat-schema";
import { base64ToBlob } from "@/lib/images";
import { markAiUnavailable } from "@/lib/services";
import { storeBlob } from "@/lib/store/altar-store";

// Browser-side calls to our own API routes.

// The server has no OpenAI key; the page shows its fallbacks instead.
export class AiUnavailableError extends Error {}

function failure(data: { error?: string; code?: string }, fallback: string) {
  if (data.code === "ai_unavailable") {
    markAiUnavailable();
    return new AiUnavailableError(data.error ?? fallback);
  }
  return new Error(data.error ?? fallback);
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw failure(data, "Something went wrong. Please try again.");
  return data as T;
}

export interface AlebrijeBirth {
  name: string;
  intro: string;
  personality: string;
  image_subject: string;
}

export function birthAlebrije(answers: {
  animal: string;
  color: string;
  place: string;
  lovedOneName: string;
  isChild: boolean;
}) {
  return postJson<AlebrijeBirth>("/api/alebrije", answers);
}

export type ImageKind = "alebrije" | "object" | "vignette" | "element";

// Paints an image and stores it with the altar; resolves to the blob id.
export async function paintImage(kind: ImageKind, subject: string) {
  const { b64, mime } = await postJson<{ b64: string; mime: string }>("/api/image", { kind, subject });
  return storeBlob(base64ToBlob(b64, mime));
}

// Streams one alebrije turn from /api/chat or /api/interview.
export async function streamChat(
  url: string,
  body: unknown,
  onEvent: (event: ChatEvent) => void,
  signal?: AbortSignal,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    throw failure(data, "I couldn't reach the alebrije. Please try again.");
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) onEvent(JSON.parse(line) as ChatEvent);
    }
  }
}
