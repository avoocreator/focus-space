"use client";

// ═══════════════════════════════════════════════════════
//  QUESTS CARD — "Quest Harian"
//  Sesi fokus  : count focus_sessions hari ini (Supabase),
//                fallback ke counter lokal dari TimerContext.
//  Target      : count tasks selesai hari ini (DB / lokal),
//                refresh via event "fs:task-changed".
//  Game & kuis : isActivityDoneToday (localStorage activity).
//  Tamu: quest tetap jalan (basis localStorage) + banner mini.
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  Check,
  ClipboardList,
  Dices,
  Flag,
  Gamepad2,
  HardDriveDownload,
  PartyPopper,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { isActivityDoneToday } from "@/lib/activity";
import { useConfetti } from "@/components/ui/confetti";
import { playSound } from "@/components/ui/sfx";
import { cn, todayStr } from "@/lib/utils";
import { FOCUS_RECORDED_EVENT, useTimerCtrl } from "./timer-context";
import { readLocalTaskDoneToday, TASKS_CHANGED_EVENT } from "./task-card";

const LS_CELEBRATED = "fs_quests_celebrated";

function localMidnightIso(): string {
  return new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
}

type QuestDef = {
  key: string;
  icon: LucideIcon;
  label: string;
  target: number;
  progress: number;
};

export default function QuestsCard() {
  const { user, loading } = useAuth();
  const { focusDone } = useTimerCtrl();
  const confetti = useConfetti();

  const [focusCount, setFocusCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [gameDone, setGameDone] = useState(false);
  const [quizDone, setQuizDone] = useState(false);

  const useDb = isSupabaseConfigured && !!user;

  // ── Hitung progress quest ──
  const refresh = useCallback(async () => {
    setGameDone(isActivityDoneToday("game"));
    setQuizDone(isActivityDoneToday("quiz"));

    if (!isSupabaseConfigured || !user) {
      setFocusCount(focusDone);
      setTaskCount(readLocalTaskDoneToday());
      return;
    }
    try {
      const sb = getSupabase();
      const midnight = localMidnightIso();
      const { count: fc, error: e1 } = await sb
        .from("focus_sessions")
        .select("id", { count: "exact", head: true })
        .eq("mode", "focus")
        .eq("completed", true)
        .gte("created_at", midnight);
      setFocusCount(!e1 && typeof fc === "number" ? fc : focusDone);

      const { count: tc, error: e2 } = await sb
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("done", true)
        .gte("done_at", midnight);
      setTaskCount(!e2 && typeof tc === "number" ? tc : readLocalTaskDoneToday());
    } catch {
      setFocusCount(focusDone);
      setTaskCount(readLocalTaskDoneToday());
    }
  }, [user, focusDone]);

  useEffect(() => {
    if (loading) return;
    void refresh();
  }, [loading, refresh]);

  // ── Refresh saat task berubah / sesi fokus tercatat / tab kembali aktif ──
  useEffect(() => {
    const onTaskChanged = () => void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener(TASKS_CHANGED_EVENT, onTaskChanged);
    window.addEventListener(FOCUS_RECORDED_EVENT, onTaskChanged);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(TASKS_CHANGED_EVENT, onTaskChanged);
      window.removeEventListener(FOCUS_RECORDED_EVENT, onTaskChanged);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const quests: QuestDef[] = useMemo(
    () => [
      { key: "focus", icon: Brain, label: "Selesaikan 2 sesi fokus", target: 2, progress: focusCount },
      { key: "task", icon: ClipboardList, label: "Centang 3 target", target: 3, progress: taskCount },
      { key: "game", icon: Gamepad2, label: "Main 1 game tantangan harian", target: 1, progress: gameDone ? 1 : 0 },
      { key: "quiz", icon: Dices, label: "Selesaikan 1 kuis", target: 1, progress: quizDone ? 1 : 0 },
    ],
    [focusCount, taskCount, gameDone, quizDone]
  );

  const allDone = quests.every((q) => q.progress >= q.target);

  // ── Rayakan saat SEMUA quest selesai (sekali per hari) ──
  useEffect(() => {
    if (!allDone) return;
    try {
      const raw = JSON.parse(
        localStorage.getItem(LS_CELEBRATED) || "{}"
      ) as { date?: string };
      if (raw.date === todayStr()) return;
      localStorage.setItem(LS_CELEBRATED, JSON.stringify({ date: todayStr() }));
    } catch {
      return;
    }
    confetti({ big: true });
    playSound("success");
  }, [allDone, confetti]);

  return (
    <section className="card">
      <div className="card-header !mb-2.5">
        <span className="card-icon flex items-center">
          <Zap size={18} strokeWidth={2.5} />
        </span>
        <h2 className="card-title">Quest Harian</h2>
        <span className="chip !text-[10px] !py-0.5">
          {quests.filter((q) => q.progress >= q.target).length}/{quests.length}
          <Flag size={11} strokeWidth={2.5} aria-hidden="true" />
        </span>
      </div>

      {!useDb && (
        <p
          className="text-[10.5px] font-bold rounded-[10px] px-2.5 py-1 mb-2 flex items-center gap-1.5"
          style={{ background: "var(--peach)", border: "2px dashed var(--peach-dark)" }}
        >
          <HardDriveDownload size={13} strokeWidth={2.5} aria-hidden="true" />
          Tamu: quest tersimpan lokal ya!
        </p>
      )}

      <AnimatePresence>
        {allDone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            className="rounded-[12px] px-3 py-2 mb-2.5 text-center font-head text-[12.5px] font-bold flex items-center justify-center gap-1.5"
            style={{ background: "var(--yellow)", border: "2.5px solid var(--card-border)", boxShadow: "var(--shadow-sm)" }}
          >
            <PartyPopper size={15} strokeWidth={2.5} aria-hidden="true" />
            SEMUA QUEST SELESAI!
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col">
        {quests.map((q, i) => {
          const done = q.progress >= q.target;
          const pct = Math.min(1, q.progress / q.target);
          return (
            <motion.div
              key={q.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 24 }}
              className={cn(
                "flex items-center gap-2.5 py-2",
                i > 0 && "border-t-2 border-dashed"
              )}
              style={i > 0 ? { borderColor: "var(--peach-dark)" } : undefined}
            >
              <span className="badge-emoji !w-[34px] !h-[34px]" style={{ color: "var(--text-main)" }}>
                <q.icon size={16} strokeWidth={2.5} />
              </span>

              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-[12.5px] font-bold leading-tight",
                    done && "line-through opacity-60"
                  )}
                >
                  {q.label}
                </p>
                {done ? (
                  <motion.p
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 20 }}
                    className="text-[10.5px] font-head font-bold mt-0.5 flex items-center gap-1"
                    style={{ color: "var(--green-dark)" }}
                  >
                    <Check size={12} strokeWidth={3} aria-hidden="true" />
                    Selesai!
                  </motion.p>
                ) : (
                  <div className="flex items-center gap-1.5 mt-1">
                    <div
                      className="flex-1 h-2 rounded-full border-2 overflow-hidden"
                      style={{ borderColor: "var(--card-border)", background: "var(--warm-white)" }}
                    >
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: "var(--accent)" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round(pct * 100)}%` }}
                        transition={{ type: "spring", stiffness: 140, damping: 20 }}
                      />
                    </div>
                    <span className="text-[9.5px] font-bold text-[var(--text-muted)] whitespace-nowrap">
                      {Math.min(q.progress, q.target)}/{q.target}
                    </span>
                  </div>
                )}
              </div>

              <span
                className="chip !text-[9.5px] !py-0.5 !px-2 flex-shrink-0"
                style={{ background: "var(--yellow)" }}
              >
                +50 XP
              </span>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
