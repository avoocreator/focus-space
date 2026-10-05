"use client";

// ═════════════════════════════════════════════════════════════
//  QuizStage — panggung utama saat playing.
//  • Timer ring 20 detik (sisa dihitung dari q_started_at)
//  • 4 opsi warna A/B/C/D, entrance stagger, kunci jawaban
//  • Reveal: benar → hijau ✓ pop, salah → shake merah, explain
//  • Leaderboard mini live (framer-motion layout) — momen signature
//  • Host: tombol Lanjut → + countdown auto-advance
// ═════════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Circle,
  Dumbbell,
  Flag,
  Flame,
  Lightbulb,
  Medal,
  PartyPopper,
  Pencil,
  Star,
  Timer,
  Trophy,
  Zap,
} from "lucide-react";
import { ProgressRing } from "@/components/ui/progress-ring";
import { cn } from "@/lib/utils";
import type { QuizPlayerState } from "@/lib/types";
import {
  OPTION_COLORS,
  OPTION_LETTERS,
  QUESTION_SECONDS,
  sortPlayers,
  type PublicQuestion,
  type RevealInfo,
} from "./quiz-shared";

const MEDALS_MINI = [
  <Medal key="gold" size={13} strokeWidth={2.5} style={{ color: "#d4a017" }} />,
  <Medal key="silver" size={13} strokeWidth={2.5} style={{ color: "#8f9aa6" }} />,
  <Medal key="bronze" size={13} strokeWidth={2.5} style={{ color: "#b0682c" }} />,
];

type Props = {
  title: string;
  emoji: string;
  qIndex: number;
  total: number;
  question: PublicQuestion;
  qStartedAt: number;
  picked: number | null;
  reveal: RevealInfo | null;
  answeredCount: number;
  players: QuizPlayerState[];
  meId: string;
  isHost: boolean;
  advanceIn: number | null;
  combo: number;
  onPick: (idx: number) => void;
  onNext: () => void;
  onExit: () => void;
};

export default function QuizStage({
  title,
  emoji,
  qIndex,
  total,
  question,
  qStartedAt,
  picked,
  reveal,
  answeredCount,
  players,
  meId,
  isHost,
  advanceIn,
  combo,
  onPick,
  onNext,
  onExit,
}: Props) {
  // tick 150ms untuk timer ring & countdown (dibersihkan saat unmount)
  const [now, setNow] = useState(() => (typeof window === "undefined" ? 0 : Date.now()));
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 150);
    return () => window.clearInterval(t);
  }, []);

  const elapsedMs = Math.max(0, now - qStartedAt);
  const remainingSec = Math.max(0, QUESTION_SECONDS - elapsedMs / 1000);
  const progress = reveal ? 0 : remainingSec / QUESTION_SECONDS;
  const timeCritical = !reveal && remainingSec <= 5;

  const locked = picked !== null || !!reveal;
  const ranked = sortPlayers(players);
  const myScore = players.find((p) => p.id === meId)?.score ?? 0;

  return (
    <div className="w-full max-w-[1150px] mx-auto flex flex-col gap-3 px-3 sm:px-4 py-4 min-h-screen">
      {/* ══ BAR ATAS ══ */}
      <div className="flex items-center gap-2">
        <button
          className="btn-secondary !py-2 !text-[12.5px] inline-flex items-center gap-1.5"
          onClick={onExit}
        >
          <ArrowLeft size={14} strokeWidth={2.5} />
          Keluar
        </button>
        <span className="chip !text-[11.5px] truncate max-w-[220px]">
          {emoji} {title}
        </span>
        <span className="chip chip-active !text-[11.5px]">
          Soal {qIndex + 1}/{total}
        </span>
        <span
          className={cn("chip !text-[11.5px]", answeredCount > 0 && answeredCount >= players.length && "chip-active")}
          title="Pemain yang sudah menjawab"
        >
          <Pencil size={12} strokeWidth={2.5} className="mr-1 inline-block" />
          {answeredCount}/{players.length}
        </span>
        {combo >= 2 && (
          <motion.span
            key={combo}
            initial={{ scale: 0.6, rotate: -8 }}
            animate={{ scale: 1.15, rotate: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 14 }}
            className="chip !text-[11.5px]"
            style={{ background: "var(--yellow)" }}
            title="Benar beruntun!"
          >
            <Flame size={12} strokeWidth={2.5} className="mr-1 inline-block" />
            combo x{combo}
          </motion.span>
        )}
        <div className="flex-1" />
        <span className="chip !text-[11.5px] hidden sm:inline-flex">
          <Star size={12} strokeWidth={2.5} className="mr-1 inline-block" />
          {myScore}
        </span>
      </div>

      <div className="flex-1 grid lg:grid-cols-[1fr_280px] gap-4 items-start">
        {/* ══ AREA SOAL ══ */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* soal + timer */}
          <div className="card !p-5 sm:!p-6 relative">
            <div className="absolute top-4 right-4">
              <ProgressRing
                progress={progress}
                size={64}
                stroke={9}
                color={timeCritical ? "var(--red)" : "var(--accent)"}
              >
                <span
                  className={cn(
                    "font-head font-bold text-[18px] leading-none",
                    timeCritical && "animate-wiggle"
                  )}
                  style={{ color: timeCritical ? "var(--red)" : "var(--text-main)" }}
                >
                  {Math.ceil(remainingSec)}
                </span>
              </ProgressRing>
            </div>

            <p className="micro-title mb-2 inline-flex items-center gap-1">
              {reveal ? (
                <>
                  <Circle size={11} strokeWidth={2.5} style={{ color: "var(--green)", fill: "var(--green)" }} />
                  Pembahasan
                </>
              ) : (
                <>
                  <Zap size={11} strokeWidth={2.5} />
                  Jawab secepat mungkin!
                </>
              )}
            </p>
            <motion.h2
              key={question.q}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-head font-bold text-[19px] sm:text-[24px] leading-snug pr-20"
            >
              {question.q}
            </motion.h2>
          </div>

          {/* opsi */}
          <div className="grid sm:grid-cols-2 gap-2.5 sm:gap-3">
            {question.options.map((opt, idx) => {
              const isCorrect = !!reveal && idx === reveal.correct;
              const isWrongPicked = !!reveal && picked === idx && idx !== reveal.correct;
              const isPicked = picked === idx;
              return (
                <motion.button
                  key={idx}
                  initial={{ opacity: 0, y: 18, scale: 0.96 }}
                  animate={
                    isWrongPicked
                      ? { opacity: 1, y: 0, scale: 1, x: [0, -6, 6, -6, 0] }
                      : { opacity: 1, y: 0, scale: 1 }
                  }
                  transition={
                    isWrongPicked
                      ? { delay: 0.05 * idx, duration: 0.4, x: { delay: 0.15 + 0.05 * idx, duration: 0.35 } }
                      : { type: "spring", stiffness: 350, damping: 24, delay: 0.06 * idx }
                  }
                  whileHover={locked ? undefined : { x: -2, y: -2 }}
                  whileTap={locked ? undefined : { scale: 0.97 }}
                  onClick={() => !locked && onPick(idx)}
                  disabled={locked}
                  className={cn(
                    "relative text-left rounded-[16px] px-4 py-3.5 flex items-center gap-3 transition-colors",
                    locked && "cursor-default"
                  )}
                  style={{
                    background: isCorrect ? "var(--green)" : isWrongPicked ? "var(--red)" : OPTION_COLORS[idx],
                    border: "2.5px solid var(--card-border)",
                    boxShadow:
                      isCorrect || isWrongPicked || isPicked
                        ? "5px 5px 0 var(--card-border)"
                        : "var(--shadow-md)",
                    color: "var(--text-main)",
                    opacity: reveal && !isCorrect && !isWrongPicked ? 0.55 : 1,
                  }}
                >
                  <span
                    className="flex items-center justify-center w-8 h-8 rounded-[10px] font-head font-bold text-[14px] flex-shrink-0"
                    style={{
                      background: "var(--warm-white)",
                      border: "2px solid var(--card-border)",
                      color: "var(--text-main)",
                    }}
                  >
                    {OPTION_LETTERS[idx]}
                  </span>
                  <span className="font-semibold text-[14px] sm:text-[15px] leading-snug">{opt}</span>
                  <AnimatePresence>
                    {isCorrect && (
                      <motion.span
                        initial={{ scale: 0, rotate: -30 }}
                        animate={{ scale: 1.2, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 15 }}
                        className="absolute -top-2.5 -right-2.5 w-8 h-8 rounded-full flex items-center justify-center text-[15px]"
                        style={{ background: "var(--green)", border: "2.5px solid var(--card-border)" }}
                      >
                        ✓
                      </motion.span>
                    )}
                    {isPicked && !reveal && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold"
                        style={{ background: "var(--warm-white)", border: "2.5px solid var(--card-border)" }}
                      >
                        kamu
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>

          {/* panel pembahasan + lanjut */}
          <AnimatePresence>
            {reveal && (
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                className="card !p-4 flex flex-wrap items-center gap-3"
                style={{ borderColor: "var(--green)" }}
              >
                <span className="inline-flex text-[var(--green-dark)]">
                  {picked === reveal.correct ? (
                    <PartyPopper size={24} strokeWidth={2.5} />
                  ) : picked === null ? (
                    <Timer size={24} strokeWidth={2.5} />
                  ) : (
                    <Dumbbell size={24} strokeWidth={2.5} />
                  )}
                </span>
                <p className="text-[13px] font-semibold flex-1 min-w-[200px] leading-snug">
                  {picked === reveal.correct
                    ? "Benar! Bonus kecepatan menghantam"
                    : picked === null
                      ? "Waktu habis — jawab lebih cepat di soal berikutnya!"
                      : "Belum tepat — tidak apa, lanjutkan!"}
                  {reveal.explain ? (
                    <span className="block text-[12px] text-[var(--text-muted)] mt-1">
                      <Lightbulb size={12} strokeWidth={2.5} className="inline-block mr-1" />
                      {reveal.explain}
                    </span>
                  ) : null}
                </p>
                {isHost && (
                  <div className="flex items-center gap-2 ml-auto">
                    <AnimatePresence>
                      {advanceIn !== null && advanceIn > 0 && (
                        <motion.span
                          key={advanceIn}
                          initial={{ scale: 0.7, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.7, opacity: 0 }}
                          className="chip !text-[11px]"
                        >
                          auto {advanceIn}s
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <button
                      className="btn-primary !text-[13px] inline-flex items-center gap-1.5"
                      onClick={onNext}
                    >
                      {qIndex + 1 >= total ? (
                        <>
                          <Flag size={14} strokeWidth={2.5} />
                          Hasil Akhir
                        </>
                      ) : (
                        <>
                          Lanjut
                          <ArrowRight size={14} strokeWidth={2.5} />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ══ LEADERBOARD MINI (signature: layout animation) ══ */}
        <div className="card !p-3.5 lg:sticky lg:top-4">
          <div className="card-header !mb-2.5">
            <span className="card-icon">
              <Trophy size={20} strokeWidth={2.5} />
            </span>
            <h3 className="card-title !text-[14px]">Papan Skor</h3>
          </div>
          <ol className="flex flex-col gap-1.5">
            {ranked.map((p, i) => (
              <motion.li
                key={p.id}
                layout
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
                className={cn(
                  "flex items-center gap-2 rounded-[10px] px-2 py-1.5",
                  p.id === meId && "!border-[var(--accent)]"
                )}
                style={{
                  background: i === 0 ? "var(--yellow)" : p.id === meId ? "var(--peach)" : "var(--cream)",
                  border: "2px solid var(--card-border)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <span className="font-head font-bold text-[12px] w-[18px] text-center inline-flex items-center justify-center">
                  {i < 3 ? MEDALS_MINI[i] : i + 1}
                </span>
                <span className="text-[14px]">{p.avatar}</span>
                <span className="font-head text-[11.5px] font-bold truncate flex-1">{p.name}</span>
                <motion.span
                  key={p.score}
                  initial={{ scale: 1.35, color: "var(--accent-deep)" }}
                  animate={{ scale: 1, color: "var(--text-main)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="font-head font-bold text-[12.5px]"
                >
                  {p.score}
                </motion.span>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
