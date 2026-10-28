"use client";

import { personConversation } from "@/lib/people";
import { useRef, useState } from "react";
import type { ChatRequest } from "@/lib/ai/chat-schema";
import { applyToolAction } from "@/lib/altar-actions";
import { streamChat } from "@/lib/api";
import { downscaleToDataUrl } from "@/lib/images";
import { getAltar, storeBlob, updateAltar } from "@/lib/store/altar-store";
import { uid } from "@/lib/store/db";
import type { AltarState } from "@/lib/types";

const HISTORY = 40;

// The altar page's conversation.
export function useAlebrijeChat() {
  return useAgentChat({ url: "/api/chat", build: buildRequest, apply: applyToolAction });
}

export type AgentChat = ReturnType<typeof useAgentChat>;

// Runs one conversational turn: saves the user's message, streams the
// alebrije's reply, and applies its tool calls to the altar as they arrive.
// Shared by the altar chat and the interview, which differ in endpoint,
// request and what their tools do.
export function useAgentChat({
  url,
  build,
  apply,
}: {
  url: string;
  build: (altar: AltarState, replyId: string, photoDataUrl?: string) => unknown;
  apply: (messageId: string, tool: string, callId: string, args: Record<string, unknown>, photoId?: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [streaming, setStreaming] = useState<{ id: string; text: string } | null>(null);
  const abort = useRef<AbortController | null>(null);

  async function run(user?: { text: string; photo?: Blob; skipped?: boolean }) {
    if (!getAltar() || abort.current) return;
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError(undefined);

    let photoId: string | undefined;
    let photoDataUrl: string | undefined;
    const replyId = uid("msg");
    let text = "";

    try {
      if (user?.photo) {
        photoId = await storeBlob(user.photo);
        photoDataUrl = await downscaleToDataUrl(user.photo);
      }
      await updateAltar((a) => ({
        ...a,
        messages: [
          ...a.messages,
          ...(user
            ? [{ id: uid("msg"), role: "user" as const, text: user.text, photoId, skipped: user.skipped, createdAt: Date.now() }]
            : []),
          { id: replyId, role: "assistant" as const, text: "", createdAt: Date.now() + 1 },
        ],
      }));
      setStreaming({ id: replyId, text: "" });

      await streamChat(
        url,
        build(getAltar()!, replyId, photoDataUrl),
        (event) => {
          if (event.type === "text") {
            text += event.delta;
            setStreaming({ id: replyId, text });
          } else if (event.type === "action") {
            apply(replyId, event.tool, event.callId, event.args, photoId);
          } else if (event.type === "error") {
            setError(event.message);
          }
        },
        controller.signal,
      );
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      // Commit the streamed words once, and drop the reply if nothing came.
      await updateAltar((a) => ({
        ...a,
        messages: a.messages
          .map((m) => (m.id === replyId ? { ...m, text } : m))
          .filter((m) => m.id !== replyId || m.text.trim() || m.cards?.length),
      }));
      setStreaming(null);
      setBusy(false);
      abort.current = null;
    }
  }

  return {
    busy,
    error,
    streaming,
    send: (text: string, photo?: Blob) => run({ text, photo }),
    skip: () => run({ text: "I'd rather skip this one.", skipped: true }),
    continueTalking: () => run(),
    stop: () => abort.current?.abort(),
  };
}

export function buildRequest(altar: AltarState, replyId: string, photoDataUrl?: string): ChatRequest {
  const history = personConversation(altar.messages)
    .filter((m) => m.id !== replyId && m.text.trim())
    .slice(-HISTORY);
  const lastUser = history.findLastIndex((m) => m.role === "user");

  // The interview's goodbye counts as a rest, so the altar chat starts fresh.
  const lastRest = altar.messages.findLastIndex((m) =>
    m.cards?.some((c) => c.kind === "pause" || c.kind === "finish"),
  );
  const questionsSinceRest = altar.messages
    .slice(lastRest + 1)
    .filter((m) => m.role === "assistant" && m.text.trim()).length;

  return {
    altar: {
      lovedOne: {
        name: altar.lovedOne.name,
        relation: altar.lovedOne.relation,
        isChild: altar.lovedOne.isChild,
        hasPhoto: !!altar.lovedOne.photoId,
        pronouns: altar.lovedOne.pronouns,
      },
      alebrije: {
        name: altar.alebrije?.name ?? "Alebrije",
        animal: altar.alebrije?.traits.animal ?? "",
        color: altar.alebrije?.traits.color ?? "",
        place: altar.alebrije?.traits.place ?? "",
        personality: altar.alebrije?.personality ?? "",
      },
      mood: altar.mood,
      memories: altar.memories.filter((m) => m.lovedOneId === altar.lovedOne.id).map((m) => ({
        id: m.id,
        text: m.text.slice(0, 600),
        illustrated: m.illustrationStatus === "done",
      })),
      objects: altar.objects.filter((o) => o.lovedOneId === altar.lovedOne.id).map((o) => o.name),
      elements: altar.elements,
      questionsSinceRest,
    },
    messages: history.map((m, i) => ({
      role: m.role,
      text: m.text.slice(0, 6000),
      photo: i === lastUser ? photoDataUrl : undefined,
    })),
  };
}
