"use client";

// ═══════════════════════════════════════════════════════
//  TASK CARD — "Target Hari Ini"
//  Login (termasuk tamu anonim) → Supabase `tasks` + realtime.
//  Tanpa sesi → localStorage ("fs_tasks_local").
//  Event "fs:task-changed" di-dispatch tiap perubahan supaya
//  QuestsCard bisa sinkron.
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ClipboardList,
  HardDriveDownload,
  Plus,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { playSound } from "@/components/ui/sfx";
import { useConfetti } from "@/components/ui/confetti";
import { recordActivity } from "@/lib/activity";
import { cn, todayStr } from "@/lib/utils";
import type { TaskDTO, TaskPriority } from "@/lib/types";

// ── Konstanta ──
const LS_TASKS = "fs_tasks_local";
export const TASKS_CHANGED_EVENT = "fs:task-changed";

const EMOJIS = ["📚", "✍️", "💪", "🧹", "🛒", "🎨", "💻", "🌱"];

const PRIORITY_META: Record<TaskPriority, { label: string; color: string }> = {
  high: { label: "Tinggi", color: "var(--red)" },
  normal: { label: "Normal", color: "var(--peach-dark)" },
  low: { label: "Santai", color: "var(--blue)" },
};
const PRIORITY_ORDER: TaskPriority[] = ["low", "normal", "high"];

const FILTERS = [
  { key: "all" as const, label: "Semua" },
  { key: "todo" as const, label: "Belum" },
  { key: "done" as const, label: "Selesai" },
];
type FilterKey = (typeof FILTERS)[number]["key"];

// ── Helper ──
function uid(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* diam */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}` === todayStr()
  );
}

function loadLocalTasks(): TaskDTO[] {
  try {
    const raw = localStorage.getItem(LS_TASKS);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr as TaskDTO[];
  } catch {
    return [];
  }
}

/** Jumlah task lokal yang selesai hari ini (fallback quest). */
export function readLocalTaskDoneToday(): number {
  return loadLocalTasks().filter((t) => t.done && !!t.done_at && isToday(t.done_at)).length;
}

function upsertTask(list: TaskDTO[], row: TaskDTO): TaskDTO[] {
  const idx = list.findIndex((t) => t.id === row.id);
  if (idx === -1) return [...list, row];
  const next = [...list];
  next[idx] = row;
  return next;
}

function metaOf(p: TaskPriority): { label: string; color: string } {
  return PRIORITY_META[p] ?? PRIORITY_META.normal;
}

// ── Komponen ──
export default function TaskCard() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const confetti = useConfetti();

  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [input, setInput] = useState("");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [confirmClear, setConfirmClear] = useState(false);
  const [oldOpen, setOldOpen] = useState(false);

  const useDb = isSupabaseConfigured && !!user;

  const notifyChange = useCallback(() => {
    try {
      window.dispatchEvent(new Event(TASKS_CHANGED_EVENT));
    } catch {
      /* diam */
    }
  }, []);

  // ── Load data awal (tunggu auth selesai dulu) ──
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    if (isSupabaseConfigured && user) {
      void (async () => {
        try {
          const sb = getSupabase();
          const { data, error } = await sb
            .from("tasks")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true });
          if (!cancelled && !error && data) setTasks(data as TaskDTO[]);
          else if (!cancelled && error) setTasks(loadLocalTasks());
        } catch {
          if (!cancelled) setTasks(loadLocalTasks());
        } finally {
          if (!cancelled) setLoaded(true);
        }
      })();
    } else {
      setTasks(loadLocalTasks());
      setLoaded(true);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id]);

  // ── Persist lokal (mode tamu) ──
  useEffect(() => {
    if (!loaded || useDb) return;
    try {
      localStorage.setItem(LS_TASKS, JSON.stringify(tasks));
    } catch {
      /* diam */
    }
  }, [tasks, loaded, useDb]);

  // ── Realtime sync antar device ──
  useEffect(() => {
    if (!useDb || !user) return;
    const sb = getSupabase();
    const ch = sb
      .channel(`fs-tasks-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const evt = payload.eventType;
          if (evt === "INSERT" || evt === "UPDATE") {
            const row = payload.new as unknown as TaskDTO | null;
            if (row && row.id) setTasks((ts) => upsertTask(ts, row));
          } else if (evt === "DELETE") {
            const old = payload.old as unknown as { id?: string } | null;
            if (old?.id) setTasks((ts) => ts.filter((t) => t.id !== old.id));
          }
        }
      )
      .subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useDb, user?.id]);

  // ── Aksi ──
  const addTask = useCallback(async () => {
    const title = input.trim();
    if (!title) return;
    setInput("");
    setEmojiOpen(false);
    const chosenEmoji = emoji;
    setEmoji(null);
    playSound("click");

    if (useDb && user) {
      try {
        const sb = getSupabase();
        const { data, error } = await sb
          .from("tasks")
          .insert({ user_id: user.id, title, emoji: chosenEmoji, priority })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          const row = data as TaskDTO;
          setTasks((ts) => upsertTask(ts, row));
          notifyChange();
        }
      } catch {
        toast("error", "Gagal menambah target");
      }
    } else {
      const t: TaskDTO = {
        id: uid(),
        user_id: "local",
        title,
        emoji: chosenEmoji,
        priority,
        done: false,
        created_at: new Date().toISOString(),
        done_at: null,
      };
      setTasks((ts) => [...ts, t]);
      notifyChange();
    }
  }, [input, emoji, priority, useDb, user, toast, notifyChange]);

  const toggleTask = useCallback(
    async (t: TaskDTO) => {
      const nowDone = !t.done;
      const doneAt = nowDone ? new Date().toISOString() : null;
      setTasks((ts) =>
        ts.map((x) => (x.id === t.id ? { ...x, done: nowDone, done_at: doneAt } : x))
      );
      notifyChange();

      if (nowDone) {
        playSound("check");
        void recordActivity("task");
        // confetti kecil kalau semua target hari ini selesai
        const todayAll = tasks.filter((x) => isToday(x.created_at));
        if (
          todayAll.length > 0 &&
          todayAll.every((x) => x.done || x.id === t.id)
        ) {
          confetti({ big: false });
          toast("success", "Semua target hari ini selesai! Hebat");
        }
      }

      if (useDb && user) {
        try {
          const { error } = await getSupabase()
            .from("tasks")
            .update({ done: nowDone, done_at: doneAt })
            .eq("id", t.id);
          if (error) throw error;
        } catch {
          // rollback optimistik
          setTasks((ts) =>
            ts.map((x) => (x.id === t.id ? { ...x, done: t.done, done_at: t.done_at } : x))
          );
          toast("error", "Gagal update target");
        }
      }
    },
    [tasks, useDb, user, confetti, toast, notifyChange]
  );

  const deleteTask = useCallback(
    async (t: TaskDTO) => {
      playSound("click");
      setTasks((ts) => ts.filter((x) => x.id !== t.id));
      notifyChange();
      if (useDb && user) {
        try {
          await getSupabase().from("tasks").delete().eq("id", t.id);
        } catch {
          toast("error", "Gagal hapus target");
        }
      }
    },
    [useDb, user, toast, notifyChange]
  );

  const askClearDone = useCallback(() => {
    playSound("click");
    setConfirmClear(true);
    window.setTimeout(() => setConfirmClear(false), 4000);
  }, []);

  const confirmClearDone = useCallback(async () => {
    setConfirmClear(false);
    playSound("check");
    const ids = tasks.filter((t) => isToday(t.created_at) && t.done).map((t) => t.id);
    setTasks((ts) => ts.filter((t) => !(isToday(t.created_at) && t.done)));
    notifyChange();
    if (useDb && user && ids.length > 0) {
      try {
        await getSupabase().from("tasks").delete().in("id", ids);
      } catch {
        toast("error", "Gagal membersihkan target");
      }
    }
  }, [tasks, useDb, user, toast, notifyChange]);

  // ── Turunan list ──
  const todayList = useMemo(() => tasks.filter((t) => isToday(t.created_at)), [tasks]);
  const oldList = useMemo(() => tasks.filter((t) => !isToday(t.created_at)), [tasks]);
  const doneToday = useMemo(() => todayList.filter((t) => t.done).length, [todayList]);

  const visibleToday = useMemo(() => {
    const base =
      filter === "todo"
        ? todayList.filter((t) => !t.done)
        : filter === "done"
          ? todayList.filter((t) => t.done)
          : todayList;
    return [...base].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.created_at.localeCompare(b.created_at);
    });
  }, [todayList, filter]);

  const pct = todayList.length > 0 ? doneToday / todayList.length : 0;

  // ── Render satu baris task ──
  const renderRow = (t: TaskDTO) => {
    const pm = metaOf(t.priority);
    return (
      <motion.li
        key={t.id}
        initial={{ opacity: 0, scale: 0.92, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, x: -24, scale: 0.94 }}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
        className="flex items-center gap-2 py-1.5"
      >
        {/* checkbox custom */}
        <motion.button
          whileTap={{ scale: 0.86 }}
          onClick={() => void toggleTask(t)}
          aria-label={t.done ? "Tandai belum selesai" : "Tandai selesai"}
          title={t.done ? "Batalkan" : "Tandai selesai"}
          className="w-[24px] h-[24px] rounded-[7px] border-[2.5px] flex items-center justify-center flex-shrink-0"
          style={{
            background: t.done ? "var(--green)" : "var(--warm-white)",
            borderColor: "var(--card-border)",
            color: "#fff",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {t.done && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
            >
              <Check size={15} strokeWidth={3.5} />
            </motion.span>
          )}
        </motion.button>

        {/* indikator prioritas */}
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: pm.color }}
          title={`Prioritas ${pm.label}`}
        />

        {t.emoji ? <span className="text-[15px] flex-shrink-0">{t.emoji}</span> : null}

        <span
          className={cn(
            "flex-1 min-w-0 text-[13px] font-semibold truncate",
            t.done && "line-through opacity-50"
          )}
        >
          {t.title}
        </span>

        {/* hapus */}
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={() => void deleteTask(t)}
          className="btn-icon-sm !opacity-100 hover:!bg-[var(--red)] hover:!text-white"
          title="Hapus target"
          aria-label={`Hapus target ${t.title}`}
        >
          <X size={13} strokeWidth={3} />
        </motion.button>
      </motion.li>
    );
  };

  return (
    <section className="card">
      {/* header */}
      <div className="card-header !mb-2.5">
        <span className="card-icon flex items-center">
          <ClipboardList size={18} strokeWidth={2.5} />
        </span>
        <h2 className="card-title">Target Hari Ini</h2>
        {confirmClear ? (
          <div className="flex items-center gap-1">
            <span className="text-[10.5px] font-bold text-[var(--text-muted)]">
              Hapus {doneToday} selesai?
            </span>
            <motion.button
              whileTap={{ scale: 0.85 }}
              className="btn-icon-sm !opacity-100"
              onClick={() => void confirmClearDone()}
              title="Ya, hapus"
              aria-label="Ya, hapus target selesai"
            >
              <Check size={14} strokeWidth={3} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.85 }}
              className="btn-icon-sm !opacity-100"
              onClick={() => setConfirmClear(false)}
              title="Batal"
              aria-label="Batal hapus"
            >
              <X size={14} strokeWidth={3} />
            </motion.button>
          </div>
        ) : (
          doneToday > 0 && (
            <motion.button
              whileTap={{ scale: 0.85 }}
              className="btn-icon-sm !opacity-100"
              onClick={askClearDone}
              title="Hapus semua target yang selesai"
              aria-label="Hapus semua target yang selesai"
            >
              <Trash2 size={14} strokeWidth={2.5} />
            </motion.button>
          )
        )}
      </div>

      {/* banner tamu */}
      {!useDb && (
        <p
          className="text-[11px] font-bold rounded-[10px] px-2.5 py-1.5 mb-2.5 flex items-center gap-1.5"
          style={{ background: "var(--peach)", border: "2px dashed var(--peach-dark)" }}
        >
          <HardDriveDownload size={13} strokeWidth={2.5} aria-hidden="true" />
          Tamu: task tersimpan di perangkat ini saja
        </p>
      )}

      {/* progress hari ini */}
      <div className="flex items-center gap-2 mb-2.5">
        <div
          className="flex-1 h-3 rounded-full border-2 overflow-hidden"
          style={{ borderColor: "var(--card-border)", background: "var(--warm-white)" }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: pct >= 1 ? "var(--green)" : "var(--accent)" }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(pct * 100)}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
        <span className="text-[11px] font-bold text-[var(--text-muted)] whitespace-nowrap">
          {doneToday}/{todayList.length} selesai
        </span>
      </div>

      {/* filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap mb-1">
        {FILTERS.map((f) => (
          <motion.button
            key={f.key}
            whileTap={{ scale: 0.94 }}
            className={cn("chip chip-click !text-[11px]", filter === f.key && "chip-active")}
            onClick={() => {
              playSound("click");
              setFilter(f.key);
            }}
          >
            {f.label}
          </motion.button>
        ))}
      </div>

      {/* form tambah + emoji picker */}
      <AnimatePresence>
        {emojiOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-1 flex-wrap py-2">
              <span className="text-[10.5px] font-head font-bold text-[var(--text-muted)] mr-0.5">
                Emoji:
              </span>
              {EMOJIS.map((e) => (
                <motion.button
                  key={e}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => {
                    playSound("click");
                    setEmoji(emoji === e ? null : e);
                    setEmojiOpen(false);
                  }}
                  className="text-[16px] w-[30px] h-[30px] rounded-[8px] flex items-center justify-center"
                  style={{
                    background: emoji === e ? "var(--yellow)" : "var(--warm-white)",
                    border: `2px solid ${emoji === e ? "var(--card-border)" : "rgba(44,26,14,0.15)"}`,
                  }}
                >
                  {e}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-1.5 mb-2">
        <motion.button
          whileTap={{ scale: 0.94 }}
          className="btn-ctrl !w-9 !h-9 !rounded-[10px]"
          onClick={() => {
            playSound("click");
            setEmojiOpen((v) => !v);
          }}
          title="Pilih emoji (opsional)"
          aria-label="Pilih emoji"
        >
          <Smile size={16} strokeWidth={2.5} />
        </motion.button>
        <input
          className="text-input !py-2 flex-1 min-w-0"
          maxLength={80}
          placeholder="Tulis target hari ini…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void addTask();
          }}
          aria-label="Target baru"
        />
        {/* prioritas: klik untuk siklus low → normal → high */}
        <motion.button
          whileTap={{ scale: 0.94 }}
          className="chip chip-click !text-[10.5px] flex-shrink-0"
          onClick={() => {
            playSound("click");
            const idx = PRIORITY_ORDER.indexOf(priority);
            setPriority(PRIORITY_ORDER[(idx + 1) % PRIORITY_ORDER.length]);
          }}
          title={`Prioritas: ${metaOf(priority).label} (klik untuk ganti)`}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: metaOf(priority).color }} />
          {metaOf(priority).label}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.94 }}
          className="btn-yellow !px-3 flex-shrink-0"
          onClick={() => void addTask()}
          title="Tambah target"
          aria-label="Tambah target"
        >
          <Plus size={16} strokeWidth={3.2} />
        </motion.button>
      </div>

      {/* list hari ini */}
      {!loaded ? (
        <div className="flex flex-col gap-2 py-1">
          <div className="skeleton h-8" />
          <div className="skeleton h-8 w-4/5" />
          <div className="skeleton h-8 w-3/5" />
        </div>
      ) : visibleToday.length > 0 ? (
        <ul>
          <AnimatePresence initial={false}>
            {visibleToday.map((t) => renderRow(t))}
          </AnimatePresence>
        </ul>
      ) : (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-[12.5px] font-semibold text-[var(--text-muted)] py-4"
        >
          {filter === "done"
            ? "Belum ada yang selesai hari ini. Semangat!"
            : filter === "todo"
              ? "Semua target selesai! Kamu luar biasa"
              : "Belum ada target hari ini! Tambah satu yuk"}
        </motion.p>
      )}

      {/* section task lama */}
      {loaded && oldList.length > 0 && (
        <div className="mt-2">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              playSound("click");
              setOldOpen((v) => !v);
            }}
            className="flex items-center gap-1.5 font-head text-[11.5px] font-bold text-[var(--text-muted)]"
            aria-expanded={oldOpen}
          >
            <motion.span animate={{ rotate: oldOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={14} strokeWidth={3} />
            </motion.span>
            Sebelumnya ({oldList.filter((t) => !t.done).length} belum selesai)
          </motion.button>
          <AnimatePresence initial={false}>
            {oldOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <ul className="pt-1">
                  <AnimatePresence initial={false}>
                    {oldList.map((t) => renderRow(t))}
                  </AnimatePresence>
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
