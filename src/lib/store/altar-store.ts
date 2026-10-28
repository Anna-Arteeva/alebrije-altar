"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { AltarState } from "@/lib/types";
import { hasSupabase } from "@/lib/supabase";
import { clearAll, getBlob, loadState, putBlob, saveState } from "./db";
import { clearLocal, getLocalBlobs, loadLocalState } from "./local-db";

// A tiny external store so every component sees the same altar, with each
// change written through to Supabase (or this browser) in order.

type Snapshot =
  | { status: "loading"; altar: null }
  | { status: "ready"; altar: AltarState | null };

const LOADING: Snapshot = { status: "loading", altar: null };
let snapshot: Snapshot = LOADING;
let loadStarted = false;
let writes = Promise.resolve();
// The last state Supabase has, so each write sends only what changed. A failed
// write leaves it as it was, and the next change sends those rows again.
let saved: AltarState | null = null;
// True while the altar can't be loaded or saved, so the page can say so.
let storageProblem = false;
const listeners = new Set<() => void>();

function emit(next: Snapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function setStorageProblem(problem: boolean) {
  if (storageProblem === problem) return;
  storageProblem = problem;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!loadStarted) {
    loadStarted = true;
    load()
      .then((altar) => {
        saved = altar;
        emit({ status: "ready", altar });
      })
      .catch((error) => {
        console.error(error);
        setStorageProblem(true);
        emit({ status: "ready", altar: null });
      });
  }
  return () => listeners.delete(listener);
}

async function load() {
  const altar = await loadState();
  return altar ?? (hasSupabase ? await migrateLocal() : null);
}

// An altar kept in this browser (made before the move to Supabase, or before
// it was configured) is uploaded once, under a new id, then cleared from this
// device. If anything fails it stays put for next time.
async function migrateLocal() {
  const local = await loadLocalState().catch(() => null);
  if (!local) return null;
  await clearAll(); // whatever a half-finished earlier try left behind
  for (const { id, blob } of await getLocalBlobs()) await putBlob(blob, id);
  const altar = { ...local, id: crypto.randomUUID() };
  await saveState(null, altar);
  await clearLocal();
  return altar;
}

export function useAltar() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => LOADING,
  );
}

export function useStorageProblem() {
  return useSyncExternalStore(
    subscribe,
    () => storageProblem,
    () => false,
  );
}

export function getAltar() {
  return snapshot.altar;
}

export function setAltar(altar: AltarState) {
  emit({ status: "ready", altar });
  writes = writes
    .then(async () => {
      await saveState(saved, altar);
      saved = altar;
      setStorageProblem(false);
    })
    .catch((error) => {
      console.error(error);
      setStorageProblem(true);
    });
  return writes;
}

export function updateAltar(change: (altar: AltarState) => AltarState) {
  const current = snapshot.altar;
  if (!current) return writes;
  return setAltar(change(current));
}

export async function deleteEverything() {
  await writes;
  await clearAll();
  saved = null;
  urlCache.forEach((url) => URL.revokeObjectURL(url));
  urlCache.clear();
  emit({ status: "ready", altar: null });
}

// Blob ids → object URLs, shared across components.
const urlCache = new Map<string, string>();

export async function storeBlob(blob: Blob, id?: string) {
  const blobId = await putBlob(blob, id);
  urlCache.set(blobId, URL.createObjectURL(blob));
  return blobId;
}

export function useBlobUrl(id: string | undefined) {
  const [, setLoaded] = useState(0);
  useEffect(() => {
    if (!id || urlCache.has(id)) return;
    let live = true;
    getBlob(id).then((blob) => {
      if (!blob || !live) return;
      if (!urlCache.has(id)) urlCache.set(id, URL.createObjectURL(blob));
      setLoaded((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, [id]);
  return id ? urlCache.get(id) : undefined;
}
