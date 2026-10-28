"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DetailPanel } from "@/components/AltarPanels";
import { AltarScene, type Selection } from "@/components/AltarScene";
import { ChatPanel } from "@/components/ChatPanel";
import { ElementArt } from "@/components/ElementArt";
import { ExistingAltar } from "@/components/ExistingAltar";
import { PapelPicado } from "@/components/PapelPicado";
import { startInterview } from "@/lib/interview-actions";
import { useAltar } from "@/lib/store/altar-store";
import { useInterviewChat } from "@/lib/use-interview";

// Starting an altar by talking: Alebrije asks, and the ofrenda fills in
// beside the conversation as the user answers. On a phone the two are tabs.

export function InterviewApp() {
  const { status, altar } = useAltar();
  const chat = useInterviewChat();
  const [replacing, setReplacing] = useState(false);
  const [view, setView] = useState<"talk" | "altar">("talk");
  const [selection, setSelection] = useState<Selection | null>(null);
  const started = useRef(false);

  const interviewing = altar?.stage === "interview";

  // A fresh visit with no altar starts the interview straight away.
  useEffect(() => {
    if (status === "ready" && !altar && !started.current) {
      started.current = true;
      void startInterview(false);
    }
  }, [status, altar]);

  // Alebrije speaks first, and tries again if that turn was cut off.
  useEffect(() => {
    if (interviewing && altar.messages.length === 0 && !chat.busy && !chat.error) chat.continueTalking();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the conversation is empty
  }, [interviewing, altar?.messages.length, chat.busy]);

  useEffect(() => {
    document.documentElement.dataset.mood = altar?.mood ?? "festive";
  }, [altar?.mood]);

  if (status === "loading" || !altar) {
    return (
      <div className="grid flex-1 place-items-center p-8">
        <div className="skeleton h-80 w-full max-w-xl rounded-2xl" />
      </div>
    );
  }

  if (!interviewing && !replacing) {
    return (
      <div className="flex flex-1 flex-col">
        <PapelPicado flags={11} className="max-h-24" />
        <main className="onboarding-frame mx-auto flex-1 px-5 pb-16 pt-8 sm:pt-12">
          <div className="onboarding-panel">
            <ExistingAltar
              altar={altar}
              onReplace={() => {
                setReplacing(true);
                void startInterview(true);
              }}
            />
          </div>
        </main>
      </div>
    );
  }

  if (!interviewing) {
    return <div className="grid flex-1 place-items-center p-8"><div className="skeleton h-80 w-full max-w-xl rounded-2xl" /></div>;
  }

  const placed = altar.objects.length + altar.memories.length + altar.elements.length;

  return (
    <div className="flex h-dvh flex-col">
      <div className="flex min-h-0 flex-1">
        <main
          className={`interview-altar min-h-0 flex-1 overflow-y-auto ${view === "talk" ? "hidden lg:block" : ""}`}
          aria-label="Your ofrenda so far"
        >
          <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6">
            <p className="eyebrow">{altar.lovedOne.name ? `Ofrenda for ${altar.lovedOne.name}` : "Your ofrenda"}</p>
            {altar.lovedOne.name ? (
              <>
                <AltarScene altar={altar} selected={selection} onSelect={setSelection} />
                {selection && (
                  <div className="mt-8">
                    <DetailPanel altar={altar} selection={selection} onClose={() => setSelection(null)} />
                  </div>
                )}
              </>
            ) : (
              <EmptyAltar />
            )}
          </div>
        </main>

        <aside
          className={`chat-rail min-h-0 w-full lg:block lg:w-[32rem] lg:shrink-0 lg:border-l lg:border-paper-edge ${view === "altar" ? "hidden" : ""}`}
          aria-label="Conversation with Alebrije"
        >
          <ChatPanel
            altar={altar}
            chat={chat}
            subtitle="Your guide to the ofrenda"
            aside={
              <Link href="/new" className="btn btn-ghost btn-sm max-sm:px-2 text-xs sm:text-sm">
                Prefer a form?
              </Link>
            }
          />
        </aside>
      </div>

      <nav className="view-nav grid grid-cols-2 lg:hidden" aria-label="View">
        {(["talk", "altar"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={`min-h-12 text-sm font-semibold transition-colors duration-150 ${view === v ? "text-rosa-text" : "text-ink-soft"}`}
          >
            {v === "talk" ? "Talk with Alebrije" : `Altar so far${placed ? ` (${placed})` : ""}`}
          </button>
        ))}
      </nav>
    </div>
  );
}

function EmptyAltar() {
  return (
    <div className="mt-10 flex flex-col items-center text-center">
      <div className="flex items-end gap-3 opacity-70" aria-hidden>
        <ElementArt element="candles" size={64} />
        <ElementArt element="cempasuchil" size={80} />
        <ElementArt element="candles" size={64} />
      </div>
      <p className="mt-6 max-w-sm font-display text-2xl leading-snug">Their ofrenda will take shape here as you talk.</p>
      <p className="hint mt-3 max-w-sm">
        Everything stays in this browser. Alebrije only places things you agree to.
      </p>
    </div>
  );
}
