"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, Bomb, Flag, RotateCcw, Smile, Frown, Timer, Target,
  Trophy, Flame, CheckCircle2,
} from "lucide-react";
import { dailySeed, mulberry32, completeDaily, getStreak, isDailyDone, getBest, setBest, saveGameScore } from "@/lib/games/daily";
import { todayStr, formatClock, cn } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { playSound } from "@/components/ui/sfx";
import { useConfetti } from "@/components/ui/confetti";

type Diff = { key: string; label: string; w: number; h: number; mines: number; cell: number };
const DIFFS: Diff[] = [
  { key: "easy", label: "Mudah", w: 9, h: 9, mines: 10, cell: 34 },
  { key: "normal", label: "Normal", w: 16, h: 16, mines: 40, cell: 30 },
  { key: "hard", label: "Sulit", w: 30, h: 16, mines: 99, cell: 27 },
];

type Cell = { mine: boolean; adj: number; revealed: boolean; flagged: boolean; exploded?: boolean };
type Status = "idle" | "playing" | "won" | "lost";

function neighbors(i: number, w: number, h: number): number[] {
  const r = Math.floor(i / w);
  const c = i % w;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < h && nc >= 0 && nc < w) out.push(nr * w + nc);
    }
  return out;
}

/** Papan deterministik: posisi ranjau dari rng, klik pertama + tetangganya dijamin aman. */
function generate(w: number, h: number, mines: number, firstIdx: number, rng: () => number): Cell[] {
  const total = w * h;
  const cells: Cell[] = Array.from({ length: total }, () => ({ mine: false, adj: 0, revealed: false, flagged: false }));
  const protectedSet = new Set([firstIdx, ...neighbors(firstIdx, w, h)]);
  const candidates: number[] = [];
  for (let i = 0; i < total; i++) if (!protectedSet.has(i)) candidates.push(i);
  // Fisher-Yates dengan rng
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const n = Math.min(mines, candidates.length);
  for (let k = 0; k < n; k++) cells[candidates[k]].mine = true;
  for (let i = 0; i < total; i++) {
    if (cells[i].mine) continue;
    cells[i].adj = neighbors(i, w, h).filter((j) => cells[j].mine).length;
  }
  return cells;
}

const NUM_COLOR = ["", "#1976d2", "#388e3c", "#d32f2f", "#5c3317", "#8b5e3c", "#00838f", "#6a1b9a", "#880e4f"];

export default function MinesweeperGame() {
  const { toast } = useToast();
  const confetti = useConfetti();

  const [diff, setDiff] = useState<Diff>(DIFFS[0]);
  const [daily, setDaily] = useState(true);
  const [cells, setCells] = useState<Cell[]>(() => Array.from({ length: 81 }, () => ({ mine: false, adj: 0, revealed: false, flagged: false })));
  const [status, setStatus] = useState<Status>("idle");
  const [flagMode, setFlagMode] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dailyDone, setDailyDone] = useState(false);
  const [best, setBestState] = useState<number | null>(null);
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const startedAt = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPress = useRef<{ t: ReturnType<typeof setTimeout> | null; fired: boolean }>({ t: null, fired: false });
  const recorded = useRef(false);

  useEffect(() => {
    setStreak(getStreak("minesweeper"));
    setDailyDone(isDailyDone("minesweeper"));
  }, []);

  useEffect(() => {
    setBestState(getBest("minesweeper", diff.key));
  }, [diff.key]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(
    (d: Diff = diff) => {
      stopTimer();
      setCells(Array.from({ length: d.w * d.h }, () => ({ mine: false, adj: 0, revealed: false, flagged: false })));
      setStatus("idle");
      setElapsed(0);
      recorded.current = false;
    },
    [diff, stopTimer]
  );

  const changeDiff = useCallback(
    (d: Diff) => {
      playSound("click");
      setDiff(d);
      reset(d);
    },
    [reset]
  );

  const toggleDaily = useCallback(() => {
    playSound("click");
    setDaily((v) => !v);
    reset();
  }, [reset]);

  const finish = useCallback(
    (won: boolean, finalCells: Cell[], secs: number) => {
      stopTimer();
      setStatus(won ? "won" : "lost");
      if (won) {
        confetti({ big: true });
        playSound("success");
        setBest("minesweeper", secs, diff.key);
        setBestState(getBest("minesweeper", diff.key));
        if (daily && !recorded.current) {
          recorded.current = true;
          completeDaily("minesweeper", true);
          setDailyDone(true);
          setStreak(getStreak("minesweeper"));
        }
        void saveGameScore("minesweeper", secs, true, { difficulty: diff.key, daily });
        toast("success", `Bersih! Selesai dalam ${formatClock(secs)}`);
      } else {
        playSound("wrong");
        toast("info", "Boom! Coba lagi, hati-hati langkahmu");
      }
      // tampilkan semua ranjau saat kalah
      if (!won) {
        setCells(finalCells.map((c) => (c.mine ? { ...c, revealed: true } : c)));
      }
    },
    [confetti, daily, diff.key, stopTimer, toast]
  );

  const revealFrom = useCallback(
    (start: number, base: Cell[]) => {
      const total = diff.w * diff.h;
      const next = base.map((c) => ({ ...c }));
      const stack = [start];
      while (stack.length) {
        const i = stack.pop() as number;
        const c = next[i];
        if (c.revealed || c.flagged) continue;
        c.revealed = true;
        if (c.adj === 0 && !c.mine) {
          for (const j of neighbors(i, diff.w, diff.h)) {
            if (!next[j].revealed && !next[j].flagged && !next[j].mine) stack.push(j);
          }
        }
      }
      const revealedCount = next.filter((c) => c.revealed && !c.mine).length;
      setCells(next);
      if (revealedCount === total - diff.mines) {
        finish(true, next, Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)));
      }
    },
    [diff, finish]
  );

  const handleReveal = useCallback(
    (idx: number) => {
      if (status === "won" || status === "lost") return;
      const cell = cells[idx];
      if (cell.flagged) return;

      if (status === "idle") {
        // papan dibuat setelah klik pertama
        const rng = daily ? mulberry32(dailySeed(todayStr())) : Math.random;
        const board = generate(diff.w, diff.h, diff.mines, idx, rng);
        startedAt.current = Date.now();
        setStatus("playing");
        stopTimer();
        timerRef.current = setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)), 500);
        playSound("click");
        revealFrom(idx, board);
        return;
      }

      if (cell.mine) {
        playSound("wrong");
        const next = cells.map((c) => ({ ...c }));
        next[idx].exploded = true;
        finish(false, next, Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)));
        return;
      }
      playSound("click");
      revealFrom(idx, cells);
    },
    [cells, daily, diff, finish, revealFrom, status, stopTimer]
  );

  const toggleFlag = useCallback(
    (idx: number) => {
      if (status === "won" || status === "lost") return;
      setCells((cs) => {
        const next = cs.map((c) => ({ ...c }));
        if (next[idx].revealed) return cs;
        next[idx].flagged = !next[idx].flagged;
        playSound("check");
        return next;
      });
    },
    [status]
  );

  const onCellClick = useCallback(
    (idx: number) => {
      if (longPress.current.fired) {
        longPress.current.fired = false;
        return;
      }
      if (flagMode) toggleFlag(idx);
      else handleReveal(idx);
    },
    [flagMode, handleReveal, toggleFlag]
  );

  const flagsUsed = cells.filter((c) => c.flagged).length;
  const minesLeft = diff.mines - flagsUsed;
  const face = status === "lost" ? Frown : Smile;

  return (
    <div className="flex flex-col gap-4">
      {/* header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/games" className="btn-secondary">
          <ArrowLeft size={16} strokeWidth={2.5} /> Semua Games
        </Link>
        <div className="flex items-center gap-2">
          <span className="badge-emoji">
            <Bomb size={19} strokeWidth={2.5} className="text-[var(--red-dark)]" />
          </span>
          <div>
            <h1 className="font-head text-[20px] font-bold leading-none">Minesweeper</h1>
            <p className="text-[11px] font-semibold text-[var(--text-muted)]">Bersihkan papan tanpa menginjak ranjau</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="chip !gap-1.5">
            <Flame size={13} strokeWidth={2.5} className="text-[var(--orange-deep)]" /> {streak.current} hari
          </span>
          <span className="chip !gap-1.5">
            <Trophy size={13} strokeWidth={2.5} className="text-[var(--yellow-dark)]" />
            {best !== null ? formatClock(best) : "—"}
          </span>
        </div>
      </div>

      {/* kontrol */}
      <div className="flex items-center gap-2 flex-wrap">
        {DIFFS.map((d) => (
          <button key={d.key} className={`chip chip-click ${diff.key === d.key ? "chip-active" : ""}`} onClick={() => changeDiff(d)}>
            {d.label} {d.w}×{d.h}·{d.mines}
          </button>
        ))}
        <button className={`chip chip-click ${daily ? "chip-active" : ""}`} onClick={toggleDaily}>
          <Target size={14} strokeWidth={2.5} /> Tantangan Harian
        </button>
        {daily && (dailyDone || status === "won") && (
          <span className="chip !bg-[var(--green)] !text-white !gap-1.5">
            <CheckCircle2 size={13} strokeWidth={2.5} /> Harian selesai
          </span>
        )}
      </div>

      {/* info bar */}
      <div className="card !py-2.5 !px-4 flex items-center gap-3 flex-wrap">
        <span className="chip !gap-1.5">
          <Bomb size={13} strokeWidth={2.5} /> {minesLeft}
        </span>
        <span className="chip !gap-1.5">
          <Timer size={13} strokeWidth={2.5} /> {formatClock(elapsed)}
        </span>
        <button
          className="btn-ctrl !w-9 !h-9 mx-auto"
          onClick={() => reset()}
          title="Papan baru"
          aria-label="Reset papan"
        >
          {status === "lost" ? <Frown size={17} strokeWidth={2.5} className="text-[var(--red-dark)]" /> : <Smile size={17} strokeWidth={2.5} className="text-[var(--green-dark)]" />}
        </button>
        <button
          className={`chip chip-click ${flagMode ? "chip-active" : ""}`}
          onClick={() => setFlagMode((v) => !v)}
          title="Mode bendera (untuk layar sentuh)"
        >
          <Flag size={13} strokeWidth={2.5} /> Mode Bendera
        </button>
        <span className="chip !gap-1.5 hidden sm:inline-flex">
          <RotateCcw size={13} strokeWidth={2.5} /> klik-kanan = bendera
        </span>
      </div>

      {/* papan */}
      <div className="card !p-3 overflow-x-auto mx-auto">
        <motion.div
          className="grid mx-auto"
          style={{ gridTemplateColumns: `repeat(${diff.w}, ${diff.cell}px)`, width: diff.w * diff.cell }}
          animate={status === "lost" ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
          transition={{ duration: 0.45 }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {cells.map((c, i) => {
            const showMine = c.revealed && c.mine;
            return (
              <motion.button
                key={i}
                initial={false}
                animate={c.revealed ? { scale: [0.85, 1] } : { scale: 1 }}
                transition={{ duration: 0.12 }}
                className={cn("flex items-center justify-center font-head font-bold select-none", c.exploded && "!bg-[var(--red)]")}
                style={{
                  width: diff.cell,
                  height: diff.cell,
                  background: c.revealed ? (c.exploded ? "var(--red)" : "var(--warm-white)") : "var(--peach)",
                  border: "1.5px solid var(--card-border)",
                  borderRadius: 6,
                  boxShadow: c.revealed ? "none" : "1.5px 1.5px 0 var(--card-border)",
                  color: c.revealed && !c.mine ? NUM_COLOR[c.adj] : "var(--text-main)",
                  fontSize: diff.cell * 0.5,
                  cursor: c.revealed && !c.mine ? "default" : "pointer",
                }}
                onClick={() => onCellClick(i)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  toggleFlag(i);
                }}
                onTouchStart={() => {
                  longPress.current.fired = false;
                  longPress.current.t = setTimeout(() => {
                    longPress.current.fired = true;
                    toggleFlag(i);
                  }, 450);
                }}
                onTouchEnd={() => {
                  if (longPress.current.t) clearTimeout(longPress.current.t);
                }}
                onTouchMove={() => {
                  if (longPress.current.t) clearTimeout(longPress.current.t);
                }}
                aria-label={c.flagged ? "Cell bendera" : "Cell tertutup"}
              >
                {c.flagged && !c.revealed ? (
                  <Flag size={diff.cell * 0.5} strokeWidth={2.5} className="text-[var(--red-dark)]" />
                ) : showMine ? (
                  <Bomb size={diff.cell * 0.5} strokeWidth={2.5} className={c.exploded ? "text-white" : "text-[var(--text-main)]"} />
                ) : c.revealed && c.adj > 0 ? (
                  c.adj
                ) : null}
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      <p className="text-center text-[11px] font-semibold text-[var(--text-muted)]">
        {daily
          ? "Papan tantangan harian sama untuk semua orang — klik pertama selalu aman"
          : "Papan acak setiap permainan — klik pertama selalu aman"}
      </p>
    </div>
  );
}
