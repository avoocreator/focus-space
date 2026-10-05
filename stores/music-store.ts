// ═══════════════════════════════════════════════════════════
//  MUSIC STORE — satu sumber kebenaran untuk seluruh modul musik
//  (radio generatif + Spotify + file lokal). Dock & page hanya
//  konsumen; engine (lib/music/engine.ts) yang menulis state.
// ═══════════════════════════════════════════════════════════

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type RadioTrackKey = "kopi" | "hujan" | "buku" | "malam";

export interface SpotifyNowPlaying {
  uri: string;
  title: string;
  artist: string;
  art: string | null;
  durationMs: number;
  positionMs: number;
}

/** State Spotify yang dipakai bersama oleh dock & halaman /music */
export interface SpotifySlice {
  connected: boolean;
  /** null = belum dicek; true = Premium (bisa play di browser); false = Gratis */
  premium: boolean | null;
  displayName: string | null;
  avatarUrl: string | null;
  /** device_id browser dari Web Playback SDK */
  deviceId: string | null;
  playerReady: boolean;
  playerError: string | null;
  isPlaying: boolean;
  nowPlaying: SpotifyNowPlaying | null;
}

export interface MusicState {
  /** track radio generatif yang sedang bunyi (null = berhenti) */
  playing: RadioTrackKey | null;
  /** track radio terakhir (dipersist, untuk "lanjutkan" cepat) */
  lastTrack: RadioTrackKey;
  /** master volume 0..1 (dipersist) */
  volume: number;
  /** true kalau AudioContext sudah siap dipakai */
  ready: boolean;
  spotify: SpotifySlice;

  setPlaying: (k: RadioTrackKey | null) => void;
  setLastTrack: (k: RadioTrackKey) => void;
  setVolume: (v: number) => void;
  setReady: (v: boolean) => void;
  patchSpotify: (patch: Partial<SpotifySlice>) => void;
  resetSpotify: () => void;
}

export const SPOTIFY_INIT: SpotifySlice = {
  connected: false,
  premium: null,
  displayName: null,
  avatarUrl: null,
  deviceId: null,
  playerReady: false,
  playerError: null,
  isPlaying: false,
  nowPlaying: null,
};

const DEFAULT_VOLUME = 0.9;

export const useMusicStore = create<MusicState>()(
  persist(
    (set) => ({
      playing: null,
      lastTrack: "kopi",
      volume: DEFAULT_VOLUME,
      ready: false,
      spotify: SPOTIFY_INIT,

      setPlaying: (k) => set({ playing: k }),
      setLastTrack: (k) => set({ lastTrack: k }),
      setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)) }),
      setReady: (v) => set({ ready: v }),
      patchSpotify: (patch) => set((s) => ({ spotify: { ...s.spotify, ...patch } })),
      resetSpotify: () => set({ spotify: SPOTIFY_INIT }),
    }),
    {
      name: "fs_music",
      skipHydration: true, // direhydrate manual dari komponen client (anti hydration mismatch)
      storage: createJSONStorage(() => localStorage),
      partialize: (s): Pick<MusicState, "volume" | "lastTrack"> => ({
        volume: s.volume,
        lastTrack: s.lastTrack,
      }),
    }
  )
);
