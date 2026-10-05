/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  FolderOpen,
  Lock,
  Music2,
  Music4,
  Pause,
  Play,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { stopMusic } from "@/lib/music/engine";
import { useMusicStore } from "@/stores/music-store";
import { playSound } from "@/components/ui/sfx";
import { useToast } from "@/components/toast";
import { EqBars } from "@/components/music/eq";
import { formatClock, shuffle } from "@/lib/utils";

/** Ikon volume dinamis sesuai level (0..1). */
function VolumeIcon({ level }: { level: number }) {
  if (level <= 0) return <VolumeX size={14} strokeWidth={2.5} aria-hidden="true" />;
  if (level < 0.5) return <Volume1 size={14} strokeWidth={2.5} aria-hidden="true" />;
  return <Volume2 size={14} strokeWidth={2.5} aria-hidden="true" />;
}

interface LocalTrack {
  id: string;
  name: string;
  url: string;
  sizeMb: number;
  durationSec: number | null;
}

const AUDIO_RE = /\.(mp3|m4a|wav|ogg|oga|flac|aac|opus|weba|webm)$/i;

/**
 * Tab "File Lokal" — putar file audio dari komponenmu sendiri.
 * Object URL lokal, tidak ada yang diunggah ke server.
 */
export function LocalFilesPanel() {
  const { toast } = useToast();
  const [tracks, setTracks] = useState<LocalTrack[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [shuffleOn, setShuffleOn] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const shuffleOrderRef = useRef<number[]>([]);
  const tracksRef = useRef<LocalTrack[]>([]);
  tracksRef.current = tracks;

  const playingRadio = useMusicStore((s) => s.playing);

  // Radio mulai bunyi → jeda file lokal (satu suara dulu)
  useEffect(() => {
    if (playingRadio) {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
  }, [playingRadio]);

  // Bersihkan object URL saat unmount
  useEffect(() => {
    return () => {
      tracksRef.current.forEach((t) => URL.revokeObjectURL(t.url));
      audioRef.current?.pause();
    };
  }, []);

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: LocalTrack[] = [];
    Array.from(files).forEach((f) => {
      if (!f.type.startsWith("audio/") && !AUDIO_RE.test(f.name)) {
        toast("info", `${f.name} bukan file audio`);
        return;
      }
      added.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        url: URL.createObjectURL(f),
        sizeMb: f.size / (1024 * 1024),
        durationSec: null,
      });
    });
    if (added.length === 0) return;
    setTracks((prev) => [...prev, ...added]);
    toast("success", `${added.length} lagu masuk antrean`);

    // Baca durasi dari metadata
    added.forEach((t) => {
      const probe = new Audio();
      probe.preload = "metadata";
      probe.src = t.url;
      probe.onloadedmetadata = () => {
        const dur = Number.isFinite(probe.duration) ? probe.duration : null;
        setTracks((prev) => prev.map((x) => (x.id === t.id ? { ...x, durationSec: dur } : x)));
      };
    });
  };

  const playTrack = (idx: number) => {
    const a = audioRef.current;
    const t = tracks[idx];
    if (!a || !t) return;
    if (useMusicStore.getState().playing) stopMusic(true); // radio off dulu
    setCurrentIdx(idx);
    setIsPlaying(true);
    a.src = t.url;
    a.load();
    void a.play().catch(() => {
      setIsPlaying(false);
      toast("error", "Gagal memutar file ini — formatnya mungkin tidak didukung browser");
    });
  };

  const nextIdx = (dir: 1 | -1): number | null => {
    if (tracks.length === 0) return null;
    if (shuffleOn) {
      if (shuffleOrderRef.current.length !== tracks.length) {
        shuffleOrderRef.current = shuffle(tracks.map((_, i) => i));
      }
      const pos = currentIdx === null ? -1 : shuffleOrderRef.current.indexOf(currentIdx);
      const nextPos = (pos + dir + shuffleOrderRef.current.length) % shuffleOrderRef.current.length;
      return shuffleOrderRef.current[nextPos];
    }
    if (currentIdx === null) return 0;
    return (currentIdx + dir + tracks.length) % tracks.length;
  };

  const handleNext = () => {
    playSound("click");
    const n = nextIdx(1);
    if (n !== null) playTrack(n);
  };

  const handlePrev = () => {
    playSound("click");
    const n = nextIdx(-1);
    if (n !== null) playTrack(n);
  };

  const handleToggle = () => {
    playSound("click");
    const a = audioRef.current;
    if (!a) return;
    if (currentIdx === null) {
      playTrack(0);
      return;
    }
    if (isPlaying) {
      a.pause();
      setIsPlaying(false);
    } else {
      if (useMusicStore.getState().playing) stopMusic(true);
      void a.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const handleToggleShuffle = () => {
    playSound("click");
    const next = !shuffleOn;
    setShuffleOn(next);
    if (next) shuffleOrderRef.current = shuffle(tracks.map((_, i) => i));
  };

  const removeTrack = (id: string) => {
    playSound("click");
    const idx = tracks.findIndex((t) => t.id === id);
    const t = tracks[idx];
    if (!t) return;
    URL.revokeObjectURL(t.url);
    const wasCurrent = idx === currentIdx;
    setTracks((prev) => prev.filter((x) => x.id !== id));
    if (wasCurrent) {
      audioRef.current?.pause();
      audioRef.current?.removeAttribute("src");
      setIsPlaying(false);
      setCurrentIdx(null);
      setPosition(0);
      setDuration(0);
    } else if (currentIdx !== null && idx < currentIdx) {
      setCurrentIdx((c) => (c === null ? null : c - 1));
    }
  };

  const clearAll = () => {
    playSound("click");
    audioRef.current?.pause();
    tracks.forEach((t) => URL.revokeObjectURL(t.url));
    setTracks([]);
    setCurrentIdx(null);
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
    toast("info", "Antrean dibersihkan");
  };

  const current = currentIdx !== null ? tracks[currentIdx] : null;
  const activePlaying = isPlaying && !!current;

  return (
    <div className="flex flex-col gap-4">
      {/* ══ PILIH FILE ══ */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button className="btn-primary !text-[13px]" onClick={() => inputRef.current?.click()}>
          <FolderOpen size={14} strokeWidth={2.5} aria-hidden="true" />
          Pilih File Musik
        </button>
        <p className="text-[11.5px] font-semibold text-[var(--text-muted)] flex-1 flex items-center gap-1.5">
          <Lock size={12} strokeWidth={2.5} aria-hidden="true" className="flex-shrink-0" />
          File diputar langsung di browser — tidak diunggah ke mana pun
        </p>
      </div>

      {/* ══ ANTREAN ══ */}
      {tracks.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-[16px] py-10 text-center"
          style={{ border: "2.5px dashed var(--card-border)", background: "var(--warm-white)" }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
        >
          <div className="animate-bouncy" style={{ color: "var(--text-muted)" }}>
            <Music4 size={40} strokeWidth={2.5} aria-hidden="true" />
          </div>
          <p className="font-head text-[15px] font-bold mt-1.5">Belum ada lagu di antrean</p>
          <p className="text-[12px] font-semibold text-[var(--text-muted)] mt-0.5">
            Klik “Pilih File Musik” atau seret file audio ke sini
          </p>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-[340px] overflow-y-auto pr-1">
          {tracks.map((t, i) => {
            const active = i === currentIdx;
            return (
              <div
                key={t.id}
                className="flex items-center gap-2.5 p-2 rounded-[12px] transition-all"
                style={{
                  background: active ? "var(--yellow)" : "var(--warm-white)",
                  border: "2px solid var(--card-border)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <span className="badge-emoji !w-9 !h-9" style={{ color: "var(--text-main)" }}>
                  {active && isPlaying ? (
                    <Volume2 size={15} strokeWidth={2.5} />
                  ) : (
                    <Music2 size={15} strokeWidth={2.5} />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-bold truncate leading-tight">{t.name}</p>
                  <p className="text-[10.5px] font-semibold text-[var(--text-muted)] leading-tight">
                    {t.durationSec !== null ? formatClock(t.durationSec) : "membaca durasi…"} · {t.sizeMb.toFixed(1)} MB
                  </p>
                </div>
                {active && <EqBars />}
                <button
                  className="btn-ctrl !w-8 !h-8"
                  onClick={() => (active ? handleToggle() : playTrack(i))}
                  title={active && isPlaying ? "Pause" : "Putar"}
                  aria-label={active && isPlaying ? "Pause" : "Putar"}
                >
                  {active && isPlaying ? (
                    <Pause size={13} strokeWidth={2.5} />
                  ) : (
                    <Play size={13} strokeWidth={2.5} className="ml-0.5" fill="currentColor" />
                  )}
                </button>
                <button
                  className="btn-icon-sm !opacity-100"
                  onClick={() => removeTrack(t.id)}
                  title="Hapus dari antrean"
                  aria-label={`Hapus ${t.name} dari antrean`}
                >
                  <X size={13} strokeWidth={2.5} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ TRANSPORT ══ */}
      <div className="card !p-3.5" style={{ background: "var(--warm-white)" }}>
        <div className="flex items-center gap-2.5">
          <span className="badge-emoji !w-11 !h-11" style={{ color: "var(--text-main)" }}>
            {activePlaying ? (
              <Volume2 size={17} strokeWidth={2.5} />
            ) : (
              <Music2 size={17} strokeWidth={2.5} />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-head text-[13.5px] font-bold truncate">
              {current?.name || "Belum ada yang diputar"}
            </p>
            <p className="text-[11px] font-semibold text-[var(--text-muted)] truncate">
              {current ? "Putar dari file lokalmu" : "Pilih lagu dari antrean di atas"}
            </p>
          </div>
          <button
            className={`chip chip-click ${shuffleOn ? "chip-active" : ""}`}
            onClick={handleToggleShuffle}
            title="Acak urutan"
            aria-label="Acak urutan antrean"
            aria-pressed={shuffleOn}
          >
            <Shuffle size={12} strokeWidth={2.5} aria-hidden="true" />
          </button>
          <button
            className="btn-ctrl !w-9 !h-9"
            onClick={handlePrev}
            disabled={tracks.length === 0}
            title="Sebelumnya"
            aria-label="Lagu sebelumnya"
          >
            <SkipBack size={14} strokeWidth={2.5} fill="currentColor" />
          </button>
          <button
            className="btn-ctrl !w-10 !h-10"
            onClick={handleToggle}
            disabled={tracks.length === 0}
            title={isPlaying ? "Pause" : "Play"}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause size={15} strokeWidth={2.5} />
            ) : (
              <Play size={15} strokeWidth={2.5} className="ml-0.5" fill="currentColor" />
            )}
          </button>
          <button
            className="btn-ctrl !w-9 !h-9"
            onClick={handleNext}
            disabled={tracks.length === 0}
            title="Berikutnya"
            aria-label="Lagu berikutnya"
          >
            <SkipForward size={14} strokeWidth={2.5} fill="currentColor" />
          </button>
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <span className="text-[10px] font-bold text-[var(--text-muted)] w-[36px] text-right">
            {formatClock(position)}
          </span>
          <input
            type="range"
            className="cozy-slider flex-1 !h-3"
            min={0}
            max={Math.max(1, duration)}
            step={0.5}
            value={Math.min(position, Math.max(1, duration))}
            disabled={!current}
            onChange={(e) => {
              const v = Number(e.target.value);
              setPosition(v);
              if (audioRef.current) audioRef.current.currentTime = v;
            }}
            aria-label="Progress lagu"
          />
          <span className="text-[10px] font-bold text-[var(--text-muted)] w-[36px]">
            {formatClock(duration)}
          </span>
        </div>

        <div className="mt-1.5 flex items-center gap-2">
          <VolumeIcon level={volume} />
          <input
            type="range"
            className="cozy-slider flex-1 !h-3"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(e) => {
              const v = Number(e.target.value) / 100;
              setVolume(v);
              if (audioRef.current) audioRef.current.volume = v;
            }}
            aria-label="Volume file lokal"
          />
          <span className="font-head text-[10.5px] font-bold text-[var(--text-muted)] w-[34px] text-right">
            {Math.round(volume * 100)}%
          </span>
          {tracks.length > 0 && (
            <button className="btn-icon-sm !opacity-100" onClick={clearAll} title="Bersihkan antrean" aria-label="Bersihkan antrean">
              <Trash2 size={13} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* audio element tersembunyi */}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => {
          const n = nextIdx(1);
          if (n !== null) playTrack(n);
          else setIsPlaying(false);
        }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        className="hidden"
      />
    </div>
  );
}
