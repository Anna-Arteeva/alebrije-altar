"use client";

import Image from "next/image";
import { ElementArt } from "@/components/ElementArt";
import { ELEMENTS } from "@/content/ofrenda";
import { peopleOnAltar } from "@/lib/people";
import { useBlobUrl } from "@/lib/store/altar-store";
import { ELEMENT_KEYS, type AltarObject, type AltarState, type ElementKey, type LovedOne, type Memory } from "@/lib/types";

export type Selection =
  | { kind: "photo"; personId?: string }
  | { kind: "element"; key: ElementKey }
  | { kind: "object"; id: string }
  | { kind: "memory"; id: string }
  | { kind: "memories" }
  | { kind: "about" };

type SceneProps = { altar: AltarState; selected: Selection | null; onSelect: (selection: Selection) => void; onAddPerson?: () => void };

export function AltarScene({ altar, selected, onSelect, onAddPerson }: SceneProps) {
  const people = peopleOnAltar(altar).filter((p) => p.name);
  const isSelected = (s: Selection) => JSON.stringify(s) === JSON.stringify(selected);
  // Each row is another physical tier. More portraits and offerings add rows,
  // rather than shrinking the objects or putting them outside the altar.
  const portraitRows = Array.from({ length: Math.max(1, Math.ceil(people.length / 2)) }, (_, i) => people.slice(i * 2, i * 2 + 2));
  const objectRows = Array.from({ length: Math.ceil(altar.objects.length / 5) }, (_, i) => altar.objects.slice(i * 5, i * 5 + 5));
  return (<>
    <div className="ofrenda-scene">
      <Image
        className="altar-plate"
        src="/altar/altar-cutout-v2.webp"
        width={864}
        height={1120}
        sizes="(max-width: 780px) 100vw, min(760px, 65vw)"
        alt=""
        preload
      />
      {/* Separate alpha layers leave portraits and offerings interactive. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="altar-botanical botanical-left" src="/altar/marigold-arrangement.png" alt="" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="altar-botanical botanical-right" src="/altar/marigold-arrangement.png" alt="" />
      <div className="ofrenda-tiers">
        {portraitRows.map((row, index) => (
          <Tier
            key={`portraits-${index}`}
            width={row.length > 1 || index ? "79%" : "57%"}
            shift={index % 2 ? "7%" : "-4%"}
            lean={index % 2 ? "0.35deg" : "-0.25deg"}
            arrangement={index % 2 ? "end" : "start"}
          >
            <ElementButton element="candles" onSelect={onSelect} />
            {row.length ? row.map((person) => <Portrait key={person.id} person={person} onSelect={onSelect} />) : (
              <button className="portrait-invitation" onClick={onAddPerson} aria-label="Add a person to your altar">
                <span className="portrait-flower" aria-hidden="true">✺</span>
                <span>A place for<br />someone you love</span>
                <span className="portrait-plus" aria-hidden="true">＋</span>
              </button>
            )}
            <ElementButton element="candles" onSelect={onSelect} />
          </Tier>
        ))}
        {objectRows.map((row, index) => <Tier key={`objects-${index}`} width="82%" shift={index % 2 ? "-5%" : "4%"} arrangement={index % 2 ? "start" : "end"}>
          {row.map((object) => <ObjectCutout key={object.id} object={object} selected={isSelected({ kind: "object", id: object.id })} onSelect={onSelect} />)}
        </Tier>)}
        <Tier width="89%" shift="-3%" arrangement="start">
          {(["water", "pan_de_muerto", "salt", "calaveritas"] as ElementKey[]).map((key) => <ElementButton key={key} element={key} onSelect={onSelect} />)}
        </Tier>
        <Tier width="100%" shift="2%" lean="0.18deg" arrangement="end">
          <ElementButton element="cempasuchil" onSelect={onSelect} />
          <ElementButton element="copal" onSelect={onSelect} />
          <ElementButton element="candles" onSelect={onSelect} />
        </Tier>
      </div>
      <div className="altar-petal-floor" aria-hidden="true"><PetalPath /></div>
      <div className="altar-foreground" aria-hidden="true">
        <span className="ground-candle ground-candle-one" />
        <span className="ground-candle ground-candle-two" />
        <span className="ground-candle ground-candle-three" />
        <span className="petal-scatter petal-scatter-left" />
        <span className="petal-scatter petal-scatter-right" />
      </div>
      <p className="altar-explore">Hover or tap an offering to discover its meaning</p>
      <span className="sr-only">{ELEMENT_KEYS.length} traditional offerings are already on your altar.</span>
    </div>
    {/* Memories hang below the altar plate, at the foot of the room. */}
    {altar.memories.length > 0 && <div className="ofrenda-memory-tier"><MemoryGarland altar={altar} isSelected={isSelected} onSelect={onSelect} /></div>}
  </>);
}

function Tier({
  width,
  shift = "0%",
  lean = "0deg",
  arrangement = "center",
  children,
}: {
  width: string;
  shift?: string;
  lean?: string;
  arrangement?: "start" | "center" | "end";
  children: React.ReactNode;
}) {
  return <div
    className={`linen-tier linen-tier-${arrangement}`}
    style={{ "--tier-width": width, "--tier-shift": shift, "--tier-lean": lean } as React.CSSProperties}
  >
    <div className="linen-offerings">{children}</div>
    <div className="linen-cloth" aria-hidden="true" />
  </div>;
}

export function Portrait({ person, onSelect }: { person: LovedOne; onSelect: SceneProps["onSelect"] }) {
  const url = useBlobUrl(person.photoId);
  return <button type="button" className="ofrenda-portrait" onClick={() => onSelect({ kind: "photo", personId: person.id })} aria-label={`Remembering ${person.name}`}>
    {url ? (
      // eslint-disable-next-line @next/next/no-img-element -- original private photo
      <img src={url} alt={person.name} />
    ) : <span className="portrait-initial">{person.name.charAt(0)}</span>}
    <span className="portrait-name">{person.name}</span>
  </button>;
}

function ElementButton({ element, onSelect }: { element: ElementKey; onSelect: SceneProps["onSelect"] }) {
  const info = ELEMENTS[element];
  return <button type="button" className="offering-hotspot" onClick={() => onSelect({ kind: "element", key: element })} aria-label={`${info.name}: ${info.meaning}`}>
    <ElementArt element={element} size={100} />
    <span className="offering-tooltip" role="tooltip"><strong>{info.name}</strong><span>{info.gloss}</span>{info.meaning}</span>
  </button>;
}

export function ObjectCutout({
  object,
  selected,
  onSelect,
}: {
  object: AltarObject;
  selected: boolean;
  onSelect: (selection: Selection) => void;
}) {
  const url = useBlobUrl(object.imageId) ?? object.imageSrc;
  return (
    <button
      type="button"
      onClick={() => onSelect({ kind: "object", id: object.id })}
      aria-label={object.name}
      className={`offering-object rise relative flex w-24 flex-col items-center rounded-xl p-1 transition-colors duration-200 hover:bg-paper-deep sm:w-28 ${selected ? "bg-marigold-tint" : ""}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob URL
        <img src={url} alt="" className="size-20 object-contain drop-shadow-sm sm:size-24" />
      ) : object.imageStatus === "pending" ? (
        <span className="skeleton block size-20 rounded-full sm:size-24" aria-label="Painting" />
      ) : (
        <span className="grid size-20 place-items-center rounded-full bg-paper-raised font-display text-2xl text-marigold-deep sm:size-24">
          {object.name.charAt(0)}
        </span>
      )}
      <span className="offering-tooltip" role="tooltip"><strong>{object.name}</strong>{object.description}</span>
    </button>
  );
}

// Tags hang at slightly different lengths and angles, like ones tied by hand.
// The pattern comes from the memory's place in line, so it never jumps.
const TILTS = [-3, 2, -1.5, 3.5, -2.5, 1];
const DROPS = [14, 26, 18, 32, 10, 22];

export function MemoryGarland({
  altar,
  isSelected,
  onSelect,
}: {
  altar: AltarState;
  isSelected: (s: Selection) => boolean;
  onSelect: (selection: Selection) => void;
}) {
  return (
    <div className="pb-2">
      <div className="memory-line" role="list" aria-label="Memories on this altar">
        <div className="memory-line-track">
          {altar.memories.map((memory, i) => (
            <div key={memory.id} role="listitem" className="memory-hang" style={{ "--drop": `${DROPS[i % DROPS.length]}px` } as React.CSSProperties}>
              <MemoryTag
                memory={memory}
                personName={peopleOnAltar(altar).find((p) => p.id === memory.lovedOneId)?.name}
                tilt={TILTS[i % TILTS.length]}
                selected={isSelected({ kind: "memory", id: memory.id })}
                onSelect={onSelect}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-center">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSelect({ kind: "memories" })}>
          Read all {altar.memories.length} {altar.memories.length === 1 ? "memory" : "memories"}
        </button>
      </div>
    </div>
  );
}

function MemoryTag({
  memory,
  personName,
  tilt,
  selected,
  onSelect,
}: {
  memory: Memory;
  personName?: string;
  tilt: number;
  selected: boolean;
  onSelect: (selection: Selection) => void;
}) {
  const photo = useBlobUrl(memory.mediaId);
  const illustration = useBlobUrl(memory.illustrationId);
  const image = photo ?? illustration;

  return (
    <button
      type="button"
      onClick={() => onSelect({ kind: "memory", id: memory.id })}
      aria-pressed={selected}
      className="memory-tag rise"
      style={{ "--tilt": `${tilt}deg` } as React.CSSProperties}
    >
      {image && (
        // eslint-disable-next-line @next/next/no-img-element -- local blob URL
        <img src={image} alt="" className="mb-2 aspect-square w-full rounded-[2px] object-cover" />
      )}
      {!image && memory.illustrationStatus === "pending" && (
        <span className="skeleton mb-2 block aspect-square w-full rounded-[2px]" aria-label="Painting" />
      )}
      {personName && <span className="memory-person-name">{personName}</span>}
      <span className={`memory-tag-text ${image ? "line-clamp-2" : "line-clamp-5"}`}>{memory.text}</span>
    </button>
  );
}

function PetalPath() {
  return (
    <svg viewBox="0 0 160 40" className="h-10 w-40" aria-hidden>
      {Array.from({ length: 22 }, (_, i) => {
        const x = 8 + i * 7;
        const y = 20 + Math.sin(i * 1.7) * 9;
        return <ellipse key={i} cx={x} cy={y} rx="3.2" ry="2" fill={i % 3 ? "var(--marigold)" : "var(--marigold-deep)"} transform={`rotate(${i * 37} ${x} ${y})`} />;
      })}
    </svg>
  );
}
