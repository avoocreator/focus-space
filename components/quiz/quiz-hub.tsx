"use client";

// ═════════════════════════════════════════════════════════════
//  QuizHub — halaman /quiz: arena kuis.
//  • Tab Publik (realtime INSERT) & Kuis Saya (+ lokal)
//  • Masuk room dengan kode 6 karakter
//  • Kartu: Solo Latihan (solo-{id}) & Host Bareng (host-{id})
//  • Edit / hapus kuis milik sendiri (DB atau localStorage)
// ═════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Dices,
  FileText,
  Flame,
  Folder,
  Gamepad2,
  Globe,
  Inbox,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Save,
  Search,
  Settings,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { playSound } from "@/components/ui/sfx";
import { Modal } from "@/components/ui/modal";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { cn, timeAgo } from "@/lib/utils";
import type { QuizSetDTO } from "@/lib/types";
import { buildDemoSet, deleteLocalSet, loadLocalSets } from "./quiz-shared";

type Tab = "publik" | "saya";

export default function QuizHub() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("publik");
  const [publicSets, setPublicSets] = useState<QuizSetDTO[]>([]);
  const [mySets, setMySets] = useState<QuizSetDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<QuizSetDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── muat kuis publik + milikku ──
  const loadMine = useCallback(async () => {
    const local = loadLocalSets();
    if (!isSupabaseConfigured || !user) {
      setMySets(local);
      return;
    }
    try {
      const sb = getSupabase();
      const { data, error } = await sb
        .from("quiz_sets")
        .select("*")
        .eq("host_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      const dbSets = (!error && data ? data : []) as QuizSetDTO[];
      // gabung: set lokal (id "local-…") + set DB, dedupe by id
      const seen = new Set(dbSets.map((s) => s.id));
      setMySets([...local.filter((s) => !seen.has(s.id)), ...dbSets]);
    } catch {
      setMySets(local);
    }
  }, [user]);

  useEffect(() => {
    let alive = true;
    if (!isSupabaseConfigured) {
      setPublicSets([buildDemoSet()]);
      setLoading(false);
      void loadMine();
      return;
    }
    (async () => {
      try {
        const sb = getSupabase();
        const { data, error } = await sb
          .from("quiz_sets")
          .select("*")
          .eq("is_public", true)
          .order("created_at", { ascending: false })
          .limit(60);
        if (alive && !error && data) setPublicSets(data as QuizSetDTO[]);
      } catch {
        /* tampil kosong saja */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    void loadMine();
    return () => {
      alive = false;
    };
  }, [loadMine]);

  // ── realtime: kuis publik baru langsung muncul ──
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = getSupabase();
    const ch = sb
      .channel("quiz-sets-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "quiz_sets", filter: "is_public=eq.true" },
        (payload) => {
          const row = payload.new as unknown as QuizSetDTO;
          setPublicSets((prev) => (prev.some((s) => s.id === row.id) ? prev : [row, ...prev]));
        }
      )
      .subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, []);

  // refresh "Kuis Saya" saat kembali ke tab ini (setelah buat/edit)
  useEffect(() => {
    if (tab === "saya") void loadMine();
  }, [tab, loadMine]);

  const shown = useMemo(() => {
    const src = tab === "publik" ? publicSets : mySets;
    const q = query.trim().toLowerCase();
    if (!q) return src;
    return src.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.topic || "").toLowerCase().includes(q) ||
        s.host_name.toLowerCase().includes(q)
    );
  }, [tab, publicSets, mySets, query]);

  const joinRoom = () => {
    const code = joinCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (code.length !== 6) {
      toast("error", "Kode room harus 6 karakter ya");
      return;
    }
    playSound("click");
    router.push(`/quiz/play/${code}`);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.id.startsWith("local-")) {
        deleteLocalSet(deleteTarget.id);
      } else if (isSupabaseConfigured) {
        const sb = getSupabase();
        const { error } = await sb.from("quiz_sets").delete().eq("id", deleteTarget.id);
        if (error) throw error;
      }
      playSound("success");
      toast("success", "Kuis dihapus");
      setPublicSets((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setMySets((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      toast("error", "Gagal menghapus kuis");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-slideUp">
      {/* ══ HEADER ══ */}
      <div className="card flex flex-wrap items-center gap-3">
        <div className="badge-emoji !w-[46px] !h-[46px] flex items-center justify-center animate-wiggle">
          <Dices size={26} strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-[180px]">
          <h1 className="font-head text-[22px] font-bold leading-tight">Arena Kuis</h1>
          <p className="text-[12px] font-semibold text-[var(--text-muted)]">
            Latihan solo, atau host bareng teman ala panggung kuis live{" "}
            <Sparkles size={12} strokeWidth={2.5} className="inline-block" />
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            className="text-input !w-[150px] text-center font-head tracking-[0.2em] uppercase"
            placeholder="KODE"
            maxLength={6}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && joinRoom()}
            aria-label="Kode room"
          />
          <button
            className="btn-secondary !px-3 inline-flex items-center gap-1.5"
            onClick={joinRoom}
            disabled={joinCode.length !== 6}
            title="Masuk room kuis dengan kode"
          >
            <KeyRound size={14} strokeWidth={2.5} />
            Masuk dengan kode
          </button>
        </div>

        <Link
          href="/quiz/create"
          className="btn-primary inline-flex items-center gap-1"
          onClick={() => playSound("click")}
        >
          <Plus size={15} strokeWidth={2.5} />
          Buat Kuis
        </Link>
      </div>

      {!isSupabaseConfigured && (
        <div className="card !p-3.5 !border-[var(--yellow-dark)]">
          <p className="text-[12.5px] font-semibold">
            <Settings size={14} strokeWidth={2.5} className="inline-block mr-1" />
            <b>Supabase belum dikonfigurasi.</b> Kuis online (bareng & simpan) butuh koneksi —
            untuk sementara coba <b>Kuis Demo</b> mode solo. Lihat{" "}
            <a className="underline font-bold" href="/setup" style={{ color: "var(--accent-deep)" }}>
              Panduan Setup
            </a>
            .
          </p>
        </div>
      )}

      {/* ══ TABS + SEARCH ══ */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={cn("chip chip-click", tab === "publik" && "chip-active")}
          onClick={() => {
            setTab("publik");
            playSound("click");
          }}
        >
          <Globe size={13} strokeWidth={2.5} className="mr-1 inline-block" />
          Publik
        </button>
        <button
          className={cn("chip chip-click", tab === "saya" && "chip-active")}
          onClick={() => {
            setTab("saya");
            playSound("click");
          }}
        >
          <Folder size={13} strokeWidth={2.5} className="mr-1 inline-block" />
          Kuis Saya
        </button>
        <div className="flex-1" />
        <input
          className="text-input !w-[200px] !py-2"
          placeholder="Cari judul / topik…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* ══ DAFTAR ══ */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-[168px]" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="card text-center py-12">
          <div className="flex justify-center animate-bouncy text-[var(--text-muted)]">
            {tab === "publik" ? (
              <Search size={40} strokeWidth={2.5} />
            ) : (
              <Inbox size={40} strokeWidth={2.5} />
            )}
          </div>
          <p className="font-head font-bold mt-2">
            {tab === "publik" ? "Belum ada kuis publik" : "Kamu belum punya kuis"}
          </p>
          <p className="text-[12px] font-semibold text-[var(--text-muted)] mt-1">
            {tab === "publik"
              ? "Jadilah yang pertama membagikan kuis!"
              : "Buat kuis pertamamu dengan bantuan AI"}
          </p>
          <Link
            href="/quiz/create"
            className="btn-primary mt-4 inline-flex items-center gap-1"
          >
            <Plus size={15} strokeWidth={2.5} />
            Buat Kuis
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {shown.map((s, i) => (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 320, damping: 26, delay: Math.min(i * 0.03, 0.3) }}
              >
                <SetCard
                  set={s}
                  mine={tab === "saya"}
                  onEdit={() => {
                    playSound("click");
                    router.push(`/quiz/create?edit=${s.id}`);
                  }}
                  onDelete={() => setDeleteTarget(s)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ══ MODAL HAPUS ══ */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus kuis ini?"
        sub={`"${deleteTarget?.title ?? ""}" akan hilang permanen beserta semua soalnya.`}
      >
        <div className="modal-actions">
          <button className="btn-danger" onClick={confirmDelete} disabled={deleting}>
            {deleting ? "Menghapus…" : "Ya, Hapus"}
          </button>
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>
            Batal
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  Kartu kuis
// ═════════════════════════════════════════════════════════════
function SetCard({
  set,
  mine,
  onEdit,
  onDelete,
}: {
  set: QuizSetDTO;
  mine: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const go = (path: string) => {
    playSound("click");
    router.push(path);
  };

  return (
    <div className="card card-hover h-full flex flex-col gap-2.5">
      <div className="flex items-start gap-3">
        <div className="badge-emoji !w-[52px] !h-[52px] !text-[27px]">{set.emoji}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-head text-[15px] font-bold leading-snug line-clamp-2">{set.title}</h3>
          <p className="text-[11.5px] font-semibold text-[var(--text-muted)] truncate">
            <UserRound size={12} strokeWidth={2.5} className="inline-block mr-0.5" />
            {set.host_name}
            {set.topic ? ` · ${set.topic}` : ""}
          </p>
        </div>
        {mine && (
          <div className="flex gap-0.5">
            <button className="btn-icon-sm" title="Edit kuis" onClick={onEdit}>
              <Pencil size={15} strokeWidth={2.5} />
            </button>
            <button className="btn-icon-sm" title="Hapus kuis" onClick={onDelete}>
              <Trash2 size={15} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="chip !text-[11px]">
          <FileText size={12} strokeWidth={2.5} className="mr-1 inline-block" />
          {set.questions.length} soal
        </span>
        <span className="chip !text-[11px]">
          <Flame size={12} strokeWidth={2.5} className="mr-1 inline-block" />
          {set.plays}x main
        </span>
        {!set.is_public && (
          <span className="chip !text-[11px]">
            <Lock size={12} strokeWidth={2.5} className="mr-1 inline-block" />
            Privat
          </span>
        )}
        {set.id.startsWith("local-") && (
          <span className="chip !text-[11px]">
            <Save size={12} strokeWidth={2.5} className="mr-1 inline-block" />
            Lokal
          </span>
        )}
        <span className="ml-auto text-[10.5px] font-bold text-[var(--text-muted)]">
          {timeAgo(set.created_at)}
        </span>
      </div>

      <div className="flex gap-2 mt-auto pt-1">
        <button
          className="btn-yellow flex-1 !text-[12.5px]"
          onClick={() => go(`/quiz/play/solo-${set.id}`)}
          title="Latihan mandiri dengan timer & skor"
        >
          Solo Latihan
        </button>
        <button
          className="btn-primary flex-1 !text-[12.5px] inline-flex items-center justify-center gap-1.5"
          onClick={() => go(`/quiz/play/host-${set.id}`)}
          title="Buat room live, bagikan kode ke temanmu"
        >
          <Gamepad2 size={14} strokeWidth={2.5} />
          Host Bareng
        </button>
      </div>
    </div>
  );
}
