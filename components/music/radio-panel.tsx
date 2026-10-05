"use client";

import React from "react";
import { motion } from "framer-motion";
import { Play, Sparkles, Square, Timer, Volume1, Volume2, VolumeX } from "lucide-react";
import { MUSIC_TRACKS, TRACK_KEYS, playMusic, stopMusic } from "@/lib/music/engine";
import { useMusicStore, type RadioTrackKey } from "@/stores/music-store";
import { playSound } from "@/components/ui/sfx";
import { EqBars } from "@/components/music/eq";

/** Warna ikon per track radio (neubrutalism cozy — tetap pakai palet app). */
const TRACK_COLORS: Record<RadioTrackKey, string> = {
  kopi: "var(--accent)",
  hujan: "var(--blue-dark)",
  buku: "var(--green-dark)",
  malam: "var(--pink)",
};

/** Ikon volume dinamis sesuai level (0..1). */
function VolumeIcon({ level }: { level: number }) {
  if (level <= 0) return <VolumeX size={16} strokeWidth={2.5} aria-hidden="true" />;
  if (level < 0.5) return <Volume1 size={16} strokeWidth={2.5} aria-hidden="true" />;
  return <Volume2 size={16} strokeWidth={2.5} aria-hidden="true" />;
}

/**
 * Tab "Radio Cozy" — 4 track musik generatif WebAudio.
 * Musik dibangkitkan real-time, bebas copyright, tetap play walau pindah halaman.
 */
export function RadioPanel() {
  const playing = useMusicStore((s) => s.playing);
  const volume = useMusicStore((s) => s.volume);
  const setVolume = useMusicStore((s) => s.setVolume);
  const ready = useMusicStore((s) => s.ready);

  const handleTrack = (key: RadioTrackKey) => {
    playSound("click");
    if (playing === key) {
      stopMusic(); // toggle: klik track aktif = berhenti
    } else {
      playMusic(key);
    }
  };

  const handleStop = () => {
    playSound("click");
    stopMusic();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid sm:grid-cols-2 gap-3">
        {TRACK_KEYS.map((key, i) => {
          const t = MUSIC_TRACKS[key];
          const active = playing === key;
          const TrackIcon = t.icon;
          return (
            <motion.button
              key={key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, type: "spring", stiffness: 260, damping: 24 }}
              whileHover={{ x: -2, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleTrack(key)}
              className="text-left p-4 rounded-[16px] transition-colors"
              style={{
                background: active ? "var(--yellow)" : "var(--warm-white)",
                border: "2.5px solid var(--card-border)",
                boxShadow: active ? "var(--shadow-md)" : "var(--shadow-sm)",
              }}
            >
              <div className="flex items-center gap-3">
                <motion.span
                  className="badge-emoji !w-[46px] !h-[46px]"
                  style={{ color: TRACK_COLORS[key] }}
                  animate={active ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                  transition={active ? { repeat: Infinity, duration: 1.6 } : { duration: 0.2 }}
                >
                  <TrackIcon size={24} strokeWidth={2.5} />
                </motion.span>
                <div className="flex-1 min-w-0">
                  <p className="font-head text-[16px] font-bold leading-tight">{t.name}</p>
                  <p className="text-[11.5px] font-semibold text-[var(--text-muted)] leading-snug mt-0.5">
                    {t.desc}
                  </p>
                </div>
                {active ? <EqBars height={20} /> : <Play size={18} strokeWidth={2.5} className="flex-shrink-0" fill="currentColor" />}
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="chip !text-[10.5px] !py-0.5">{t.bpm} BPM</span>
                <span className="chip !text-[10.5px] !py-0.5">
                  <Timer size={11} strokeWidth={2.5} aria-hidden="true" />
                  durasi ∞
                </span>
                {active && <span className="chip chip-active !text-[10.5px] !py-0.5 ml-auto">SEDANG BUNYI</span>}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* kontrol stop + volume */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <button
          onClick={handleStop}
          disabled={!playing}
          className="rounded-[12px] px-4 py-2 font-head text-[13px] font-bold border-2 border-dashed border-[var(--card-border)] bg-[var(--warm-white)] text-[var(--text-main)] transition-all hover:!border-[var(--red)] hover:text-[var(--red-dark)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Square size={13} strokeWidth={2.5} aria-hidden="true" />
          Berhenti Musik
        </button>
        <div className="flex items-center gap-2 flex-1 card !p-2.5 !py-2 !rounded-[12px] !shadow-none">
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
          <span className="font-head text-[11px] font-bold text-[var(--text-muted)] w-[34px] text-right">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>

      {/* tips */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="rounded-[12px] px-3.5 py-2.5 text-[12px] font-semibold flex items-start gap-2"
        style={{ background: "var(--peach)", border: "2px dashed var(--card-border)" }}
      >
        <Sparkles size={14} strokeWidth={2.5} aria-hidden="true" className="flex-shrink-0 mt-0.5" />
        <span>
          Musik dibangkitkan real-time oleh WebAudio — bebas copyright, dan tetap bunyi walau kamu
          pindah halaman. Klik track lagi untuk berhenti.{" "}
          {ready ? "Siap diputar!" : "Klik dulu untuk mulai!"}
        </span>
      </motion.div>
    </div>
  );
}
