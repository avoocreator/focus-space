"use client";

// ═════════════════════════════════════════════════════════════
//  QuizLobby — ruang tunggu live kuis (fullscreen dramatis).
//  Kode room raksasa + salin, daftar pemain popIn stagger,
//  toggle siap, tombol mulai (host), hint bagikan kode.
// ═════════════════════════════════════════════════════════════

import React from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  FileText,
  Hand,
  Lightbulb,
  Rocket,
  Tent,
  Timer,
  Users,
} from "lucide-react";
import { useToast } from "@/components/toast";
import { playSound } from "@/components/ui/sfx";
import { cn } from "@/lib/utils";
import type { QuizPlayerState } from "@/lib/types";
import { MAX_PLAYERS } from "./quiz-shared";

type Props = {
  code: string;
  title: string;
  emoji: string;
  totalQuestions: number;
  players: QuizPlayerState[];
  meId: string;
  isHost: boolean;
  onStart: () => void;
  onToggleReady: () => void;
  onExit: () => void;
};

export default function QuizLobby({
  code,
  title,
  emoji,
  totalQuestions,
  players,
  meId,
  isHost,
  onStart,
  onToggleReady,
  onExit,
}: Props) {
  const { toast } = useToast();
  const me = players.find((p) => p.id === meId);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      playSound("success");
      toast("success", "Kode room disalin — bagikan ke temanmu!");
    } catch {
      toast("error", "Gagal menyalin — salin manual ya");
    }
  };

  return (
    <div className="w-full max-w-[900px] mx-auto flex flex-col gap-4 px-4 py-6 animate-slideUp">
      {/* bar atas */}
      <div className="flex items-center gap-2">
        <button
          className="btn-secondary !py-2 !text-[12.5px] inline-flex items-center gap-1.5"
          onClick={onExit}
        >
          <ArrowLeft size={14} strokeWidth={2.5} />
          Keluar
        </button>
        <div className="flex-1" />
        <span className="chip">
          <FileText size={12} strokeWidth={2.5} className="mr-1 inline-block" />
          {totalQuestions} soal
        </span>
        <span className="chip chip-active">
          <Users size={12} strokeWidth={2.5} className="mr-1 inline-block" />
          {players.length}/{MAX_PLAYERS}
        </span>
      </div>

      {/* judul kuis */}
      <div className="text-center mt-1">
        <motion.div
          className="text-[72px] leading-none animate-wiggle"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
        >
          {emoji}
        </motion.div>
        <h1 className="font-head text-[26px] sm:text-[32px] font-bold mt-2 leading-tight">{title}</h1>
        <p className="text-[13px] font-semibold text-[var(--text-muted)] mt-1">
          Ruang tunggu — panggil teman-temanmu!
        </p>
      </div>

      {/* kode room raksasa */}
      <div className="card !py-6 text-center relative overflow-hidden">
        <p className="micro-title mb-1">Kode Room</p>
        <div className="font-head font-bold text-[64px] leading-none tracking-[0.12em] select-all"
          style={{ color: "var(--accent-deep)", textShadow: "3px 3px 0 var(--peach-dark)" }}
        >
          {code}
        </div>
        <button
          className="btn-yellow mt-4 !text-[13px] inline-flex items-center gap-1.5"
          onClick={copyCode}
        >
          <Copy size={14} strokeWidth={2.5} />
          Salin Kode
        </button>
        <p className="text-[11.5px] font-semibold text-[var(--text-muted)] mt-3">
          <Lightbulb size={12} strokeWidth={2.5} className="inline-block mr-1" />
          Bagikan kode ke temanmu — mereka buka halaman Kuis lalu &quot;Masuk dengan kode&quot;.
        </p>
      </div>

      {/* pemain */}
      <div className="card">
        <div className="card-header">
          <span className="card-icon">
            <Tent size={20} strokeWidth={2.5} />
          </span>
          <h2 className="card-title">Pemain ({players.length})</h2>
        </div>
        {players.length === 0 ? (
          <p className="text-[12.5px] font-semibold text-[var(--text-muted)] text-center py-4">
            Belum ada pemain — kamu yang pertama!
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {players.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, scale: 0.7, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 24, delay: Math.min(i * 0.06, 0.6) }}
                className={cn(
                  "flex items-center gap-2 rounded-[12px] px-2.5 py-2",
                  p.id === meId && "!border-[var(--accent)]"
                )}
                style={{
                  background: p.id === meId ? "var(--peach)" : "var(--cream)",
                  border: "2px solid var(--card-border)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <span className="badge-emoji !w-[30px] !h-[30px] !text-[15px]">{p.avatar}</span>
                <span className="font-head text-[12px] font-bold truncate flex-1">{p.name}</span>
                {p.id !== meId && p.ready && (
                  <span title="Siap!" className="inline-flex text-[var(--green)]">
                    <CheckCircle2 size={14} strokeWidth={2.5} />
                  </span>
                )}
                {p.id === meId && <span className="text-[10px] font-bold">kamu</span>}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* aksi */}
      <div className="flex flex-col items-center gap-2.5 pb-4">
        {!isHost && (
          <button
            className={cn("btn-primary !text-[15px] !px-8", me?.ready && "!bg-[var(--green)]")}
            onClick={onToggleReady}
          >
            {me?.ready ? (
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={15} strokeWidth={2.5} />
                Siap! (batal)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Hand size={15} strokeWidth={2.5} />
                Aku Siap!
              </span>
            )}
          </button>
        )}
        {isHost && (
          <>
            <button
              className="btn-primary !text-[16px] !px-10 !py-3 animate-bouncy inline-flex items-center gap-2"
              onClick={onStart}
            >
              <Rocket size={18} strokeWidth={2.5} />
              Mulai Kuis
            </button>
            <p className="text-[11.5px] font-semibold text-[var(--text-muted)]">
              {players.length <= 1
                ? "Bisa main sendirian, tapi lebih seru bareng teman"
                : `${players.length} pemain siap berduel!`}
            </p>
          </>
        )}
        <p className="text-[11px] font-semibold text-[var(--text-muted)]">
          <Timer size={12} strokeWidth={2.5} className="inline-block mr-1" />
          20 detik per soal · jawab cepat = bonus skor besar
        </p>
      </div>
    </div>
  );
}
