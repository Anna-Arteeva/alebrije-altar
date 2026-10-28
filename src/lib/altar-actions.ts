"use client";

import { strToU8, zipSync } from "fflate";
import { paintImage } from "@/lib/api";
import { getAltar, updateAltar } from "@/lib/store/altar-store";
import { getBlob, uid } from "@/lib/store/db";
import type { AltarState, ChatCard, ChatMessage, ElementKey, Memory } from "@/lib/types";
import { ELEMENTS } from "@/content/ofrenda";

// Every change to the altar goes through here, whether it came from the
// alebrije's tool calls, a confirm card, or the user adding things by hand.

export function note(text: string): ChatMessage {
  return { id: uid("note"), role: "note", text, createdAt: Date.now() };
}

export function patchCard(
  altar: AltarState,
  messageId: string,
  callId: string,
  patch: (card: ChatCard) => ChatCard,
): AltarState {
  return {
    ...altar,
    messages: altar.messages.map((m) =>
      m.id !== messageId
        ? m
        : {
            ...m,
            cards: m.cards?.map((c) => ("callId" in c && c.callId === callId ? patch(c) : c)),
          },
    ),
  };
}

export function addCard(altar: AltarState, messageId: string, card: ChatCard): AltarState {
  return {
    ...altar,
    messages: altar.messages.map((m) =>
      m.id === messageId ? { ...m, cards: [...(m.cards ?? []), card] } : m,
    ),
  };
}

// --- Tool calls from the alebrije -----------------------------------------

export function applyToolAction(
  messageId: string,
  tool: string,
  callId: string,
  args: Record<string, unknown>,
  attachedPhotoId?: string,
) {
  updateAltar((altar) => {
    switch (tool) {
      case "add_memory": {
        const fromPhoto = args.from_attached_photo === true && !!attachedPhotoId;
        const memory: Memory = {
          id: String(args.memory_id),
          lovedOneId: altar.lovedOne.id,
          type: fromPhoto ? "photo" : "text",
          text: String(args.text),
          mediaId: fromPhoto ? attachedPhotoId : undefined,
          illustrate: false,
          illustrationStatus: "none",
          createdAt: Date.now(),
          source: "chat",
        };
        return addCard({ ...altar, memories: [...altar.memories, memory] }, messageId, {
          kind: "memory",
          memoryId: memory.id,
        });
      }
      case "suggest_object":
        return addCard(altar, messageId, {
          kind: "object",
          callId,
          name: String(args.name),
          description: String(args.description),
          imageSubject: String(args.image_subject),
          state: "proposed",
        });
      case "illustrate_memory":
        return addCard(altar, messageId, {
          kind: "illustrate",
          callId,
          memoryId: String(args.memory_id),
          prompt: String(args.image_subject),
          state: "proposed",
        });
      case "add_traditional_element":
        return addCard(altar, messageId, {
          kind: "element",
          callId,
          element: args.element as ElementKey,
          reason: String(args.reason),
          state: "proposed",
        });
      case "pause_conversation":
        return addCard(altar, messageId, {
          kind: "pause",
          callId,
          reason: String(args.reason),
          state: "proposed",
        });
      case "show_support_resources":
        return addCard(altar, messageId, { kind: "support", callId });
      default:
        return altar;
    }
  });
}

// --- Confirm cards ---------------------------------------------------------

export function decideCard(messageId: string, card: ChatCard, accept: boolean) {
  if (!("callId" in card) || card.kind === "support") return;
  const state = accept ? "accepted" : "declined";

  switch (card.kind) {
    case "object": {
      if (!accept) {
        updateAltar((a) => {
          const next = patchCard(a, messageId, card.callId, (c) => ({ ...c, state }));
          return { ...next, messages: [...next.messages, note(`The user chose not to place "${card.name}" for now.`)] };
        });
        return;
      }
      const objectId = addObject(card.name, card.description, card.imageSubject, false);
      updateAltar((a) => {
        const next = patchCard(a, messageId, card.callId, (c) => ({ ...c, state, objectId }));
        return { ...next, messages: [...next.messages, note(`The user placed "${card.name}" on the altar.`)] };
      });
      return;
    }
    case "illustrate": {
      updateAltar((a) => {
        const next = patchCard(a, messageId, card.callId, (c) => ({ ...c, state }));
        const text = accept
          ? `The user asked to illustrate memory ${card.memoryId}.`
          : `The user prefers to keep memory ${card.memoryId} as words.`;
        return { ...next, messages: [...next.messages, note(text)] };
      });
      if (accept) illustrateMemory(card.memoryId, card.prompt);
      return;
    }
    case "element": {
      updateAltar((a) => {
        const next = patchCard(a, messageId, card.callId, (c) => ({ ...c, state }));
        const name = ELEMENTS[card.element].name;
        return {
          ...next,
          elements: accept && !next.elements.includes(card.element) ? [...next.elements, card.element] : next.elements,
          messages: [
            ...next.messages,
            note(accept ? `The user placed ${name} on the altar.` : `The user chose not to add ${name} for now.`),
          ],
        };
      });
      return;
    }
    case "pause": {
      updateAltar((a) => {
        const next = patchCard(a, messageId, card.callId, (c) => ({ ...c, state }));
        const text = accept
          ? "The user chose to rest here. If they come back, welcome them warmly and gently pick up again."
          : "The user wants to keep going. Ask your next question.";
        return { ...next, messages: [...next.messages, note(text)] };
      });
      return;
    }
  }
}

// --- Images ----------------------------------------------------------------

export async function illustrateMemory(memoryId: string, prompt: string) {
  updateAltar((a) => ({
    ...a,
    memories: a.memories.map((m) =>
      m.id === memoryId ? { ...m, illustrate: true, illustrationPrompt: prompt, illustrationStatus: "pending" } : m,
    ),
  }));
  try {
    const illustrationId = await paintImage("vignette", prompt);
    setMemory(memoryId, { illustrationId, illustrationStatus: "done" });
  } catch {
    setMemory(memoryId, { illustrationStatus: "error" });
  }
}

async function paintObject(objectId: string, subject: string) {
  updateAltar((a) => ({
    ...a,
    objects: a.objects.map((o) => (o.id === objectId ? { ...o, imageStatus: "pending" } : o)),
  }));
  try {
    const imageId = await paintImage("object", subject);
    updateAltar((a) => ({
      ...a,
      objects: a.objects.map((o) => (o.id === objectId ? { ...o, imageId, imageStatus: "done" } : o)),
    }));
  } catch {
    updateAltar((a) => ({
      ...a,
      objects: a.objects.map((o) => (o.id === objectId ? { ...o, imageStatus: "error" } : o)),
    }));
  }
}

export function repaintObject(objectId: string) {
  const object = getAltar()?.objects.find((o) => o.id === objectId);
  if (object) void paintObject(object.id, object.imageSubject);
}

// --- Manual edits ----------------------------------------------------------

// A starter-set object arrives already painted.
export function addStarterObject(name: string, imageSubject: string, imageSrc: string) {
  const id = uid("obj");
  updateAltar((a) => ({
    ...a,
    objects: [
      ...a.objects,
      { id, lovedOneId: a.lovedOne.id, name, description: "", imageSubject, imageSrc, imageStatus: "done", createdAt: Date.now() },
    ],
  }));
  return id;
}

export function addObject(name: string, description: string, imageSubject: string, manual = true) {
  const id = uid("obj");
  updateAltar((a) => ({
    ...a,
    objects: [
      ...a.objects,
      {
        id,
        lovedOneId: a.lovedOne.id,
        name,
        description,
        imageSubject,
        imageStatus: "pending",
        createdAt: Date.now(),
      },
    ],
    messages: manual ? [...a.messages, note(`The user placed "${name}" on the altar by hand.`)] : a.messages,
  }));
  void paintObject(id, imageSubject);
  return id;
}

export function addMemory(text: string, photoId?: string) {
  const id = uid("m");
  updateAltar((a) => ({
    ...a,
    memories: [
      ...a.memories,
      {
        id,
        lovedOneId: a.lovedOne.id,
        type: photoId ? "photo" : "text",
        text,
        mediaId: photoId,
        illustrate: false,
        illustrationStatus: "none",
        createdAt: Date.now(),
        source: "manual",
      },
    ],
  }));
  return id;
}

export function setMemory(memoryId: string, patch: Partial<Memory>) {
  updateAltar((a) => ({
    ...a,
    memories: a.memories.map((m) => (m.id === memoryId ? { ...m, ...patch } : m)),
  }));
}

export function removeMemory(memoryId: string) {
  updateAltar((a) => ({
    ...a,
    memories: a.memories.filter((m) => m.id !== memoryId),
    messages: [...a.messages, note(`The user removed memory ${memoryId} from the altar.`)],
  }));
}

export function removeObject(objectId: string) {
  updateAltar((a) => {
    const object = a.objects.find((o) => o.id === objectId);
    return {
      ...a,
      objects: a.objects.filter((o) => o.id !== objectId),
      messages: object
        ? [...a.messages, note(`The user removed "${object.name}" from the altar.`)]
        : a.messages,
    };
  });
}

export function toggleElement(key: ElementKey) {
  updateAltar((a) => {
    const placed = a.elements.includes(key);
    return {
      ...a,
      elements: placed ? a.elements.filter((e) => e !== key) : [...a.elements, key],
      messages: [
        ...a.messages,
        note(`The user ${placed ? "removed" : "placed"} ${ELEMENTS[key].name} ${placed ? "from" : "on"} the altar by hand.`),
      ],
    };
  });
}

export function setMood(mood: AltarState["mood"]) {
  updateAltar((a) => ({ ...a, mood }));
}

// --- Export ----------------------------------------------------------------

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic" };

export async function exportAltar() {
  const altar = getAltar();
  if (!altar) return;

  const files: Record<string, Uint8Array> = {};
  const add = async (blobId: string | undefined, path: string) => {
    if (!blobId) return;
    const blob = await getBlob(blobId);
    if (!blob) return;
    files[`${path}.${EXT[blob.type] ?? "bin"}`] = new Uint8Array(await blob.arrayBuffer());
  };

  await add(altar.lovedOne.photoId, "photo-of-" + slug(altar.lovedOne.name));
  if (altar.alebrije) await add(altar.alebrije.imageId, "alebrije-" + slug(altar.alebrije.name));
  for (const [i, m] of altar.memories.entries()) {
    await add(m.mediaId, `memories/${i + 1}-photo`);
    await add(m.illustrationId, `memories/${i + 1}-illustration`);
  }
  for (const [i, o] of altar.objects.entries()) {
    if (o.imageId) {
      await add(o.imageId, `objects/${i + 1}-${slug(o.name)}`);
    } else if (o.imageSrc) {
      const response = await fetch(o.imageSrc);
      if (response.ok) files[`objects/${i + 1}-${slug(o.name)}.webp`] = new Uint8Array(await response.arrayBuffer());
    }
  }

  const lines = [
    `Ofrenda for ${altar.lovedOne.name}`,
    "",
    "Memories",
    ...altar.memories.map((m, i) => `${i + 1}. ${m.text}`),
    "",
    "On the altar",
    ...altar.objects.map((o) => `- ${o.name}: ${o.description}`),
    ...altar.elements.map((e) => `- ${ELEMENTS[e].name} (${ELEMENTS[e].gloss})`),
  ];
  files["memories.txt"] = strToU8(lines.join("\n"));
  files["altar.json"] = strToU8(JSON.stringify(altar, null, 2));

  const zip = zipSync(files, { level: 0 });
  const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `ofrenda-${slug(altar.lovedOne.name)}.zip`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function slug(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "altar";
}
