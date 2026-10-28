"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/store/database.types";

// The browser's Supabase client. Each person is a silent anonymous user, and
// Row Level Security keeps their altar private to them. Created on first use,
// so server rendering never needs it.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Without these the altar is kept in this browser instead (see store/db.ts).
export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

let client: SupabaseClient<Database> | null = null;

export function supabase() {
  client ??= createClient<Database>(SUPABASE_URL!, SUPABASE_KEY!);
  return client;
}

let userPromise: Promise<string> | null = null;

// Resolves to the current user's id, signing in anonymously the first time.
export function ensureUser() {
  userPromise ??= (async () => {
    const { data } = await supabase().auth.getSession();
    if (data.session) return data.session.user.id;
    const { data: signedIn, error } = await supabase().auth.signInAnonymously();
    if (error || !signedIn.user) throw error ?? new Error("Couldn't start a session.");
    return signedIn.user.id;
  })().catch((error) => {
    userPromise = null;
    throw error;
  });
  return userPromise;
}
