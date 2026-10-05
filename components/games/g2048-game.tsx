"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, LayoutGrid, RotateCcw, Undo2, Trophy, Flame, Target,
  CheckCircle2, ArrowUp, ArrowDown, ArrowLeft as ArrowL, ArrowRight as ArrowR,
  PartyPopper, Frown,
} from "lucide-react";
import {
  dailySeed, completeDaily, getStreak, isDailyDone, getBest, setBest, saveGameScore,
} from "@/lib/games/daily";
import { todayStr } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { playSound } from "@/components/ui/sfx";
import { useConfetti } from "@/components/ui/confetti";

const SIZE = 4;
const CELL = 70;
const GAP = 8;
const BOARD = SIZE * CELL + (SIZE + 1) * GAP;

type Dir = "up" | "down" | "left" | "right";
type Tile = { id: number; value: number; row: number; col: number; isNew: boolean; merged: boolean };

const TILE_COLOR: Record<number, { bg: string; fg: string }> = {
  2: { bg: "var(--warm-white)", fg: "var(--text-main)" },
  4: { bg: "var(--peach)", fg: "var(--text-main)" },
  8: { bg: "var(--peach-dark)", fg: "#fff" },
  16: { bg: "var(--yellow)", fg: "var(--text-main)" },
  32: { bg: "var(--yellow-dark)", fg: "var(--text-main)" },
  64: { bg: "var(--accent)", fg: "#fff" },
  128: { bg: "var(--pink)", fg: "var(--text-main)" },
  256: { bg: "var(--blue)", fg: "var(--text-main)" },
  512: { bg: "var(--green)", fg: "#fff" },
  1024: { bg: "var(--accent-deep)", fg: "#fff" },
  2048: { bg: "var(--brown)", fg: "#fff" },
};

function emptyPositions(tiles: Tile[]): number[] {
  const occ = new Set(tiles.map((t) => t.row * SIZE + t.col));
  const out: number[] = [];
  for (let i = 0; i < SIZE * SIZE; i++) if (!occ.has(i)) out.push(i);
  return out;
}

function spawn(tiles: Tile[], id: number): Tile[] {
  const empty = emptyPositions(tiles);
  if (empty.length === 0) return tiles;
  const pos = empty[Math.floor(Math.random() * empty.length)];
  return [...tiles, { id, value: Math.random() < 0.9 ? 2 : 4, row: Math.floor(pos / SIZE), col: pos % SIZE, isNew: true, merged: false }];
}

function slide(tiles: Tile[], dir: Dir): { tiles: Tile[]; moved: boolean; gained: number; maxV: number } {
  const grid: (Tile | null)[][] = Array.from({ length: SIZE }, () => Array<Tile | null>(SIZE).fill(null));
  tiles.forEach((t) => {
    grid[t.row][t.col] = { ...t, isNew: false, merged: false };
  });

  const next: Tile[] = [];
  let moved = false;
  let gained = 0;
  let maxV = 0;

  for (let line = 0; line < SIZE; line++) {
    const seq: Tile[] = [];
    for (let i = 0; i < SIZE; i++) {
      let r: number, c: number;
      if (dir === "left") { r = line; c = i; }
      else if (dir === "right") { r = line; c = SIZE - 1 - i; }
      else if (dir === "up") { r = i; c = line; }
      else { r = SIZE - 1 - i; c = line; }
      const t = grid[r][c];
      if (t) seq.push(t);
    }

    const out: Tile[] = [];
    let i = 0;
    while (i < seq.length) {
      if (i + 1 < seq.length && seq[i].value === seq[i + 1].value) {
        const merged = { ...seq[i], value: seq[i].value * 2, merged: true };
        gained += merged.value;
        out.push(merged);
        i += 2;
      } else {
        out.push({ ...seq[i] });
        i++;
      }
    }

    out.forEach((t, pos) => {
      let r: number, c: number;
      if (dir === "left") { r = line; c = pos; }
      else if (dir === "right") { r = line; c = SIZE - 1 - pos; }
      else if (dir === "up") { r = pos; c = line; }
      else { r = SIZE - 1 - pos; c = line; }
      if (t.row !== r || t.col !== c || t.merged) moved = true;
      t.row = r;
      t.col = c;
      maxV = Math.max(maxV, t.value);
      next.push(t);
    });
  }

  return { tiles: next, moved, gained, maxV };
}

function isGameOver(tiles: Tile[]): boolean {
  if (emptyPositions(tiles).length > 0) return false;
  const grid: number[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  tiles.forEach((t) => {
    grid[t.row][t.col] = t.value;
  });
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (c + 1 < SIZE && grid[r][c] === grid[r][c + 1]) return false;
      if (r + 1 < SIZE && grid[r][c] === grid[r + 1][c]) return false;
    }
  return true;
}

export default function Game2048() {
  const { toast } = useToast();
  const confetti = useConfetti();

  const [tiles, setTiles] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [best, setBestScore] = useState(0);
  const [won, setWon] = useState(false);
  const [over, setOver] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [dailyDone, setDailyDone] = useState(false);
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [ready, setReady] = useState(false);

  const idRef = useRef(1);
  const undoRef = useRef<{ tiles: Tile[]; score: number } | null>(null);
  const dailyHit = useRef(false);
  const wonRef = useRef(false);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const target = useMemo(() => 512 + (dailySeed(todayStr()) % 3) * 512, []);

  const newGame = useCallback(() => {
    idRef.current = 1;
    undoRef.current = null;
    dailyHit.current = false;
    wonRef.current = false;
    let t: Tile[] = [];
    t = spawn(t, idRef.current++);
    t = spawn(t, idRef.current++);
    setTiles(t);
    setScore(0);
    setWon(false);
    setOver(false);
    setCanUndo(false);
    playSound("click");
  }, []);

  useEffect(() => {
    setBestScore(getBest("g2048") ?? 0);
    setStreak(getStreak("g2048"));
    setDailyDone(isDailyDone("g2048"));
    newGame();
    setReady(true);
  }, [newGame]);

  const doMove = useCallback(
    (dir: Dir) => {
      if (over) return;
      const snap = { tiles: tiles.map((t) => ({ ...t })), score };
      const res = slide(tiles, dir);
      if (!res.moved) return;

      playSound("click");
      undoRef.current = snap;
      setCanUndo(true);

      const newScore = score + res.gained;
      setScore(newScore);
      if (newScore > best) {
        setBestScore(newScore);
        setBest("g2048", newScore);
      }

      let next = res.tiles;
      next = spawn(next, idRef.current++);
      setTiles(next);

      if (res.maxV >= 2048 && !wonRef.current) {
        wonRef.current = true;
        setWon(true);
        confetti({ big: true });
        playSound("success");
      }

      if (dailyHit.current === false && res.maxV >= target) {
        dailyHit.current = true;
        completeDaily("g2048", true);
        setDailyDone(true);
        setStreak(getStreak("g2048"));
        toast("success", `Target harian ${target} tercapai! Streak aman`);
        confetti({});
      }

      if (isGameOver(next)) {
        setOver(true);
        playSound("wrong");
        void saveGameScore("g2048", newScore, wonRef.current, { maxTile: res.maxV });
        if (!dailyHit.current) {
          dailyHit.current = true;
          completeDaily("g2048", res.maxV >= target);
          setDailyDone(true);
          setStreak(getStreak("g2048"));
        }
      }
    },
    [best, confetti, over, score, target, tiles, toast]
  );

  const undo = useCallback(() => {
    if (!canUndo || !undoRef.current) return;
    setTiles(undoRef.current.tiles);
    setScore(undoRef.current.score);
    undoRef.current = null;
    setCanUndo(false);
    setOver(false);
    playSound("click");
  }, [canUndo]);

  // keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const map: Record<string, Dir> = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
        w: "up", s: "down", a: "left", d: "right",
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        doMove(dir);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [doMove]);

  // swipe
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const st = touchRef.current;
      if (!st) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - st.x;
      const dy = t.clientY - st.y;
      touchRef.current = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
      if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? "right" : "left");
      else doMove(dy > 0 ? "down" : "up");
    },
    [doMove]
  );

  const DIRS: Array<{ dir: Dir; Icon: typeof ArrowUp }> = [
    { dir: "up", Icon: ArrowUp },
    { dir: "left", Icon: ArrowL },
    { dir: "down", Icon: ArrowDown },
    { dir: "right", Icon: ArrowR },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/games" className="btn-secondary">
          <ArrowLeft size={16} strokeWidth={2.5} /> Semua Games
        </Link>
        <div className="flex items-center gap-2">
          <span className="badge-emoji">
            <LayoutGrid size={19} strokeWidth={2.5} className="text-[var(--yellow-dark)]" />
          </span>
          <div>
            <h1 className="font-head text-[20px] font-bold leading-none">2048</h1>
            <p className="text-[11px] font-semibold text-[var(--text-muted)]">Gabungkan angka, kejar 2048</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="chip !gap-1.5">
            <Flame size={13} strokeWidth={2.5} className="text-[var(--orange-deep)]" /> {streak.current} hari
          </span>
          <span className="chip !gap-1.5">
            <Trophy size={13} strokeWidth={2.5} className="text-[var(--yellow-dark)]" /> {best}
          </span>
        </div>
      </div>

      {/* kontrol */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="chip !gap-1.5">
          <Target size={13} strokeWidth={2.5} className="text-[var(--accent-deep)]" /> Target harian: {target}
        </span>
        {dailyDone && (
          <span className="chip !bg-[var(--green)] !text-white !gap-1.5">
            <CheckCircle2 size={13} strokeWidth={2.5} /> Harian selesai
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="card !py-1.5 !px-3 text-center">
            <p className="text-[9px] font-bold text-[var(--text-muted)] leading-none">SKOR</p>
            <p className="font-head text-[17px] font-bold leading-tight">{score}</p>
          </div>
          <div className="card !py-1.5 !px-3 text-center">
            <p className="text-[9px] font-bold text-[var(--text-muted)] leading-none">TERBAIK</p>
            <p className="font-head text-[17px] font-bold leading-tight">{best}</p>
          </div>
        </div>
      </div>

      {/* papan */}
      <div
        className="relative mx-auto rounded-[16px]"
        style={{
          width: BOARD,
          height: BOARD,
          background: "var(--peach)",
          border: "2.5px solid var(--card-border)",
          boxShadow: "var(--shadow-md)",
          touchAction: "none",
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* sel latar */}
        {Array.from({ length: SIZE * SIZE }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-[8px]"
            style={{
              width: CELL,
              height: CELL,
              left: GAP + (i % SIZE) * (CELL + GAP),
              top: GAP + Math.floor(i / SIZE) * (CELL + GAP),
              background: "var(--warm-white)",
              opacity: 0.65,
            }}
          />
        ))}

        {/* tile */}
        {tiles.map((t) => {
          const col = TILE_COLOR[t.value] ?? { bg: "var(--tan)", fg: "#fff" };
          const fontSize = t.value >= 1024 ? 20 : t.value >= 128 ? 25 : 30;
          return (
            <motion.div
              key={t.id}
              className="absolute flex items-center justify-center rounded-[8px] font-head font-bold"
              style={{
                width: CELL,
                height: CELL,
                left: 0,
                top: 0,
                background: col.bg,
                color: col.fg,
                border: "2px solid var(--card-border)",
                zIndex: t.merged ? 2 : 1,
              }}
              initial={t.isNew ? { scale: 0, x: GAP + t.col * (CELL + GAP), y: GAP + t.row * (CELL + GAP) } : false}
              animate={{
                x: GAP + t.col * (CELL + GAP),
                y: GAP + t.row * (CELL + GAP),
                scale: t.merged ? [1, 1.16, 1] : 1,
              }}
              transition={{ duration: 0.13, ease: "easeOut" }}
            >
              <span style={{ fontSize }}>{t.value}</span>
            </motion.div>
          );
        })}

        {/* overlay menang / game over */}
        {(won || over) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 rounded-[14px]"
            style={{ background: "rgba(44,26,14,0.72)", backdropFilter: "blur(3px)" }}
          >
            <span className="badge-emoji !w-[58px] !h-[58px] !rounded-full">
              {won ? (
                <PartyPopper size={27} strokeWidth={2.5} className="text-[var(--green-dark)]" />
              ) : (
                <Frown size={27} strokeWidth={2.5} className="text-[var(--red-dark)]" />
              )}
            </span>
            <h3 className="font-head text-[22px] font-bold text-[var(--cream)]">
              {won ? "2048 tercapai!" : "Papan penuh"}
            </h3>
            <p className="text-[13px] font-semibold text-[var(--peach)]">Skor: {score}</p>
            <div className="flex gap-2 mt-1">
              {won && (
                <button className="btn-primary !py-2" onClick={() => setWon(false)}>
                  Lanjut Main
                </button>
              )}
              <button className="btn-yellow !py-2" onClick={newGame}>
                <RotateCcw size={15} strokeWidth={2.5} /> Mulai Baru
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* tombol arah (mobile) */}
      <div className="flex items-center justify-center gap-2 sm:hidden">
        {DIRS.map(({ dir, Icon }) => (
          <button key={dir} className="btn-ctrl" onClick={() => doMove(dir)} aria-label={`Geser ${dir}`}>
            <Icon size={18} strokeWidth={2.5} />
          </button>
        ))}
      </div>

      {/* bawah */}
      <div className="flex items-center justify-center gap-2">
        <button className="btn-secondary" onClick={undo} disabled={!canUndo}>
          <Undo2 size={15} strokeWidth={2.5} /> Undo
        </button>
        <button className="btn-primary" onClick={newGame}>
          <RotateCcw size={15} strokeWidth={2.5} /> Papan Baru
        </button>
      </div>

      <p className="text-center text-[11px] font-semibold text-[var(--text-muted)]">
        {ready ? "Geser dengan panah keyboard atau swipe di layar sentuh — undo tersedia 1x per papan" : "Menyiapkan papan…"}
      </p>
    </div>
  );
}
