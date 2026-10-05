"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Brain, Timer, ClipboardList, Gamepad2, Dices, Crown, Flame,
  CalendarDays, Medal, Lock, Sunrise, Zap, Trophy, MessagesSquare, Smartphone,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { levelFromXp } from "@/lib/utils";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { useInstallPrompt } from "@/components/layout/install-pwa";

type DayCell = { date: string; count: number };

const ACHIEVEMENTS = [
  { key: "first_focus", Icon: Sunrise, name: "Fokus Pertama", desc: "Selesaikan 1 sesi fokus" },
  { key: "streak_3", Icon: Flame, name: "Tiga Hari Beruntun", desc: "Streak 3 hari" },
  { key: "streak_7", Icon: Zap, name: "Seminggu Konsisten", desc: "Streak 7 hari" },
  { key: "task_10", Icon: ClipboardList, name: "Pemburu Target", desc: "Selesaikan 10 task" },
  { key: "quiz_master", Icon: Trophy, name: "Juara Kuis", desc: "Menang kuis bareng" },
  { key: "gamer", Icon: Gamepad2, name: "Gamer Cozy", desc: "Main 5 game" },
  { key: "social", Icon: MessagesSquare, name: "Soul Kafe", desc: "Ikut ruangan belajar" },
  { key: "level_5", Icon: Crown, name: "Barista Senior", desc: "Capai Level 5" },
];

const IC = { size: 18, strokeWidth: 2.5 } as const;

export default function ProfilePage() {
  const { profile, isGuest, user, session } = useAuth();
  const { installed, canInstall } = useInstallPrompt();
  const lvl = levelFromXp(profile?.xp || 0);

  const [focusCount, setFocusCount] = useState<number | null>(null);
  const [focusMinutes, setFocusMinutes] = useState(0);
  const [taskDone, setTaskDone] = useState(0);
  const [gameCount, setGameCount] = useState(0);
  const [quizCount, setQuizCount] = useState(0);
  const [heatmap, setHeatmap] = useState<DayCell[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!session?.user || !isSupabaseConfigured) {
        setLoading(false);
        return;
      }
      const sb = getSupabase();
      const uid = session.user.id;
      const since = new Date(Date.now() - 90 * 86400000).toISOString();

      const [fs, gs, qa] = await Promise.all([
        sb.from("focus_sessions").select("duration_sec,created_at").eq("user_id", uid).gte("created_at", since),
        sb.from("game_scores").select("id,created_at").eq("user_id", uid),
        sb.from("quiz_attempts").select("id,created_at").eq("user_id", uid),
      ]);

      const sessions = (fs.data || []) as Array<{ duration_sec: number; created_at: string }>;
      setFocusCount(sessions.length);
      setFocusMinutes(Math.round(sessions.reduce((a, s) => a + (s.duration_sec || 0), 0) / 60));
      setGameCount((gs.data || []).length);
      setQuizCount((qa.data || []).length);

      const byDay: Record<string, number> = {};
      sessions.forEach((s) => {
        const d = s.created_at.slice(0, 10);
        byDay[d] = (byDay[d] || 0) + 1;
      });
      const cells: DayCell[] = [];
      for (let i = 89; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        cells.push({ date: key, count: byDay[key] || 0 });
      }
      setHeatmap(cells);
      setLoading(false);
    })();
  }, [session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      if (!session?.user || !isSupabaseConfigured) return;
      const sb = getSupabase();
      const { count } = await sb
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .eq("done", true);
      setTaskDone(count || 0);
    })();
  }, [session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const streak = profile?.streak_current || 0;
  const unlocked = new Set<string>();
  if ((focusCount || 0) >= 1) unlocked.add("first_focus");
  if (streak >= 3) unlocked.add("streak_3");
  if (streak >= 7) unlocked.add("streak_7");
  if (taskDone >= 10) unlocked.add("task_10");
  if ((profile?.xp || 0) > 0 && quizCount > 0) unlocked.add("quiz_master");
  if (gameCount >= 5) unlocked.add("gamer");
  if (user && !isGuest && (focusCount || 0) > 0) unlocked.add("social");
  if (lvl.level >= 5) unlocked.add("level_5");

  const stats = [
    { Icon: Brain, label: "Sesi Fokus", value: loading ? "…" : `${focusCount ?? 0}` },
    { Icon: Timer, label: "Menit Fokus", value: loading ? "…" : `${focusMinutes}` },
    { Icon: ClipboardList, label: "Task Selesai", value: loading ? "…" : `${taskDone}` },
    { Icon: Gamepad2, label: "Game Dimainkan", value: loading ? "…" : `${gameCount}` },
    { Icon: Dices, label: "Kuis Dikerjakan", value: loading ? "…" : `${quizCount}` },
    { Icon: Crown, label: "Streak Terpanjang", value: `${profile?.streak_longest ?? 0} hari` },
  ];

  return (
    <div className="flex flex-col gap-4 py-1">
      {/* HEADER PROFIL */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card flex flex-col sm:flex-row items-center gap-5">
        <motion.div
          className="badge-emoji !w-[84px] !h-[84px] !text-[44px] !rounded-full"
          animate={{ rotate: [-3, 3, -3] }}
          transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
        >
          {profile?.avatar || "🐣"}
        </motion.div>
        <div className="flex-1 text-center sm:text-left">
          <h1 className="font-head text-[26px] font-bold leading-tight">{profile?.display_name || "Tamu"}</h1>
          <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
            <span className="chip !gap-1.5">
              <Flame size={14} strokeWidth={2.5} className="text-[var(--orange-deep)]" /> {streak} hari streak
            </span>
            <span className="chip chip-active">Lv {lvl.level}</span>
            <span className="chip">{profile?.xp ?? 0} XP</span>
            {isGuest && <span className="chip">Tamu</span>}
          </div>
          <div className="h-3.5 rounded-full border-2 overflow-hidden mt-3 max-w-[320px]" style={{ borderColor: "var(--card-border)", background: "var(--warm-white)" }}>
            <motion.div
              className="h-full"
              style={{ background: "linear-gradient(90deg, var(--peach-dark), var(--accent))" }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(lvl.progress * 100)}%` }}
              transition={{ type: "spring", stiffness: 90, damping: 18 }}
            />
          </div>
          <p className="text-[11px] font-bold text-[var(--text-muted)] mt-1">{lvl.cur}/{lvl.next} XP menuju Lv {lvl.level + 1}</p>
        </div>
        {(canInstall || installed) && (
          <div className="card !p-3 !py-2.5 text-center">
            <p className="font-head text-[12px] font-bold mb-1.5">{installed ? "Aplikasi terpasang" : "Pintasan desktop"}</p>
            {canInstall && <InstallCta />}
            {installed && <p className="text-[10.5px] font-semibold text-[var(--text-muted)]">FocusSpace jalan seperti app beneran</p>}
          </div>
        )}
      </motion.section>

      {/* STATISTIK */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card !p-4 flex items-center gap-3 card-hover"
          >
            <span className="badge-emoji">
              <s.Icon {...IC} className="text-[var(--accent-deep)]" />
            </span>
            <div>
              <p className="font-head text-[20px] font-bold leading-none">{s.value}</p>
              <p className="text-[11px] font-bold text-[var(--text-muted)]">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </section>

      {/* HEATMAP 90 HARI */}
      <section className="card">
        <div className="card-header">
          <CalendarDays {...IC} className="text-[var(--accent-deep)]" />
          <h2 className="card-title">Peta Konsistensi 90 Hari</h2>
          <span className="chip !text-[10px]">aktivitasmu terlihat di sini</span>
        </div>
        <div className="flex flex-wrap gap-[4px]">
          {heatmap.length === 0 && !loading && (
            <p className="text-[12px] font-semibold text-[var(--text-muted)]">
              Login + mulai aktivitas dulu, lalu peta ini akan terisi
            </p>
          )}
          {heatmap.map((c, i) => {
            const intensity = c.count === 0 ? 0 : c.count < 2 ? 1 : c.count < 4 ? 2 : 3;
            const bg = ["var(--warm-white)", "var(--peach)", "var(--peach-dark)", "var(--accent)"][intensity];
            return (
              <motion.div
                key={c.date}
                className="rounded-[4px] border"
                style={{
                  width: 13,
                  height: 13,
                  background: bg,
                  borderColor: "var(--card-border)",
                  opacity: intensity === 0 ? 0.6 : 1,
                }}
                title={`${c.date}: ${c.count} sesi`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.004 }}
              />
            );
          })}
        </div>
        <div className="flex items-center gap-1.5 mt-3 text-[10px] font-bold text-[var(--text-muted)]">
          <span>sepi</span>
          {["var(--warm-white)", "var(--peach)", "var(--peach-dark)", "var(--accent)"].map((c) => (
            <span key={c} className="rounded-[3px] border" style={{ width: 12, height: 12, background: c, borderColor: "var(--card-border)" }} />
          ))}
          <span className="flex items-center gap-1">
            on fire <Flame size={12} strokeWidth={2.5} className="text-[var(--orange-deep)]" />
          </span>
        </div>
      </section>

      {/* LENCANA */}
      <section className="card">
        <div className="card-header">
          <Medal {...IC} className="text-[var(--accent-deep)]" />
          <h2 className="card-title">Koleksi Lencana</h2>
          <span className="chip !text-[10px]">{unlocked.size}/{ACHIEVEMENTS.length} terbuka</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {ACHIEVEMENTS.map((a, i) => {
            const open = unlocked.has(a.key);
            return (
              <motion.div
                key={a.key}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                whileHover={open ? { y: -3, rotate: -1 } : {}}
                className="rounded-[14px] p-3 text-center"
                style={{
                  background: open ? "var(--yellow)" : "var(--warm-white)",
                  border: `2.5px solid var(--card-border)`,
                  boxShadow: open ? "var(--shadow-sm)" : "none",
                  opacity: open ? 1 : 0.55,
                }}
              >
                <div className={`flex justify-center ${open ? "animate-bouncy" : ""}`}>
                  {open ? (
                    <a.Icon size={26} strokeWidth={2.5} className="text-[var(--accent-deep)]" />
                  ) : (
                    <Lock size={24} strokeWidth={2.5} className="text-[var(--text-muted)]" />
                  )}
                </div>
                <p className="font-head text-[11px] font-bold mt-1">{a.name}</p>
                <p className="text-[9.5px] font-semibold text-[var(--text-muted)]">{a.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function InstallCta() {
  const { install } = useInstallPrompt();
  return (
    <button className="btn-primary !text-[12px] !py-2 !px-3" onClick={install}>
      <Smartphone size={15} strokeWidth={2.5} /> Install
    </button>
  );
}
