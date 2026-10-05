/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Headphones,
  Music2,
  Pause,
  Play,
  Radio,
  SkipForward,
  Square,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { MUSIC_TRACKS, TRACK_KEYS, playMusic, stopMusic } from "@/lib/music/engine";
import { SpotifyError, spotifyNext, spotifyTogglePlay, syncNowPlaying } from "@/lib/music/spotify";
import { useMusicStore, type RadioTrackKey } from "@/stores/music-store";
import { playSound } from "@/components/ui/sfx";
import { useToast } from "@/components/toast";
import { EqBars } from "@/components/music/eq";

/** Ikon volume dinamis sesuai level. */
function VolumeIcon({ level }: { level: number }) {
  if (level <= 0) return <VolumeX size={16} strokeWidth={2.5} aria-hidden="true" />;
  if (level < 0.5) return <Volume1 size={16} strokeWidth={2.5} aria-hidden="true" />;
  return <Volume2 size={16} strokeWidth={2.5} aria-hidden="true" />;
}

/**
 * MusicDock global — panel musik kecil yang bisa dibuka dari halaman manapun.
 * Kontrak: <MusicDock open={open} onClose={onClose} />
 * Tidak pernah unmount (dipasang di AppShell), musik tetap bunyi lintas halaman.
 */
export default function MusicDock({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const playing = useMusicStore((s) => s.playing);
  const volume = useMusicStore((s) => s.volume);
  const setVolume = useMusicStore((s) => s.setVolume);
  const spotify = useMusicStore((s) => s.spotify);
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
    void useMusicStore.persist.rehydrate();
  }, []);

  // Escape menutup panel
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const handleTrack = (key: RadioTrackKey) => {
    playSound("click");
    playMusic(key);
  };

  const handleStop = () => {
    playSound("click");
    stopMusic();
  };

  const refreshLater = () => {
    window.setTimeout(() => {
      void syncNowPlaying().catch(() => {});
    }, 900);
  };

  const handleSpotifyToggle = async () => {
    const next = !spotify.isPlaying;
    if (next && useMusicStore.getState().playing) stopMusic(true); // jangan tumpuk dengan radio
    try {
      await spotifyTogglePlay(next);
    } catch (e) {
      if (e instanceof SpotifyError && e.status === 404) {
        toast("info", "Tidak ada device Spotify aktif — buka app Spotify dulu");
      } else {
        toast("error", "Gagal mengontrol Spotify");
      }
      return;
    }
    useMusicStore.getState().patchSpotify({ isPlaying: next });
    refreshLater();
  };

  const handleSpotifyNext = async () => {
    try {
      await spotifyNext();
    } catch (e) {
      if (e instanceof SpotifyError && e.status === 404) {
        toast("info", "Tidak ada device Spotify aktif — buka app Spotify dulu");
      } else {
        toast("error", "Gagal skip lagu");
      }
      return;
    }
    refreshLater();
  };

  return (
    <AnimatePresence>
      {open && mounted && (
        <>
          {/* klik luar → tutup */}
          <motion.div
            key="dock-backdrop"
            className="fixed inset-0 z-[2400]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.div
            key="dock-panel"
            className="fixed top-[76px] left-1/2 z-[2500] w-[340px] max-w-[92vw]"
            style={{ x: "-50%" }}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            <div className="card !p-4" style={{ boxShadow: "var(--shadow-lg)" }}>
              <div className="flex items-center justify-between mb-2.5">
                <span className="font-head text-[16px] font-bold flex items-center gap-2">
                  <Headphones size={18} strokeWidth={2.5} aria-hidden="true" />
                  Musik Cozy
                </span>
                <button className="btn-icon-sm !opacity-100" onClick={onClose} title="Tutup" aria-label="Tutup panel musik">
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>

              {/* ══ RADIO COZY ══ */}
              <span className="micro-title flex items-center gap-1.5">
                <Radio size={12} strokeWidth={2.5} aria-hidden="true" />
                Radio Cozy
              </span>
              <div className="mt-1.5 flex flex-col gap-1.5">
                {TRACK_KEYS.map((key) => {
                  const t = MUSIC_TRACKS[key];
                  const active = playing === key;
                  const TrackIcon = t.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => handleTrack(key)}
                      className="w-full flex items-center gap-2.5 p-2 rounded-[12px] text-left transition-all hover:-translate-y-px hover:shadow-[3px_3px_0_var(--card-border)]"
                      style={{
                        background: active ? "var(--yellow)" : "var(--warm-white)",
                        border: "2px solid var(--card-border)",
                        boxShadow: active ? "3px 3px 0 var(--card-border)" : "var(--shadow-sm)",
                      }}
                    >
                      <span className="badge-emoji !w-[30px] !h-[30px]" style={{ color: "var(--text-main)" }}>
                        <TrackIcon size={15} strokeWidth={2.5} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-head text-[13px] font-bold truncate leading-tight">
                          {t.name}
                        </span>
                        <span className="block text-[10.5px] font-semibold text-[var(--text-muted)] truncate leading-tight">
                          {t.desc}
                        </span>
                      </span>
                      {active && <EqBars />}
                    </button>
                  );
                })}
              </div>

              {/* stop (dashed, hover merah) + volume */}
              <button
                onClick={handleStop}
                disabled={!playing}
                className="mt-2.5 w-full rounded-[12px] py-1.5 font-head text-[12px] font-bold border-2 border-dashed border-[var(--card-border)] bg-[var(--warm-white)] text-[var(--text-main)] transition-all hover:!border-[var(--red)] hover:text-[var(--red-dark)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Square size={12} strokeWidth={2.5} aria-hidden="true" />
                Berhenti Musik
              </button>
              <div className="mt-2.5 flex items-center gap-2">
                <VolumeIcon level={volume} />
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(volume * 100)}
                  onChange={(e) => setVolume(Number(e.target.value) / 100)}
                  className="cozy-slider flex-1 !h-3"
                  aria-label="Volume musik"
                />
                <span className="font-head text-[10.5px] font-bold text-[var(--text-muted)] w-[32px] text-right">
                  {Math.round(volume * 100)}%
                </span>
              </div>

              {/* ══ SPOTIFY NOW PLAYING ══ */}
              {spotify.connected && spotify.nowPlaying && (
                <>
                  <hr className="divider-dashed my-3" />
                  <span className="micro-title flex items-center gap-1.5">
                    <Music2 size={12} strokeWidth={2.5} aria-hidden="true" />
                    Spotify
                  </span>
                  <div
                    className="mt-1.5 flex items-center gap-2 p-2 rounded-[12px]"
                    style={{
                      background: "var(--warm-white)",
                      border: "2px solid var(--card-border)",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    {spotify.nowPlaying.art ? (
                      <img
                        src={spotify.nowPlaying.art}
                        alt=""
                        className="w-9 h-9 rounded-[8px] object-cover border-2 flex-shrink-0"
                        style={{ borderColor: "var(--card-border)" }}
                      />
                    ) : (
                      <span className="badge-emoji !w-9 !h-9" style={{ color: "var(--text-main)" }}>
                        <Music2 size={15} strokeWidth={2.5} />
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-head text-[12px] font-bold truncate leading-tight">
                        {spotify.nowPlaying.title}
                      </p>
                      <p className="text-[10.5px] font-semibold text-[var(--text-muted)] truncate leading-tight">
                        {spotify.nowPlaying.artist}
                      </p>
                    </div>
                    <button
                      className="btn-icon-sm !opacity-100"
                      onClick={() => void handleSpotifyToggle()}
                      title={spotify.isPlaying ? "Pause" : "Play"}
                      aria-label={spotify.isPlaying ? "Pause Spotify" : "Play Spotify"}
                    >
                      {spotify.isPlaying ? (
                        <Pause size={14} strokeWidth={2.5} />
                      ) : (
                        <Play size={14} strokeWidth={2.5} className="ml-0.5" fill="currentColor" />
                      )}
                    </button>
                    <button
                      className="btn-icon-sm !opacity-100"
                      onClick={() => void handleSpotifyNext()}
                      title="Lagu berikutnya"
                      aria-label="Lagu berikutnya"
                    >
                      <SkipForward size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
