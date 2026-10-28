import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AltarState } from "@/lib/types";

// The altar kept in this browser's IndexedDB. It is the store when Supabase
// isn't configured (a fresh clone, say). When Supabase is set up, an altar
// found here is uploaded once, then cleared from the device.

interface AltarDB extends DBSchema {
  state: { key: string; value: AltarState };
  blobs: { key: string; value: Blob };
}

const STATE_KEY = "altar";
let dbPromise: Promise<IDBPDatabase<AltarDB>> | null = null;

function db() {
  dbPromise ??= openDB<AltarDB>("alebrije-altar", 1, {
    upgrade(database) {
      database.createObjectStore("state");
      database.createObjectStore("blobs");
    },
  });
  return dbPromise;
}

export async function loadLocalState() {
  if (typeof indexedDB === "undefined") return null;
  return (await (await db()).get("state", STATE_KEY)) ?? null;
}

export async function saveLocalState(altar: AltarState) {
  await (await db()).put("state", altar, STATE_KEY);
}

export async function getLocalBlobs() {
  const database = await db();
  const keys = await database.getAllKeys("blobs");
  const blobs = await database.getAll("blobs");
  return keys.map((key, i) => ({ id: key, blob: blobs[i] }));
}

export async function putLocalBlob(blob: Blob, id: string) {
  await (await db()).put("blobs", blob, id);
}

export async function getLocalBlob(id: string) {
  return (await db()).get("blobs", id);
}

export async function deleteLocalBlob(id: string) {
  await (await db()).delete("blobs", id);
}

export async function clearLocal() {
  const database = await db();
  await database.clear("state");
  await database.clear("blobs");
}
