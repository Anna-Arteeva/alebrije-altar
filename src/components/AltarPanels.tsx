"use client";

import { useState, type FormEvent } from "react";
import type { Selection } from "@/components/AltarScene";
import { ElementArt } from "@/components/ElementArt";
import {
  ABOUT_ALEBRIJES,
  DIA_DE_MUERTOS,
  ELEMENTS,
  OBJECTS_MEANING,
  PHOTO_MEANING,
} from "@/content/ofrenda";
import {
  addMemory,
  addObject,
  illustrateMemory,
  removeMemory,
  removeObject,
  repaintObject,
  setMemory,
  toggleElement,
} from "@/lib/altar-actions";
import { useServices } from "@/lib/services";
import { storeBlob, useBlobUrl } from "@/lib/store/altar-store";
import { ELEMENT_KEYS, type AltarState, type Memory } from "@/lib/types";

// Inline panels under the altar: what a selected thing means, adding by hand,
// and the tray of traditional elements.

export function DetailPanel({
  altar,
  selection,
  onClose,
  bare = false,
}: {
  altar: AltarState;
  selection: Selection;
  onClose: () => void;
  /** Skip the panel frame when this already sits inside a dialog. */
  bare?: boolean;
}) {
  const body = <Detail altar={altar} selection={selection} onClose={onClose} />;
  if (bare) return body;
  return (
    <section
      aria-live="polite"
      className="surface-panel rise relative p-5 sm:p-6"
    >
      <button
        type="button"
        onClick={onClose}
        className="btn btn-ghost btn-sm absolute right-2 top-2"
        aria-label="Close"
      >
        <svg viewBox="0 0 20 20" className="size-4" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M5 5 L15 15 M15 5 L5 15" />
        </svg>
      </button>
      {body}
    </section>
  );
}

function Detail({ altar, selection, onClose }: { altar: AltarState; selection: Selection; onClose: () => void }) {
  switch (selection.kind) {
    case "photo":
      return (
        <>
          <Eyebrow>At the center</Eyebrow>
          <h2 className="font-display text-2xl">{altar.lovedOne.name}</h2>
          <p className="mt-2 max-w-prose">{PHOTO_MEANING}</p>
          <p className="hint mt-2 max-w-prose">
            {altar.lovedOne.photoId
              ? "Your photo stays exactly as you added it. It is never edited, and never sent to the AI."
              : "Without a photo, their name holds the center."}
          </p>
        </>
      );

    case "element": {
      const info = ELEMENTS[selection.key];
      const placed = altar.elements.includes(selection.key);
      return (
        <div className="flex gap-4">
          <div className="shrink-0">
            <ElementArt element={selection.key} size={72} />
          </div>
          <div>
            <Eyebrow>Ofrenda element{info.natural ? ` · ${info.natural}` : ""}</Eyebrow>
            <h2 className="font-display text-2xl">
              {info.name} <span className="font-sans text-base text-ink-soft">({info.gloss})</span>
            </h2>
            <p className="mt-2 max-w-prose">{info.meaning}</p>
            <button
              type="button"
              className={`btn btn-sm mt-4 ${placed ? "btn-secondary" : "btn-primary"}`}
              onClick={() => toggleElement(selection.key)}
            >
              {placed ? "Remove from the altar" : "Place on the altar"}
            </button>
          </div>
        </div>
      );
    }

    case "object": {
      const object = altar.objects.find((o) => o.id === selection.id);
      if (!object) return <Gone />;
      return <ObjectDetail object={object} onRemoved={onClose} />;
    }

    case "memory": {
      const memory = altar.memories.find((m) => m.id === selection.id);
      if (!memory) return <Gone />;
      return <MemoryDetail key={memory.id} memory={memory} onRemoved={onClose} />;
    }

    case "memories":
      return <AllMemories altar={altar} />;

    case "about":
      return <About />;
  }
}

function ObjectDetail({ object, onRemoved }: { object: AltarState["objects"][number]; onRemoved: () => void }) {
  const url = useBlobUrl(object.imageId) ?? object.imageSrc;
  const { ai } = useServices();
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- local blob URL
        <img src={url} alt="" className="size-36 shrink-0 object-contain" />
      )}
      <div>
        <Eyebrow>On the altar</Eyebrow>
        <h2 className="font-display text-2xl">{object.name}</h2>
        {object.description && <p className="mt-2 max-w-prose">{object.description}</p>}
        <p className="hint mt-2 max-w-prose">{OBJECTS_MEANING}</p>
        {ai === false ? (
          !url && <p className="hint mt-2">{NO_PAINTING}</p>
        ) : (
          object.imageStatus === "error" && <p className="mt-2 text-danger">The painting didn&rsquo;t come out.</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {object.imageStatus !== "pending" && ai !== false && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => repaintObject(object.id)}>
              {object.imageStatus === "error" ? "Paint again" : "Paint a new version"}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              removeObject(object.id);
              onRemoved();
            }}
          >
            Remove from the altar
          </button>
        </div>
      </div>
    </div>
  );
}

function MemoryDetail({ memory, onRemoved }: { memory: Memory; onRemoved: () => void }) {
  const photo = useBlobUrl(memory.mediaId);
  const illustration = useBlobUrl(memory.illustrationId);
  const { ai } = useServices();
  const [text, setText] = useState(memory.text);
  const changed = text.trim() !== memory.text && text.trim().length > 0;

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {(photo || illustration) && (
        // eslint-disable-next-line @next/next/no-img-element -- local blob URL
        <img src={photo ?? illustration} alt="" className="size-40 shrink-0 rounded-md object-cover" />
      )}
      {!photo && !illustration && memory.illustrationStatus === "pending" && (
        <span className="skeleton block size-40 shrink-0 rounded-md" aria-label="Painting" />
      )}
      <div className="min-w-0 flex-1">
        <Eyebrow>{memory.source === "chat" ? "A memory you shared" : "A memory you added"}</Eyebrow>
        <label htmlFor="memory-text" className="sr-only">Memory</label>
        <textarea
          id="memory-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={Math.min(8, Math.max(3, Math.ceil(text.length / 60)))}
          className="field mt-1 resize-y"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {changed && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setMemory(memory.id, { text: text.trim() })}>
              Save
            </button>
          )}
          {!photo && memory.illustrationStatus !== "pending" && (
            illustration ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setMemory(memory.id, { illustrate: false, illustrationId: undefined, illustrationStatus: "none" })}
              >
                Keep as words only
              </button>
            ) : (
              ai !== false && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => illustrateMemory(memory.id, memory.illustrationPrompt ?? memory.text)}
                >
                  {memory.illustrationStatus === "error" ? "Try painting again" : "Illustrate"}
                </button>
              )
            )
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              removeMemory(memory.id);
              onRemoved();
            }}
          >
            Remove
          </button>
        </div>
        {!photo && !illustration && (
          <p className="hint mt-2">
            {ai === false ? NO_PAINTING : "Illustrations show places, things and scenes. They never show people."}
          </p>
        )}
      </div>
    </div>
  );
}

function AllMemories({ altar }: { altar: AltarState }) {
  return (
    <>
      <Eyebrow>Memories</Eyebrow>
      <h2 className="font-display text-2xl">Remembering {altar.lovedOne.name}</h2>
      <ol className="mt-4 space-y-4">
        {altar.memories.map((m) => (
          <li key={m.id} className="max-w-prose">
            <p className="font-display text-lg leading-snug">&ldquo;{m.text}&rdquo;</p>
          </li>
        ))}
      </ol>
      <p className="hint mt-5">Tap a tag on the altar to edit, illustrate or remove a memory.</p>
    </>
  );
}

function About() {
  return (
    <div className="max-w-prose space-y-6">
      <div>
        <Eyebrow>The tradition</Eyebrow>
        <h2 className="font-display text-2xl">Día de Muertos</h2>
        <p className="mt-2">{DIA_DE_MUERTOS.summary}</p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {DIA_DE_MUERTOS.calendar.map((day) => (
            <div key={day.date} className="contents">
              <dt className="font-semibold">{day.date}</dt>
              <dd>{day.text}</dd>
            </div>
          ))}
        </dl>
        <p className="hint mt-3">{DIA_DE_MUERTOS.levels}</p>
      </div>
      <div>
        <h2 className="font-display text-2xl">{ABOUT_ALEBRIJES.title}</h2>
        {ABOUT_ALEBRIJES.body.map((p) => (
          <p key={p} className="mt-2">{p}</p>
        ))}
      </div>
    </div>
  );
}

function Gone() {
  return <p className="text-ink-soft">This is no longer on the altar.</p>;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow mb-1">{children}</p>;
}

// Shown where a painting would be when this copy has no AI service set up.
const NO_PAINTING = "Paintings need an OpenAI key, which isn't set up in this copy.";

export function AddPanel({ onDone }: { onDone: () => void }) {
  const { ai } = useServices();
  const [kind, setKind] = useState<"memory" | "object">("memory");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [why, setWhy] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (kind === "memory") {
      if (!text.trim()) return;
      const photoId = photo ? await storeBlob(photo) : undefined;
      addMemory(text.trim(), photoId);
    } else {
      if (!name.trim()) return;
      addObject(name.trim(), why.trim(), why.trim() ? `${name.trim()}: ${why.trim()}` : name.trim());
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="surface-panel rise p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-2xl">Add to the altar</h2>
        <div role="radiogroup" aria-label="What to add" className="segmented-control flex">
          {(["memory", "object"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className="segmented-option transition-colors duration-150"
            >
              {k === "memory" ? "Memory" : "Object"}
            </button>
          ))}
        </div>
      </div>

      {kind === "memory" ? (
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="add-memory" className="label">In your own words</label>
            <textarea
              id="add-memory"
              className="field resize-y"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="She hummed while she made tortillas."
              autoFocus
            />
          </div>
          <label className="btn btn-secondary btn-sm cursor-pointer">
            {photo ? `Photo: ${photo.name}` : "Attach a photo (optional)"}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="add-object" className="label">What is it?</label>
            <input
              id="add-object"
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="His straw hat"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="add-why" className="label">
              Why it belongs <span className="font-normal text-ink-soft">(optional)</span>
            </label>
            <input
              id="add-why"
              className="field"
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="He wore it to every market day."
            />
          </div>
          <p className="hint">{ai === false ? NO_PAINTING : "The alebrije will paint it for the altar."}</p>
        </div>
      )}

      <div className="mt-5 flex gap-2">
        <button type="submit" className="btn btn-primary btn-sm" disabled={kind === "memory" ? !text.trim() : !name.trim()}>
          Place it
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ElementsTray({
  altar,
  onSelect,
}: {
  altar: AltarState;
  onSelect: (selection: Selection) => void;
}) {
  return (
    <section aria-labelledby="elements-heading">
      <h2 id="elements-heading" className="font-display text-xl">Ofrenda elements</h2>
      <p className="hint mt-1 max-w-prose">
        Many altars gather water, wind, earth and fire. Tap one to learn what it means.
      </p>
      <ul className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
        {ELEMENT_KEYS.map((key) => {
          const placed = altar.elements.includes(key);
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onSelect({ kind: "element", key })}
                className="flex w-full flex-col items-center gap-1 rounded-xl p-2 transition-colors duration-150 hover:bg-paper-deep"
              >
                <span className={`relative transition-opacity duration-200 ${placed ? "" : "opacity-40 grayscale"}`}>
                  <ElementArt element={key} size={44} />
                </span>
                <span className="text-center text-xs leading-tight">{ELEMENTS[key].name}</span>
                <span className={`text-[0.6875rem] leading-none ${placed ? "text-leaf" : "text-ink-faint"}`}>
                  {placed ? "On the altar" : "Not yet"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
