"use client";

// ═══════════════════════════════════════════════════════════
//  VoiceChannelsCard — daftar voice channel dalam ruangan.
//
//  - List dari tabel `voice_channels` (by room_name) + realtime
//    postgres_changes INSERT/DELETE.
//  - Badge jumlah orang live per channel via presence ringan di
//    channel `vcpres:{channelId}` (track hanya saat aktif join).
//  - Join WebRTC mesh via useVoiceChannel — hanya SATU channel
//    aktif dalam satu waktu; join lain = leave dulu.
//  - Wajib default export dengan props { roomName: string }
//    (dipakai app/rooms/[name]/page.tsx).
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Headphones, Mic, MicOff, Plus, Volume1, VolumeX } from "lucide-react";
import { REALTIME_SUBSCRIBE_STATES, type RealtimeChannel } from "@supabase/supabase-js";
import ParticipantTile from "@/components/voice/participant-tile";
import { useVoiceChannel } from "@/lib/voice/use-voice-channel";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { playSound } from "@/components/ui/sfx";
import { cn, clamp } from "@/lib/utils";
import type { VoiceChannelDTO } from "@/lib/types";

type Props = { roomName: string };

export default function VoiceChannelsCard({ roomName }: Props) {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  // ── daftar channel + state UI ──
  const [channels, setChannels] = useState<VoiceChannelDTO[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [wantJoin, setWantJoin] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  // ── hook voice (SATU instance — satu channel aktif) ──
  const { joined, joining, join, leave, peers, muted, deafened, toggleMute, toggleDeafen, error, localLevel } =
    useVoiceChannel(activeId);

  const myName = profile?.display_name?.trim() || "Tamu";
  const myAvatar = profile?.avatar || "🐣"; // avatar default — pengecualian (avatar boleh emoji)

  // ── map channel presence vcpres:{id} untuk badge live count ──
  const vcpresRef = useRef(new Map<string, RealtimeChannel>());
  const vcpresReadyRef = useRef(new Set<string>());

  // ── join channel (leave dulu kalau sedang di channel lain) ──
  const handleJoin = useCallback(
    (id: string) => {
      if (id === activeId) return;
      if (activeId) leave(); // hanya SATU channel — keluar dulu
      setActiveId(id);
      setWantJoin(true);
      playSound("click");
    },
    [activeId, leave]
  );

  const handleLeave = useCallback(() => {
    leave();
    setActiveId(null);
    setWantJoin(false);
    playSound("click");
  }, [leave]);

  // setelah channelId efektif berubah (leave lama sudah jalan di cleanup
  // hook), eksekusi join yang tertunda
  useEffect(() => {
    if (!wantJoin) return;
    setWantJoin(false);
    if (!activeId) return;
    void join();
  }, [wantJoin, activeId, join]);

  // ── muat channel ruangan + realtime INSERT/DELETE ──
  useEffect(() => {
    if (!isSupabaseConfigured || !roomName) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    const sb = getSupabase();
    (async () => {
      const { data } = await sb
        .from("voice_channels")
        .select("*")
        .eq("room_name", roomName)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setChannels((data as VoiceChannelDTO[]) ?? []);
      setLoaded(true);
    })();

    const listCh = sb
      .channel(`vclist:${roomName}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "voice_channels",
          filter: `room_name=eq.${roomName}`,
        },
        (payload) => {
          const row = payload.new as VoiceChannelDTO | null;
          if (!row?.id) return;
          setChannels((prev) => (prev.some((c) => c.id === row.id) ? prev : [...prev, row]));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "voice_channels",
          filter: `room_name=eq.${roomName}`,
        },
        (payload) => {
          const old = payload.old as { id?: string } | null;
          const id = old?.id;
          if (!id) return;
          setChannels((prev) => prev.filter((c) => c.id !== id));
          setActiveId((cur) => (cur === id ? null : cur)); // hook auto-leave
          setWantJoin(false);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void sb.removeChannel(listCh);
    };
  }, [roomName]);

  // ── subscribe presence count untuk tiap channel di daftar ──
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = getSupabase();
    for (const c of channels) {
      if (vcpresRef.current.has(c.id)) continue;
      const ch = sb.channel(`vcpres:${c.id}`);
      ch.on("presence", { event: "sync" }, () => {
        const n = Object.keys(ch.presenceState()).length;
        setCounts((prev) => (prev[c.id] === n ? prev : { ...prev, [c.id]: n }));
      });
      vcpresRef.current.set(c.id, ch);
      void ch.subscribe((status) => {
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          vcpresReadyRef.current.add(c.id);
        } else if (
          status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
          status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT ||
          status === REALTIME_SUBSCRIBE_STATES.CLOSED
        ) {
          vcpresReadyRef.current.delete(c.id);
        }
      });
    }
    // buang subscription untuk channel yang sudah tidak ada di daftar
    for (const [id, ch] of Array.from(vcpresRef.current)) {
      if (!channels.some((c) => c.id === id)) {
        void sb.removeChannel(ch);
        vcpresRef.current.delete(id);
        vcpresReadyRef.current.delete(id);
        setCounts((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    }
  }, [channels]);

  // ── unmount: buang semua channel vcpres ──
  useEffect(() => {
    return () => {
      const sb = getSupabase();
      for (const ch of Array.from(vcpresRef.current.values())) void sb.removeChannel(ch);
      vcpresRef.current.clear();
      vcpresReadyRef.current.clear();
    };
  }, []);

  // ── track/untrack presence SAYA di channel yang sedang dijoin ──
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const ch = activeId ? vcpresRef.current.get(activeId) : undefined;
    if (joined && activeId && ch && vcpresReadyRef.current.has(activeId)) {
      void ch.track({ name: myName, avatar: myAvatar }).catch(() => {});
    } else {
      void ch?.untrack().catch(() => {});
    }
  }, [joined, activeId, channels, myName, myAvatar]);

  // ── toast error dari hook ──
  useEffect(() => {
    if (error) toast("error", error);
  }, [error, toast]);

  // ── buat channel baru (Enter / tombol) ──
  const submitNew = useCallback(async () => {
    const name = newName.trim().replace(/\s+/g, " ");
    if (!name) return;
    if (name.length > 30) {
      toast("error", "Nama channel maksimal 30 huruf");
      return;
    }
    if (channels.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast("error", "Nama channel sudah dipakai");
      return;
    }
    try {
      const { data, error: insErr } = await getSupabase()
        .from("voice_channels")
        .insert({ room_name: roomName, name, created_by: user?.id ?? null })
        .select()
        .single();
      if (insErr || !data) {
        toast("error", "Gagal buat channel — coba lagi");
        return;
      }
      const created = data as VoiceChannelDTO;
      setChannels((prev) => (prev.some((c) => c.id === created.id) ? prev : [...prev, created]));
      setNewName("");
      setCreating(false);
      toast("success", `Channel "${name}" siap dipakai`);
      playSound("check");
    } catch {
      toast("error", "Gagal buat channel — coba lagi");
    }
  }, [newName, channels, roomName, user?.id, toast]);

  // ── turunan untuk UI ──
  const activeChannel = channels.find((c) => c.id === activeId) ?? null;
  const levelPct = Math.round(clamp(localLevel * 250, 0, 100));
  const selfSpeaking = localLevel > 0.06;

  return (
    <div className="card !py-3">
      {/* header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="micro-title inline-flex items-center gap-1">
          <Mic size={13} strokeWidth={2.5} />
          Voice Channels
        </span>
        <button
          type="button"
          className="btn-icon-sm"
          title="Buat channel baru"
          aria-label="Buat channel baru"
          onClick={() => {
            setCreating((v) => !v);
            setNewName("");
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
        </button>
      </div>

      {!isSupabaseConfigured ? (
        <div className="py-2 text-center">
          <p className="mb-2 text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
            Voice butuh koneksi database — Supabase belum diatur.
          </p>
          <Link href="/setup" className="btn-secondary !px-3 !py-1.5 !text-[12px]">
            Ke /setup
          </Link>
        </div>
      ) : (
        <>
          {/* form buat channel inline */}
          {creating && (
            <div className="mb-2 flex animate-slideUp gap-1.5">
              <input
                autoFocus
                className="text-input flex-1 !px-2.5 !py-1.5 !text-[12px]"
                placeholder="Nama channel baru…"
                maxLength={30}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitNew();
                  if (e.key === "Escape") setCreating(false);
                }}
              />
              <button
                type="button"
                className="btn-primary !px-3 !py-1.5 !text-[12px]"
                onClick={() => void submitNew()}
              >
                Buat
              </button>
            </div>
          )}

          {/* daftar channel */}
          <div className="flex max-h-[280px] flex-col gap-1.5 overflow-y-auto pr-0.5">
            {!loaded ? (
              <>
                <div className="skeleton h-8 w-full" />
                <div className="skeleton h-8 w-full" />
              </>
            ) : channels.length === 0 ? (
              <p className="py-1 text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
                Belum ada channel — buat lewat tombol tambah di atas
              </p>
            ) : (
              channels.map((c) => {
                const isActive = c.id === activeId;
                const liveCount = isActive
                  ? (counts[c.id] ?? (joined ? peers.length + 1 : 0))
                  : (counts[c.id] ?? 0);
                return (
                  <div
                    key={c.id}
                    className="overflow-hidden rounded-[12px] border-2 border-cardline bg-warmwhite"
                    style={{ boxShadow: "var(--shadow-sm)" }}
                  >
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <span
                        className="flex-1 truncate font-head text-[12.5px] font-semibold"
                        title={c.name}
                      >
                        <Headphones size={13} strokeWidth={2.5} className="mr-1 inline-block align-[-2px]" />
                        {c.name}
                      </span>
                      {liveCount > 0 && (
                        <span className={cn("chip !px-2 !py-0 !text-[9px]", isActive && joined && "chip-active")}>
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0"
                            style={{ background: "var(--green)" }}
                            aria-hidden
                          />
                          {liveCount}
                        </span>
                      )}
                      {isActive ? (
                        <button
                          type="button"
                          className="btn-danger !px-2.5 !py-1 !text-[11px]"
                          onClick={handleLeave}
                        >
                          Keluar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-primary !px-2.5 !py-1 !text-[11px]"
                          onClick={() => handleJoin(c.id)}
                          disabled={joining}
                        >
                          Gabung
                        </button>
                      )}
                    </div>

                    {/* expand: tiles + kontrol saat channel aktif */}
                    {isActive && (
                      <div className="animate-slideUp px-2 pb-2">
                        {joining && !joined && (
                          <p className="micro-title !text-[10px] pb-1.5">menyambungkan mic…</p>
                        )}
                        <div className="grid grid-cols-2 gap-1.5">
                          <ParticipantTile
                            name={myName}
                            avatar={myAvatar}
                            speaking={selfSpeaking}
                            connection="connected"
                            hasAudio={!muted}
                            isSelf
                          />
                          {peers.map((p) => (
                            <ParticipantTile
                              key={p.id}
                              name={p.name}
                              avatar={p.avatar}
                              speaking={p.speaking}
                              connection={p.connection}
                              hasAudio={!!p.stream}
                            />
                          ))}
                        </div>

                        {/* bar kontrol */}
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            className={cn(
                              "btn-ctrl !h-9 !w-9 !text-[15px]",
                              muted ? "!bg-red text-white" : "animate-pulseDot"
                            )}
                            title={muted ? "Nyalakan mic" : "Mute mic"}
                            aria-label={muted ? "Nyalakan mic" : "Mute mic"}
                            onClick={toggleMute}
                            disabled={!joined && !joining}
                          >
                            {muted ? <MicOff size={16} strokeWidth={2.5} /> : <Mic size={16} strokeWidth={2.5} />}
                          </button>
                          <button
                            type="button"
                            className="btn-ctrl !h-9 !w-9 !text-[15px]"
                            title={deafened ? "Nyalakan suara" : "Bisukan semua suara"}
                            aria-label={deafened ? "Nyalakan suara" : "Bisukan semua suara"}
                            onClick={toggleDeafen}
                            disabled={!joined && !joining}
                          >
                            {deafened ? <VolumeX size={16} strokeWidth={2.5} /> : <Volume1 size={16} strokeWidth={2.5} />}
                          </button>
                          <div
                            className="h-3 flex-1 overflow-hidden rounded-full border-2 border-cardline bg-warmwhite"
                            aria-hidden
                          >
                            <div
                              className="h-full transition-[width] duration-150"
                              style={{
                                width: `${levelPct}%`,
                                background: "linear-gradient(90deg, var(--green), var(--accent))",
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            className="btn-danger !px-2.5 !py-1 !text-[11px]"
                            onClick={handleLeave}
                          >
                            Tinggalkan
                          </button>
                        </div>

                        {error && (
                          <p
                            className="animate-shake mt-1.5 text-[11px] font-bold"
                            style={{ color: "var(--red-dark)" }}
                          >
                            {error}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {!activeChannel && (
            <p className="mt-2 text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>
              P2P langsung antar-browser — ideal sampai 8 orang
            </p>
          )}
        </>
      )}
    </div>
  );
}
