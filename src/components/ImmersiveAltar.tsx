"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AltarScene, ObjectCutout, Portrait, type Selection } from "@/components/AltarScene";
import { ELEMENTS } from "@/content/ofrenda";
import { ELEMENT_KEYS, type AltarState, type Memory } from "@/lib/types";
import { peopleOnAltar } from "@/lib/people";
import { useBlobUrl } from "@/lib/store/altar-store";
import { preload } from "react-dom";
import { objectAnchor, OFFERING_ANCHORS, portraitSlot, SCULPTED_ALTAR_URL } from "@/lib/altar3d/layout";
import "./immersive-altar.css";
import type { AltarSceneController, SpatialItem } from "@/lib/altar3d/scene";

type Props = { altar: AltarState; selected: Selection | null; onSelect: (s: Selection) => void; onAddPerson: () => void };

export function ImmersiveAltar({ altar, selected, onSelect, onAddPerson }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<AltarSceneController | null>(null);
  const spatial = useRef(new Map<string, SpatialItem>());
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const instructionsId = useId();
  const people = peopleOnAltar(altar).filter((p) => p.name);
  const isSelected = (s: Selection) => JSON.stringify(s) === JSON.stringify(selected);
  // Start the sculpt download now rather than after three.js loads and the room is built.
  preload(SCULPTED_ALTAR_URL, { as: "fetch", crossOrigin: "anonymous" });

  useEffect(() => {
    let active = true;
    import("@/lib/altar3d/scene").then(({ createAltarScene }) => {
      if (!active || !host.current) return;
      try {
        controller.current = createAltarScene(host.current, () => { if (active) setStatus("ready"); }, () => { if (active) setStatus("error"); });
        controller.current.setItems([...spatial.current.values()]);
      } catch (error) {
        console.error("The 3D ofrenda could not start", error);
        if (active) setStatus("error");
      }
    }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; controller.current?.dispose(); controller.current = null; };
  }, []);

  function register(element: HTMLDivElement | null, id: string, placement: Omit<SpatialItem, "element">) {
      if (element) spatial.current.set(id, { element, ...placement });
      else spatial.current.delete(id);
      controller.current?.setItems([...spatial.current.values()]);
  }

  function registerPortrait(element: HTMLDivElement | null, id: string, index: number) {
    register(element, id, portraitSlot(index, people.length));
  }

  return <>
    <div className="immersive-stage" data-scene-status={status} ref={host}
      role="group" aria-label="Interactive 3D ofrenda" tabIndex={status === "ready" ? 0 : -1}
      aria-describedby={status === "ready" ? instructionsId : undefined}
      aria-keyshortcuts={status === "ready" ? "ArrowLeft ArrowRight Home" : undefined}
      onKeyDown={(event) => {
        if (status !== "ready" || event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault(); controller.current?.rotateBy(event.key === "ArrowLeft" ? -3 : 3);
        } else if (event.key === "Home") {
          event.preventDefault(); controller.current?.resetView();
        }
      }}>
      {status === "error" ? <div className="immersive-fallback"><AltarScene altar={altar} selected={selected} onSelect={onSelect} onAddPerson={onAddPerson} /></div> : <>
        <div className="spatial-offerings" aria-label="Your ofrenda">
          {people.length ? people.map((person, i) => <div key={person.id} className="spatial-item spatial-portrait" ref={(node) => registerPortrait(node, `person-${person.id}`, i)}>
            <Portrait person={person} onSelect={onSelect} />
          </div>) : <div className="spatial-item spatial-portrait" ref={(node) => registerPortrait(node, "invitation", 0)}>
            <button className="portrait-invitation" onClick={onAddPerson} aria-label="Add a person to your altar">
              <span className="portrait-flower" aria-hidden="true">✺</span><span>A place for<br />someone you love</span><span className="portrait-plus" aria-hidden="true">＋</span>
            </button>
          </div>}
          {altar.objects.map((object, i) => <div key={object.id} className="spatial-item spatial-keepsake" ref={(node) => register(node, `object-${object.id}`, { point: objectAnchor(i), width: .6 })}>
            <ObjectCutout object={object} selected={isSelected({ kind: "object", id: object.id })} onSelect={onSelect} />
          </div>)}
          {ELEMENT_KEYS.map((key) => <div key={key} className="spatial-item spatial-hotspot" ref={(node) => register(node, key, { point: OFFERING_ANCHORS[key] ?? [0, 1.6, 0], width: .52 })}>
            <button className="sculpted-offering" onClick={() => onSelect({ kind: "element", key })} aria-label={`Explore ${ELEMENTS[key].name}`}>
              <span className="offering-indicator" aria-hidden="true">＋</span>
              <span className="sculpted-label">{ELEMENTS[key].name}</span>
            </button>
          </div>)}
        </div>
        <div className="scene-vignette" aria-hidden="true" />
        <div className="scene-motes" aria-hidden="true">{Array.from({length: 12}, (_, i) => <i key={i} style={{ "--mote-i": i } as React.CSSProperties} />)}</div>
        <p className="scene-invitation"><span aria-hidden="true">✧</span> A little light. A living memory.
          {status === "ready" && <span id={instructionsId} className="sr-only">Drag left or right to turn the altar. When the altar is focused, use the Left and Right arrow keys to turn, or Home to reset the view. Select an offering to explore it.</span>}
        </p>
        {status === "loading" && <span className="scene-loading" role="status">Lighting the candles…</span>}
      </>}
    </div>
    {status !== "error" && altar.memories.length > 0 && <MemoryBookmarks altar={altar} isSelected={isSelected} onSelect={onSelect} />}
  </>;
}

// Bookmarks all lean left, each at a slightly different height and angle, like ones slipped into a book by hand.
// The pattern comes from the memory's place in line, so it never jumps.
const SINKS = [0, 10, 4, 14, 2, 8];
const TILTS = [-14, -11, -17, -13, -16, -12];

function MemoryBookmarks({ altar, isSelected, onSelect }: { altar: AltarState; isSelected: (s: Selection) => boolean; onSelect: (s: Selection) => void }) {
  const people = peopleOnAltar(altar).filter((p) => p.name);
  // With one person on the altar, every memory is theirs; the name would only repeat.
  const nameFor = (id: string) => people.length > 1 ? people.find((p) => p.id === id)?.name : undefined;
  const lean = (i: number) => ({ "--sink": `${SINKS[i % SINKS.length]}px`, "--tilt": `${TILTS[i % TILTS.length]}deg` }) as React.CSSProperties;
  return <ul className="memory-bookmarks" aria-label="Memories on this altar">
    {altar.memories.map((memory, i) => <li key={memory.id} style={lean(i)}>
      <MemoryBookmark memory={memory} personName={nameFor(memory.lovedOneId)} selected={isSelected({ kind: "memory", id: memory.id })} onSelect={onSelect} />
    </li>)}
    <li style={lean(altar.memories.length)}>
      <button type="button" className="memory-bookmark memory-bookmark-all" onClick={() => onSelect({ kind: "memories" })}>
        <span className="bookmark-name"><span aria-hidden="true">✧ </span>Read all</span>
        <span className="bookmark-text">{altar.memories.length} {altar.memories.length === 1 ? "memory" : "memories"}</span>
      </button>
    </li>
  </ul>;
}

function MemoryBookmark({ memory, personName, selected, onSelect }: { memory: Memory; personName?: string; selected: boolean; onSelect: (s: Selection) => void }) {
  const photo = useBlobUrl(memory.mediaId);
  const illustration = useBlobUrl(memory.illustrationId);
  const image = photo ?? illustration;
  return <button type="button" className="memory-bookmark" aria-pressed={selected} onClick={() => onSelect({ kind: "memory", id: memory.id })}>
    {personName && <span className="bookmark-name">{personName}</span>}
    <span className="bookmark-text">{memory.text}</span>
    {image && (
      // eslint-disable-next-line @next/next/no-img-element -- local blob URL
      <img src={image} alt="" className="bookmark-image" />
    )}
  </button>;
}
