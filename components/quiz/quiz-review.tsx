"use client";

// ═════════════════════════════════════════════════════════════
//  QuizReview — mode review per soal setelah kuis selesai.
//  Pertanyaan + semua opsi (benar hijau), jawabanmu dibingkai,
//  panel explain, chips nama yang benar, navigasi ‹ › + dots.
// ═════════════════════════════════════════════════════════════

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  FileQuestion,
  Lightbulb,
  Timer,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlayerAnswer, QuizQuestion } from "@/lib/types";
import { OPTION_COLORS, OPTION_LETTERS } from "./quiz-shared";

type Props = {
  questions: QuizQuestion[];
  myAnswers: PlayerAnswer[];
  /** qIdx → daftar nama pemain yang menjawab benar */
  rightBy: Record<number, string[]>;
  onExit: () => void;
};

export default function QuizReview({ questions, myAnswers, rightBy, onExit }: Props) {
  const [idx, setIdx] = useState(0);

  const q = questions[idx];
  const mine = myAnswers.find((a) => a.q === idx);
  const rightNames = rightBy[idx] ?? [];
  const picked = mine ? mine.picked : -1;

  if (!q) {
    return (
      <div className="w-full max-w-[760px] mx-auto px-4 py-10 text-center animate-fadeIn">
        <div className="card py-12">
          <div className="flex justify-center text-[var(--text-muted)]">
            <FileQuestion size={40} strokeWidth={2.5} />
          </div>
          <p className="font-head font-bold mt-2">Soal review tidak tersedia</p>
          <button
            className="btn-primary mt-4 inline-flex items-center gap-1.5"
            onClick={onExit}
          >
            <ArrowLeft size={15} strokeWidth={2.5} />
            Kembali ke Podium
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[760px] mx-auto flex flex-col gap-3.5 px-4 py-6 min-h-screen animate-slideUp">
      {/* bar atas */}
      <div className="flex items-center gap-2">
        <button
          className="btn-secondary !py-2 !text-[12.5px] inline-flex items-center gap-1.5"
          onClick={onExit}
        >
          <ArrowLeft size={14} strokeWidth={2.5} />
          Podium
        </button>
        <span className="chip chip-active !text-[11.5px]">
          <BookOpen size={12} strokeWidth={2.5} className="mr-1 inline-block" />
          Review {idx + 1}/{questions.length}
        </span>
        <div className="flex-1" />
        <span className="chip !text-[11.5px]">
          {picked === q.answer ? (
            <span className="inline-flex items-center gap-1 text-[var(--green-dark)]">
              <CheckCircle2 size={12} strokeWidth={2.5} />
              benar
            </span>
          ) : picked === -1 ? (
            <span className="inline-flex items-center gap-1">
              <Timer size={12} strokeWidth={2.5} />
              tidak jawab
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[var(--red)]">
              <XCircle size={12} strokeWidth={2.5} />
              salah
            </span>
          )}
        </span>
      </div>

      {/* soal */}
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.18 }}
          className="flex flex-col gap-3"
        >
          <div className="card !p-5">
            <p className="micro-title mb-1.5">Soal {idx + 1}</p>
            <h2 className="font-head font-bold text-[18px] sm:text-[21px] leading-snug">{q.q}</h2>
          </div>

          <div className="flex flex-col gap-2">
            {q.options.map((opt, oIdx) => {
              const isCorrect = oIdx === q.answer;
              const isMine = oIdx === picked;
              return (
                <div
                  key={oIdx}
                  className={cn("rounded-[14px] px-4 py-3 flex items-center gap-3")}
                  style={{
                    background: isCorrect ? "var(--green)" : "var(--card-bg)",
                    border: `2.5px solid ${isMine ? "var(--accent)" : "var(--card-border)"}`,
                    boxShadow: isMine ? "5px 5px 0 var(--card-border)" : "var(--shadow-sm)",
                    opacity: !isCorrect && !isMine && q.answer !== oIdx ? 0.85 : 1,
                  }}
                >
                  <span
                    className="flex items-center justify-center w-7 h-7 rounded-[8px] font-head font-bold text-[12px] flex-shrink-0"
                    style={{ background: OPTION_COLORS[oIdx], border: "2px solid var(--card-border)" }}
                  >
                    {OPTION_LETTERS[oIdx]}
                  </span>
                  <span className="font-semibold text-[13.5px] flex-1">{opt}</span>
                  {isCorrect && <span className="font-head font-bold text-[12px]">✓ benar</span>}
                  {isMine && !isCorrect && <span className="font-head font-bold text-[11px]">pilihanmu</span>}
                </div>
              );
            })}
          </div>

          {q.explain && (
            <div className="card !p-3.5 !border-[var(--yellow-dark)]">
              <p className="text-[12.5px] font-semibold leading-snug">
                <Lightbulb size={13} strokeWidth={2.5} className="inline-block mr-1 text-[#d4a017]" />
                {q.explain}
              </p>
            </div>
          )}

          {rightNames.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="micro-title">Yang benar:</span>
              {rightNames.slice(0, 12).map((n, i) => (
                <span
                  key={`${n}-${i}`}
                  className="chip !text-[11px] inline-flex items-center gap-1"
                  style={{ background: "var(--green)" }}
                >
                  <CheckCircle2 size={11} strokeWidth={2.5} />
                  {n}
                </span>
              ))}
              {rightNames.length > 12 && <span className="chip !text-[11px]">+{rightNames.length - 12}</span>}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* navigasi */}
      <div className="mt-auto flex items-center justify-center gap-4 pb-6 pt-2">
        <button
          className="btn-ctrl !w-[46px] !h-[46px] !text-[18px]"
          onClick={() => setIdx((v) => Math.max(0, v - 1))}
          disabled={idx === 0}
          aria-label="Soal sebelumnya"
        >
          ‹
        </button>
        <div className="flex gap-1.5 flex-wrap justify-center max-w-[240px]">
          {questions.map((_, i) => (
            <button
              key={i}
              className="rounded-full transition-all"
              style={{
                width: i === idx ? 12 : 8,
                height: i === idx ? 12 : 8,
                background: i === idx ? "var(--accent)" : "var(--peachdark)",
                border: "1.5px solid var(--card-border)",
                opacity: i === idx ? 1 : 0.55,
              }}
              onClick={() => setIdx(i)}
              aria-label={`Ke soal ${i + 1}`}
            />
          ))}
        </div>
        <button
          className="btn-ctrl !w-[46px] !h-[46px] !text-[18px]"
          onClick={() => setIdx((v) => Math.min(questions.length - 1, v + 1))}
          disabled={idx >= questions.length - 1}
          aria-label="Soal berikutnya"
        >
          ›
        </button>
      </div>
    </div>
  );
}
