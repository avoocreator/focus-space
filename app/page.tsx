"use client";

// ═══════════════════════════════════════════════════════
//  BERANDA / — DASHBOARD FOKUS
//  Kiri : pomodoro + target hari ini.
//  Kanan: quests + kutipan + quick links.
//  Mobile: satu kolom.
//  TimerProvider membungkus semuanya → PomodoroCard &
//  FocusOverlay berbagi satu sumber state timer.
// ═══════════════════════════════════════════════════════

import React from "react";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { TimerProvider } from "@/components/focus/timer-context";
import PomodoroCard from "@/components/focus/pomodoro-card";
import TaskCard from "@/components/focus/task-card";
import QuestsCard from "@/components/focus/quests-card";
import QuoteCard from "@/components/focus/quote-card";
import QuickLinks from "@/components/focus/quick-links";
import FocusOverlay from "@/components/focus/focus-overlay";

function Greeting() {
  const { profile } = useAuth();
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4 flex items-end justify-between gap-3 flex-wrap"
    >
      <div>
        <h1 className="font-head text-[22px] font-bold leading-tight">
          Halo, {profile?.display_name || "Tamu"}!
        </h1>
        <p className="text-[12.5px] font-semibold text-[var(--text-muted)]">
          Siap bikin hari ini produktif? Yuk mulai dari satu sesi kecil
        </p>
      </div>
      <span className="chip">
        <Flame size={13} strokeWidth={2.5} className="text-[var(--red-dark)]" />
        {profile?.streak_current ?? 0} hari streak
      </span>
    </motion.div>
  );
}

export default function DashboardPage() {
  return (
    <TimerProvider>
      <div className="animate-slideUp">
        <Greeting />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_370px] gap-4 items-start"
        >
          {/* kolom kiri */}
          <div className="flex flex-col gap-4 min-w-0">
            <PomodoroCard />
            <TaskCard />
          </div>

          {/* kolom kanan */}
          <div className="flex flex-col gap-4 min-w-0">
            <QuestsCard />
            <QuoteCard />
            <QuickLinks />
          </div>
        </motion.div>
      </div>

      {/* overlay fullscreen (state dari TimerProvider) */}
      <FocusOverlay />
    </TimerProvider>
  );
}
