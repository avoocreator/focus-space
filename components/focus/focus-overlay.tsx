"use client";

// ═══════════════════════════════════════════════════════
//  FOCUS OVERLAY — mode fokus layar penuh.
//  TIDAK menyimpan state timer sendiri; semuanya dari
//  TimerContext (satu sumber kebenaran bersama PomodoroCard).
// ═══════════════════════════════════════════════════════

import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Brain, Coffee, Moon, Pause, Play, RotateCcw, X } from "lucide-react";
import { ProgressRing } from "@/components/ui/progress-ring";
import { playSound } from "@/components/ui/sfx";
import { formatClock } from "@/lib/utils";
import { MODE_META, useTimerCtrl, useTimerTick } from "./timer-context";

const PILLS = [
  { key: "focus", icon: Brain, label: "Fokus" },
  { key: "break", icon: Coffee, label: "Istirahat" },
  { key: "santai", icon: Moon, label: "Santai" },
  { key: "belajar", icon: BookOpen, label: "Belajar" },
] as const;

export default function FocusOverlay() {
  const { running, remainSecs, progress } = useTimerTick();
  const { mode, toggle, reset, overlayOpen, setOverlayOpen } = useTimerCtrl();
  const meta = MODE_META[mode];

  // Esc untuk keluar + kunci scroll body saat terbuka
  useEffect(() => {
    if (!overlayOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOverlayOpen(false);
    };
    window.addEventListener("keydown", h);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = prevOverflow;
    };
  }, [overlayOpen, setOverlayOpen]);

  return (
    <AnimatePresence>
      {overlayOpen && (
        <motion.div
          key="focus-overlay"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-0 z-[4000] flex flex-col items-center justify-center gap-5 px-6 py-8 overflow-y-auto"
          style={{ background: "var(--brown)" }}
          role="dialog"
          aria-label="Mode fokus layar penuh"
        >
          {/* tombol keluar */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              playSound("click");
              setOverlayOpen(false);
            }}
            className="absolute top-5 right-5 w-11 h-11 rounded-full border-[2.5px] flex items-center justify-center flex-shrink-0"
            style={{
              background: "var(--peach)",
              borderColor: "var(--cream)",
              color: "var(--text-main)",
              boxShadow: "var(--shadow-md)",
            }}
            title="Keluar dari mode fokus (Esc)"
            aria-label="Keluar dari mode fokus"
          >
            <X size={18} strokeWidth={2.5} />
          </motion.button>

          {/* status pills (dekoratif) */}
          <div className="flex flex-wrap justify-center gap-1.5 max-w-[340px]">
            {PILLS.map((p) => {
              const active = mode === "focus" ? p.key === "focus" : p.key === "break";
              const PillIcon = p.icon;
              return (
                <span
                  key={p.key}
                  className="chip !text-[10.5px]"
                  style={
                    active
                      ? { background: "var(--yellow)" }
                      : { background: "var(--warm-white)", opacity: 0.85 }
                  }
                >
                  <PillIcon size={12} strokeWidth={2.5} />
                  {p.label}
                </span>
              );
            })}
          </div>

          {/* label mode */}
          <h2 className="font-head text-[24px] font-bold text-center" style={{ color: "var(--peach)" }}>
            {meta.label}
          </h2>

          {/* ring waktu besar */}
          <ProgressRing
            progress={progress}
            size={240}
            stroke={14}
            color={meta.color}
            trackColor="rgba(254,246,228,0.16)"
          >
            <span style={{ color: meta.color }} aria-hidden="true">
              <meta.icon size={30} strokeWidth={2.5} />
            </span>
            <span
              className="font-head font-bold text-[64px] leading-none tabular-nums"
              style={{ color: "var(--cream)" }}
            >
              {formatClock(remainSecs)}
            </span>
            <span
              className="text-[11px] font-bold mt-1.5"
              style={{ color: "rgba(254,246,228,0.6)" }}
            >
              {running ? "sedang berjalan…" : "dijeda"}
            </span>
          </ProgressRing>

          {/* kontrol mini */}
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={toggle}
              aria-label={running ? "Jeda timer" : "Mulai timer"}
              title={running ? "Jeda" : "Mulai"}
              className="w-[54px] h-[54px] rounded-full border-[2.5px] flex items-center justify-center flex-shrink-0"
              style={{
                background: running ? "var(--yellow)" : "var(--green)",
                borderColor: "var(--card-border)",
                boxShadow: "var(--shadow-md)",
                color: running ? "var(--text-main)" : "#fff",
              }}
            >
              {running ? (
                <Pause size={22} strokeWidth={2.6} />
              ) : (
                <Play size={22} strokeWidth={2.6} className="ml-0.5" fill="currentColor" />
              )}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                playSound("click");
                reset();
              }}
              title="Reset timer"
              aria-label="Reset timer"
              className="w-[44px] h-[44px] rounded-full border-[2.5px] flex items-center justify-center flex-shrink-0"
              style={{
                background: "var(--warm-white)",
                borderColor: "var(--card-border)",
                color: "var(--text-main)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <RotateCcw size={18} strokeWidth={2.6} />
            </motion.button>
          </div>

          <p
            className="text-[11px] font-semibold text-center flex items-center justify-center gap-1 flex-wrap"
            style={{ color: "rgba(254,246,228,0.55)" }}
          >
            Tekan Esc atau tombol
            <X size={11} strokeWidth={2.5} aria-hidden="true" />
            untuk keluar
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
