"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AlebrijeAvatar } from "@/components/AlebrijeAvatar";
import { ExistingAltar } from "@/components/ExistingAltar";
import { PapelPicado } from "@/components/PapelPicado";
import { AiUnavailableError, birthAlebrije, paintImage, type AlebrijeBirth } from "@/lib/api";
import { useServices } from "@/lib/services";
import { deleteEverything, setAltar, storeBlob, updateAltar, useAltar } from "@/lib/store/altar-store";
import { uid } from "@/lib/store/db";
import type { AltarState } from "@/lib/types";

type Step = "who" | "guide" | "birth";
type BirthStatus = "naming" | "name-error" | "painting" | "paint-error" | "done";

export function Onboarding() {
  const router = useRouter();
  const { status, altar } = useAltar();
  const { ai } = useServices();
  const [replacing, setReplacing] = useState(false);
  const [step, setStep] = useState<Step>("who");

  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [isChild, setIsChild] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string>();

  const [animal, setAnimal] = useState("");
  const [color, setColor] = useState("");
  const [place, setPlace] = useState("");

  const [birthStatus, setBirthStatus] = useState<BirthStatus>("naming");
  const [birth, setBirth] = useState<AlebrijeBirth>();
  const [error, setError] = useState<string>();

  const trimmedName = name.trim();

  function choosePhoto(file: File | null) {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhoto(file);
    setPhotoUrl(file ? URL.createObjectURL(file) : undefined);
  }

  async function paint(subject: string) {
    setBirthStatus("painting");
    try {
      const imageId = await paintImage("alebrije", subject);
      await updateAltar((a) => (a.alebrije ? { ...a, alebrije: { ...a.alebrije, imageId } } : a));
      setBirthStatus("done");
    } catch (e) {
      setError((e as Error).message);
      setBirthStatus("paint-error");
    }
  }

  async function bringToLife(event?: FormEvent) {
    event?.preventDefault();
    setStep("birth");
    setBirthStatus("naming");
    setError(undefined);
    try {
      const answers = { animal, color, place, lovedOneName: trimmedName, isChild };
      const born =
        ai === false
          ? plainAlebrije(answers)
          : await birthAlebrije(answers).catch((e) => {
              if (e instanceof AiUnavailableError) return plainAlebrije(answers);
              throw e;
            });
      if (replacing) await deleteEverything();
      const photoId = photo ? await storeBlob(photo) : undefined;
      const now = Date.now();
      const state: AltarState = {
        version: 1,
        id: crypto.randomUUID(),
        createdAt: now,
        mood: "festive",
        lovedOne: {
          id: uid("person"),
          name: trimmedName,
          relation: relation.trim() || undefined,
          isChild,
          photoId,
        },
        alebrije: {
          name: born.name,
          traits: { animal, color, place },
          intro: born.intro,
          personality: born.personality,
          imageSubject: born.image_subject,
        },
        elements: [],
        memories: [],
        objects: [],
        messages: [{ id: uid("msg"), role: "assistant", text: born.intro, createdAt: now }],
      };
      await setAltar(state);
      setBirth(born);
      if (born.image_subject) void paint(born.image_subject);
      else setBirthStatus("done");
    } catch (e) {
      setError((e as Error).message);
      setBirthStatus("name-error");
    }
  }

  if (status === "loading") return <Shell />;

  if (altar && !replacing && step !== "birth") {
    return (
      <Shell>
        <ExistingAltar altar={altar} onReplace={() => setReplacing(true)} />
      </Shell>
    );
  }

  if (step === "who") {
    return (
      <Shell stepLabel="1 of 2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmedName) setStep("guide");
          }}
          className="rise"
        >
          <h1 className="font-display text-3xl sm:text-4xl">Who is this ofrenda for?</h1>
          <p className="mt-3 text-ink-soft">
            An ofrenda is a home altar that welcomes someone you love back for a visit.
          </p>

          <div className="mt-8 space-y-6">
            <div>
              <label htmlFor="name" className="label">Their name</label>
              <input
                id="name"
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Abuela Rosa"
                autoComplete="off"
                required
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="relation" className="label">
                Who they are to you <span className="font-normal text-ink-soft">(optional)</span>
              </label>
              <input
                id="relation"
                className="field"
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
                placeholder="my grandmother"
                autoComplete="off"
              />
            </div>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={isChild}
                onChange={(e) => setIsChild(e.target.checked)}
                className="mt-1 size-5 accent-[var(--rosa)]"
              />
              <span>
                They were a child
                <span className="hint block">Many families keep Nov 1 for the angelitos, the children.</span>
              </span>
            </label>
            <PhotoPicker url={photoUrl} name={trimmedName} onChange={choosePhoto} />
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
            <button type="submit" className="btn btn-primary" disabled={!trimmedName}>
              Continue
            </button>
            <Link href="/talk" className="text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
              Prefer to talk it through with Alebrije?
            </Link>
          </div>
        </form>
      </Shell>
    );
  }

  if (step === "guide") {
    const ready = animal.trim() && color.trim() && place.trim();
    return (
      <Shell stepLabel="2 of 2">
        <form onSubmit={bringToLife} className="rise">
          <h1 className="font-display text-3xl sm:text-4xl">Now, your guide</h1>
          <p className="mt-3 text-ink-soft">
            An alebrije will help you build the altar. It is born from three things that remind you of{" "}
            {trimmedName}.
          </p>
          <div className="mt-8 space-y-6">
            <GuideField
              id="animal"
              label={`An animal ${trimmedName} loved`}
              placeholder="hummingbirds, her old cat"
              value={animal}
              onChange={setAnimal}
              autoFocus
            />
            <GuideField
              id="color"
              label="A color that feels like them"
              placeholder="the turquoise of his truck"
              value={color}
              onChange={setColor}
            />
            <GuideField
              id="place"
              label="A place that feels like them"
              placeholder="her kitchen in Puebla"
              value={place}
              onChange={setPlace}
            />
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <button type="submit" className="btn btn-primary" disabled={!ready}>
              Bring my alebrije to life
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setStep("who")}>
              Back
            </button>
          </div>
        </form>
      </Shell>
    );
  }

  // step === "birth"
  if (birthStatus === "naming" || birthStatus === "name-error" || !birth) {
    return (
      <Shell>
        <div className="flex flex-col items-center text-center" aria-live="polite">
          <div className="skeleton size-56 rounded-full" />
          {birthStatus === "name-error" ? (
            <>
              <p className="mt-8 text-lg">Your alebrije didn&rsquo;t quite wake up.</p>
              <p className="hint mt-1">{error}</p>
              <div className="mt-6 flex gap-3">
                <button type="button" className="btn btn-primary" onClick={() => bringToLife()}>
                  Try again
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setStep("guide")}>
                  Change answers
                </button>
              </div>
            </>
          ) : (
            <p className="mt-8 text-lg text-ink-soft">
              Mixing {color.trim() || "colors"}, carving {animal.trim() || "wood"}, remembering{" "}
              {place.trim() || "places"}…
            </p>
          )}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col items-center text-center rise" aria-live="polite">
        <AlebrijeAvatar
          alebrije={{ name: birth.name, imageId: altar?.alebrije?.imageId }}
          size={224}
          painting={birthStatus === "painting"}
        />
        <p className="eyebrow mt-8">Meet your guide</p>
        <h1 className="mt-1 font-display text-4xl">{birth.name}</h1>
        <p className="mt-4 max-w-prose text-lg">{birth.intro}</p>
        {birthStatus === "painting" && (
          <p className="hint mt-4">Painting {birth.name}&rsquo;s portrait. You can go ahead; it will appear when ready.</p>
        )}
        {birthStatus === "paint-error" && (
          <p className="hint mt-4">
            The portrait didn&rsquo;t come out.{" "}
            <button type="button" className="underline" onClick={() => paint(birth.image_subject)}>
              Paint again
            </button>
          </p>
        )}
        <button type="button" className="btn btn-primary mt-8" onClick={() => router.push("/altar")}>
          Go to the altar
        </button>
      </div>
    </Shell>
  );
}

// A guide made from the answers alone, when this copy has no AI service set up.
// With no image subject, it keeps its patterned placeholder.
function plainAlebrije({ animal, color, lovedOneName }: { animal: string; color: string; lovedOneName: string }): AlebrijeBirth {
  const creature = animal.trim().toLowerCase();
  return {
    name: "Alebrije",
    intro: `I'm Alebrije, a ${color.trim().toLowerCase()} ${creature} carved from your answers. Let's make a place for ${lovedOneName}. What did they love?`,
    personality: "Warm, curious and gently playful, a guide for the living who loves a good story.",
    image_subject: "",
  };
}

function Shell({ children, stepLabel }: { children?: React.ReactNode; stepLabel?: string }) {
  return (
    <div className="flex flex-1 flex-col">
      <PapelPicado flags={11} className="max-h-24" />
      <main className="onboarding-frame mx-auto flex-1 px-5 pb-16 pt-8 sm:pt-12">
        <div className="mb-7 flex items-center justify-between text-sm text-ink-soft">
          <Link href="/" className="site-brand transition-colors hover:text-ink">Alebrije Altar</Link>
          {stepLabel && <span className="eyebrow">Step {stepLabel}</span>}
        </div>
        <div className="onboarding-panel">{children}</div>
      </main>
    </div>
  );
}

function GuideField(props: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label htmlFor={props.id} className="label">{props.label}</label>
      <input
        id={props.id}
        className="field"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        maxLength={200}
        autoComplete="off"
        required
        autoFocus={props.autoFocus}
      />
    </div>
  );
}

function PhotoPicker({
  url,
  name,
  onChange,
}: {
  url?: string;
  name: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <div>
      <span className="label">
        A photo of them <span className="font-normal text-ink-soft">(optional)</span>
      </span>
      <div className="flex items-center gap-4">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview
          <img src={url} alt={`Photo of ${name || "them"}`} className="size-24 rounded-xl object-cover" />
        ) : (
          <div className="grid size-24 place-items-center rounded-xl border-2 border-dashed border-paper-edge bg-paper-raised/50 text-ink-faint">
            <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="12" cy="12" r="3.5" />
            </svg>
          </div>
        )}
        <div className="flex flex-col items-start gap-1">
          <label className="btn btn-secondary btn-sm cursor-pointer">
            {url ? "Choose another" : "Choose a photo"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => onChange(e.target.files?.[0] ?? null)}
            />
          </label>
          {url && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>
              Remove
            </button>
          )}
        </div>
      </div>
      <p className="hint mt-2">It is stored privately, exactly as it is. It is never edited or sent to the AI.</p>
    </div>
  );
}
