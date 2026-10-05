"use client";

// ═════════════════════════════════════════════════════════════
//  QUIZ SHARED — kontrak internal modul kuis: tipe broadcast,
//  konstanta stage, helper skor/penyimpanan lokal & kuis demo.
//  Dipakai quiz-hub / quiz-create / quiz-play + anak-anaknya.
// ═════════════════════════════════════════════════════════════

import { clamp, randomCode } from "@/lib/utils";
import type { PlayerAnswer, QuizPlayerState, QuizQuestion, QuizRoomState, QuizSetDTO } from "@/lib/types";

// ── Konstanta panggung ──
export const QUESTION_SECONDS = 20;
export const QUESTION_MS = QUESTION_SECONDS * 1000;
export const REVEAL_SECONDS = 6;
export const MAX_PLAYERS = 30;
export const HEARTBEAT_MS = 3000;
export const HOST_TIMEOUT_MS = 10000; // 3 heartbeat bolong → dianggap hilang
export const TAKEOVER_COUNTDOWN = 30; // detik sebelum tombol ambil alih aktif
export const JOIN_TIMEOUT_MS = 8000; // kode room tak terjawab > 8 detik

/** Soal versi aman (TANPA answer & explain) untuk broadcast — anti-cheat. */
export type PublicQuestion = { q: string; options: string[] };

export function stripQuestion(q: QuizQuestion): PublicQuestion {
  return { q: q.q, options: [...q.options] };
}

export type RevealInfo = { correct: number; explain?: string };

// ── Union semua pesan broadcast di channel `quiz:{code}` ──
export type QuizBroadcast =
  | { type: "join_request"; id: string; name: string; avatar: string }
  | {
      type: "sync";
      host_id: string;
      set_id: string | null;
      state: QuizRoomState;
      players: QuizPlayerState[];
      question: PublicQuestion | null;
      reveal: RevealInfo | null;
      /** soal LENGKAP hanya saat masih lobby (joiner simpan untuk takeover) */
      questions: QuizQuestion[] | null;
    }
  | {
      type: "state";
      host_id: string;
      set_id: string | null;
      state: QuizRoomState;
      question: PublicQuestion | null;
      players: QuizPlayerState[];
      /** hanya saat status "finished" — soal lengkap untuk review semua pemain */
      full_questions?: QuizQuestion[];
    }
  | { type: "reveal"; host_id: string; correct: number; explain?: string; players: QuizPlayerState[] }
  | { type: "answer"; id: string; picked: number; ms: number }
  | { type: "ready"; id: string; ready: boolean }
  | { type: "heartbeat"; host_id: string }
  | { type: "host_left" };

export type PlayMode = "solo" | "host" | "join";

/** Skor 1 jawaban: 100 base + bonus kecepatan maks 100. */
export function scoreFor(ms: number): number {
  return 100 + Math.round(100 * clamp((QUESTION_MS - clamp(ms, 0, QUESTION_MS)) / QUESTION_MS, 0, 1));
}

/** Urutan leaderboard: skor desc, nama asc sebagai tie-breaker. */
export function sortPlayers(players: QuizPlayerState[]): QuizPlayerState[] {
  return [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export const OPTION_COLORS = ["var(--peach)", "var(--blue)", "var(--green)", "var(--yellow)"] as const;
export const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

// ── Penyimpanan lokal (kuis tanpa sesi / fallback offline) ──
const LS_SETS = "fs_quiz_local_sets";
const LS_GUEST = "fs_guest_id";

export function loadLocalSets(): QuizSetDTO[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(LS_SETS) || "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw as QuizSetDTO[];
  } catch {
    return [];
  }
}

export function saveLocalSet(set: QuizSetDTO): void {
  if (typeof window === "undefined") return;
  try {
    const all = loadLocalSets().filter((s) => s.id !== set.id);
    all.unshift(set);
    localStorage.setItem(LS_SETS, JSON.stringify(all.slice(0, 50)));
  } catch {
    /* diam */
  }
}

export function getLocalSet(id: string): QuizSetDTO | null {
  return loadLocalSets().find((s) => s.id === id) ?? null;
}

export function deleteLocalSet(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_SETS, JSON.stringify(loadLocalSets().filter((s) => s.id !== id)));
  } catch {
    /* diam */
  }
}

/**
 * ID pemain: user id kalau ada sesi, kalau tidak → guest id.
 * Disimpan di sessionStorage (per-tab) supaya 2 tab di browser yang
 * sama dihitung 2 pemain berbeda — dan tetap survive refresh.
 */
export function getMeId(userId: string | null | undefined): string {
  if (userId) return userId;
  if (typeof window === "undefined") return "g-ssr";
  const gen = () => `g-${randomCode(8)}`;
  try {
    let id = window.sessionStorage.getItem(LS_GUEST) || window.localStorage.getItem(LS_GUEST);
    if (!id) {
      id = gen();
      try {
        window.sessionStorage.setItem(LS_GUEST, id);
      } catch {
        window.localStorage.setItem(LS_GUEST, id);
      }
    }
    return id;
  } catch {
    return gen();
  }
}

/** Kuis demo bawaan — dipakai kalau Supabase off / set gagal dimuat (mode solo). */
export const DEMO_QUESTIONS: QuizQuestion[] = [
  {
    q: "Ibu kota Indonesia adalah…",
    options: ["Bandung", "Jakarta", "Surabaya", "Medan"],
    answer: 1,
    explain: "Jakarta adalah ibu kota dan pusat pemerintahan Indonesia.",
  },
  {
    q: "Planet yang dijuluki 'Planet Merah' adalah…",
    options: ["Venus", "Jupiter", "Mars", "Saturnus"],
    answer: 2,
    explain: "Mars tampak kemerahan karena kandungan besi oksida di permukaannya.",
  },
  {
    q: "Hasil dari 12 × 8 adalah…",
    options: ["86", "92", "96", "108"],
    answer: 2,
    explain: "12 × 8 = 96 — ingat: 12 × 8 = 12 × 10 − 12 × 2.",
  },
  {
    q: "Hewan darat tercepat di dunia adalah…",
    options: ["Singa", "Kuda", "Antelop", "Cheetah"],
    answer: 3,
    explain: "Cheetah bisa berlari hingga ±110 km/jam dalam jarak pendek.",
  },
  {
    q: "Bahasa pemrograman utama untuk membangun aplikasi web FocusSpace 2.0 adalah…",
    options: ["TypeScript", "PHP", "Pascal", "Fortran"],
    answer: 0,
    explain: "FocusSpace 2.0 dibangun dengan Next.js + TypeScript strict.",
  },
];

export function buildDemoSet(): QuizSetDTO {
  return {
    id: "demo",
    host_id: null,
    host_name: "Kazu ☕",
    title: "Kuis Demo Cozy",
    topic: "Pengetahuan Umum",
    emoji: "🍩",
    questions: DEMO_QUESTIONS,
    is_public: true,
    plays: 0,
    created_at: new Date(0).toISOString(),
  };
}

/** Kumpulan jawaban per soal → statistik podium. */
export type QuizStats = {
  totalCorrect: number;
  totalAnswers: number;
  hardest: { q: string; pct: number } | null;
};

export function computeStats(
  questions: QuizQuestion[],
  heard: Map<number, Map<string, PlayerAnswer>>
): QuizStats {
  let totalCorrect = 0;
  let totalAnswers = 0;
  let hardest: { q: string; pct: number } | null = null;

  questions.forEach((question, idx) => {
    const picks = heard.get(idx);
    if (!picks || picks.size === 0) return;
    let correct = 0;
    picks.forEach((a) => {
      totalAnswers += 1;
      if (a.picked === question.answer) {
        correct += 1;
        totalCorrect += 1;
      }
    });
    const pct = correct / picks.size;
    if (!hardest || pct < hardest.pct) hardest = { q: question.q, pct };
  });

  return { totalCorrect, totalAnswers, hardest };
}

/** qIdx → daftar nama pemain yang benar (untuk review). */
export function rightNamesFor(
  qIdx: number,
  questions: QuizQuestion[],
  heard: Map<number, Map<string, PlayerAnswer>>,
  players: QuizPlayerState[]
): string[] {
  const question = questions[qIdx];
  if (!question) return [];
  const picks = heard.get(qIdx);
  if (!picks) return [];
  const nameOf = new Map(players.map((p) => [p.id, p.name]));
  const names: string[] = [];
  picks.forEach((a, id) => {
    if (a.picked === question.answer) names.push(nameOf.get(id) || "Pemain");
  });
  return names;
}
