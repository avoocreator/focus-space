/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  Disc3,
  Headphones,
  Hourglass,
  Music2,
  Pause,
  Play,
  RadioTower,
  RefreshCw,
  Search,
  SkipBack,
  SkipForward,
  Sparkles,
  Square,
  Unplug,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { stopMusic } from "@/lib/music/engine";
import {
  SpotifyError,
  clearSpotifyToken,
  ensureFreshToken,
  fetchDevices,
  fetchPlaylistTracks,
  fetchSpotifyMe,
  fetchSpotifyPlaylists,
  loadPlaybackSDK,
  searchSpotifyTracks,
  spotifyNext,
  spotifyPlayContext,
  spotifyPlayUris,
  spotifyPrev,
  spotifySeek,
  spotifySetVolume,
  spotifyTogglePlay,
  spotifyTransferPlayback,
  startSpotifyOAuth,
  syncNowPlaying,
  type SpotifyDevice,
  type SpotifyPlaylist,
  type SpotifyPlayer,
  type SpotifySDK,
  type SpotifyTrack,
} from "@/lib/music/spotify";
import { useMusicStore } from "@/stores/music-store";
import { useToast } from "@/components/toast";
import { playSound } from "@/components/ui/sfx";
import { EqBars } from "@/components/music/eq";
import { formatClock } from "@/lib/utils";

function errMsg(e: unknown, fallback: string): string {
  if (e instanceof SpotifyError && e.message) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

/** Ikon volume dinamis sesuai level (0..100). */
function VolumeIcon({ level }: { level: number }) {
  if (level <= 0) return <VolumeX size={14} strokeWidth={2.5} aria-hidden="true" />;
  if (level < 50) return <Volume1 size={14} strokeWidth={2.5} aria-hidden="true" />;
  return <Volume2 size={14} strokeWidth={2.5} aria-hidden="true" />;
}

/* ════════════════════════════════════════════
   BELUM CONNECT
   ════════════════════════════════════════════ */

function NotConnectedView() {
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    playSound("click");
    setConnecting(true);
    try {
      await startSpotifyOAuth(); // redirect ke Spotify — halaman akan pindah
    } catch (e) {
      toast("error", errMsg(e, "Gagal mulai login Spotify"));
      setConnecting(false);
    }
  };

  return (
    <div className="flex flex-col items-center text-center py-6 gap-3">
      <motion.div
        style={{ color: "var(--text-main)" }}
        animate={{ rotate: [0, -6, 6, 0] }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
      >
        <Headphones size={52} strokeWidth={2.5} aria-hidden="true" />
      </motion.div>
      <h2 className="font-head text-[19px] font-bold">Sambungkan Spotify-mu</h2>
      <p className="text-[13px] font-semibold text-[var(--text-muted)] max-w-[420px] leading-relaxed">
        Dengarkan playlist kesukaanmu langsung dari FocusSpace. Login sekali via Spotify, kembali
        lagi, dan musik siap mengalir.
      </p>

      <button
        onClick={() => void handleConnect()}
        disabled={connecting}
        className="font-head font-bold text-[14px] text-white rounded-[14px] px-5 py-2.5 mt-1 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--card-border)] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{
          background: "#1DB954",
          border: "2.5px solid var(--card-border)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <Headphones size={15} strokeWidth={2.5} aria-hidden="true" />
        {connecting ? "Mengarahkan ke Spotify…" : "Connect Spotify"}
      </button>

      <div
        className="rounded-[12px] px-3.5 py-2.5 mt-2 text-[12px] font-semibold text-left leading-relaxed max-w-[440px]"
        style={{ background: "var(--peach)", border: "2px dashed var(--card-border)" }}
      >
        <p className="flex items-center gap-1.5">
          <Sparkles size={13} strokeWidth={2.5} aria-hidden="true" className="flex-shrink-0" />
          <span>
            <b>Akun Premium</b> = bisa putar lagu penuh langsung di browser ini.
          </span>
        </p>
        <p className="mt-1 flex items-center gap-1.5">
          <Music2 size={13} strokeWidth={2.5} aria-hidden="true" className="flex-shrink-0" />
          <span>
            <b>Akun Gratis</b> = browsing playlist + kontrol pemutaran di app Spotify-mu + preview
            30 detik per lagu.
          </span>
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   BARIS LAGU
   ════════════════════════════════════════════ */

function TrackRow({
  track,
  active,
  activePlaying,
  premium,
  previewing,
  onPlay,
  onPreview,
}: {
  track: SpotifyTrack;
  active: boolean;
  activePlaying: boolean;
  premium: boolean;
  previewing: boolean;
  onPlay: (t: SpotifyTrack) => void;
  onPreview: (t: SpotifyTrack) => void;
}) {
  const art = track.album.images[track.album.images.length - 1]?.url ?? null;
  return (
    <div
      className="flex items-center gap-2.5 p-2 rounded-[12px] transition-all hover:-translate-y-px"
      style={{
        background: active ? "var(--yellow)" : "var(--warm-white)",
        border: "2px solid var(--card-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {art ? (
        <img
          src={art}
          alt=""
          className="w-10 h-10 rounded-[8px] object-cover border-2 flex-shrink-0"
          style={{ borderColor: "var(--card-border)" }}
        />
      ) : (
        <span className="badge-emoji !w-10 !h-10" style={{ color: "var(--text-main)" }}>
          <Music2 size={16} strokeWidth={2.5} />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-bold truncate leading-tight">{track.name}</p>
        <p className="text-[10.5px] font-semibold text-[var(--text-muted)] truncate leading-tight">
          {track.artists.map((a) => a.name).join(", ")}
        </p>
      </div>
      {active && <EqBars />}
      <span className="text-[10.5px] font-bold text-[var(--text-muted)] w-[38px] text-right flex-shrink-0">
        {formatClock(track.duration_ms / 1000)}
      </span>
      {premium ? (
        <button
          className="btn-ctrl !w-8 !h-8"
          onClick={() => onPlay(track)}
          title={active && activePlaying ? "Sedang bunyi" : "Putar"}
          aria-label={active && activePlaying ? "Sedang bunyi" : "Putar lagu"}
        >
          {active && activePlaying ? (
            <Pause size={13} strokeWidth={2.5} />
          ) : (
            <Play size={13} strokeWidth={2.5} className="ml-0.5" fill="currentColor" />
          )}
        </button>
      ) : (
        <button
          className={`!text-[10.5px] !px-2 !py-1 !rounded-[10px] inline-flex items-center gap-1 ${previewing ? "btn-yellow" : "btn-secondary"}`}
          onClick={() => onPreview(track)}
          title="Preview 30 detik"
        >
          {previewing ? (
            <Square size={10} strokeWidth={2.5} aria-hidden="true" />
          ) : (
            <Play size={10} strokeWidth={2.5} aria-hidden="true" fill="currentColor" />
          )}
          30s
        </button>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   SUDAH CONNECT
   ════════════════════════════════════════════ */

function ConnectedView() {
  const { toast } = useToast();
  const spotify = useMusicStore((s) => s.spotify);
  const patchSpotify = useMusicStore((s) => s.patchSpotify);
  const resetSpotify = useMusicStore((s) => s.resetSpotify);

  const [checking, setChecking] = useState(true);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);

  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyTrack[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [activePlaylist, setActivePlaylist] = useState<SpotifyPlaylist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<SpotifyTrack[] | null>(null);
  const [loadingTracks, setLoadingTracks] = useState(false);

  const [devices, setDevices] = useState<Array<SpotifyDevice & { id: string }> | null>(null);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const [previewingUri, setPreviewingUri] = useState<string | null>(null);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [spotifyVol, setSpotifyVol] = useState(70);

  const playerRef = useRef<SpotifyPlayer | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const lastUriRef = useRef<string | null>(null);
  const seekTimerRef = useRef<number | null>(null);
  const volTimerRef = useRef<number | null>(null);

  const isPremium = spotify.premium === true;
  const np = spotify.nowPlaying;

  // ── Profil + daftar playlist ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await fetchSpotifyMe();
        if (!alive) return;
        patchSpotify({
          connected: true,
          displayName: me.display_name || me.id,
          avatarUrl: me.images[0]?.url ?? null,
          premium: me.product === "premium",
        });
      } catch (e) {
        if (alive) toast("error", errMsg(e, "Gagal mengambil profil Spotify"));
      } finally {
        if (alive) setChecking(false);
      }
      try {
        const page = await fetchSpotifyPlaylists();
        if (!alive) return;
        setPlaylists(page.items);
      } catch (e) {
        if (alive) toast("error", errMsg(e, "Gagal memuat playlist"));
      } finally {
        if (alive) setLoadingPlaylists(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [patchSpotify, toast]);

  // ── Web Playback SDK (Premium) ──
  useEffect(() => {
    if (spotify.premium !== true) return;
    let alive = true;
    (async () => {
      try {
        const SDK: SpotifySDK = await loadPlaybackSDK();
        if (!alive || playerRef.current) return;
        const player = new SDK.Player({
          name: "FocusSpace",
          getOAuthToken: (cb) => {
            void ensureFreshToken().then((t) => {
              if (t) cb(t.access_token);
            });
          },
        });
        playerRef.current = player;

        player.addListener("ready", ({ device_id }) => {
          patchSpotify({ deviceId: device_id, playerReady: true, playerError: null });
        });
        player.addListener("not_ready", () => {
          patchSpotify({ playerReady: false });
        });
        player.addListener("player_state_changed", (state) => {
          if (!state) return;
          const tr = state.track_window.current_track;
          if (!state.paused && useMusicStore.getState().playing) stopMusic(true); // radio off
          patchSpotify({
            isPlaying: !state.paused,
            nowPlaying: {
              uri: tr.uri,
              title: tr.name,
              artist: tr.artists.map((a) => a.name).join(", "),
              art: tr.album.images[0]?.url ?? null,
              durationMs: state.duration,
              positionMs: state.position,
            },
          });
          setPositionMs(state.position);
          setDurationMs(state.duration);
        });
        player.addListener("account_error", ({ message }) => {
          patchSpotify({ premium: false, playerReady: false, playerError: message });
          toast("info", "Akun Spotify bukan Premium — mode remote & preview aktif");
        });
        player.addListener("initialization_error", ({ message }) =>
          patchSpotify({ playerError: message })
        );
        player.addListener("authentication_error", ({ message }) =>
          patchSpotify({ playerError: message })
        );
        player.addListener("playback_error", ({ message }) =>
          patchSpotify({ playerError: message })
        );

        await player.connect();
      } catch (e) {
        if (alive) {
          patchSpotify({ playerError: e instanceof Error ? e.message : "SDK gagal dimuat" });
        }
      }
    })();
    return () => {
      alive = false;
      try {
        playerRef.current?.disconnect();
      } catch {
        /* abaikan */
      }
      playerRef.current = null;
    };
  }, [spotify.premium, patchSpotify, toast]);

  // ── Audio preview 30 detik (akun gratis) ──
  useEffect(() => {
    const a = new Audio();
    a.onended = () => setPreviewingUri(null);
    previewRef.current = a;
    return () => {
      a.pause();
      a.removeAttribute("src");
      previewRef.current = null;
    };
  }, []);

  // ── Timer progres lokal ──
  useEffect(() => {
    if (!spotify.isPlaying) return;
    const iv = window.setInterval(() => {
      setPositionMs((p) => Math.min(p + 1000, Math.max(durationMs, p)));
    }, 1000);
    return () => window.clearInterval(iv);
  }, [spotify.isPlaying, durationMs]);

  // ── Sinkron posisi dari store (lagu ganti / snapshot pause) ──
  useEffect(() => {
    if (!np) {
      setPositionMs(0);
      setDurationMs(0);
      return;
    }
    setDurationMs(np.durationMs);
    if (np.uri !== lastUriRef.current || !spotify.isPlaying) {
      lastUriRef.current = np.uri;
      setPositionMs(np.positionMs);
    }
  }, [np, spotify.isPlaying]);

  // ── Bersihkan timer di unmount ──
  useEffect(
    () => () => {
      if (seekTimerRef.current) window.clearTimeout(seekTimerRef.current);
      if (volTimerRef.current) window.clearTimeout(volTimerRef.current);
    },
    []
  );

  // ── Actions ──
  const handleSpotifyErr = (e: unknown, fallback: string) => {
    if (e instanceof SpotifyError && e.status === 404) {
      toast("info", "Device Spotify belum aktif — buka app Spotify atau tunggu player siap");
    } else {
      toast("error", errMsg(e, fallback));
    }
  };

  const stopPreview = () => {
    const a = previewRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    setPreviewingUri(null);
  };

  const startPreview = (track: SpotifyTrack) => {
    if (!track.preview_url) {
      toast("info", "Lagu ini tidak punya preview 30 detik — putar di app Spotify-mu ya");
      return;
    }
    const a = previewRef.current;
    if (!a) return;
    if (previewingUri === track.uri) {
      a.pause();
      setPreviewingUri(null);
      return;
    }
    if (useMusicStore.getState().playing) stopMusic(true); // radio off dulu
    a.src = track.preview_url;
    a.volume = 0.9;
    setPreviewingUri(track.uri);
    a.play().catch(() => {
      setPreviewingUri(null);
      toast("error", "Gagal memutar preview");
    });
  };

  const handlePlayTrack = async (track: SpotifyTrack) => {
    playSound("click");
    if (isPremium) {
      stopPreview();
      if (useMusicStore.getState().playing) stopMusic(true);
      try {
        await spotifyPlayUris([track.uri], spotify.playerReady ? (spotify.deviceId ?? undefined) : undefined);
        patchSpotify({
          isPlaying: true,
          nowPlaying: {
            uri: track.uri,
            title: track.name,
            artist: track.artists.map((a) => a.name).join(", "),
            art: track.album.images[0]?.url ?? null,
            durationMs: track.duration_ms,
            positionMs: 0,
          },
        });
        lastUriRef.current = track.uri;
        setPositionMs(0);
        setDurationMs(track.duration_ms);
      } catch (e) {
        handleSpotifyErr(e, "Gagal memutar lagu");
      }
    } else {
      startPreview(track);
    }
  };

  const handlePlayPlaylist = async (pl: SpotifyPlaylist) => {
    playSound("click");
    if (!isPremium) {
      toast("info", "Mode gratis: buka playlist ini di app Spotify, atau coba preview per lagu");
      return;
    }
    if (useMusicStore.getState().playing) stopMusic(true);
    try {
      await spotifyPlayContext(pl.uri, spotify.playerReady ? (spotify.deviceId ?? undefined) : undefined);
      patchSpotify({ isPlaying: true });
    } catch (e) {
      handleSpotifyErr(e, "Gagal memutar playlist");
    }
  };

  const handleTransport = async (action: "toggle" | "next" | "prev") => {
    try {
      if (action === "toggle") await spotifyTogglePlay(!spotify.isPlaying);
      else if (action === "next") await spotifyNext();
      else await spotifyPrev();
    } catch (e) {
      handleSpotifyErr(e, "Gagal mengontrol pemutaran");
      return;
    }
    if (action === "toggle") patchSpotify({ isPlaying: !spotify.isPlaying });
    window.setTimeout(() => {
      void syncNowPlaying().catch(() => {});
    }, 900);
  };

  const handleSeek = (ms: number) => {
    setPositionMs(ms);
    if (seekTimerRef.current) window.clearTimeout(seekTimerRef.current);
    seekTimerRef.current = window.setTimeout(() => {
      void spotifySeek(ms).catch(() => {});
    }, 350);
  };

  const handleSpotifyVolume = (pct: number) => {
    setSpotifyVol(pct);
    if (volTimerRef.current) window.clearTimeout(volTimerRef.current);
    volTimerRef.current = window.setTimeout(() => {
      void spotifySetVolume(pct).catch(() => {});
    }, 350);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = searchQ.trim();
    if (!q) return;
    setSearching(true);
    try {
      const page = await searchSpotifyTracks(q);
      setSearchResults(page.items);
      setActivePlaylist(null);
      setPlaylistTracks(null);
    } catch (err) {
      handleSpotifyErr(err, "Gagal mencari lagu");
    } finally {
      setSearching(false);
    }
  };

  const openPlaylist = async (pl: SpotifyPlaylist) => {
    playSound("click");
    setLoadingTracks(true);
    setActivePlaylist(pl);
    setSearchResults(null);
    try {
      const page = await fetchPlaylistTracks(pl.id);
      setPlaylistTracks(page.items.map((it) => it.track).filter((t): t is SpotifyTrack => t !== null));
    } catch (e) {
      handleSpotifyErr(e, "Gagal memuat lagu playlist");
      setActivePlaylist(null);
    } finally {
      setLoadingTracks(false);
    }
  };

  const loadDevices = async () => {
    setLoadingDevices(true);
    try {
      const d = await fetchDevices();
      setDevices(d.devices.filter((x): x is SpotifyDevice & { id: string } => typeof x.id === "string" && !!x.id));
    } catch (e) {
      handleSpotifyErr(e, "Gagal memuat daftar device");
    } finally {
      setLoadingDevices(false);
    }
  };

  const transferTo = async (id: string) => {
    try {
      await spotifyTransferPlayback(id, true);
      toast("success", "Pemutaran dipindah");
      window.setTimeout(() => {
        void syncNowPlaying().catch(() => {});
      }, 1000);
    } catch (e) {
      handleSpotifyErr(e, "Gagal memindah pemutaran");
    }
  };

  const disconnect = () => {
    playSound("click");
    try {
      playerRef.current?.disconnect();
    } catch {
      /* abaikan */
    }
    stopPreview();
    clearSpotifyToken();
    resetSpotify();
    toast("info", "Spotify diputus — sampai jumpa");
  };

  const activePlaying = spotify.isPlaying && !!np;
  const maxMs = Math.max(1000, durationMs);

  return (
    <div className="flex flex-col gap-4">
      {/* ══ PROFIL ══ */}
      <div className="flex items-center gap-3">
        {spotify.avatarUrl ? (
          <img
            src={spotify.avatarUrl}
            alt=""
            className="w-10 h-10 rounded-full object-cover border-[2.5px] flex-shrink-0"
            style={{ borderColor: "var(--card-border)" }}
          />
        ) : (
          <span className="badge-emoji !w-10 !h-10" style={{ color: "var(--text-main)" }}>
            <Headphones size={16} strokeWidth={2.5} />
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-head text-[14px] font-bold truncate">
            {spotify.displayName || "Pengguna Spotify"}
          </p>
          <p className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1">
            {checking ? (
              "memeriksa akun…"
            ) : spotify.premium ? (
              <>
                <Sparkles size={11} strokeWidth={2.5} aria-hidden="true" />
                Premium — putar langsung di browser
              </>
            ) : (
              "Akun Gratis — mode remote + preview"
            )}
          </p>
        </div>
        <button className="btn-danger !text-[12px] !px-3 !py-1.5" onClick={disconnect}>
          <Unplug size={13} strokeWidth={2.5} aria-hidden="true" />
          Disconnect
        </button>
      </div>

      {/* ══ BANNER AKUN GRATIS ══ */}
      {!checking && spotify.premium === false && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[14px] p-3.5"
          style={{ background: "var(--yellow)", border: "2.5px solid var(--card-border)", boxShadow: "var(--shadow-sm)" }}
        >
          <p className="font-head text-[13px] font-bold">Akun Gratis terdeteksi — pakai kontrol remote:</p>
          <p className="text-[11.5px] font-semibold mt-0.5 leading-relaxed">
            Cari device (app Spotify / speaker), pindah pemutaran ke sana, lalu atur dari panel ini.
            Bisa juga preview 30 detik per lagu.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button className="btn-yellow !text-[12px]" onClick={() => void loadDevices()} disabled={loadingDevices}>
              <RadioTower size={12} strokeWidth={2.5} aria-hidden="true" />
              {loadingDevices ? "Mencari device…" : "Cari Device"}
            </button>
          </div>
          {devices &&
            (devices.length === 0 ? (
              <p className="text-[11.5px] font-semibold mt-2">
                Belum ada device. Buka app Spotify-mu (play 1 lagu), lalu tekan Cari Device lagi.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {devices.map((d) => (
                  <button
                    key={d.id}
                    className={`chip chip-click ${d.is_active ? "chip-active" : ""}`}
                    onClick={() => void transferTo(d.id)}
                  >
                    {d.is_active ? (
                      <Check size={11} strokeWidth={3} aria-hidden="true" />
                    ) : (
                      <Play size={11} strokeWidth={2.5} aria-hidden="true" fill="currentColor" />
                    )}
                    {d.name}
                  </button>
                ))}
              </div>
            ))}
        </motion.div>
      )}

      {/* ══ TRANSPORT (PREMIUM) ══ */}
      {isPremium && (
        <div className="card !p-3.5" style={{ background: "var(--warm-white)" }}>
          <div className="flex items-center gap-2.5">
            {np?.art ? (
              <img
                src={np.art}
                alt=""
                className="w-11 h-11 rounded-[10px] object-cover border-2 flex-shrink-0"
                style={{ borderColor: "var(--card-border)" }}
              />
            ) : (
              <span className="badge-emoji !w-11 !h-11" style={{ color: "var(--text-main)" }}>
                <Music2 size={17} strokeWidth={2.5} />
              </span>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-head text-[13.5px] font-bold truncate">{np?.title || "Belum ada lagu"}</p>
              <p className="text-[11px] font-semibold text-[var(--text-muted)] truncate">
                {np?.artist || "Pilih lagu di bawah"}
              </p>
            </div>
            {!spotify.playerReady && (
              <span className="chip !text-[10px]">
                <RefreshCw size={10} strokeWidth={2.5} aria-hidden="true" />
                menunggu device…
              </span>
            )}
            <button
              className="btn-ctrl !w-9 !h-9"
              onClick={() => void handleTransport("prev")}
              title="Sebelumnya"
              aria-label="Lagu sebelumnya"
            >
              <SkipBack size={14} strokeWidth={2.5} fill="currentColor" />
            </button>
            <button
              className="btn-ctrl !w-10 !h-10"
              onClick={() => void handleTransport("toggle")}
              title={spotify.isPlaying ? "Pause" : "Play"}
              aria-label={spotify.isPlaying ? "Pause" : "Play"}
            >
              {spotify.isPlaying ? (
                <Pause size={15} strokeWidth={2.5} />
              ) : (
                <Play size={15} strokeWidth={2.5} className="ml-0.5" fill="currentColor" />
              )}
            </button>
            <button
              className="btn-ctrl !w-9 !h-9"
              onClick={() => void handleTransport("next")}
              title="Berikutnya"
              aria-label="Lagu berikutnya"
            >
              <SkipForward size={14} strokeWidth={2.5} fill="currentColor" />
            </button>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-[10px] font-bold text-[var(--text-muted)] w-[36px] text-right">
              {formatClock(positionMs / 1000)}
            </span>
            <input
              type="range"
              className="cozy-slider flex-1 !h-3"
              min={0}
              max={maxMs}
              step={500}
              value={Math.min(positionMs, maxMs)}
              onChange={(e) => handleSeek(Number(e.target.value))}
              aria-label="Progress lagu"
            />
            <span className="text-[10px] font-bold text-[var(--text-muted)] w-[36px]">
              {formatClock(durationMs / 1000)}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <VolumeIcon level={spotifyVol} />
            <input
              type="range"
              className="cozy-slider flex-1 !h-3"
              min={0}
              max={100}
              value={spotifyVol}
              onChange={(e) => handleSpotifyVolume(Number(e.target.value))}
              aria-label="Volume Spotify"
            />
          </div>
          {spotify.playerError && (
            <p className="text-[11px] font-semibold mt-2 flex items-start gap-1.5" style={{ color: "var(--red-dark)" }}>
              <AlertTriangle size={13} strokeWidth={2.5} aria-hidden="true" className="flex-shrink-0 mt-0.5" />
              {spotify.playerError}
            </p>
          )}
        </div>
      )}

      {/* ══ SEARCH ══ */}
      <form onSubmit={(e) => void handleSearch(e)} className="flex gap-2">
        <input
          className="text-input flex-1 !py-2"
          placeholder="Cari lagu, artis, album…"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          aria-label="Cari lagu, artis, atau album"
        />
        <button type="submit" className="btn-primary !text-[12.5px] !px-3.5" disabled={searching}>
          {searching ? (
            <>
              <Hourglass size={13} strokeWidth={2.5} aria-hidden="true" />
              Mencari…
            </>
          ) : (
            <>
              <Search size={13} strokeWidth={2.5} aria-hidden="true" />
              Cari
            </>
          )}
        </button>
      </form>

      {/* ══ KONTEN: PLAYLIST / HASIL CARI / TRACKS ══ */}
      {searchResults && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="micro-title flex items-center gap-1.5">
              <Search size={12} strokeWidth={2.5} aria-hidden="true" />
              Hasil Pencarian
            </span>
            <button className="chip chip-click !text-[10.5px] ml-auto" onClick={() => setSearchResults(null)}>
              <ArrowLeft size={11} strokeWidth={2.5} aria-hidden="true" />
              Tutup hasil
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {searchResults.length === 0 ? (
              <p className="text-[12px] font-semibold text-[var(--text-muted)] text-center py-4">
                Tidak ada lagu yang cocok — coba kata kunci lain
              </p>
            ) : (
              searchResults.map((t) => (
                <TrackRow
                  key={t.id}
                  track={t}
                  active={np?.uri === t.uri}
                  activePlaying={activePlaying}
                  premium={isPremium}
                  previewing={previewingUri === t.uri}
                  onPlay={(x) => void handlePlayTrack(x)}
                  onPreview={startPreview}
                />
              ))
            )}
          </div>
        </div>
      )}

      {activePlaylist && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="micro-title flex items-center gap-1.5 min-w-0">
              <Disc3 size={12} strokeWidth={2.5} aria-hidden="true" className="flex-shrink-0" />
              <span className="truncate">{activePlaylist.name}</span>
            </span>
            {isPremium && (
              <button className="btn-yellow !text-[11px] !px-2.5 !py-1 ml-auto flex-shrink-0" onClick={() => void handlePlayPlaylist(activePlaylist)}>
                <Play size={11} strokeWidth={2.5} aria-hidden="true" fill="currentColor" />
                Putar Playlist
              </button>
            )}
            <button
              className="chip chip-click !text-[10.5px] flex-shrink-0"
              onClick={() => {
                setActivePlaylist(null);
                setPlaylistTracks(null);
              }}
            >
              <ArrowLeft size={11} strokeWidth={2.5} aria-hidden="true" />
              Kembali
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {loadingTracks ? (
              <>
                <div className="skeleton h-[58px]" />
                <div className="skeleton h-[58px]" />
                <div className="skeleton h-[58px]" />
              </>
            ) : playlistTracks && playlistTracks.length > 0 ? (
              playlistTracks.map((t) => (
                <TrackRow
                  key={`${t.id}-${t.uri}`}
                  track={t}
                  active={np?.uri === t.uri}
                  activePlaying={activePlaying}
                  premium={isPremium}
                  previewing={previewingUri === t.uri}
                  onPlay={(x) => void handlePlayTrack(x)}
                  onPreview={startPreview}
                />
              ))
            ) : (
              <p className="text-[12px] font-semibold text-[var(--text-muted)] text-center py-4">
                Playlist kosong atau lagunya tidak bisa diputar
              </p>
            )}
          </div>
        </div>
      )}

      {!searchResults && !activePlaylist && (
        <div>
          <span className="micro-title flex items-center gap-1.5">
            <BookOpen size={12} strokeWidth={2.5} aria-hidden="true" />
            Playlist Kamu
          </span>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {loadingPlaylists ? (
              <>
                <div className="skeleton h-[150px]" />
                <div className="skeleton h-[150px]" />
                <div className="skeleton h-[150px]" />
              </>
            ) : playlists && playlists.length > 0 ? (
              playlists.map((pl, i) => (
                <motion.button
                  key={pl.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.4) }}
                  whileHover={{ x: -2, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => void openPlaylist(pl)}
                  className="text-left p-2.5 rounded-[14px] transition-colors"
                  style={{
                    background: "var(--warm-white)",
                    border: "2px solid var(--card-border)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <div
                    className="w-full aspect-square rounded-[10px] overflow-hidden mb-2 flex items-center justify-center"
                    style={{ background: "var(--peach)", border: "2px solid var(--card-border)" }}
                  >
                    {pl.images?.[0]?.url ? (
                      <img src={pl.images[0].url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Disc3 size={26} strokeWidth={2.5} style={{ color: "var(--text-muted)" }} aria-hidden="true" />
                    )}
                  </div>
                  <p className="font-head text-[12px] font-bold truncate leading-tight">{pl.name}</p>
                  <p className="text-[10.5px] font-semibold text-[var(--text-muted)] mt-0.5">
                    {pl.tracks.total} lagu
                    {pl.owner.display_name ? ` · ${pl.owner.display_name}` : ""}
                  </p>
                </motion.button>
              ))
            ) : (
              <p className="col-span-full text-[12px] font-semibold text-[var(--text-muted)] text-center py-4">
                Belum ada playlist. Buat dulu di Spotify-mu, lalu muat ulang halaman ini.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   PANEL UTAMA
   ════════════════════════════════════════════ */

export function SpotifyPanel() {
  const connected = useMusicStore((s) => s.spotify.connected);
  return connected ? <ConnectedView /> : <NotConnectedView />;
}
