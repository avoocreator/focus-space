"use client";

// ═════════════════════════════════════════════════════════════
//  QuizPodium — layar hasil (finished).
//  Podium 3 tier (2-1-3, tinggi beda) + medal/crown, confetti
//  big 2x, leaderboard lengkap + akurasi, stat cepat kelas,
//  tombol Main Lagi (host/solo) · Review · Kembali ke Kafe.
// ═════════════════════════════════════════════════════════════

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Crown,
  Home,
  Medal,
  PartyPopper,
  RotateCcw,
  Target,
} from "lucide-react";
import { useConfetti } from "@/components/ui/confetti";
import { cn } from "@/lib/utils";
import type { QuizPlayerState } from "@/lib/types";
import { sortPlayers, type QuizStats } from "./quiz-shared";

type Props = {
  title: string;
  emoji: string;
  players: QuizPlayerState[];
  totalQuestions: number;
  meId: string;
  canRestart: boolean; // host / solo
  stats: QuizStats;
  onRestart: () => void;
  onReview: () => void;
  onHome: () => void;
};

const MEDALS = [
  <Medal key="gold" size={16} strokeWidth={2.5} style={{ color: "#d4a017" }} />,
  <Medal key="silver" size={16} strokeWidth={2.5} style={{ color: "#8f9aa6" }} />,
  <Medal key="bronze" size={16} strokeWidth={2.5} style={{ color: "#b0682c" }} />,
];
const HEIGHTS = [168, 116, 88]; // tinggi tier untuk posisi 2-1-3
const TIER_COLORS = ["var(--blue)", "var(--yellow)", "var(--peachdark)"];

export default function QuizPodium({
  title,
  emoji,
  players,
  totalQuestions,
  meId,
  canRestart,
  stats,
  onRestart,
  onReview,
  onHome,
}: Props) {
  const fireConfetti = useConfetti();
  const ranked = sortPlayers(players);
  const top3 = [ranked[1], ranked[0], ranked[2]].filter(Boolean) as QuizPlayerState[]; // 2-1-3

  // confetti big berulang 2x saat podium muncul
  useEffect(() => {
    fireConfetti({ big: true });
    const t = window.setTimeout(() => fireConfetti({ big: true }), 900);
    return () => window.clearTimeout(t);
  }, [fireConfetti]);

  return (
    <div className="w-full max-w-[860px] mx-auto flex flex-col gap-4 px-4 py-6 min-h-screen animate-slideUp">
      {/* header */}
      <div className="text-center">
        <motion.div
          className="text-[54px] leading-none"
          animate={{ rotate: [0, -6, 6, 0], scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        >
          {emoji}
        </motion.div>
        <h1 className="font-head text-[24px] sm:text-[28px] font-bold mt-1 inline-flex items-center gap-2">
          <PartyPopper size={24} strokeWidth={2.5} />
          Kuis Selesai!
        </h1>
        <p className="text-[12.5px] font-semibold text-[var(--text-muted)]">{title}</p>
      </div>

      {/* podium 2-1-3 */}
      <div className="flex items-end justify-center gap-3 sm:gap-5 pt-6">
        {top3.map((p, i) => {
          const place = i === 1 ? 0 : i === 0 ? 1 : 2; // 2-1-3 → rank 1,2,3
          const isChampion = place === 0;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 90, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.25 + place * 0.22 }}
              className={cn("flex flex-col items-center gap-2", isChampion ? "w-[132px] sm:w-[160px]" : "w-[104px] sm:w-[124px]")}
            >
              {isChampion && (
                <motion.div
                  className="leading-none text-[#d4a017]"
                  animate={{ y: [0, -8, 0], rotate: [-6, 6, -6] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                >
                  <Crown size={40} strokeWidth={2.5} />
                </motion.div>
              )}
              <div
                className={cn(
                  "badge-emoji",
                  isChampion ? "!w-[62px] !h-[62px] !text-[34px] animate-bouncy" : "!w-[48px] !h-[48px] !text-[26px]"
                )}
              >
                {p.avatar}
              </div>
              <div className="text-center max-w-full">
                <p className={cn("font-head font-bold leading-tight truncate inline-flex items-center gap-1", isChampion ? "text-[15px]" : "text-[12.5px]")}>
                  {MEDALS[place]}
                  {p.name}
                </p>
                <p className="font-head font-bold text-[16px] sm:text-[19px]" style={{ color: "var(--accent-deep)" }}>
                  {p.score}
                </p>
              </div>
              <div
                className="w-full rounded-t-[14px] flex items-start justify-center pt-2"
                style={{
                  height: HEIGHTS[place],
                  background: TIER_COLORS[place],
                  border: "2.5px solid var(--card-border)",
                  borderBottom: "none",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                <span className="font-head font-bold text-[26px]" style={{ color: "var(--text-main)" }}>
                  {place + 1}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {ranked.length > 3 && (
        <p className="text-center text-[11.5px] font-semibold text-[var(--text-muted)]">
          +{ranked.length - 3} pemain lain di papan skor lengkap di bawah
        </p>
      )}

      {/* stat cepat */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="card !p-3.5 text-center">
          <p className="micro-title">Jawaban Benar Kelas</p>
          <p className="font-head font-bold text-[20px] mt-0.5 inline-flex items-center justify-center gap-1" style={{ color: "var(--green-dark)" }}>
            <CheckCircle2 size={16} strokeWidth={2.5} />
            {stats.totalCorrect}
            <span className="text-[12px] text-[var(--text-muted)]">/{stats.totalAnswers}</span>
          </p>
        </div>
        <div className="card !p-3.5 text-center">
          <p className="micro-title">Akurasi Kelas</p>
          <p className="font-head font-bold text-[20px] mt-0.5 inline-flex items-center justify-center gap-1" style={{ color: "var(--blue-dark)" }}>
            <Target size={16} strokeWidth={2.5} />
            {stats.totalAnswers > 0 ? Math.round((stats.totalCorrect / stats.totalAnswers) * 100) : 0}%
          </p>
        </div>
        <div className="card !p-3.5 text-center col-span-2 sm:col-span-1">
          <p className="micro-title">Soal Tersulit</p>
          <p className="text-[11.5px] font-semibold mt-0.5 leading-snug line-clamp-2">
            {stats.hardest ? `${stats.hardest.q} (${Math.round(stats.hardest.pct * 100)}% benar)` : "—"}
          </p>
        </div>
      </div>

      {/* leaderboard lengkap */}
      <div className="card !p-3.5">
        <div className="card-header !mb-2.5">
          <span className="card-icon">
            <ClipboardList size={20} strokeWidth={2.5} />
          </span>
          <h3 className="card-title !text-[14px]">Papan Skor Lengkap</h3>
          <span className="chip !text-[10.5px]">{totalQuestions} soal</span>
        </div>
        <ol className="flex flex-col gap-1.5">
          {ranked.map((p, i) => (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + Math.min(i * 0.05, 0.5) }}
              className={cn(
                "flex items-center gap-2.5 rounded-[12px] px-3 py-2",
                p.id === meId && "!border-[var(--accent)]"
              )}
              style={{
                background: i === 0 ? "var(--yellow)" : p.id === meId ? "var(--peach)" : "var(--cream)",
                border: "2px solid var(--card-border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <span className="font-head font-bold text-[13px] w-[26px] text-center inline-flex items-center justify-center">
                {i < 3 ? MEDALS[i] : i + 1}
              </span>
              <span className="text-[16px]">{p.avatar}</span>
              <span className="font-head text-[13px] font-bold truncate flex-1">
                {p.name}
                {p.id === meId && <span className="text-[10px] font-semibold ml-1">(kamu)</span>}
              </span>
              <span className="text-[10.5px] font-bold text-[var(--text-muted)]">
                {totalQuestions > 0 ? `≈${Math.round((p.score / (200 * totalQuestions)) * 100)}%` : ""}
              </span>
              <span className="font-head font-bold text-[14px]">{p.score}</span>
            </motion.li>
          ))}
        </ol>
      </div>

      {/* aksi */}
      <div className="flex flex-wrap justify-center gap-2 pb-6">
        {canRestart && (
          <button
            className="btn-primary !text-[14px] !px-6 inline-flex items-center gap-1.5"
            onClick={onRestart}
          >
            <RotateCcw size={15} strokeWidth={2.5} />
            Main Lagi
          </button>
        )}
        <button
          className="btn-yellow !text-[14px] !px-6 inline-flex items-center gap-1.5"
          onClick={onReview}
        >
          <BookOpen size={15} strokeWidth={2.5} />
          Review Jawaban
        </button>
        <button
          className="btn-secondary !text-[14px] !px-6 inline-flex items-center gap-1.5"
          onClick={onHome}
        >
          <Home size={15} strokeWidth={2.5} />
          Kembali ke Kafe
        </button>
      </div>
    </div>
  );
}
