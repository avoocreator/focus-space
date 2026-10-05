// Util tantangan harian & streak untuk semua game.
// Seed deterministik → puzzle harian sama untuk semua orang.

import { todayStr } from "@/lib/utils";
import { recordActivity } from "@/lib/activity";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { GameKey } from "@/lib/types";

/** FNV-1a hash → seed 32-bit */
export function dailySeed(dateStr: string = todayStr()): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** PRNG deterministik (mulberry32) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type StreakMap = Record<string, { lastDate: string; current: number; best: number }>;

const STREAK_KEY = "fs_game_streak";

function loadStreaks(): StreakMap {
  try {
    return JSON.parse(localStorage.getItem(STREAK_KEY) || "{}") as StreakMap;
  } catch {
    return {};
  }
}

export function getStreak(game: GameKey): { current: number; best: number } {
  if (typeof window === "undefined") return { current: 0, best: 0 };
  const s = loadStreaks()[game];
  return { current: s?.current ?? 0, best: s?.best ?? 0 };
}

/** Apakah tantangan harian game ini sudah dikerjakan hari ini? */
export function isDailyDone(game: GameKey): boolean {
  if (typeof window === "undefined") return false;
  return loadStreaks()[game]?.lastDate === todayStr();
}

function yesterdayStr(): string {
  const d = new Date(Date.now() - 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Tandai tantangan harian selesai. Dipanggil 1x saat game harian berakhir.
 * Streak naik sekali per hari; XP via recordActivity (dedupe internal).
 */
export function completeDaily(game: GameKey, won: boolean): void {
  if (typeof window === "undefined") return;
  const all = loadStreaks();
  const s = all[game];
  if (s?.lastDate === todayStr()) return; // sudah dicatat hari ini
  const current = s?.lastDate === yesterdayStr() ? (s?.current ?? 0) + 1 : 1;
  const best = Math.max(s?.best ?? 0, current);
  all[game] = { lastDate: todayStr(), current, best };
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(all));
  } catch {}
  void recordActivity("game");
  if (won) void recordActivity("game_win");
}

// ── Best score per game (opsional per-difficulty) ──

const BEST_KEY = "fs_game_best";

type BestMap = Record<string, number>;

function bestKey(game: GameKey, diff?: string): string {
  return diff ? `${game}:${diff}` : game;
}

export function getBest(game: GameKey, diff?: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const m = JSON.parse(localStorage.getItem(BEST_KEY) || "{}") as BestMap;
    return m[bestKey(game, diff)] ?? null;
  } catch {
    return null;
  }
}

export function setBest(game: GameKey, value: number, diff?: string): void {
  if (typeof window === "undefined") return;
  try {
    const m = JSON.parse(localStorage.getItem(BEST_KEY) || "{}") as BestMap;
    const k = bestKey(game, diff);
    if (m[k] === undefined || value > m[k]) {
      m[k] = value;
      localStorage.setItem(BEST_KEY, JSON.stringify(m));
    }
  } catch {}
}

/** Simpan skor ke Supabase (diam saja kalau tamu tanpa DB / gagal). */
export async function saveGameScore(
  game: GameKey,
  score: number,
  won: boolean,
  meta: Record<string, unknown> = {}
): Promise<void> {
  try {
    if (!isSupabaseConfigured) return;
    const sb = getSupabase();
    const { data } = await sb.auth.getSession();
    if (!data.session) return;
    await sb.from("game_scores").insert({ game, score, won, meta });
  } catch {
    // skor lokal tetap tersimpan — ini hanya bonus sync
  }
}
