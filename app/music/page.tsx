"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FolderOpen, Headphones, Music2, RadioTower } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { RadioPanel } from "@/components/music/radio-panel";
import { SpotifyPanel } from "@/components/music/spotify-panel";
import { LocalFilesPanel } from "@/components/music/local-files";
import { useMusicStore } from "@/stores/music-store";
import { playSound } from "@/components/ui/sfx";

type TabKey = "radio" | "spotify" | "lokal";

const TABS: Array<{ key: TabKey; icon: LucideIcon; label: string }> = [
  { key: "radio", icon: RadioTower, label: "Radio Cozy" },
  { key: "spotify", icon: Music2, label: "Spotify" },
  { key: "lokal", icon: FolderOpen, label: "File Lokal" },
];

export default function MusicPage() {
  const [tab, setTab] = useState<TabKey>("radio");
  const connected = useMusicStore((s) => s.spotify.connected);
  const playing = useMusicStore((s) => s.playing);

  // Rehidrasi volume + track terakhir dari localStorage (sekali saja, aman dipanggil 2x)
  useEffect(() => {
    void useMusicStore.persist.rehydrate();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* ══ HEADER HALAMAN ══ */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-head text-[26px] font-bold flex items-center gap-2.5">
          <motion.span
            className="inline-flex"
            animate={{ rotate: [0, -8, 8, 0] }}
            transition={{ repeat: Infinity, duration: 3.6, ease: "easeInOut" }}
          >
            <Headphones size={28} strokeWidth={2.5} aria-hidden="true" />
          </motion.span>
          Musik Cozy
        </h1>
        <p className="text-[13px] font-semibold text-[var(--text-muted)] mt-0.5">
          Radio generatif, Spotify, dan file lokal — semua senada satu atap
        </p>
      </motion.div>

      {/* ══ TABS ══ */}
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const TabIcon = t.icon;
          return (
            <button
              key={t.key}
              className={`chip chip-click !text-[12.5px] !px-3.5 !py-1.5 ${tab === t.key ? "chip-active" : ""}`}
              onClick={() => {
                playSound("click");
                setTab(t.key);
              }}
            >
              <TabIcon size={14} strokeWidth={2.5} aria-hidden="true" />
              {t.label}
              {t.key === "radio" && playing && <span className="text-[9px]">●</span>}
              {t.key === "spotify" && connected && <span className="text-[9px]">●</span>}
            </button>
          );
        })}
      </div>

      {/* ══ KONTEN TAB ══ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="card"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {tab === "radio" && <RadioPanel />}
            {tab === "spotify" && <SpotifyPanel />}
            {tab === "lokal" && <LocalFilesPanel />}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
