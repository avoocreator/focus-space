"use client";

// ═══════════════════════════════════════════════════════
//  TIMER CONTEXT — mesin pomodoro bersama untuk
//  PomodoroCard + FocusOverlay (TIDAK menggandakan state).
//  Akurat walau tab di-background: sisa waktu dihitung dari
//  timestamp (startedAt), interval hanya untuk refresh tampilan.
//  Persist di localStorage → refresh halaman tidak mereset.
// ═══════════════════════════════════════════════════════

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { LucideIcon } from "lucide-react";
import { Armchair, Brain, Coffee } from "lucide-react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { playSound } from "@/components/ui/sfx";
import { useConfetti } from "@/components/ui/confetti";
import { useToast } from "@/components/toast";
import { recordActivity } from "@/lib/activity";
import { formatClock, todayStr } from "@/lib/utils";
import type { FocusMode } from "@/lib/types";

/** Durasi tiap mode (detik) */
export const DURATIONS: Record<FocusMode, number> = {
  focus: 25 * 60,
  break: 5 * 60,
  long: 15 * 60,
};

export const MODE_META: Record<
  FocusMode,
  { tab: string; label: string; color: string; icon: LucideIcon }
> = {
  focus: { tab: "Focus", label: "FOCUS TIME!", color: "var(--accent)", icon: Brain },
  break: { tab: "Break", label: "SHORT BREAK", color: "var(--green)", icon: Coffee },
  long: { tab: "Long", label: "LONG BREAK", color: "var(--blue)", icon: Armchair },
};

const LS_KEY = "fs_pomo_v1";

/** Event window setelah sesi focus sukses direkam ke DB (untuk QuestsCard). */
export const FOCUS_RECORDED_EVENT = "fs:focus-recorded";

type TickValue = {
  running: boolean;
  remainSecs: number;
  /** 0..1 proporsi waktu yang sudah lewat */
  progress: number;
};

type CtrlValue = {
  mode: FocusMode;
  /** jumlah sesi focus selesai hari ini */
  focusDone: number;
  /** nomor sesi saat ini (focusDone + 1) */
  sessionNo: number;
  autoChain: boolean;
  autoStart: boolean;
  setAutoChain: (v: boolean) => void;
  setAutoStart: (v: boolean) => void;
  start: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  skip: () => void;
  setMode: (m: FocusMode) => void;
  overlayOpen: boolean;
  setOverlayOpen: (v: boolean) => void;
};

const TickCtx = createContext<TickValue>({
  running: false,
  remainSecs: DURATIONS.focus,
  progress: 0,
});
const CtrlCtx = createContext<CtrlValue | null>(null);

/** State yang berubah tiap tick (waktu) — dipisah supaya konsumen
 *  lain (quests, dst) tidak ikut re-render setiap 250ms. */
export const useTimerTick = () => useContext(TickCtx);

/** Kontrol timer (mode, aksi, pengaturan) */
export function useTimerCtrl(): CtrlValue {
  const v = useContext(CtrlCtx);
  if (!v) throw new Error("useTimerCtrl harus dipakai di dalam <TimerProvider>");
  return v;
}

type Persisted = {
  mode: FocusMode;
  running: boolean;
  startedAt: number | null;
  remainSecs: number;
  focusDone: number;
  dayKey: string;
  autoChain: boolean;
  autoStart: boolean;
};

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const confetti = useConfetti();

  const [mode, setModeState] = useState<FocusMode>("focus");
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [remainSecs, setRemainSecs] = useState<number>(DURATIONS.focus);
  const [focusDone, setFocusDone] = useState(0);
  const [autoChain, setAutoChain] = useState(true);
  const [autoStart, setAutoStart] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // mirror terbaru untuk callback yang stabil
  const remainRef = useRef(remainSecs);
  remainRef.current = remainSecs;
  const stateRef = useRef({ mode, focusDone, autoChain, autoStart });
  stateRef.current = { mode, focusDone, autoChain, autoStart };
  const lastCompleteRef = useRef(0);
  const titleRef = useRef<string>("FocusSpace");

  // ── Muat sesi tersimpan (sekali di mount) ──
  useEffect(() => {
    titleRef.current = document.title;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Persisted>;
        const m: FocusMode =
          p.mode === "focus" || p.mode === "break" || p.mode === "long" ? p.mode : "focus";
        const dur = DURATIONS[m];
        const isToday = p.dayKey === todayStr();
        if (isToday && typeof p.focusDone === "number" && p.focusDone >= 0) {
          setFocusDone(Math.floor(p.focusDone));
        }
        if (typeof p.autoChain === "boolean") setAutoChain(p.autoChain);
        if (typeof p.autoStart === "boolean") setAutoStart(p.autoStart);
        if (p.running && typeof p.startedAt === "number") {
          // sesi jalan saat reload → lanjutkan dari timestamp
          const remain = dur - (Date.now() - p.startedAt) / 1000;
          setModeState(m);
          if (remain > 0.5) {
            setStartedAt(p.startedAt);
            setRemainSecs(remain);
            setRunning(true);
          } else {
            // selesai saat away — biarkan user mulai ulang (tidak merekam retroaktif)
            setRemainSecs(dur);
          }
        } else {
          setModeState(m);
          const r = typeof p.remainSecs === "number" ? p.remainSecs : dur;
          setRemainSecs(r > 0 && r <= dur ? r : dur);
        }
      }
    } catch {
      /* localStorage rusak → pakai default */
    }
    setHydrated(true);
    return () => {
      document.title = titleRef.current;
    };
  }, []);

  // ── Persist (tanpa remainSecs yang berubah tiap tick; saat berjalan
  //     sisa waktu selalu dihitung ulang dari startedAt) ──
  useEffect(() => {
    if (!hydrated) return;
    try {
      const snap: Persisted = {
        mode,
        running,
        startedAt,
        remainSecs: remainRef.current,
        focusDone,
        dayKey: todayStr(),
        autoChain,
        autoStart,
      };
      localStorage.setItem(LS_KEY, JSON.stringify(snap));
    } catch {
      /* diam */
    }
  }, [hydrated, mode, running, startedAt, focusDone, autoChain, autoStart]);

  // ── Ganti mode & (opsional) langsung jalan ──
  const beginMode = useCallback((m: FocusMode, run: boolean) => {
    setModeState(m);
    setRemainSecs(DURATIONS[m]);
    setRunning(run);
    setStartedAt(run ? Date.now() : null);
  }, []);

  // ── Selesai satu fase ──
  const finish = useCallback(() => {
    const now = Date.now();
    if (now - lastCompleteRef.current < 1500) return; // guard dobel-complete
    lastCompleteRef.current = now;
    const s = stateRef.current;

    if (s.mode === "focus") {
      playSound("timer");
      confetti({ big: true });
      toast("success", "Sesi fokus selesai! +25 XP");
      void recordActivity("focus");
      if (isSupabaseConfigured) {
        void (async () => {
          try {
            const sb = getSupabase();
            const { data } = await sb.auth.getSession();
            const uid = data.session?.user?.id;
            if (!uid) return;
            await sb.from("focus_sessions").insert({
              user_id: uid,
              mode: "focus",
              duration_sec: DURATIONS.focus,
              completed: true,
            });
            try {
              window.dispatchEvent(new Event(FOCUS_RECORDED_EVENT));
            } catch {
              /* diam */
            }
          } catch {
            /* diam — tidak boleh ganggu UI */
          }
        })();
      }
      const nextCount = s.focusDone + 1;
      setFocusDone(nextCount);
      const next: FocusMode = nextCount % 4 === 0 ? "long" : "break";
      beginMode(next, s.autoChain && s.autoStart);
      if (s.autoChain && !s.autoStart) {
        toast(
          "info",
          next === "long"
            ? "4 sesi selesai! Saatnya long break"
            : "Saatnya istirahat sebentar"
        );
      }
    } else {
      // break/long selesai → kembali ke focus, TIDAK auto-start
      playSound("chat");
      toast("info", "Istirahat selesai! Ayo fokus lagi");
      beginMode("focus", false);
    }
  }, [beginMode, confetti, toast]);

  const finishRef = useRef(finish);
  finishRef.current = finish;

  // ── Interval 250ms — sisa dihitung dari timestamp, akurat di background ──
  useEffect(() => {
    if (!running || startedAt == null) return;
    const dur = DURATIONS[mode];
    const tick = () => {
      const remain = dur - (Date.now() - startedAt) / 1000;
      if (remain <= 0) {
        setRemainSecs(0);
        finishRef.current();
      } else {
        setRemainSecs(remain);
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [running, startedAt, mode]);

  // ── Aksi ──
  const start = useCallback(() => {
    const m = stateRef.current.mode;
    const remain = remainRef.current > 0 ? remainRef.current : DURATIONS[m];
    // startedAt = now - waktu yang sudah lewat (durasi - sisa)
    setStartedAt(Date.now() - (DURATIONS[m] - remain) * 1000);
    setRemainSecs(remain);
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    if (startedAt != null) {
      const remain = DURATIONS[stateRef.current.mode] - (Date.now() - startedAt) / 1000;
      setRemainSecs(Math.max(0, remain));
      setStartedAt(null);
    }
    setRunning(false);
  }, [startedAt]);

  const toggle = useCallback(() => {
    if (running) pause();
    else start();
  }, [running, pause, start]);

  const reset = useCallback(() => {
    beginMode(stateRef.current.mode, false);
  }, [beginMode]);

  const skip = useCallback(() => {
    const m = stateRef.current.mode;
    beginMode(m === "focus" ? "break" : "focus", false);
  }, [beginMode]);

  const setMode = useCallback(
    (m: FocusMode) => {
      beginMode(m, false);
    },
    [beginMode]
  );

  // ── document.title dengan sisa waktu saat jalan ──
  useEffect(() => {
    if (!running) return;
    document.title = `${formatClock(remainSecs)} — FocusSpace`;
  }, [running, mode, remainSecs]);

  useEffect(() => {
    if (running || !hydrated) return;
    document.title = titleRef.current;
  }, [running, hydrated]);

  // ── Nilai context ──
  const tickValue = useMemo<TickValue>(() => {
    const p = 1 - remainSecs / DURATIONS[mode];
    return {
      running,
      remainSecs,
      progress: Math.min(1, Math.max(0, p)),
    };
  }, [running, remainSecs, mode]);

  const ctrlValue = useMemo<CtrlValue>(
    () => ({
      mode,
      focusDone,
      sessionNo: focusDone + 1,
      autoChain,
      autoStart,
      setAutoChain,
      setAutoStart,
      start,
      pause,
      toggle,
      reset,
      skip,
      setMode,
      overlayOpen,
      setOverlayOpen,
    }),
    [
      mode,
      focusDone,
      autoChain,
      autoStart,
      overlayOpen,
      start,
      pause,
      toggle,
      reset,
      skip,
      setMode,
    ]
  );

  return (
    <TickCtx.Provider value={tickValue}>
      <CtrlCtx.Provider value={ctrlValue}>{children}</CtrlCtx.Provider>
    </TickCtx.Provider>
  );
}
