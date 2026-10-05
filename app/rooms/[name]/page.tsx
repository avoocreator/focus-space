"use client";

// ═════════════════════════════════════════════════════════════
//  /rooms/[name] — di dalam ruangan.
//  Kiri: chat besar (RoomChat). Kanan: sidebar (anggota presence,
//  voice channels, kata semangat, link undangan). Mobile: chat
//  penuh, sidebar jadi bottom-sheet yang bisa dibuka-tutup.
//
//  Presence:
//  - channel `room:{name}`  → daftar anggota ruangan ini.
//  - channel `fs-lobby`     → SATU channel global yang juga
//    didengar lobi /rooms untuk menghitung online per ruangan
//    (lihat penjelasan di components/rooms/rooms-lobby.tsx).
//  Semua channel di-untrack + removeChannel saat unmount / path
//  berubah (cleanup useEffect) supaya tidak ada kebocoran.
// ═════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import VoiceChannelsCard from "@/components/voice/voice-channels-card";
import RoomChat, { type ChatIdentity } from "@/components/rooms/room-chat";
import RoomMembersCard, { type RoomMember } from "@/components/rooms/room-members-card";
import KataSemangatCard from "@/components/rooms/kata-semangat-card";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { StudyRoomDTO } from "@/lib/types";

function normalizeRoomName(raw: string): string {
  let s = raw;
  try {
    s = decodeURIComponent(raw);
  } catch {
    // %malformed — pakai nilai mentah
  }
  return s.toLowerCase().trim();
}

type RoomLoadState = "loading" | "ready" | "missing" | "unconfigured";

export default function Page() {
  const params = useParams<{ name: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile, loading: authLoading } = useAuth();

  const roomName = normalizeRoomName(params?.name ?? "");

  const [roomState, setRoomState] = useState<RoomLoadState>(isSupabaseConfigured ? "loading" : "unconfigured");
  const [room, setRoom] = useState<StudyRoomDTO | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const me = useMemo<ChatIdentity>(
    () => ({
      id: user?.id ?? "guest",
      name: profile?.display_name || "Tamu",
      avatar: profile?.avatar || "🐣",
    }),
    [user?.id, profile?.display_name, profile?.avatar]
  );

  // ── muat data ruangan + nama owner ──
  useEffect(() => {
    if (!roomName) return;
    if (!isSupabaseConfigured) {
      setRoomState("unconfigured");
      return;
    }
    let cancelled = false;
    setRoomState("loading");
    setRoom(null);
    setOwnerName(null);
    const sb = getSupabase();
    (async () => {
      const { data, error } = await sb.from("study_rooms").select("*").eq("name", roomName).maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setRoomState("missing");
        return;
      }
      const row = data as StudyRoomDTO;
      setRoom(row);
      setRoomState("ready");
      if (row.owner_id) {
        const { data: prof } = await sb
          .from("profiles")
          .select("display_name")
          .eq("id", row.owner_id)
          .maybeSingle();
        if (!cancelled && prof) setOwnerName((prof as { display_name: string }).display_name);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomName]);

  // ── JOIN presence ruangan: channel `room:{name}` ──
  useEffect(() => {
    if (roomState !== "ready" || authLoading || !isSupabaseConfigured) return;
    const sb = getSupabase();
    const ch = sb.channel(`room:${roomName}`);
    const syncMembers = () => {
      const state = ch.presenceState<RoomMember>();
      // dedupe: user yang buka 2 tab tetap dihitung satu anggota
      const seen = new Map<string, RoomMember>();
      for (const metas of Object.values(state)) {
        for (const p of metas) {
          if (p?.user_id && !seen.has(p.user_id)) seen.set(p.user_id, p);
        }
      }
      setMembers(Array.from(seen.values()));
    };
    ch.on("presence", { event: "sync" }, syncMembers);
    void ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({
          user_id: me.id,
          name: me.name,
          avatar: me.avatar,
          status: profile?.status || "focus",
        });
      }
    });
    return () => {
      void ch.untrack();
      void sb.removeChannel(ch);
      setMembers([]);
    };
  }, [roomName, roomState, authLoading, me.id, me.name, me.avatar, profile?.status]);

  // ── umumkan kehadiran ke lobi via channel global "fs-lobby" ──
  useEffect(() => {
    if (roomState !== "ready" || authLoading || !isSupabaseConfigured) return;
    const sb = getSupabase();
    const ch = sb.channel("fs-lobby");
    void ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ room: roomName, name: me.name, avatar: me.avatar });
      }
    });
    return () => {
      void ch.untrack();
      void sb.removeChannel(ch);
    };
  }, [roomName, roomState, authLoading, me.id, me.name, me.avatar]);

  const copyInvite = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/rooms/${roomName}`);
      toast("success", "Link undangan disalin! Bagikan ke temanmu ☕");
    } catch {
      toast("error", "Gagal menyalin link 😢");
    }
  }, [roomName, toast]);

  // ── keadaan khusus ──
  if (!isSupabaseConfigured || roomState === "unconfigured") {
    return (
      <div className="card text-center py-14">
        <div className="text-[46px]">⚙️</div>
        <h3 className="font-head text-[17px] font-bold mt-2">Supabase belum disetel</h3>
        <p className="text-[12.5px] font-semibold mt-1" style={{ color: "var(--text-muted)" }}>
          Chat ruangan butuh koneksi database ☕
        </p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <Link href="/setup" className="btn-primary">
            Buka Panduan Setup
          </Link>
          <Link href="/rooms" className="btn-secondary">
            ← Kembali
          </Link>
        </div>
      </div>
    );
  }

  if (roomState === "missing") {
    return (
      <div className="card text-center py-14">
        <div className="text-[46px] animate-wiggle">🚪💨</div>
        <h3 className="font-head text-[17px] font-bold mt-2">Ruangan tidak ditemukan</h3>
        <p className="text-[12.5px] font-semibold mt-1" style={{ color: "var(--text-muted)" }}>
          Mungkin sudah dihapus owner-nya, atau memang belum pernah ada 🙈
        </p>
        <Link href="/rooms" className="btn-primary mt-4">
          ← Lihat Ruangan Lain
        </Link>
      </div>
    );
  }

  if (roomState === "loading" || authLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="card !py-3 flex items-center gap-2.5">
          <div className="skeleton !w-[34px] !h-[34px] !rounded-full" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="skeleton h-4 w-1/3" />
            <div className="skeleton h-3 w-1/4" />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="skeleton flex-1 h-[420px]" />
          <div className="skeleton hidden lg:block w-[280px] h-[420px]" />
        </div>
      </div>
    );
  }

  // ── layout utama ──
  return (
    <div className="flex flex-col gap-3">
      {/* header ruangan */}
      <div className="card !py-2.5 !px-3.5 flex items-center gap-2.5 flex-wrap">
        <button className="btn-header-icon flex-shrink-0" onClick={() => router.push("/rooms")} title="Keluar ruangan">
          ←
        </button>
        <span className="text-[22px] flex-shrink-0">💬</span>
        <div className="min-w-0">
          <h1 className="font-head text-[17px] font-bold leading-tight truncate">{roomName}</h1>
          <p className="text-[10.5px] font-semibold leading-tight truncate" style={{ color: "var(--text-muted)" }}>
            {ownerName ? `👑 Dibuat oleh ${ownerName}` : "👑 Ruangan belajar cozy"}
          </p>
        </div>
        <div className="flex-1" />
        <span className="chip !text-[11px]">🟢 {members.length} online</span>
        {room?.password_hash && <span className="chip !text-[11px]">🔒 berkunci</span>}
      </div>

      {/* backdrop bottom-sheet (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[2900] bg-black/40 lg:hidden animate-fadeIn"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex gap-3 items-stretch min-h-0">
        {/* ── kiri: chat ── */}
        <section className="flex-1 min-w-0 min-h-0 h-[calc(100vh-252px)] min-h-[400px] lg:h-[calc(100vh-186px)] lg:min-h-[440px]">
          <RoomChat roomName={roomName} me={me} canPost={!!user} />
        </section>

        {/* ── kanan: sidebar (desktop kolom, mobile bottom-sheet) ── */}
        <aside
          className={cn(
            // mobile: bottom-sheet
            "fixed z-[3000] inset-x-2 bottom-2 max-h-[74vh] flex flex-col gap-3 overflow-y-auto",
            "p-2.5 rounded-[22px] border-[2.5px] border-cardline bg-[var(--cream)] shadow-hard-xl",
            "transition-transform duration-300 ease-out",
            sidebarOpen ? "translate-y-0" : "translate-y-[120%]",
            // desktop: kolom statis 280px
            "lg:static lg:z-auto lg:inset-auto lg:w-[280px] lg:flex-shrink-0 lg:max-h-[calc(100vh-186px)]",
            "lg:p-0 lg:bg-transparent lg:border-0 lg:shadow-none lg:rounded-none lg:translate-y-0 lg:overflow-y-auto"
          )}
        >
          <button className="btn-secondary lg:hidden !py-2 flex-shrink-0" onClick={() => setSidebarOpen(false)}>
            ✕ Tutup
          </button>

          <RoomMembersCard members={members} myUserId={me.id} ownerId={room?.owner_id ?? null} ownerName={ownerName} />

          {/* voice channels (modul voice) */}
          <VoiceChannelsCard roomName={roomName} />

          <KataSemangatCard />

          <button className="btn-secondary !py-2.5 flex-shrink-0" onClick={() => void copyInvite()}>
            🔗 Salin Link Undangan
          </button>
        </aside>
      </div>

      {/* tombol buka sidebar (mobile) */}
      <button
        className="lg:hidden fixed bottom-20 right-4 z-[2800] btn-primary !rounded-full !px-4 !py-3 shadow-hard-lg"
        onClick={() => setSidebarOpen(true)}
        title="Info ruangan, anggota & voice"
      >
        👥 <span className="text-[12px]">Info</span>
      </button>
    </div>
  );
}
