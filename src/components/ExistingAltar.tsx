import Link from "next/link";
import type { AltarState } from "@/lib/types";

// Shown when someone starts a new altar while they already have one.
// Starting again replaces it, so it's always a deliberate choice.

export function ExistingAltar({ altar, onReplace }: { altar: AltarState; onReplace: () => void }) {
  const { name } = altar.lovedOne;
  const talking = altar.stage === "interview";

  return (
    <>
      <h1 className="font-display text-3xl">
        {talking ? "You've already started an altar" : "You already have an altar"}
      </h1>
      <p className="mt-3 text-ink-soft">
        This app keeps one altar for you{name ? `, for ${name}` : ""}. Starting a new one replaces it.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {talking ? (
          <Link href="/talk" className="btn btn-primary">Continue with Alebrije</Link>
        ) : (
          <Link href="/altar" className="btn btn-primary">Return to {name}&rsquo;s altar</Link>
        )}
        <button type="button" className="btn btn-ghost" onClick={onReplace}>
          Start a new one
        </button>
      </div>
    </>
  );
}
