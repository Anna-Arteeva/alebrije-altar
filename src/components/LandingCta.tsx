"use client";

import Link from "next/link";
import { useAltar } from "@/lib/store/altar-store";

export function LandingCta() {
  const { status, altar } = useAltar();

  return (
    <div className="mt-10 flex min-h-11 flex-wrap items-center gap-3">
      {status === "loading" ? null : altar ? (
        <>
          {altar.stage === "interview" ? (
            <Link href="/talk" className="btn btn-primary">Continue with Alebrije</Link>
          ) : (
            <Link href="/altar" className="btn btn-primary">
              Return to {altar.lovedOne.name}&rsquo;s altar
            </Link>
          )}
          <Link href="/talk" className="btn btn-ghost">Start a new one</Link>
        </>
      ) : (
        <>
          <Link href="/talk" className="btn btn-primary">Start an altar</Link>
          <Link href="/new" className="btn btn-ghost">Prefer a form?</Link>
        </>
      )}
    </div>
  );
}
