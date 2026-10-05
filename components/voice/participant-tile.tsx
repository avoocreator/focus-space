"use client";

// ═══════════════════════════════════════════════════════════
//  ParticipantTile — tile visual satu peserta voice channel.
//  MURNI visual: elemen <audio> dikelola oleh use-voice-channel.
//  Saat speaking → ring glow hijau + scale halus (framer-motion).
// ═══════════════════════════════════════════════════════════

import React from "react";
import { motion } from "framer-motion";
import { MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VoiceConnectionState } from "@/lib/voice/use-voice-channel";

type Props = {
  name: string;
  avatar: string;
  speaking: boolean;
  connection: VoiceConnectionState;
  /** false → tampil ikon MicOff (mic mati / belum ada stream) */
  hasAudio: boolean;
  isSelf?: boolean;
};

const DOT_COLOR: Record<VoiceConnectionState, string> = {
  connected: "var(--green)",
  connecting: "var(--yellow-dark)",
  failed: "var(--red)",
};

const DOT_TITLE: Record<VoiceConnectionState, string> = {
  connected: "Tersambung",
  connecting: "Menghubungkan…",
  failed: "Gagal tersambung",
};

export default function ParticipantTile({
  name,
  avatar,
  speaking,
  connection,
  hasAudio,
  isSelf = false,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-[12px] border-2 border-cardline bg-warmwhite px-1.5 py-2",
        speaking && "bg-peach"
      )}
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <motion.div
        className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-cardline bg-peach"
        animate={{ scale: speaking ? 1.08 : 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 20 }}
        style={speaking ? { boxShadow: "0 0 0 3px var(--green)" } : undefined}
      >
        <span className="select-none text-[22px] leading-none">{avatar}</span>
        {/* dot status koneksi */}
        <span
          className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-cardline"
          style={{ background: DOT_COLOR[connection] }}
          title={DOT_TITLE[connection]}
        />
      </motion.div>

      <span className="max-w-full truncate font-head text-[11px] font-semibold" title={name}>
        {name}
        {isSelf && <span className="opacity-60"> (kamu)</span>}
      </span>

      {!hasAudio && (
        <span className="opacity-70" title="Mic mati">
          <MicOff size={12} strokeWidth={2.5} />
        </span>
      )}
      {connection === "connecting" && (
        <span className="text-[9px] font-bold leading-none" style={{ color: "var(--text-muted)" }}>
          {hasAudio ? "menghubungkan ulang…" : "menyambungkan…"}
        </span>
      )}
      {connection === "failed" && (
        <span className="text-[9px] font-bold leading-none" style={{ color: "var(--red-dark)" }}>
          gagal tersambung
        </span>
      )}
    </div>
  );
}
