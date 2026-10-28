"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { type Selection } from "@/components/AltarScene";
import { ImmersiveAltar } from "@/components/ImmersiveAltar";
import { DetailPanel } from "@/components/AltarPanels";
import { ChatPanel } from "@/components/ChatPanel";
import { ElementArt } from "@/components/ElementArt";
import { ELEMENTS } from "@/content/ofrenda";
import { addPersonToAltar, INTERVIEW_ALEBRIJE, startInterview } from "@/lib/interview-actions";
import { peopleOnAltar, personConversation } from "@/lib/people";
import { updateAltar, useAltar } from "@/lib/store/altar-store";
import { useInterviewChat } from "@/lib/use-interview";
import { useAlebrijeChat } from "@/lib/use-chat";
import { ELEMENT_KEYS, type AltarState } from "@/lib/types";

const PREVIEW: AltarState = {
  version: 1, id: "preview", createdAt: 0, mood: "festive", lovedOne: { id: "preview", name: "", isChild: false },
  alebrije: INTERVIEW_ALEBRIJE, elements: [...ELEMENT_KEYS], objects: [], memories: [], messages: [], stage: "interview",
};

export function OfrendaHome() {
  const { status, altar } = useAltar();
  const interview = useInterviewChat();
  const ongoing = useAlebrijeChat();
  const chat = altar?.stage === "interview" ? interview : ongoing;
  const [selection, setSelection] = useState<Selection | null>(null);
  const started = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (selection) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selection]);
  const chatArea = useRef<HTMLElement>(null);
  const scene = altar ?? PREVIEW;
  const people = peopleOnAltar(scene).filter((p) => p.name);
  const guide = scene.alebrije ?? INTERVIEW_ALEBRIJE;
  const guideState = !chat.busy ? "idle" : chat.streaming?.text ? "speaking" : "thinking";

  useEffect(() => {
    if (status === "ready" && !altar && !started.current) {
      started.current = true;
      void startInterview(false);
    }
  }, [status, altar]);

  useEffect(() => {
    if (altar && ELEMENT_KEYS.some((key) => !altar.elements.includes(key))) {
      void updateAltar((a) => ({ ...a, elements: [...ELEMENT_KEYS] }));
    }
  }, [altar]);

  function focusConversation() {
    chatArea.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    chatArea.current?.querySelector("textarea")?.focus();
  }

  const selectedPerson = selection?.kind === "photo" ? people.find((p) => p.id === selection.personId) : undefined;
  const detailAltar = selectedPerson ? { ...scene, lovedOne: selectedPerson } : scene;

  return <div className="ofrenda-home">
    <main className="ofrenda-layout">
      <section className="ofrenda-room" aria-label="Ofrenda">
        <ImmersiveAltar altar={scene} selected={selection} onSelect={setSelection} onAddPerson={focusConversation} />
      </section>
      <aside className="ofrenda-conversation" ref={chatArea} aria-label="Build your altar with Alebrije">
        <div className="conversation-invitation">
          {altar?.lovedOne.name ? <button className="add-person-link" disabled={chat.busy} onClick={async () => { await addPersonToAltar(); focusConversation(); }}>＋ Welcome another person</button> : <button className="btn btn-primary" disabled={!altar} onClick={focusConversation}>＋ Add someone to the altar</button>}
        </div>
        <div className="home-chat">
          <button type="button" className="tradition-link ofrenda-tradition" onClick={() => setSelection({ kind: "about" })} aria-haspopup="dialog">The tradition <span aria-hidden="true">↗</span></button>
          {altar ? <ChatPanel altar={{ ...altar, alebrije: guide, messages: personConversation(altar.messages) }} chat={chat} subtitle={altar.lovedOne.name ? `Remembering ${altar.lovedOne.name}` : "Your guide to the ofrenda"} /> : <p className="chat-loading" role="status">Making a little room for your memories…</p>}
        </div>
        {/* Alebrije stands below the conversation, as if the words rise from it. */}
        <div className="guide-stage" data-state={guideState} aria-hidden="true">
          <Image src="/character/character-cutout.webp" alt="" width={1087} height={1381} sizes="(max-width: 780px) 300px, 420px" priority />
        </div>
      </aside>
    </main>
    <dialog ref={dialog} className="offering-detail-dialog" aria-label={selection?.kind === "about" ? "The tradition" : "About this offering"} onCancel={() => setSelection(null)} onClick={(e) => { if (e.target === e.currentTarget) setSelection(null); }}>
      {selection && <>
        <button autoFocus className="detail-dismiss" onClick={() => setSelection(null)} aria-label="Close">×</button>
        {selection.kind === "element" ? <div className="element-explanation">
          <ElementArt element={selection.key} size={100} />
          <p className="eyebrow">ON YOUR OFRENDA</p>
          <h2>{ELEMENTS[selection.key].name}</h2>
          <p className="element-gloss">{ELEMENTS[selection.key].gloss}</p>
          <p>{ELEMENTS[selection.key].meaning}</p>
        </div> : <DetailPanel bare altar={detailAltar} selection={selection} onClose={() => setSelection(null)} />}
      </>}
    </dialog>
  </div>;
}
