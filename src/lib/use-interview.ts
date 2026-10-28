"use client";

import type { InterviewRequest } from "@/lib/ai/chat-schema";
import { applyInterviewAction, markStepDone } from "@/lib/interview-actions";
import { interviewPhase } from "@/lib/interview-phase";
import { getAltar } from "@/lib/store/altar-store";
import type { AltarState } from "@/lib/types";
import { buildRequest, useAgentChat } from "@/lib/use-chat";

// The interview's conversation: the same turn loop as the altar chat, sent to
// /api/interview with where the interview stands.
export function useInterviewChat() {
  const chat = useAgentChat({ url: "/api/interview", build, apply: applyInterviewAction });
  return {
    ...chat,
    // Skipping a question in the interview skips the step it belongs to.
    skip: () => {
      const altar = getAltar();
      if (altar) {
        const phase = interviewPhase({ ...altar.lovedOne, done: altar.interview?.done ?? [] });
        if (phase !== "welcome" && phase !== "finish") markStepDone(phase);
      }
      return chat.skip();
    },
  };
}

function build(altar: AltarState, replyId: string, photoDataUrl?: string): InterviewRequest {
  const { altar: context, messages } = buildRequest(altar, replyId, photoDataUrl);
  return {
    altar: context,
    interview: { done: altar.interview?.done ?? [], hour: new Date().getHours() },
    messages,
  };
}
