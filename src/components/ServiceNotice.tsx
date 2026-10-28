"use client";

import { useState } from "react";
import { useServices } from "@/lib/services";

// A thin strip above the page when this copy of the app runs without its
// outside services, say a fresh clone with no keys, so missing pieces read as
// expected. It sits in the flow, so it never covers a control. Dismissing it
// lasts until the next full page load.

export function ServiceNotice() {
  const { ai, storage, storageProblem } = useServices();
  const [dismissed, setDismissed] = useState(false);

  const problem = storage === "cloud" && storageProblem;
  const lines = [
    ai === false && "Alebrije can't talk or paint: no OpenAI key is set up.",
    storage === "browser" && "Your altar is saved in this browser only.",
    problem && "The altar can't reach its database right now, so changes may not be saved.",
  ].filter((line): line is string => Boolean(line));

  if (dismissed || !lines.length) return null;

  return (
    <div role="status" className="flex items-center gap-2 bg-marigold-tint py-1.5 pl-4 pr-1.5 text-sm">
      <p className="mx-auto">
        <strong>{problem ? "Not saving right now." : "Demo mode."}</strong> {lines.join(" ")}{" "}
        <span className="text-ink-soft">See the README to connect OpenAI and Supabase.</span>
      </p>
      <button type="button" onClick={() => setDismissed(true)} className="btn btn-ghost btn-sm size-8 shrink-0 p-0" aria-label="Dismiss">
        <svg viewBox="0 0 20 20" className="size-3" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M5 5 L15 15 M15 5 L5 15" />
        </svg>
      </button>
    </div>
  );
}
