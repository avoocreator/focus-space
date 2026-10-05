"use client";

// ═════════════════════════════════════════════════════════════
//  RoomsLobby — halaman /rooms: daftar ruangan realtime,
//  jumlah online live, cari, buat & hapus ruangan, gerbang
//  password.
//
//  KENAPA ONLINE COUNT PAKAI SATU CHANNEL BERSAMA "fs-lobby"?
//  Daripada lobi harus subscribe presence ke channel tiap
//  ruangan (N channel = N koneksi realtime), setiap HALAMAN
//  RUANGAN melakukan track presence ke SATU channel global
//  "fs-lobby" dengan payload {room, name, avatar}. Lobi cukup
//  mendengarkan event "sync" di channel yang sama lalu
//  menghitung jumlah klien per ruangan. Hemat koneksi, selalu
//  akurat, dan otomatis ter-update saat ada yang join/leave.
// ═════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Coffee,
  Crown,
  DoorOpen,
  KeyRound,
  Lock,
  Moon,
  Plus,
  Search,
  Settings,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { Modal } from "@/components/ui/modal";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { StudyRoomDTO } from "@/lib/types";
import CreateRoomModal from "./create-room-modal";
import PasswordModal from "./password-modal";

/** payload presence di channel "fs-lobby" (dikirim halaman ruangan) */
type LobbyPresence = { room: string; name: string; avatar: string };

export default function RoomsLobby() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [rooms, setRooms] = useState<StudyRoomDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineByRoom, setOnlineByRoom] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<StudyRoomDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudyRoomDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── load daftar ruangan ──
  const loadRooms = useCallback(async () => {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("study_rooms")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setRooms(data as StudyRoomDTO[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      toast("info", "Supabase belum disetel — buka /setup untuk panduan");
      return;
    }
    void loadRooms();
  }, [loadRooms, toast]);

  // ── realtime daftar ruangan: room baru/dihapus langsung muncul ──
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = getSupabase();
    const ch = sb
      .channel("rooms-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "study_rooms" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as unknown as StudyRoomDTO;
          setRooms((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev]));
        } else if (payload.eventType === "DELETE") {
          const old = payload.old as unknown as { id?: string };
          setRooms((prev) => prev.filter((r) => r.id !== old?.id));
        } else if (payload.eventType === "UPDATE") {
          const row = payload.new as unknown as StudyRoomDTO;
          setRooms((prev) => prev.map((r) => (r.id === row.id ? row : r)));
        }
      })
      .subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, []);

  // ── presence "fs-lobby": hitung klien online per ruangan (lihat catatan atas) ──
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = getSupabase();
    const ch = sb.channel("fs-lobby").on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<LobbyPresence>();
      const counts: Record<string, number> = {};
      for (const metas of Object.values(state)) {
        for (const p of metas) {
          if (p?.room) counts[p.room] = (counts[p.room] || 0) + 1;
        }
      }
      setOnlineByRoom(counts);
    });
    // lobi hanya MENDENGAR (tidak track — lobi bukan anggota ruangan mana pun)
    ch.subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, []);

  const roomsWithOnline = useMemo(
    () => rooms.map((r) => ({ ...r, online: onlineByRoom[r.name] ?? 0 })),
    [rooms, onlineByRoom]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roomsWithOnline;
    return roomsWithOnline.filter((r) => r.name.toLowerCase().includes(q));
  }, [roomsWithOnline, query]);

  const enterRoom = (room: StudyRoomDTO) => {
    if (room.password_hash) {
      setPasswordTarget(room); // gerbang password dulu
    } else {
      router.push(`/rooms/${room.name}`);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const sb = getSupabase();
    const { error } = await sb.from("study_rooms").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast("error", "Gagal menghapus ruangan (cuma owner yang bisa)");
      return;
    }
    setRooms((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast("success", "Ruangan dihapus — terima kasih atas kopinya");
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-head text-[22px] font-bold leading-tight flex items-center gap-2">
            <DoorOpen size={24} strokeWidth={2.5} />
            Ruangan Belajar
          </h1>
          <p className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
            Pilih kafe untuk belajar bareng — atau bikin ruanganmu sendiri
          </p>
        </div>
        <div className="flex-1" />
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <span className="inline-flex items-center gap-1.5">
            <Plus size={16} strokeWidth={2.5} />
            Buat Ruangan
          </span>
        </button>
      </div>

      {/* ── pencarian ── */}
      <div className="relative max-w-[420px]">
        <input
          className="text-input !pl-9"
          placeholder="Cari ruangan…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}>
          <Search size={14} strokeWidth={2.5} />
        </span>
      </div>

      {/* ── konten ── */}
      {!isSupabaseConfigured ? (
        <div className="card text-center py-14">
          <div className="flex justify-center" style={{ color: "var(--text-muted)" }}>
            <Settings size={28} strokeWidth={2.5} />
          </div>
          <h3 className="font-head text-[17px] font-bold mt-2">Supabase belum disetel</h3>
          <p className="text-[12.5px] font-semibold mt-1" style={{ color: "var(--text-muted)" }}>
            Daftar ruangan, chat, dan presence butuh koneksi database
          </p>
          <Link href="/setup" className="btn-primary mt-4">
            Buka Panduan Setup
          </Link>
        </div>
      ) : loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card !p-4">
              <div className="flex items-center gap-2.5">
                <div className="skeleton !w-[34px] !h-[34px] !rounded-full" />
                <div className="flex-1 flex flex-col gap-2">
                  <div className="skeleton h-4 w-2/3" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-14">
          <div className="flex justify-center animate-bouncy" style={{ color: "var(--accent)" }}>
            {query.trim() ? <Search size={28} strokeWidth={2.5} /> : <Coffee size={28} strokeWidth={2.5} />}
          </div>
          <h3 className="font-head text-[17px] font-bold mt-2">
            {query.trim() ? `Tidak ada ruangan "${query.trim()}"` : "Belum ada ruangan"}
          </h3>
          <p className="text-[12.5px] font-semibold mt-1" style={{ color: "var(--text-muted)" }}>
            {query.trim() ? "Coba kata kunci lain ya" : "Jadi yang pertama buat kafe ramai!"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r, i) => {
            const isOwner = !!user && r.owner_id === user.id;
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.25 }}
                className="card card-hover cursor-pointer !p-4"
                onClick={() => enterRoom(r)}
              >
                <div className="flex items-start gap-2.5">
                  <span className="badge-emoji" style={{ color: "var(--accent-deep)" }}>
                    {r.password_hash ? <Lock size={17} strokeWidth={2.5} /> : <Coffee size={17} strokeWidth={2.5} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="font-head text-[15px] font-bold truncate">{r.name}</h3>
                      {isOwner && (
                        <span title="Ruangan milikmu" className="flex-shrink-0" style={{ color: "var(--accent-deep)" }}>
                          <Crown size={13} strokeWidth={2.5} />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className={cn("chip !text-[10px] !py-0.5", r.online > 0 && "chip-active")}>
                        {r.online > 0 ? (
                          <>
                            <span
                              className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                              style={{ background: "var(--green)" }}
                              aria-hidden
                            />
                            {r.online} online
                          </>
                        ) : (
                          <>
                            <Moon size={10} strokeWidth={2.5} />
                            kosong
                          </>
                        )}
                      </span>
                      {r.password_hash && (
                        <span className="chip !text-[10px] !py-0.5">
                          <KeyRound size={10} strokeWidth={2.5} />
                          berkunci
                        </span>
                      )}
                    </div>
                  </div>
                  {isOwner && (
                    <button
                      className="btn-icon-sm flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(r);
                      }}
                      title="Hapus ruangan"
                      aria-label={`Hapus ruangan ${r.name}`}
                    >
                      <Trash2 size={16} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── modals ── */}
      <CreateRoomModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(name) => {
          setCreateOpen(false);
          router.push(`/rooms/${name}`);
        }}
      />
      <PasswordModal room={passwordTarget} onClose={() => setPasswordTarget(null)} />

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus ruangan ini?"
        sub={deleteTarget ? `"${deleteTarget.name}" akan hilang dari daftar — teman-teman tidak bisa masuk lagi.` : ""}
      >
        <div className="card !bg-red !py-3 flex items-center gap-2.5 !border-red">
          <TriangleAlert size={20} strokeWidth={2.5} className="flex-shrink-0 text-white" />
          <p className="text-[12.5px] font-bold text-white">
            Tindakan ini tidak bisa dibatalkan ya!
          </p>
        </div>
        <div className="modal-actions">
          <button className="btn-danger flex-1" onClick={() => void doDelete()} disabled={deleting}>
            {deleting ? (
              "Menghapus…"
            ) : (
              <span className="inline-flex items-center justify-center gap-1.5">
                <Trash2 size={14} strokeWidth={2.5} />
                Ya, Hapus
              </span>
            )}
          </button>
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Batal
          </button>
        </div>
      </Modal>
    </div>
  );
}
