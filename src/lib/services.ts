"use client";

import { useSyncExternalStore } from "react";
import { useStorageProblem } from "@/lib/store/altar-store";
import { hasSupabase } from "@/lib/supabase";

// Which outside services this copy of the app has. A fresh clone has none:
// the altar is kept in this browser, and the alebrije can't talk or paint.

// null until /api/status answers.
let ai: boolean | null = null;
let checkStarted = false;
const listeners = new Set<() => void>();

function setAi(next: boolean) {
  if (ai === next) return;
  ai = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!checkStarted) {
    checkStarted = true;
    fetch("/api/status")
      .then((response) => response.json())
      .then((status: { ai: boolean }) => setAi(status.ai))
      .catch(() => {
        checkStarted = false; // unknown: ask again next time
      });
  }
  return () => listeners.delete(listener);
}

// Called when a request finds the AI service missing after all.
export function markAiUnavailable() {
  setAi(false);
}

export function useServices() {
  return {
    ai: useSyncExternalStore(subscribe, () => ai, () => null),
    storage: hasSupabase ? ("cloud" as const) : ("browser" as const),
    storageProblem: useStorageProblem(),
  };
}
