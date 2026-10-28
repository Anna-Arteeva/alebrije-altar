import { activePersonId, peopleOnAltar } from "@/lib/people";
import { ensureUser, hasSupabase, supabase } from "@/lib/supabase";
import type { Database, Json } from "@/lib/store/database.types";
import type { Alebrije, AltarObject, AltarState, ChatMessage, LovedOne, Memory } from "@/lib/types";
import {
  clearLocal,
  deleteLocalBlob,
  getLocalBlob,
  loadLocalState,
  putLocalBlob,
  saveLocalState,
} from "./local-db";

// All altar data lives in Supabase, private to the signed-in (anonymous)
// person. Each part of the altar is a row in its own table; photos and
// generated images are files in the altar-media bucket at <user id>/<blob id>.
// Without Supabase configured, everything is kept in this browser instead.

type Tables = Database["public"]["Tables"];
type Row<T extends keyof Tables> = Tables[T]["Row"];

const BUCKET = "altar-media";

export function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function check<T extends { error: unknown }>(result: T) {
  if (result.error) throw result.error;
  return result;
}

const iso = (ms: number) => new Date(ms).toISOString();
const ms = (timestamp: string) => Date.parse(timestamp);

// --- Altar state -------------------------------------------------------------

export async function loadState(): Promise<AltarState | null> {
  if (!hasSupabase) return loadLocalState();
  await ensureUser();
  const { data: altar } = check(await supabase().from("altars").select().maybeSingle());
  if (!altar) return null;

  const [lovedOnes, alebrijes, memories, objects, messages] = await Promise.all([
    supabase().from("loved_ones").select().eq("altar_id", altar.id),
    supabase().from("alebrijes").select().eq("altar_id", altar.id),
    supabase().from("memories").select().eq("altar_id", altar.id).order("position"),
    supabase().from("altar_objects").select().eq("altar_id", altar.id).order("position"),
    supabase().from("messages").select().eq("altar_id", altar.id).order("position"),
  ]).then((results) => results.map((r) => check(r).data ?? []));

  const personId = activePersonId(messages as Row<"messages">[]);
  const personRows = lovedOnes as Row<"loved_ones">[];
  const lovedOne = personRows.find((p) => p.id === personId) ?? personRows[0];
  if (!lovedOne) return null;
  const alebrije = (alebrijes as Row<"alebrijes">[])[0];

  return {
    version: 1,
    id: altar.id,
    createdAt: ms(altar.created_at),
    mood: altar.mood as AltarState["mood"],
    lovedOne: {
      id: lovedOne.id,
      name: lovedOne.name,
      relation: lovedOne.relation ?? undefined,
      isChild: lovedOne.is_child,
      photoId: lovedOne.photo_id ?? undefined,
      pronouns: (lovedOne.pronouns ?? undefined) as LovedOne["pronouns"],
    },
    people: personRows.filter((p) => p.id !== lovedOne.id).map((p) => ({
      id: p.id, name: p.name, relation: p.relation ?? undefined, isChild: p.is_child,
      photoId: p.photo_id ?? undefined, pronouns: (p.pronouns ?? undefined) as LovedOne["pronouns"],
    })),
    alebrije: alebrije
      ? {
          name: alebrije.name,
          traits: alebrije.traits as Alebrije["traits"],
          intro: alebrije.intro,
          personality: alebrije.personality,
          imageSubject: alebrije.image_subject,
          imageId: alebrije.image_id ?? undefined,
        }
      : null,
    elements: altar.elements as AltarState["elements"],
    memories: (memories as Row<"memories">[]).map((m) => ({
      id: m.id,
      lovedOneId: m.loved_one_id,
      type: m.type as Memory["type"],
      text: m.text,
      mediaId: m.media_id ?? undefined,
      illustrate: m.illustrate,
      illustrationPrompt: m.illustration_prompt ?? undefined,
      illustrationId: m.illustration_id ?? undefined,
      illustrationStatus: m.illustration_status as Memory["illustrationStatus"],
      createdAt: ms(m.created_at),
      source: m.source as Memory["source"],
    })),
    objects: (objects as Row<"altar_objects">[]).map((o) => ({
      id: o.id,
      lovedOneId: o.loved_one_id,
      name: o.name,
      description: o.description,
      imageSubject: o.image_subject,
      imageId: o.image_id ?? undefined,
      imageSrc: o.image_src ?? undefined,
      imageStatus: o.image_status as AltarObject["imageStatus"],
      createdAt: ms(o.created_at),
    })),
    messages: (messages as Row<"messages">[]).map((m) => ({
      id: m.id,
      role: m.role as ChatMessage["role"],
      text: m.text,
      photoId: m.photo_id ?? undefined,
      cards: (m.cards ?? undefined) as ChatMessage["cards"],
      skipped: m.skipped ?? undefined,
      createdAt: ms(m.created_at),
    })),
    stage: (altar.stage ?? undefined) as AltarState["stage"],
    interview: altar.interview_done ? { done: altar.interview_done as NonNullable<AltarState["interview"]>["done"] } : undefined,
  };
}

// Writes only what changed since `prev`, the last state that was saved.
// Altar updates are immutable, so an unchanged memory, object or message is
// the very same object as before.
export async function saveState(prev: AltarState | null, next: AltarState) {
  if (!hasSupabase) return saveLocalState(next);
  if (prev?.id !== next.id) prev = null;
  const altarId = next.id;

  if (
    !prev ||
    prev.mood !== next.mood ||
    prev.stage !== next.stage ||
    prev.elements !== next.elements ||
    prev.interview !== next.interview
  ) {
    check(
      await supabase().from("altars").upsert({
        id: altarId,
        mood: next.mood,
        stage: next.stage ?? null,
        elements: next.elements,
        interview_done: next.interview?.done ?? null,
        created_at: iso(next.createdAt),
      }),
    );
  }

  for (const l of peopleOnAltar(next)) {
    if (prev && peopleOnAltar(prev).some((p) => p === l)) continue;
    check(
      await supabase().from("loved_ones").upsert({
        altar_id: altarId,
        id: l.id,
        name: l.name,
        relation: l.relation ?? null,
        is_child: l.isChild,
        pronouns: l.pronouns ?? null,
        photo_id: l.photoId ?? null,
      }),
    );
  }

  await Promise.all([
    saveAlebrije(altarId, prev?.alebrije ?? null, next.alebrije),
    saveList("memories", altarId, prev?.memories ?? [], next.memories, (m) => ({
      loved_one_id: m.lovedOneId,
      type: m.type,
      text: m.text,
      media_id: m.mediaId ?? null,
      illustrate: m.illustrate,
      illustration_prompt: m.illustrationPrompt ?? null,
      illustration_id: m.illustrationId ?? null,
      illustration_status: m.illustrationStatus,
      source: m.source,
      created_at: iso(m.createdAt),
    })),
    saveList("altar_objects", altarId, prev?.objects ?? [], next.objects, (o) => ({
      loved_one_id: o.lovedOneId,
      name: o.name,
      description: o.description,
      image_subject: o.imageSubject,
      image_id: o.imageId ?? null,
      image_src: o.imageSrc ?? null,
      image_status: o.imageStatus,
      created_at: iso(o.createdAt),
    })),
    saveList("messages", altarId, prev?.messages ?? [], next.messages, (m) => ({
      role: m.role,
      text: m.text,
      photo_id: m.photoId ?? null,
      cards: (m.cards ?? null) as Json,
      skipped: m.skipped ?? null,
      created_at: iso(m.createdAt),
    })),
  ]);
}

async function saveAlebrije(altarId: string, prev: Alebrije | null, next: Alebrije | null) {
  if (prev === next) return;
  if (!next) {
    check(await supabase().from("alebrijes").delete().eq("altar_id", altarId));
    return;
  }
  check(
    await supabase().from("alebrijes").upsert({
      altar_id: altarId,
      name: next.name,
      traits: next.traits,
      intro: next.intro,
      personality: next.personality,
      image_subject: next.imageSubject,
      image_id: next.imageId ?? null,
    }),
  );
}

// Upserts items that are new, changed or moved, and deletes ones that are gone.
async function saveList<T extends { id: string }, Table extends "memories" | "altar_objects" | "messages">(
  table: Table,
  altarId: string,
  prev: T[],
  next: T[],
  toRow: (item: T) => Omit<Tables[Table]["Insert"], "altar_id" | "id" | "position">,
) {
  const before = new Map(prev.map((item, i) => [item.id, { item, i }]));
  const changed = next
    .map((item, position) => ({ item, position }))
    .filter(({ item, position }) => {
      const old = before.get(item.id);
      return old?.item !== item || old.i !== position;
    })
    .map(({ item, position }) => ({ ...toRow(item), altar_id: altarId, id: item.id, position }));
  const kept = new Set(next.map((item) => item.id));
  const removed = prev.filter((item) => !kept.has(item.id)).map((item) => item.id);

  // The generic table name hides the row type from supabase-js; the rows
  // above are checked against it.
  const rows = supabase().from(table as "messages");
  if (changed.length) check(await rows.upsert(changed as Tables["messages"]["Insert"][]));
  if (removed.length) check(await supabase().from(table as "messages").delete().eq("altar_id", altarId).in("id", removed));
}

// --- Photos and generated images ---------------------------------------------

async function blobPath(id: string) {
  return `${await ensureUser()}/${id}`;
}

export async function putBlob(blob: Blob, id = uid("blob")) {
  if (!hasSupabase) {
    await putLocalBlob(blob, id);
    return id;
  }
  check(
    await supabase().storage
      .from(BUCKET)
      .upload(await blobPath(id), blob, { contentType: blob.type || "image/jpeg", upsert: true }),
  );
  return id;
}

export async function getBlob(id: string) {
  if (!hasSupabase) return getLocalBlob(id);
  const { data } = await supabase().storage.from(BUCKET).download(await blobPath(id));
  return data ?? undefined;
}

export async function deleteBlob(id: string) {
  if (!hasSupabase) return deleteLocalBlob(id);
  check(await supabase().storage.from(BUCKET).remove([await blobPath(id)]));
}

export async function clearAll() {
  if (!hasSupabase) return clearLocal();
  const userId = await ensureUser();
  check(await supabase().from("altars").delete().eq("owner_id", userId));
  for (;;) {
    const { data } = check(await supabase().storage.from(BUCKET).list(userId, { limit: 1000 }));
    if (!data?.length) break;
    const { data: removed } = check(
      await supabase().storage.from(BUCKET).remove(data.map((file) => `${userId}/${file.name}`)),
    );
    if (!removed?.length) break;
  }
}
