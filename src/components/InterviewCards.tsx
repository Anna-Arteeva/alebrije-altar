"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ChatCards";
import { ElementArt } from "@/components/ElementArt";
import { ELEMENTS } from "@/content/ofrenda";
import { STARTER_OBJECTS } from "@/content/starter-objects";
import { removeMemory, setMemory } from "@/lib/altar-actions";
import {
  answerChoices,
  answerPhoto,
  decideObjects,
  openAltar,
  pickElements,
  pickStarterObjects,
} from "@/lib/interview-actions";
import { useBlobUrl } from "@/lib/store/altar-store";
import type { AltarState, ChatCard, ElementKey, Memory } from "@/lib/types";
import type { AgentChat } from "@/lib/use-chat";

// The interview's cards: quick answers, the photo, the painted objects, the
// memories kept in the user's words, the traditional elements and the way to
// the finished altar. Each answer goes back into the conversation as the
// user's own message.

type Props<K extends ChatCard["kind"]> = {
  card: Extract<ChatCard, { kind: K }>;
  messageId: string;
  altar: AltarState;
  chat: AgentChat;
};

export function InterviewCard(props: Props<ChatCard["kind"]>) {
  const { card } = props;
  switch (card.kind) {
    case "choices":
      return <Choices {...props} card={card} />;
    case "photo":
      return <PhotoCard {...props} card={card} />;
    case "starter-objects":
      return <StarterObjects {...props} card={card} />;
    case "objects":
      return <ObjectsCard {...props} card={card} />;
    case "memories":
      return <KeptMemories {...props} card={card} />;
    case "elements-pick":
      return <ElementsPick {...props} card={card} />;
    case "finish":
      return <Finish altar={props.altar} />;
    default:
      return null;
  }
}

// --- Quick answers ----------------------------------------------------------

function Choices({ card, messageId, altar, chat }: Props<"choices">) {
  const [picked, setPicked] = useState<string[]>([]);
  const visible = altar.messages.filter((m) => m.role !== "note");
  // Only the newest question takes tapped answers.
  if (card.answered || visible.at(-1)?.id !== messageId) return null;

  function answer(text: string) {
    answerChoices(messageId, card);
    chat.send(text);
  }

  return (
    <div className="rise mt-3" role="group" aria-label="Quick answers">
      <div className="flex flex-wrap gap-2">
        {card.options.map((option) =>
          card.mode === "multi" ? (
            <button
              key={option}
              type="button"
              aria-pressed={picked.includes(option)}
              disabled={chat.busy}
              onClick={() => setPicked((p) => (p.includes(option) ? p.filter((o) => o !== option) : [...p, option]))}
              className="choice-chip"
            >
              {option}
            </button>
          ) : (
            <button key={option} type="button" disabled={chat.busy} onClick={() => answer(option)} className="choice-chip">
              {option}
            </button>
          ),
        )}
        {card.mode === "multi" && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={chat.busy || picked.length === 0}
            onClick={() => answer(picked.join(", "))}
          >
            Send
          </button>
        )}
      </div>
      {card.allowFreeText && <p className="hint mt-2 text-xs">Or write your own answer below.</p>}
    </div>
  );
}

// --- Photo ------------------------------------------------------------------

function PhotoCard({ card, messageId, altar, chat }: Props<"photo">) {
  const photo = useBlobUrl(altar.lovedOne.photoId);
  const name = altar.lovedOne.name || "them";

  async function answer(file: File | null) {
    chat.send(await answerPhoto(messageId, card, file));
  }

  if (card.state !== "proposed") {
    return (
      <Card tone="quiet">
        {card.state === "accepted" && photo ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL; never altered */}
            <img src={photo} alt={`Photo of ${name}`} className="h-16 w-14 rounded-md object-cover" />
            <p className="text-sm text-ink-soft">At the center of the altar, exactly as it is.</p>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">No photo for now. Their name holds the center.</p>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="photo-slot grid h-20 w-16 shrink-0 place-items-center text-ink-faint" aria-hidden>
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="12" cy="12" r="3.5" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="font-semibold">A photo of {name}</p>
          <p className="mt-1 text-sm text-ink-soft">
            It is stored privately, exactly as it is. Alebrije never sees it.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className={`btn btn-primary btn-sm cursor-pointer ${chat.busy ? "pointer-events-none opacity-50" : ""}`}>
              Choose a photo
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={chat.busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void answer(file);
                }}
              />
            </label>
            <button type="button" className="btn btn-secondary btn-sm" disabled={chat.busy} onClick={() => void answer(null)}>
              Not now
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// --- Things they loved ------------------------------------------------------

function StarterObjects({ card, messageId, chat }: Props<"starter-objects">) {
  const [keys, setKeys] = useState<string[]>(card.preselect);
  const [own, setOwn] = useState("");

  if (card.picked) {
    const picked = STARTER_OBJECTS.filter((o) => card.picked!.includes(o.key));
    if (picked.length === 0) return null;
    return (
      <Card tone="quiet">
        <div className="flex flex-wrap items-center gap-2">
          {picked.map((o) => (
            <Image key={o.key} src={o.src} alt={o.label} width={40} height={40} className="size-10 object-contain" />
          ))}
          <p className="text-sm text-ink-soft">On the altar.</p>
        </div>
      </Card>
    );
  }

  const toggle = (key: string) => setKeys((k) => (k.includes(key) ? k.filter((x) => x !== key) : [...k, key]));
  const submit = () => chat.send(pickStarterObjects(messageId, card, keys, own));
  const action = keys.length ? `Place ${keys.length === 1 ? "it" : `these ${keys.length}`} on the altar` : own.trim() ? "Continue" : "None of these";

  return (
    <Card>
      <fieldset>
        <legend className="font-semibold">Pick anything that feels like them</legend>
        <ul className="object-grid mt-3">
          {STARTER_OBJECTS.map((o) => {
            const on = keys.includes(o.key);
            return (
              <li key={o.key}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(o.key)}
                  className="object-tile"
                  aria-label={`${o.label}, ${o.hint}`}
                  title={o.hint}
                >
                  <Image src={o.src} alt="" width={72} height={72} className="size-14 object-contain sm:size-16" />
                  <span className="text-xs leading-tight">{o.label}</span>
                  {on && (
                    <svg viewBox="0 0 16 16" className="object-tile-check" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                      <path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <label htmlFor={`own-${card.callId}`} className="label mt-4">
        Something else? <span className="font-normal text-ink-soft">In your own words</span>
      </label>
      <input
        id={`own-${card.callId}`}
        className="field"
        value={own}
        onChange={(e) => setOwn(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !chat.busy) submit();
        }}
        placeholder="her blue thermos, his chess set"
        autoComplete="off"
        maxLength={400}
      />
      <button type="button" className="btn btn-primary btn-sm mt-3" disabled={chat.busy} onClick={submit}>
        {action}
      </button>
    </Card>
  );
}

function ObjectsCard({ card, messageId, chat }: Props<"objects">) {
  if (card.state !== "proposed") {
    return (
      <Card tone="quiet">
        <p className="text-sm text-ink-soft">
          {card.state === "accepted" ? "Painting them for the altar." : "Not now."}
        </p>
      </Card>
    );
  }
  return (
    <Card>
      <p className="font-semibold">Place {card.objects.length === 1 ? "this" : "these"} on the altar?</p>
      <ul className="mt-2 space-y-1.5">
        {card.objects.map((o) => (
          <li key={o.name} className="text-sm">
            <span className="font-semibold">{o.name}</span>
            {o.description && o.description.toLowerCase() !== o.name.toLowerCase() && (
              <span className="text-ink-soft"> · {o.description}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="hint mt-2 text-xs">Each one is painted to match the altar.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" disabled={chat.busy} onClick={() => decideObjects(messageId, card, true)}>
          Place and paint {card.objects.length === 1 ? "it" : "them"}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={chat.busy} onClick={() => decideObjects(messageId, card, false)}>
          Not now
        </button>
      </div>
    </Card>
  );
}

// --- Memories -----------------------------------------------------------------

function KeptMemories({ card, altar }: Props<"memories">) {
  const memories = card.memoryIds
    .map((id) => altar.memories.find((m) => m.id === id))
    .filter((m): m is Memory => !!m);
  if (memories.length === 0) return null;

  return (
    <Card tone="quiet">
      <p className="eyebrow text-ink-soft">
        {memories.length === 1 ? "Kept in your words" : `${memories.length} memories, kept in your words`}
      </p>
      <ul className="mt-2 divide-y divide-paper-edge">
        {memories.map((m) => (
          <KeptMemory key={m.id} memory={m} />
        ))}
      </ul>
    </Card>
  );
}

function KeptMemory({ memory }: { memory: Memory }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(memory.text);

  if (editing) {
    return (
      <li className="py-2">
        <label htmlFor={`edit-${memory.id}`} className="sr-only">Memory</label>
        <textarea
          id={`edit-${memory.id}`}
          className="field min-h-20 text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!text.trim()}
            onClick={() => {
              setMemory(memory.id, { text: text.trim() });
              setEditing(false);
            }}
          >
            Save
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setText(memory.text);
              setEditing(false);
            }}
          >
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-1 py-2">
      <p className="mr-auto text-sm">&ldquo;{memory.text}&rdquo;</p>
      <button type="button" className="btn btn-ghost size-9 shrink-0 p-0" onClick={() => setEditing(true)} aria-label="Edit this memory">
        <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
          <path d="M4 16 L4.6 12.8 L13 4.4 L15.6 7 L7.2 15.4 Z M11.4 6 L14 8.6" />
        </svg>
      </button>
      <button type="button" className="btn btn-ghost size-9 shrink-0 p-0" onClick={() => removeMemory(memory.id)} aria-label="Remove this memory">
        <svg viewBox="0 0 20 20" className="size-4" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M5.5 5.5 L14.5 14.5 M14.5 5.5 L5.5 14.5" />
        </svg>
      </button>
    </li>
  );
}

// --- Traditional elements -------------------------------------------------------

function ElementsPick({ card, messageId, chat }: Props<"elements-pick">) {
  const [keys, setKeys] = useState<ElementKey[]>([]);

  if (card.picked) {
    if (card.picked.length === 0) return null;
    return (
      <Card tone="quiet">
        <div className="flex flex-wrap items-center gap-1">
          {card.picked.map((k) => (
            <ElementArt key={k} element={k} size={36} />
          ))}
          <p className="ml-1 text-sm text-ink-soft">On the altar.</p>
        </div>
      </Card>
    );
  }

  const toggle = (key: ElementKey) => setKeys((k) => (k.includes(key) ? k.filter((x) => x !== key) : [...k, key]));

  return (
    <Card>
      <fieldset>
        <legend className="font-semibold">Which would you like to place?</legend>
        <ul className="mt-2 space-y-1">
          {card.elements.map((key) => {
            const info = ELEMENTS[key];
            const on = keys.includes(key);
            return (
              <li key={key}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={`${info.name}, ${info.gloss}. ${info.meaning}`}
                  onClick={() => toggle(key)}
                  className="element-row"
                >
                  <ElementArt element={key} size={44} />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block font-semibold leading-tight">
                      {info.name} <span className="font-normal text-ink-soft">({info.gloss})</span>
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-soft">{info.meaning}</span>
                  </span>
                  <span className="element-row-box" aria-hidden>
                    {on && (
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4">
                        <path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" />
                      </svg>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={chat.busy || keys.length === 0}
          onClick={() => chat.send(pickElements(messageId, card, keys))}
        >
          Place on the altar
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={chat.busy} onClick={() => chat.send(pickElements(messageId, card, []))}>
          Skip
        </button>
      </div>
    </Card>
  );
}

// --- The way to the altar ---------------------------------------------------

function Finish({ altar }: { altar: AltarState }) {
  const router = useRouter();
  return (
    <div className="finish-card rise mt-3 flex items-center gap-4 px-4 py-4">
      <ElementArt element="candles" size={56} />
      <div>
        <p className="font-display text-xl leading-tight">
          {altar.lovedOne.name ? `${altar.lovedOne.name}’s ofrenda is ready` : "Your ofrenda is ready"}
        </p>
        {altar.stage === "interview" && (
          <button
            type="button"
            className="btn btn-primary mt-3"
            onClick={async () => {
              await openAltar();
              router.push("/altar");
            }}
          >
            See the altar
          </button>
        )}
      </div>
    </div>
  );
}
