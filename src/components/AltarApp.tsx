"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AddPanel, DetailPanel, ElementsTray } from "@/components/AltarPanels";
import { AltarScene, type Selection } from "@/components/AltarScene";
import { ChatPanel } from "@/components/ChatPanel";
import { PapelPicado } from "@/components/PapelPicado";
import { exportAltar, setMood } from "@/lib/altar-actions";
import { deleteEverything, useAltar } from "@/lib/store/altar-store";
import { useAlebrijeChat } from "@/lib/use-chat";
import type { AltarState } from "@/lib/types";

export function AltarApp() {
  const { status, altar } = useAltar();
  const chat = useAlebrijeChat();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<"altar" | "talk">("talk");
  const detail = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.mood = altar?.mood ?? "festive";
  }, [altar?.mood]);

  function select(next: Selection) {
    setAdding(false);
    setSelection(next);
    setView("altar");
    requestAnimationFrame(() => detail.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }

  if (status === "loading") {
    return (
      <div className="grid flex-1 place-items-center p-8">
        <div className="skeleton h-80 w-full max-w-xl rounded-2xl" />
      </div>
    );
  }

  if (altar?.stage === "interview") {
    return (
      <div className="flex flex-1 flex-col">
        <PapelPicado flags={11} className="max-h-24" />
        <main className="mx-auto max-w-xl px-5 py-16 text-center">
          <h1 className="font-display text-3xl">Your altar is still taking shape</h1>
          <p className="mt-3 text-ink-soft">Alebrije is in the middle of asking about {altar.lovedOne.name || "them"}.</p>
          <Link href="/talk" className="btn btn-primary mt-8">Continue with Alebrije</Link>
        </main>
      </div>
    );
  }

  if (!altar || !altar.alebrije) {
    return (
      <div className="flex flex-1 flex-col">
        <PapelPicado flags={11} className="max-h-24" />
        <main className="mx-auto max-w-xl px-5 py-16 text-center">
          <h1 className="font-display text-3xl">No altar here yet</h1>
          <p className="mt-3 text-ink-soft">Altars are kept with the browser where they were made.</p>
          <Link href="/talk" className="btn btn-primary mt-8">Start an altar</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <Header
        altar={altar}
        onAdd={() => {
          setSelection(null);
          setAdding(true);
          setView("altar");
        }}
        onAbout={() => select({ kind: "about" })}
      />

      <div className="flex min-h-0 flex-1">
        <main className={`min-h-0 flex-1 overflow-y-auto ${view === "talk" ? "hidden lg:block" : ""}`}>
          <div className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
            <h1 className="sr-only">Ofrenda for {altar.lovedOne.name}</h1>
            <AltarScene altar={altar} selected={selection} onSelect={select} />
            <div ref={detail} className="mt-8 space-y-10 scroll-mt-4">
              {adding && <AddPanel onDone={() => setAdding(false)} />}
              {selection && !adding && (
                <DetailPanel altar={altar} selection={selection} onClose={() => setSelection(null)} />
              )}
              <ElementsTray altar={altar} onSelect={select} />
            </div>
          </div>
        </main>

        <aside
          className={`chat-rail min-h-0 w-full lg:block lg:w-[26rem] lg:shrink-0 lg:border-l lg:border-paper-edge ${view === "altar" ? "hidden" : ""}`}
          aria-label={`Conversation with ${altar.alebrije.name}`}
        >
          <ChatPanel altar={altar} chat={chat} />
        </aside>
      </div>

      <nav className="view-nav grid grid-cols-2 lg:hidden" aria-label="View">
        {(["altar", "talk"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={`min-h-12 text-sm font-semibold transition-colors duration-150 ${view === v ? "text-rosa-text" : "text-ink-soft"}`}
          >
            {v === "altar" ? "Altar" : `Talk with ${altar.alebrije!.name}`}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Header({ altar, onAdd, onAbout }: { altar: AltarState; onAdd: () => void; onAbout: () => void }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const quiet = altar.mood === "quiet";

  return (
    <header className="app-header flex items-center gap-2 px-4 py-2 sm:px-6">
      <Link href="/" className="mr-auto min-w-0 truncate font-display text-lg sm:text-xl">
        <span className="max-sm:hidden">Ofrenda for </span>
        {altar.lovedOne.name}
      </Link>

      <button type="button" className="btn btn-ghost btn-sm" onClick={onAdd}>
        <svg viewBox="0 0 20 20" className="size-4" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M10 4 V16 M4 10 H16" />
        </svg>
        <span className="max-sm:sr-only">Add</span>
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={quiet}
        onClick={() => setMood(quiet ? "festive" : "quiet")}
        className="btn btn-ghost btn-sm"
        title="Quiet mode softens colors and the alebrije's tone"
      >
        <span className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${quiet ? "bg-ink-soft" : "bg-paper-edge"}`}>
          <span
            className={`absolute left-0 top-0.5 size-4 rounded-full bg-paper-raised shadow transition-transform duration-200 ${quiet ? "translate-x-4.5" : "translate-x-0.5"}`}
          />
        </span>
        Quiet
      </button>

      <details className="relative" onToggle={(e) => !e.currentTarget.open && setConfirmDelete(false)}>
        <summary className="btn btn-ghost btn-sm list-none [&::-webkit-details-marker]:hidden" aria-label="More">
          <svg viewBox="0 0 20 20" className="size-5" fill="currentColor" aria-hidden>
            <circle cx="4" cy="10" r="1.6" />
            <circle cx="10" cy="10" r="1.6" />
            <circle cx="16" cy="10" r="1.6" />
          </svg>
        </summary>
        <div className="surface-popover absolute right-0 z-20 mt-2 w-64 p-2">
          <MenuItem onClick={onAbout}>About Día de Muertos and alebrijes</MenuItem>
          <MenuItem onClick={() => void exportAltar()}>Download everything (.zip)</MenuItem>
          <div className="my-1 h-px bg-paper-edge" />
          {confirmDelete ? (
            <div className="p-2">
              <p className="text-sm">This deletes the altar, photos and memories for good. It can&rsquo;t be undone.</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm bg-danger text-paper-raised"
                  onClick={async () => {
                    await deleteEverything();
                    router.push("/");
                  }}
                >
                  Delete
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <MenuItem onClick={() => setConfirmDelete(true)} danger>
              Delete everything
            </MenuItem>
          )}
        </div>
      </details>
    </header>
  );
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick();
        if (!danger) e.currentTarget.closest("details")?.removeAttribute("open");
      }}
      className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-paper-deep ${danger ? "text-danger" : ""}`}
    >
      {children}
    </button>
  );
}
