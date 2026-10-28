"use client";

import { PERSON_MARKER, peopleOnAltar } from "@/lib/people";
import { ELEMENT_KEYS } from "@/lib/types";
import { STARTER_OBJECTS } from "@/content/starter-objects";
import { ELEMENTS } from "@/content/ofrenda";
import {
  addCard,
  addObject,
  addStarterObject,
  applyToolAction,
  note,
  patchCard,
} from "@/lib/altar-actions";
import { deleteEverything, getAltar, setAltar, storeBlob, updateAltar } from "@/lib/store/altar-store";
import { uid } from "@/lib/store/db";
import type { Alebrije, AltarState, ChatCard, ElementKey, InterviewStep, Memory, Pronouns } from "@/lib/types";

// What the interview's tool calls and cards do to the altar. Like
// altar-actions, every change is written through the altar store.

// A stand-in until the character is finished: the guide is simply Alebrije.
export const INTERVIEW_ALEBRIJE: Alebrije = {
  name: "Alebrije",
  traits: { animal: "", color: "", place: "" },
  intro: "",
  personality: "Warm, curious and gently playful, a guide for the living who loves a good story.",
  imageSubject: "",
};

export async function startInterview(replacing: boolean) {
  if (replacing) await deleteEverything();
  const now = Date.now();
  const state: AltarState = {
    version: 1,
    id: crypto.randomUUID(),
    createdAt: now,
    mood: "festive",
    lovedOne: { id: uid("person"), name: "", isChild: false },
    alebrije: INTERVIEW_ALEBRIJE,
    elements: [...ELEMENT_KEYS],
    memories: [],
    objects: [],
    messages: [{ id: uid("msg"), role: "assistant", text: "Hola, I’m Alebrije. I’ll help you make a place for someone you love, with their photo, favorite things and your stories. Who would you like to remember?", createdAt: now }],
    stage: "interview",
    interview: { done: ["elements"] },
  };
  await setAltar(state);
}

export function openAltar() {
  return updateAltar((a) => ({ ...a, stage: "altar" }));
}

export function markStepDone(step: InterviewStep) {
  updateAltar((a) => withStepDone(a, step));
}

function withStepDone(altar: AltarState, step: InterviewStep): AltarState {
  const done = altar.interview?.done ?? [];
  return done.includes(step) ? altar : { ...altar, interview: { done: [...done, step] } };
}

// --- Tool calls -------------------------------------------------------------

export function applyInterviewAction(
  messageId: string,
  tool: string,
  callId: string,
  args: Record<string, unknown>,
) {
  if (tool === "pause_conversation" || tool === "show_support_resources") {
    applyToolAction(messageId, tool, callId, args);
    return;
  }

  updateAltar((altar) => {
    switch (tool) {
      case "set_loved_one":
        return {
          ...altar,
          lovedOne: {
            ...altar.lovedOne,
            name: String(args.name).trim() || altar.lovedOne.name,
            pronouns: (args.pronouns as Pronouns | null) ?? altar.lovedOne.pronouns,
            relation: typeof args.relation === "string" && args.relation.trim() ? args.relation.trim() : altar.lovedOne.relation,
            isChild: args.is_child === true || altar.lovedOne.isChild,
          },
        };
      case "offer_choices":
        return addCard(altar, messageId, {
          kind: "choices",
          callId,
          mode: args.mode as "yes_no" | "single" | "multi",
          options: args.options as string[],
          allowFreeText: args.allow_free_text === true,
          answered: false,
        });
      case "request_photo":
        return addCard(altar, messageId, { kind: "photo", callId, state: "proposed" });
      case "offer_starter_objects":
        return addCard(altar, messageId, { kind: "starter-objects", callId, preselect: args.preselect as string[] });
      case "add_objects":
        return addCard(altar, messageId, {
          kind: "objects",
          callId,
          objects: (args.objects as { name: string; description: string; image_subject: string }[]).map((o) => ({
            name: o.name,
            description: o.description,
            imageSubject: o.image_subject,
          })),
          state: "proposed",
        });
      case "save_memories": {
        const memories: Memory[] = (args.memories as { id: string; text: string }[]).map((m) => ({
          id: m.id,
          lovedOneId: altar.lovedOne.id,
          type: "text",
          text: m.text,
          illustrate: false,
          illustrationStatus: "none",
          createdAt: Date.now(),
          source: "chat",
        }));
        return withMemoriesCard({ ...altar, memories: [...altar.memories, ...memories] }, messageId, memories.map((m) => m.id));
      }
      case "extend_memory": {
        const id = String(args.memory_id);
        const next = {
          ...altar,
          memories: altar.memories.map((m) => (m.id === id ? { ...m, text: continueMemory(m.text, String(args.text)) } : m)),
        };
        return withMemoriesCard(next, messageId, [id]);
      }
      case "offer_elements":
        return addCard(altar, messageId, { kind: "elements-pick", callId, elements: args.elements as ElementKey[] });
      case "complete_step":
        return withStepDone(altar, args.step as InterviewStep);
      case "finish_interview":
        return addCard(altar, messageId, { kind: "finish", callId });
      default:
        return altar;
    }
  });
}

// The user's next words join their memory as a new sentence; a full stop
// and a capital are the only things added.
function continueMemory(text: string, more: string) {
  const start = text.trim().replace(/[\s,;:]+$/, "");
  const end = /[.!?…"”)]$/.test(start) ? start : `${start}.`;
  return `${end} ${more.trim().replace(/^\p{Ll}/u, (c) => c.toUpperCase())}`;
}

// Memories saved in one reply share a single "kept these" card.
function withMemoriesCard(altar: AltarState, messageId: string, ids: string[]): AltarState {
  const message = altar.messages.find((m) => m.id === messageId);
  const existing = message?.cards?.find((c) => c.kind === "memories");
  if (!existing) return addCard(altar, messageId, { kind: "memories", memoryIds: ids });
  return {
    ...altar,
    messages: altar.messages.map((m) =>
      m.id !== messageId
        ? m
        : {
            ...m,
            cards: m.cards?.map((c) =>
              c.kind === "memories" ? { ...c, memoryIds: [...new Set([...c.memoryIds, ...ids])] } : c,
            ),
          },
    ),
  };
}

// --- Cards ------------------------------------------------------------------
// Each returns the words to send back as the user's answer, so the
// conversation carries on from what they chose.

type Card<K extends ChatCard["kind"]> = Extract<ChatCard, { kind: K }>;

export function answerChoices(messageId: string, card: Card<"choices">) {
  updateAltar((a) => patchCard(a, messageId, card.callId, (c) => ({ ...c, answered: true })));
}

export async function answerPhoto(messageId: string, card: Card<"photo">, photo: File | null) {
  const photoId = photo ? await storeBlob(photo) : undefined;
  updateAltar((a) => {
    const next = patchCard(a, messageId, card.callId, (c) => ({ ...c, state: photo ? "accepted" : "declined" }));
    return withStepDone(
      {
        ...next,
        lovedOne: photoId ? { ...next.lovedOne, photoId } : next.lovedOne,
        messages: [
          ...next.messages,
          note(
            photoId
              ? "The user added a photo. It is at the center of the altar. You cannot see it; don't describe it."
              : "The user chose not to add a photo for now.",
          ),
        ],
      },
      "photo",
    );
  });
  return photo ? `Here is a photo of ${getAltar()?.lovedOne.name || "them"}.` : "Not now.";
}

export function pickStarterObjects(messageId: string, card: Card<"starter-objects">, keys: string[], ownWords: string) {
  const picked = STARTER_OBJECTS.filter((o) => keys.includes(o.key));
  for (const object of picked) addStarterObject(object.label, object.imageSubject, object.src);
  updateAltar((a) => {
    const next = patchCard(a, messageId, card.callId, () => ({ ...card, picked: keys }));
    const placed = picked.length
      ? `The user placed these on the altar from the painted set: ${picked.map((o) => o.label).join(", ")}.`
      : "The user picked nothing from the painted set.";
    return withStepDone({ ...next, messages: [...next.messages, note(placed)] }, "objects");
  });
  const chosen = picked.map((o) => o.label.toLowerCase());
  const words = ownWords.trim();
  if (!chosen.length) return words || "None of these.";
  const list = chosen.length > 1 ? `${chosen.slice(0, -1).join(", ")} and ${chosen.at(-1)}` : chosen[0];
  const sentence = list.charAt(0).toUpperCase() + list.slice(1);
  return words ? `${sentence}. And also: ${words}` : `${sentence}.`;
}

export function decideObjects(messageId: string, card: Card<"objects">, accept: boolean) {
  if (accept) for (const o of card.objects) addObject(o.name, o.description, o.imageSubject, false);
  const names = card.objects.map((o) => `"${o.name}"`).join(", ");
  updateAltar((a) => {
    const next = patchCard(a, messageId, card.callId, (c) => ({ ...c, state: accept ? "accepted" : "declined" }));
    const text = accept ? `The user placed ${names} on the altar; they are being painted.` : `The user chose not to place ${names} for now.`;
    return { ...next, messages: [...next.messages, note(text)] };
  });
}

export function pickElements(messageId: string, card: Card<"elements-pick">, keys: ElementKey[]) {
  updateAltar((a) => {
    const next = patchCard(a, messageId, card.callId, () => ({ ...card, picked: keys }));
    return withStepDone(
      { ...next, elements: [...new Set([...next.elements, ...keys])] },
      "elements",
    );
  });
  if (!keys.length) return "Let's leave the elements for now.";
  const names = keys.map((k) => ELEMENTS[k].name);
  return `${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0]}, please.`;
}

// Expand the existing altar; never replace or delete earlier people.
export function addPersonToAltar() {
  return updateAltar((a) => {
    if (!a.lovedOne.name.trim()) return a;
    const person = { id: uid("person"), name: "", isChild: false };
    return { ...a, people: peopleOnAltar(a), lovedOne: person, stage: "interview",
      interview: { done: ["elements"] },
      messages: [...a.messages, note(PERSON_MARKER + person.id), {
        id: uid("msg"), role: "assistant", text: "There’s room for someone else here, too. Who would you like to add to the altar?", createdAt: Date.now(),
      }],
    };
  });
}
