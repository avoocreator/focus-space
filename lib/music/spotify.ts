// ═══════════════════════════════════════════════════════════
//  SPOTIFY HELPER — OAuth PKCE, penyimpanan token, klien API
//  ber-tipe (auto-refresh 1x saat 401), dan loader Web Playback SDK.
//  Semua tipe API Spotify didefinisikan di sini (strict, tanpa any).
// ═══════════════════════════════════════════════════════════

import { useMusicStore } from "@/stores/music-store";

// ─────────────────────────────────────────────
//  TIPE API SPOTIFY
// ─────────────────────────────────────────────

export interface SpotifyImage {
  url: string;
  width: number | null;
  height: number | null;
}

export interface SpotifyArtist {
  name: string;
}

export interface SpotifyAlbum {
  name: string;
  images: SpotifyImage[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  preview_url: string | null;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  uri: string;
  images: SpotifyImage[] | null;
  collaborative: boolean;
  tracks: { total: number };
  owner: { display_name?: string };
}

export interface SpotifyPlaylistItem {
  added_at: string;
  track: SpotifyTrack | null; // bisa null (track lokal / dihapus)
}

export interface SpotifyPaged<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  next: string | null;
  previous: string | null;
}

export interface SpotifyUser {
  id: string;
  display_name: string | null;
  email?: string;
  product?: string;
  images: SpotifyImage[];
}

export interface SpotifyDevice {
  id: string | null;
  is_active: boolean;
  name: string;
  type: string;
}

export interface SpotifyPlaybackState {
  device: SpotifyDevice | null;
  is_playing: boolean;
  progress_ms: number | null;
  item: SpotifyTrack | null;
}

// ── Web Playback SDK ──

export interface WebPlaybackError {
  message: string;
}

export interface WebPlaybackTrack {
  id: string | null;
  uri: string;
  name: string;
  duration_ms: number;
  artists: SpotifyArtist[];
  album: { uri: string; name: string; images: SpotifyImage[] };
}

export interface WebPlaybackState {
  context: { uri: string | null };
  disallows: Record<string, boolean>;
  paused: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  track_window: {
    current_track: WebPlaybackTrack;
    previous_tracks: WebPlaybackTrack[];
    next_tracks: WebPlaybackTrack[];
  };
}

interface SpotifyPlayerEvents {
  ready: { device_id: string };
  not_ready: { device_id: string };
  player_state_changed: WebPlaybackState | null;
  initialization_error: WebPlaybackError;
  authentication_error: WebPlaybackError;
  account_error: WebPlaybackError;
  playback_error: WebPlaybackError;
}

export interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener<K extends keyof SpotifyPlayerEvents>(
    event: K,
    cb: (payload: SpotifyPlayerEvents[K]) => void
  ): boolean;
  removeListener(event: string): boolean;
  togglePlay(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(ms: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  getVolume(): Promise<number>;
  getCurrentState(): Promise<WebPlaybackState | null>;
  setName(name: string): Promise<void>;
  activateElement(): Promise<void>;
}

export interface SpotifySDK {
  Player: new (options: {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }) => SpotifyPlayer;
}

declare global {
  interface Window {
    Spotify?: SpotifySDK;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

// ── Token response dari /api/spotify/token|refresh ──

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

export interface SpotifyTokenSet {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

// ─────────────────────────────────────────────
//  KONSTANTA
// ─────────────────────────────────────────────

const TOKEN_KEY = "fs_spotify_token";
const VERIFIER_KEY = "fs_spotify_verifier";
export const SPOTIFY_REDIRECT_PATH = "/music/callback";
export const SPOTIFY_SCOPES = [
  "user-read-email",
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-library-read",
  "user-top-read",
  "streaming",
] as const;

export function spotifyClientId(): string {
  return process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || "";
}

/** Error khusus Spotify (bawa status HTTP biar UI bisa bedakan 404 dsb) */
export class SpotifyError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "SpotifyError";
    this.status = status;
  }
}

// ─────────────────────────────────────────────
//  PKCE (code_verifier + code_challenge S256)
// ─────────────────────────────────────────────

function generateCodeVerifier(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < 64; i++) out += chars[bytes[i] % chars.length];
  return out;
}

function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function codeChallengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(digest);
}

/** Simpan verifier di sessionStorage lalu redirect ke halaman izin Spotify */
export async function startSpotifyOAuth(): Promise<void> {
  const clientId = spotifyClientId();
  if (!clientId) {
    throw new Error("NEXT_PUBLIC_SPOTIFY_CLIENT_ID belum diset — lihat /setup");
  }
  const verifier = generateCodeVerifier();
  const challenge = await codeChallengeS256(verifier);
  sessionStorage.setItem(VERIFIER_KEY, verifier);

  const redirectUri = `${window.location.origin}${SPOTIFY_REDIRECT_PATH}`;
  const url =
    "https://accounts.spotify.com/authorize" +
    `?client_id=${encodeURIComponent(clientId)}` +
    "&response_type=code" +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(SPOTIFY_SCOPES.join(" "))}` +
    "&code_challenge_method=S256" +
    `&code_challenge=${encodeURIComponent(challenge)}`;
  window.location.href = url;
}

export function takeCodeVerifier(): string | null {
  const v = sessionStorage.getItem(VERIFIER_KEY);
  if (v) sessionStorage.removeItem(VERIFIER_KEY);
  return v;
}

// ─────────────────────────────────────────────
//  PENYIMPANAN TOKEN (localStorage)
// ─────────────────────────────────────────────

export function getSpotifyToken(): SpotifyTokenSet | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SpotifyTokenSet;
    return parsed.access_token ? parsed : null;
  } catch {
    return null;
  }
}

export function isTokenUsable(t: SpotifyTokenSet | null): boolean {
  return !!t && t.expires_at - 30_000 > Date.now();
}

export function saveSpotifyToken(res: SpotifyTokenResponse): SpotifyTokenSet {
  const prev = getSpotifyToken();
  const next: SpotifyTokenSet = {
    access_token: res.access_token,
    refresh_token: res.refresh_token || prev?.refresh_token,
    expires_at: Date.now() + res.expires_in * 1000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(next));
  useMusicStore.getState().patchSpotify({ connected: true });
  return next;
}

export function clearSpotifyToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Token yang pasti masih berlaku — refresh dulu kalau perlu */
export async function ensureFreshToken(): Promise<SpotifyTokenSet | null> {
  const cur = getSpotifyToken();
  if (isTokenUsable(cur)) return cur;
  return refreshSpotifyToken();
}

// ─────────────────────────────────────────────
//  REFRESH VIA ROUTE HANDLER
// ─────────────────────────────────────────────

export async function refreshSpotifyToken(): Promise<SpotifyTokenSet | null> {
  const cur = getSpotifyToken();
  if (!cur?.refresh_token) return null;
  const res = await fetch("/api/spotify/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: cur.refresh_token }),
  });
  if (!res.ok) {
    let msg = `Gagal refresh sesi Spotify (HTTP ${res.status})`;
    try {
      const data = (await res.json()) as { error?: unknown };
      if (typeof data?.error === "string" && data.error) msg = data.error;
    } catch {
      /* biarkan pesan default */
    }
    throw new SpotifyError(msg, res.status);
  }
  const data = (await res.json()) as SpotifyTokenResponse;
  return saveSpotifyToken(data);
}

// ─────────────────────────────────────────────
//  KLIEN API (Bearer + retry 1x saat 401)
// ─────────────────────────────────────────────

function extractErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === "object" && data !== null) {
    const err = (data as { error?: unknown }).error;
    if (typeof err === "string" && err) return err;
    if (typeof err === "object" && err !== null) {
      const msg = (err as { message?: unknown }).message;
      if (typeof msg === "string" && msg) return msg;
    }
  }
  return fallback;
}

export async function spotifyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let token = getSpotifyToken();
  if (!token) throw new SpotifyError("Spotify belum terhubung — connect dulu ya");
  if (!isTokenUsable(token)) {
    token = await refreshSpotifyToken();
    if (!token) throw new SpotifyError("Sesi Spotify habis — connect ulang ya");
  }

  const call = (accessToken: string): Promise<Response> =>
    fetch(`https://api.spotify.com${path}`, {
      ...init,
      headers: {
        ...(init?.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${accessToken}`,
      },
    });

  let res = await call(token.access_token);
  if (res.status === 401) {
    const fresh = await refreshSpotifyToken();
    if (fresh) res = await call(fresh.access_token);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    throw new SpotifyError(extractErrorMessage(data, `Spotify merespons ${res.status}`), res.status);
  }
  return data as T;
}

// ─────────────────────────────────────────────
//  API SPESIFIK
// ─────────────────────────────────────────────

export function fetchSpotifyMe(): Promise<SpotifyUser> {
  return spotifyFetch<SpotifyUser>("/v1/me");
}

export function fetchSpotifyPlaylists(): Promise<SpotifyPaged<SpotifyPlaylist>> {
  return spotifyFetch<SpotifyPaged<SpotifyPlaylist>>("/v1/me/playlists?limit=50");
}

export function fetchPlaylistTracks(playlistId: string): Promise<SpotifyPaged<SpotifyPlaylistItem>> {
  return spotifyFetch<SpotifyPaged<SpotifyPlaylistItem>>(
    `/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100`
  );
}

export function searchSpotifyTracks(query: string): Promise<SpotifyPaged<SpotifyTrack>> {
  return spotifyFetch<SpotifyPaged<SpotifyTrack>>(
    `/v1/search?type=track&limit=20&q=${encodeURIComponent(query)}`
  );
}

export function fetchDevices(): Promise<{ devices: SpotifyDevice[] }> {
  return spotifyFetch<{ devices: SpotifyDevice[] }>("/v1/me/player/devices");
}

/** PUT play — dengan device_id (browser SDK) atau tanpa (remote ke device aktif user) */
export async function spotifyPlayUris(uris: string[], deviceId?: string): Promise<void> {
  const q = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  await spotifyFetch<undefined>(`/v1/me/player/play${q}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uris }),
  });
}

export async function spotifyPlayContext(contextUri: string, deviceId?: string): Promise<void> {
  const q = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  await spotifyFetch<undefined>(`/v1/me/player/play${q}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context_uri: contextUri }),
  });
}

export async function spotifyTogglePlay(play: boolean): Promise<void> {
  await spotifyFetch<undefined>(`/v1/me/player/${play ? "play" : "pause"}`, { method: "PUT" });
}

export async function spotifyNext(): Promise<void> {
  await spotifyFetch<undefined>("/v1/me/player/next", { method: "POST" });
}

export async function spotifyPrev(): Promise<void> {
  await spotifyFetch<undefined>("/v1/me/player/previous", { method: "POST" });
}

export async function spotifySeek(ms: number): Promise<void> {
  await spotifyFetch<undefined>(`/v1/me/player/seek?position_ms=${Math.max(0, Math.round(ms))}`, {
    method: "PUT",
  });
}

export async function spotifySetVolume(percent: number): Promise<void> {
  const p = Math.min(100, Math.max(0, Math.round(percent)));
  await spotifyFetch<undefined>(`/v1/me/player/volume?volume_percent=${p}`, { method: "PUT" });
}

export async function spotifyTransferPlayback(deviceId: string, play = true): Promise<void> {
  await spotifyFetch<undefined>("/v1/me/player", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_ids: [deviceId], play }),
  });
}

/** GET /v1/me/player (204 kalau kosong → null) lalu tulis ke store */
export async function syncNowPlaying(): Promise<void> {
  const state = await spotifyFetch<SpotifyPlaybackState | null>("/v1/me/player");
  const patch = {
    isPlaying: state?.is_playing ?? false,
    nowPlaying: state?.item
      ? {
          uri: state.item.uri,
          title: state.item.name,
          artist: state.item.artists.map((a) => a.name).join(", "),
          art: state.item.album.images[0]?.url ?? null,
          durationMs: state.item.duration_ms,
          positionMs: state.progress_ms ?? 0,
        }
      : null,
  };
  useMusicStore.getState().patchSpotify(patch);
}

// ─────────────────────────────────────────────
//  WEB PLAYBACK SDK (dinamis, sekali saja)
// ─────────────────────────────────────────────

let sdkPromise: Promise<SpotifySDK> | null = null;

export function loadPlaybackSDK(): Promise<SpotifySDK> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<SpotifySDK>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("SDK Spotify hanya bisa dimuat di browser"));
      return;
    }
    if (window.Spotify?.Player) {
      resolve(window.Spotify);
      return;
    }

    let settled = false;
    const onReady = (): void => {
      if (settled) return;
      if (window.Spotify?.Player) {
        settled = true;
        resolve(window.Spotify);
      }
    };
    window.onSpotifyWebPlaybackSDKReady = onReady;

    // Poll cadangan kalau event tidak terpanggil (script sudah ada sebelumnya)
    const poll = window.setInterval(() => {
      if (window.Spotify?.Player) {
        window.clearInterval(poll);
        onReady();
      }
    }, 250);
    window.setTimeout(() => {
      window.clearInterval(poll);
      if (!settled) {
        settled = true;
        reject(new Error("Gagal memuat SDK Spotify — cek koneksi internet"));
      }
    }, 12_000);

    if (!document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
      const script = document.createElement("script");
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      script.onerror = () => {
        if (!settled) {
          settled = true;
          reject(new Error("Gagal memuat SDK Spotify — cek koneksi internet"));
        }
      };
      document.body.appendChild(script);
    }
  });
  return sdkPromise;
}
