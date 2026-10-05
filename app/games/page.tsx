"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Gamepad2, Type, Bomb, LayoutGrid, Flame, Trophy, Target,
  CheckCircle2, ArrowRight, Info,
} from "lucide-react";
import { getStreak, isDailyDone, getBest } from "@/lib/games/daily";
import { formatClock } from "@/lib/utils";

type GameMeta = {
  href: string;
  name: string;
  desc: string;
  Icon: typeof Type;
  color: string;
  best: (b: number | null) => string;
};

const GAMES: GameMeta[] = [
  {
    href: "/games/wordle",
    name: "Wordle Indonesia",
    desc: "Tebak kata 5 huruf dalam 6 percobaan",
    Icon: Type,
    color: "var(--green-dark)",
    best: (b) => (b && b > 0 ? `${b} tebakan` : "—"),
  },
  {
    href: "/games/minesweeper",
    name: "Minesweeper",
    desc: "Bersihkan papan tanpa menginjak ranjau",
    Icon: Bomb,
    color: "var(--red-dark)",
    best: (b) => (b && b > 0 ? formatClock(b) : "—"),
  },
  {
    href: "/games/g2048",
    name: "2048",
    desc: "Gabungkan angka, kejar 2048",
    Icon: LayoutGrid,
    color: "var(--yellow-dark)",
    best: (b) => (b && b > 0 ? `${b} poin` : "—"),
  },
];

export default function GamesHubPage() {
  const [mounted, setMounted] = useState(false);
  const [streaks, setStreaks] = useState<Record<string, { current: number; best: number }>>({});
  const [dailyDone, setDailyDone] = useState<Record<string, boolean>>({});
  const [bests, setBests] = useState<Record<string, number | null>>({});

  useEffect(() => {
    const s: Record<string, { current: number; best: number }> = {};
    const d: Record<string, boolean> = {};
    const b: Record<string, number | null> = {};
    for (const g of GAMES) {
      const key = g.href.replace("/games/", "") as "wordle" | "minesweeper" | "g2048";
      s[key] = getStreak(key);
      d[key] = isDailyDone(key);
      b[key] = getBest(key);
    }
    setStreaks(s);
    setDailyDone(d);
    setBests(b);
    setMounted(true);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-head text-[26px] font-bold flex items-center gap-2.5">
          <Gamepad2 size={28} strokeWidth={2.5} className="text-[var(--accent-deep)]" />
          Arcade Cozy
        </h1>
        <p className="text-[13px] font-semibold text-[var(--text-muted)] mt-0.5">
          Main santai sambil panen streak harian — tiap game punya tantangan yang sama untuk semua orang
        </p>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-3">
        {GAMES.map((g, i) => {
          const key = g.href.replace("/games/", "") as "wordle" | "minesweeper" | "g2048";
          const st = streaks[key] ?? { current: 0, best: 0 };
          const done = dailyDone[key];
          return (
            <motion.div
              key={g.href}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              whileHover={{ y: -4 }}
              className="card flex flex-col gap-2.5 card-hover"
            >
              <div className="flex items-start gap-3">
                <motion.span
                  className="badge-emoji !w-[48px] !h-[48px]"
                  animate={{ rotate: [0, -6, 6, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                >
                  <g.Icon size={24} strokeWidth={2.5} style={{ color: g.color }} />
                </motion.span>
                <div className="min-w-0">
                  <h2 className="font-head text-[16px] font-bold leading-tight">{g.name}</h2>
                  <p className="text-[11px] font-semibold text-[var(--text-muted)]">{g.desc}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className="chip !text-[10.5px] !gap-1">
                  <Flame size={12} strokeWidth={2.5} className="text-[var(--orange-deep)]" /> {st.current} hari
                </span>
                <span className="chip !text-[10.5px] !gap-1">
                  <Trophy size={12} strokeWidth={2.5} className="text-[var(--yellow-dark)]" /> {g.best(bests[key] ?? null)}
                </span>
              </div>

              <div className="mt-auto flex items-center gap-2">
                {done ? (
                  <span className="chip !bg-[var(--green)] !text-white !text-[10.5px] !gap-1">
                    <CheckCircle2 size={12} strokeWidth={2.5} /> Harian selesai
                  </span>
                ) : (
                  <span className="chip !bg-[var(--yellow)] !text-[10.5px] !gap-1">
                    <Target size={12} strokeWidth={2.5} /> Tantangan menanti
                  </span>
                )}
                <Link href={g.href} className="btn-primary !py-2 !px-3.5 !text-[13px] ml-auto">
                  Main <ArrowRight size={15} strokeWidth={2.5} />
                </Link>
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card">
        <div className="card-header">
          <Info size={19} strokeWidth={2.5} className="text-[var(--blue-dark)]" />
          <h2 className="card-title">Cara kerja streak</h2>
        </div>
        <p className="text-[13px] font-semibold leading-relaxed">
          Selesaikan <b>Tantangan Harian</b> di salah satu game setiap hari — puzzle harian sama untuk semua pemain
          (Wordle: kata harian, Minesweeper: papan harian, 2048: target skor harian). Streak bertambah kalau kamu
          hadir berturut-turut, dan tiap penyelesaian memberi XP untuk levelmu.
        </p>
      </motion.section>
    </div>
  );
}
