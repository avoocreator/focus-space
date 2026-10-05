"use client";

// ═══════════════════════════════════════════════════════
//  POMODORO CARD — komponen utama timer.
//  State timer hidup di TimerProvider (timer-context) supaya
//  bisa dipakai bareng FocusOverlay tanpa duplikasi.
// ═══════════════════════════════════════════════════════

import React from "react";
import { motion } from "framer-motion";
import {
  Hourglass,
  Link2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  SkipForward,
  Target,
  Timer,
  Zap,
} from "lucide-react";
import { ProgressRing } from "@/components/ui/progress-ring";
import { playSound } from "@/components/ui/sfx";
import { cn, formatClock } from "@/lib/utils";
import type { FocusMode } from "@/lib/types";
import { DURATIONS, MODE_META, useTimerCtrl, useTimerTick } from "./timer-context";

const MODE_ORDER: FocusMode[] = ["focus", "break", "long"];

export default function PomodoroCard() {
  const { running, remainSecs, progress } = useTimerTick();
  const {
    mode,
    focusDone,
    sessionNo,
    autoChain,
    autoStart,
    toggle,
    reset,
    skip,
    setMode,
    setAutoChain,
    setAutoStart,
    setOverlayOpen,
  } = useTimerCtrl();

  const meta = MODE_META[mode];
  // titik terisi: 0..4 per siklus (4 sesi focus = 1 siklus)
  const filled = focusDone > 0 && focusDone % 4 === 0 ? 4 : focusDone % 4;

  return (
    <section className="card">
      {/* header */}
      <div className="flex items-center gap-2 mb-3">
        <p className="micro-title flex-1 flex items-center gap-1.5">
          <Timer size={13} strokeWidth={2.5} />
          Timer Pomodoro
        </p>
        <motion.button
          whileTap={{ scale: 0.94 }}
          className="btn-yellow !text-[11px] !py-1.5 !px-3"
          onClick={() => {
            playSound("click");
            setOverlayOpen(true);
          }}
          title="Mode fokus layar penuh"
        >
          <Target size={13} strokeWidth={2.5} />
          Fokus Penuh
        </motion.button>
      </div>

      {/* tab mode */}
      <div className="grid grid-cols-3 gap-1.5 mb-4">
        {MODE_ORDER.map((m) => {
          const info = MODE_META[m];
          const active = m === mode;
          return (
            <motion.button
              key={m}
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                if (!active) {
                  playSound("click");
                  setMode(m);
                }
              }}
              className="rounded-[12px] border-[2.5px] px-1 py-2 font-head font-bold flex flex-col items-center gap-0.5"
              style={{
                borderColor: "var(--card-border)",
                background: active ? info.color : "var(--warm-white)",
                color: active ? "#fff" : "var(--text-main)",
                boxShadow: "var(--shadow-sm)",
              }}
              title={`Ganti ke ${info.tab} ${formatClock(DURATIONS[m])}`}
            >
              <info.icon size={18} strokeWidth={2.5} />
              <span className="text-[11.5px] leading-tight">{info.tab}</span>
              <span className="text-[9.5px] font-semibold opacity-80 leading-none">
                {formatClock(DURATIONS[m])}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* ring waktu */}
      <div className="flex justify-center mb-4">
        <motion.div
          key={mode}
          initial={{ scale: 0.95, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.22 }}
        >
          <ProgressRing progress={progress} size={200} stroke={13} color={meta.color}>
            <span className="font-head text-[46px] font-bold leading-none tabular-nums">
              {formatClock(remainSecs)}
            </span>
            <span
              className="font-head text-[11.5px] font-bold mt-1.5 tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              {meta.label}
            </span>
          </ProgressRing>
        </motion.div>
      </div>

      {/* kontrol */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <motion.button
          whileTap={{ scale: 0.94 }}
          className="btn-ctrl"
          onClick={() => {
            playSound("click");
            reset();
          }}
          title="Reset timer"
          aria-label="Reset timer"
        >
          <RotateCcw size={17} strokeWidth={2.6} />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => {
            playSound("click");
            toggle();
          }}
          aria-label={running ? "Jeda timer" : "Mulai timer"}
          title={running ? "Jeda" : "Mulai"}
          animate={running ? { scale: [1, 1.05, 1] } : { scale: 1 }}
          transition={
            running
              ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" }
              : { duration: 0.2 }
          }
          className="w-[62px] h-[62px] rounded-full border-[2.5px] flex items-center justify-center flex-shrink-0"
          style={{
            background: running ? "var(--yellow)" : "var(--green)",
            borderColor: "var(--card-border)",
            boxShadow: "var(--shadow-md)",
            color: running ? "var(--text-main)" : "#fff",
          }}
        >
          {running ? (
            <Pause size={26} strokeWidth={2.6} />
          ) : (
            <Play size={26} strokeWidth={2.6} className="ml-1" fill="currentColor" />
          )}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.94 }}
          className="btn-ctrl"
          onClick={() => {
            playSound("click");
            skip();
          }}
          title="Lewati fase ini"
          aria-label="Lewati fase ini"
        >
          <SkipForward size={17} strokeWidth={2.6} />
        </motion.button>
      </div>

      <hr className="divider-dashed mb-3" />

      {/* session dots + counter */}
      <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <motion.span
              key={`dot-${i}-${focusDone}`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
              className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0"
              style={{
                background: i < filled ? "var(--accent)" : "var(--warm-white)",
                borderColor: "var(--card-border)",
              }}
            />
          ))}
          <span className="chip !text-[10px] !py-0.5 ml-1">Sesi ke-{sessionNo}</span>
        </div>
        {running && (
          <span className="chip !text-[10px] !py-0.5" style={{ background: "var(--yellow)" }}>
            <Hourglass size={11} strokeWidth={2.5} />
            sedang jalan…
          </span>
        )}
      </div>

      {/* toggle auto-chain & auto-start */}
      <div className="flex flex-wrap items-center gap-1.5">
        <motion.button
          whileTap={{ scale: 0.94 }}
          className={cn("chip chip-click !text-[10.5px]", autoChain && "chip-active")}
          onClick={() => {
            playSound("click");
            setAutoChain(!autoChain);
          }}
          title="Otomatis ganti mode (focus → istirahat → focus) setiap fase selesai"
        >
          <Link2 size={11} strokeWidth={2.5} />
          Auto-chain
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.94 }}
          className={cn("chip chip-click !text-[10.5px]", autoStart && "chip-active")}
          onClick={() => {
            playSound("click");
            setAutoStart(!autoStart);
          }}
          title="Langsung jalankan fase berikutnya secara otomatis"
        >
          <Zap size={11} strokeWidth={2.5} />
          Auto-start
        </motion.button>
        <span className="flex-1" />
        <span className="text-[10px] font-semibold text-[var(--text-muted)] hidden sm:flex items-center gap-1">
          <RefreshCw size={10} strokeWidth={2.5} />
          4 sesi = 1 siklus
        </span>
      </div>
    </section>
  );
}
