"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Nilai placeholder supaya build tidak pernah gagal walau env belum diisi.
// Kalau belum dikonfigurasi, semua panggilan akan gagal di runtime dengan
// pesan error yang jelas — UI pakai isSupabaseConfigured untuk menampilkan
// petunjuk setup.
const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY = "public-anon-key-placeholder";

export const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/** Klien Supabase browser (singleton). Aman dipanggil berulang. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
        realtime: { params: { eventsPerSecond: 20 } },
      }
    );
  }
  return client;
}
