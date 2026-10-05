"use client";

import { getSupabase } from "@/lib/supabase/client";
import { todayStr } from "@/lib/utils";

// ═══════════════════════════════════════════════════════
//  SISTEM STREAK & XP
//  Semua fitur (fokus, task, game, kuis) memanggil
//  recordActivity() — streak harian + XP dihitung server-side
//  via RPC touch_streak (lihat supabase/schema.sql).
// ═══════════════════════════════════════════════════════

export type ActivityKind =
  | "focus" // selesai 1 sesi fokus pomodoro
  | "task" // menyelesaikan 1 task
  | "game" // bermain 1 game (selesai)
  | "game_win" // menang game
  | "quiz" // menyelesaikan 1 kuis
  | "quiz_answer"; // jawaban kuis benar (live)

const XP: Record<ActivityKind, number> = {
  focus: 25,
  task: 5,
  game: 10,
  game_win: 15,
  quiz: 20,
  quiz_answer: 2,
};

const LS_KEY = "fs_activity_today";

/** Cek apakah aktivitas jenis ini sudah pernah dicatat hari ini (dedupe lokal). */
export function isActivityDoneToday(kind: ActivityKind): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || "{}") as Record<string, string>;
    return raw[kind] === todayStr();
  } catch {
    return false;
  }
}

/**
 * Catat aktivitas → XP + streak harian.
 * Aman dipanggil untuk tamu/non-login (diam saja).
 * Dipanggil SETIAP event (XP selalu bertambah); streak dedupe server-side.
 */
export async function recordActivity(kind: ActivityKind): Promise<void> {
  try {
    if (typeof window === "undefined") return;
    // tandai lokal (dipakai untuk quest harian & optimisme UI)
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || "{}") as Record<string, string>;
      raw[kind] = todayStr();
      localStorage.setItem(LS_KEY, JSON.stringify(raw));
    } catch {}
    const sb = getSupabase();
    const { data } = await sb.auth.getSession();
    if (!data.session) return;
    await sb.rpc("touch_streak", { p_xp: XP[kind] });
  } catch {
    // diam — aktivitas tidak boleh bikin fitur utama error
  }
}
