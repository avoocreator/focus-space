"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, Type, Flame, Trophy, Target, CheckCircle2, BarChart3,
  Copy, CornerDownLeft, Delete, RotateCcw, RefreshCw, X, Frown, PartyPopper,
} from "lucide-react";
import { WORDS, WORD_SET } from "@/lib/games/words-id";
import { dailySeed, completeDaily, getStreak, isDailyDone, saveGameScore } from "@/lib/games/daily";
import { todayStr, cn } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { playSound } from "@/components/ui/sfx";
import { useConfetti } from "@/components/ui/confetti";
import { Modal } from "@/components/ui/modal";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

const WORD_LEN = 5;
const MAX_GUESSES = 6;
const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ENTERZXCVBNM"];

type LetterState = "correct" | "present" | "absent";
type Mode = "daily" | "free";

type WordleStats = { played: number; wins: number; curStreak: number; maxStreak: number; dist: number[] };

const STATS_KEY = "fs_wordle_stats";

function loadStats(): WordleStats {
  try {
    const s = JSON.parse(localStorage.getItem(STATS_KEY) || "null") as WordleStats | null;
    if (s && Array.isArray(s.dist)) return s;
  } catch {}
  return { played: 0, wins: 0, curStreak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0] };
}

function pickDailyAnswer(): string {
  return WORDS[dailySeed(todayStr()) % WORDS.length];
}

function epochDay(): number {
  return Math.floor(Date.now() / 86400000);
}

/** Pewarnaan 2-pass supaya huruf duplikat akurat. */
function grade(guess: string, answer: string): (LetterState | null)[] {
  const res: (LetterState | null)[] = Array(WORD_LEN).fill(null);
  const pool: Record<string, number> = {};
  for (let i = 0; i < WORD_LEN; i++) {
    if (guess[i] === answer[i]) res[i] = "correct";
    else pool[answer[i]] = (pool[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < WORD_LEN; i++) {
    if (res[i]) continue;
    const c = guess[i];
    if (pool[c] > 0) {
      res[i] = "present";
      pool[c]--;
    } else res[i] = "absent";
  }
  return res;
}

const STATE_BG: Record<LetterState, string> = {
  correct: "var(--green)",
  present: "var(--yellow)",
  absent: "rgba(44,26,14,0.35)",
};

export default function WordleGame() {
  const { toast } = useToast();
  const confetti = useConfetti();

  const [mode, setMode] = useState<Mode>("daily");
  const [answer, setAnswer] = useState<string>(() => pickDailyAnswer());
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [keyStates, setKeyStates] = useState<Record<string, LetterState>>({});
  const [shakeRow, setShakeRow] = useState(false);
  const [lastSubmitted, setLastSubmitted] = useState(-1);
  const [stats, setStats] = useState<WordleStats>({ played: 0, wins: 0, curStreak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0] });
  const [statsOpen, setStatsOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [dailyDone, setDailyDone] = useState(false);
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const recorded = useRef(false);

  // init setelah mount (localStorage + daily state)
  useEffect(() => {
    setStats(loadStats());
    setStreak(getStreak("wordle"));
    setDailyDone(isDailyDone("wordle"));
  }, []);

  const newFreeGame = useCallback(() => {
    setAnswer(WORDS[Math.floor(Math.random() * WORDS.length)]);
    setGuesses([]);
    setCurrent("");
    setStatus("playing");
    setKeyStates({});
    setLastSubmitted(-1);
    setEndOpen(false);
    recorded.current = false;
    playSound("click");
  }, []);

  const backToDaily = useCallback(() => {
    setMode("daily");
    setAnswer(pickDailyAnswer());
    setGuesses([]);
    setCurrent("");
    setStatus("playing");
    setKeyStates({});
    setLastSubmitted(-1);
    setEndOpen(false);
    recorded.current = false;
    playSound("click");
  }, []);

  const switchMode = useCallback(
    (m: Mode) => {
      playSound("click");
      if (m === "daily") backToDaily();
      else {
        setMode("free");
        newFreeGame();
      }
    },
    [backToDaily, newFreeGame]
  );

  const finishGame = useCallback(
    async (won: boolean, attempt: number) => {
      setStatus(won ? "won" : "lost");
      setEndOpen(true);
      if (won) {
        confetti({ big: true });
        playSound("success");
      } else playSound("wrong");

      const s = loadStats();
      s.played++;
      if (won) {
        s.wins++;
        s.curStreak++;
        s.maxStreak = Math.max(s.maxStreak, s.curStreak);
        s.dist[attempt - 1]++;
      } else s.curStreak = 0;
      try {
        localStorage.setItem(STATS_KEY, JSON.stringify(s));
      } catch {}
      setStats(s);

      if (mode === "daily" && !recorded.current) {
        recorded.current = true;
        completeDaily("wordle", won);
        setDailyDone(true);
        setStreak(getStreak("wordle"));
        void saveGameScore("wordle", attempt, won, { word: answer });
      }
    },
    [answer, confetti, mode]
  );

  const submit = useCallback(() => {
    if (status !== "playing") return;
    const g = current.toLowerCase();
    if (g.length < WORD_LEN) {
      toast("info", `Hurufnya kurang — butuh ${WORD_LEN} huruf`);
      return;
    }
    if (!WORD_SET.has(g)) {
      setShakeRow(true);
      setTimeout(() => setShakeRow(false), 450);
      playSound("wrong");
      toast("info", "Kata tidak ada di kamus");
      return;
    }
    const next = [...guesses, g];
    setGuesses(next);
    setCurrent("");
    setLastSubmitted(next.length - 1);
    playSound("click");

    // update warna keyboard
    const grades = grade(g, answer);
    setKeyStates((ks) => {
      const copy = { ...ks };
      for (let i = 0; i < WORD_LEN; i++) {
        const c = g[i];
        const st = grades[i] as LetterState;
        if (st === "correct" || copy[c] === undefined || (st === "present" && copy[c] === "absent")) copy[c] = st;
      }
      return copy;
    });

    if (g === answer) void finishGame(true, next.length);
    else if (next.length >= MAX_GUESSES) void finishGame(false, next.length);
  }, [answer, current, finishGame, guesses, status, toast]);

  const typeLetter = useCallback(
    (c: string) => {
      if (status !== "playing") return;
      setCurrent((cur) => (cur.length < WORD_LEN ? cur + c.toLowerCase() : cur));
    },
    [status]
  );

  const backspace = useCallback(() => {
    if (status !== "playing") return;
    setCurrent((cur) => cur.slice(0, -1));
  }, [status]);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Enter") submit();
      else if (e.key === "Backspace") backspace();
      else if (/^[a-zA-Z]$/.test(e.key)) typeLetter(e.key);
    },
    [submit, backspace, typeLetter]
  );

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  const shareText = useMemo(() => {
    const grid = guesses
      .map((g) => {
        const grades = grade(g, answer);
        return grades.map((s) => (s === "correct" ? "\u{1F7E9}" : s === "present" ? "\u{1F7E8}" : "\u2B1B")).join("");
      })
      .join("\n");
    const title = mode === "daily" ? `FocusSpace Wordle #${epochDay()}` : "FocusSpace Wordle (Latihan)";
    const score = status === "won" ? `${guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
    return `${title} ${score}\n\n${grid}`;
  }, [guesses, answer, mode, status]);

  const copyShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast("success", "Hasil tersalin ke clipboard");
    } catch {
      toast("error", "Gagal menyalin — coba lagi");
    }
  }, [shareText, toast]);

  const winPct = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;
  const maxDist = Math.max(1, ...stats.dist);

  return (
    <div className="flex flex-col gap-4">
      {/* header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/games" className="btn-secondary">
          <ArrowLeft size={16} strokeWidth={2.5} /> Semua Games
        </Link>
        <div className="flex items-center gap-2">
          <span className="badge-emoji">
            <Type size={19} strokeWidth={2.5} className="text-[var(--green-dark)]" />
          </span>
          <div>
            <h1 className="font-head text-[20px] font-bold leading-none">Wordle Indonesia</h1>
            <p className="text-[11px] font-semibold text-[var(--text-muted)]">Tebak kata 5 huruf dalam 6 percobaan</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="chip !gap-1.5">
            <Flame size={13} strokeWidth={2.5} className="text-[var(--orange-deep)]" /> {streak.current} hari
          </span>
          <span className="chip !gap-1.5">
            <Trophy size={13} strokeWidth={2.5} className="text-[var(--yellow-dark)]" /> {streak.best}
          </span>
          <button className="btn-header-icon" onClick={() => setStatsOpen(true)} title="Statistik">
            <BarChart3 size={17} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* mode + daily status */}
      <div className="flex items-center gap-2 flex-wrap">
        <button className={`chip chip-click ${mode === "daily" ? "chip-active" : ""}`} onClick={() => switchMode("daily")}>
          <Target size={14} strokeWidth={2.5} /> Tantangan Harian
        </button>
        <button className={`chip chip-click ${mode === "free" ? "chip-active" : ""}`} onClick={() => switchMode("free")}>
          <RefreshCw size={14} strokeWidth={2.5} /> Latihan Bebas
        </button>
        {mode === "daily" && (dailyDone || status !== "playing") && (
          <span className="chip !bg-[var(--green)] !text-white !gap-1.5">
            <CheckCircle2 size={13} strokeWidth={2.5} /> Harian selesai
          </span>
        )}
        {mode === "free" && status === "playing" && (
          <button className="chip chip-click" onClick={newFreeGame} title="Ganti kata">
            <RotateCcw size={13} strokeWidth={2.5} /> Ganti Kata
          </button>
        )}
      </div>

      {/* papan */}
      <div className="card !py-5 flex flex-col items-center gap-1.5 mx-auto w-full max-w-[380px]">
        {Array.from({ length: MAX_GUESSES }).map((_, r) => {
          const isCurrent = r === guesses.length && status === "playing";
          const guess = guesses[r] ?? (isCurrent ? current.toLowerCase().padEnd(WORD_LEN) : "");
          const submitted = r < guesses.length;
          const grades = submitted ? grade(guesses[r], answer) : null;
          const animate = submitted && r === lastSubmitted;
          return (
            <motion.div
              key={r}
              className="flex gap-1.5"
              animate={r === guesses.length && shakeRow ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
              transition={{ duration: 0.4 }}
            >
              {Array.from({ length: WORD_LEN }).map((__, c) => {
                const letter = guess[c] ?? "";
                const st = grades?.[c];
                const filled = letter !== "";
                return (
                  <motion.div
                    key={`${r}-${c}-${animate ? "v" : "s"}`}
                    initial={animate ? { rotateX: 90, opacity: 0 } : false}
                    animate={animate ? { rotateX: 0, opacity: 1 } : { scale: filled && !submitted ? 1.04 : 1 }}
                    transition={animate ? { delay: c * 0.12, duration: 0.25 } : { duration: 0.08 }}
                    className="flex items-center justify-center font-head text-[22px] font-bold uppercase rounded-[10px]"
                    style={{
                      width: 58,
                      height: 58,
                      background: st ? STATE_BG[st] : "var(--warm-white)",
                      border: `2.5px solid ${st ? "var(--card-border)" : filled ? "var(--peach-dark)" : "rgba(44,26,14,0.18)"}`,
                      borderStyle: st || filled ? "solid" : "dashed",
                      color: st ? "#fff" : "var(--text-main)",
                      boxShadow: st ? "var(--shadow-sm)" : "none",
                    }}
                  >
                    {letter}
                  </motion.div>
                );
              })}
            </motion.div>
          );
        })}
      </div>

      {/* keyboard */}
      <div className="flex flex-col items-center gap-1.5 mx-auto w-full max-w-[480px]">
        {ROWS.map((row, ri) => (
          <div key={ri} className="flex gap-1 w-full justify-center">
            {ri === 1 && <div className="w-[12px]" />}
            {row.split("").map((c) => {
              if (c === "ENTER") {
                return (
                  <button key={c} className="key-btn !bg-[var(--green)] !text-white !w-[68px]" onClick={submit}>
                    <CornerDownLeft size={17} strokeWidth={2.5} />
                  </button>
                );
              }
              const st = keyStates[c.toLowerCase()];
              return (
                <button
                  key={c}
                  className="key-btn"
                  style={{
                    background: st ? STATE_BG[st] : "var(--peach)",
                    color: st ? "#fff" : "var(--text-main)",
                  }}
                  onClick={() => typeLetter(c)}
                >
                  {c}
                </button>
              );
            })}
            {ri === 1 && <div className="w-[12px]" />}
            {ri === 2 && (
              <button className="key-btn !w-[52px]" onClick={backspace}>
                <Delete size={17} strokeWidth={2.5} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* modal statistik */}
      <Modal open={statsOpen} onClose={() => setStatsOpen(false)} title="Statistik Wordle">
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { v: stats.played, l: "Dimainkan" },
            { v: `${winPct}%`, l: "Menang" },
            { v: stats.curStreak, l: "Streak" },
            { v: stats.maxStreak, l: "Terbaik" },
          ].map((s) => (
            <div key={s.l} className="text-center rounded-[12px] py-2" style={{ background: "var(--warm-white)", border: "2px solid var(--card-border)" }}>
              <p className="font-head text-[20px] font-bold leading-none">{s.v}</p>
              <p className="text-[9.5px] font-bold text-[var(--text-muted)]">{s.l}</p>
            </div>
          ))}
        </div>
        <p className="micro-title mb-1.5">Distribusi Tebakan</p>
        <div className="flex flex-col gap-1">
          {stats.dist.map((n, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[11px] font-bold w-3">{i + 1}</span>
              <div
                className="h-5 rounded-[6px] flex items-center justify-end px-1.5 text-[10px] font-bold text-white"
                style={{ width: `${Math.max(9, (n / maxDist) * 100)}%`, background: "var(--green)" }}
              >
                {n}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* modal selesai */}
      <Modal open={endOpen} onClose={() => setEndOpen(false)} maxWidth={360}>
        <div className="text-center">
          <span className="badge-emoji !w-[60px] !h-[60px] !rounded-full mx-auto mb-2">
            {status === "won" ? (
              <PartyPopper size={28} strokeWidth={2.5} className="text-[var(--green-dark)]" />
            ) : (
              <Frown size={28} strokeWidth={2.5} className="text-[var(--red-dark)]" />
            )}
          </span>
          <h3 className="font-head text-[20px] font-bold">
            {status === "won" ? "Tepat sekali!" : "Yah, belum dapat"}
          </h3>
          <p className="text-[13px] font-semibold text-[var(--text-muted)] mt-1 mb-1">
            {status === "won" ? `Ketemu dalam ${guesses.length} percobaan` : "Kata hari ini:"}{" "}
            <b className="text-[var(--accent-deep)] uppercase">{answer}</b>
          </p>
          <div className="text-[18px] tracking-widest my-2 leading-relaxed">
            {guesses.map((g, r) => (
              <div key={r}>
                {grade(g, answer).map((s, c) => (
                  <span key={c}>{s === "correct" ? "\u{1F7E9}" : s === "present" ? "\u{1F7E8}" : "\u2B1B"}</span>
                ))}
              </div>
            ))}
          </div>
          <div className="modal-actions justify-center">
            <button className="btn-secondary" onClick={copyShare}>
              <Copy size={15} strokeWidth={2.5} /> Salin Hasil
            </button>
            {mode === "free" ? (
              <button className="btn-primary" onClick={newFreeGame}>
                <RefreshCw size={15} strokeWidth={2.5} /> Kata Baru
              </button>
            ) : (
              <button className="btn-primary" onClick={() => { setEndOpen(false); switchMode("free"); }}>
                Latihan Lagi
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
