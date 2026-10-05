"use client";

// ═══════════════════════════════════════════════════════════
//  useVoiceChannel — hook inti voice channel (WebRTC mesh P2P).
//
//  Signaling via Supabase Realtime:
//  - SATU channel `vc:{channelId}` per join.
//  - broadcast event "signal" → VcSignal (hello/offer/answer/ice/bye).
//  - presence {name, avatar} → daftar peer + nama/avatar.
//
//  Aturan deterministik anti-glare: peer dengan id STRING LEBIH
//  BESAR yang membuat offer. Peer lain menjawab answer + tukar ICE.
//
//  Semua yang mutable (RTCPeerConnection, MediaStream, elemen
//  <audio>, AnalyserNode, retry timer) disimpan di ref — state
//  React hanya snapshot untuk UI, jadi tidak ada infinite loop.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { REALTIME_SUBSCRIBE_STATES, type RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { playSound } from "@/components/ui/sfx";
import { RTC_CONFIG } from "@/lib/voice/rtc-config";
import type { VcSignal } from "@/lib/types";

export type VoiceConnectionState = "connecting" | "connected" | "failed";

export type PeerInfo = {
  id: string;
  name: string;
  avatar: string;
  stream: MediaStream | null;
  speaking: boolean;
  connection: VoiceConnectionState;
};

// ── konstanta ──
const MAX_PEERS = 8;
const SPEAK_ON = 0.06; // ambang mulai "speaking" (RMS)
const SPEAK_OFF = 0.04; // ambang berhenti (hysteresis anti-flicker)
const POLL_MS = 100; // polling level mic / speaking
const RECONNECT_DELAY_MS = 2000; // jeda sebelum retry offer
const MAX_RETRIES = 3; // percobaan reconnect maksimal
const LOCAL_KEY = "__me"; // kunci analyser untuk mic sendiri

type PresenceMeta = { name: string; avatar: string };

type PeerAudio = {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
  speaking: boolean;
};

/** pesan broadcast "signal" — payload berisi VcSignal tervalidasi terpisah */
type SignalMessage = { signal?: unknown };

// ── type guards (tanpa any, TS strict) ──
function isVcSignal(x: unknown): x is VcSignal {
  if (typeof x !== "object" || x === null) return false;
  const s = x as Record<string, unknown>;
  return (
    typeof s.from === "string" &&
    typeof s.to === "string" &&
    (s.kind === "offer" ||
      s.kind === "answer" ||
      s.kind === "ice" ||
      s.kind === "hello" ||
      s.kind === "bye")
  );
}

function readSessionDescription(x: unknown): RTCSessionDescriptionInit | null {
  if (typeof x !== "object" || x === null) return null;
  const o = x as Record<string, unknown>;
  if (
    typeof o.type !== "string" ||
    !["offer", "pranswer", "answer", "rollback"].includes(o.type) ||
    typeof o.sdp !== "string"
  ) {
    return null;
  }
  return { type: o.type as RTCSdpType, sdp: o.sdp };
}

function readIceCandidate(x: unknown): RTCIceCandidateInit | null {
  if (typeof x !== "object" || x === null) return null;
  const o = x as Record<string, unknown>;
  if (typeof o.candidate !== "string") return null;
  return {
    candidate: o.candidate,
    sdpMid: typeof o.sdpMid === "string" ? o.sdpMid : null,
    sdpMLineIndex: typeof o.sdpMLineIndex === "number" ? o.sdpMLineIndex : null,
    usernameFragment: typeof o.usernameFragment === "string" ? o.usernameFragment : null,
  };
}

function readHelloMeta(x: unknown): PresenceMeta {
  if (typeof x === "object" && x !== null) {
    const o = x as Record<string, unknown>;
    return {
      name: typeof o.name === "string" && o.name.trim() ? o.name.trim() : "Anonim",
      avatar: typeof o.avatar === "string" && o.avatar ? o.avatar : "🐣",
    };
  }
  return { name: "Anonim", avatar: "🐣" };
}

/** RMS 0..1 dari analyser (seberapa keras suara saat ini) */
function readRms(pa: PeerAudio): number {
  try {
    pa.analyser.getByteTimeDomainData(pa.data);
    let sum = 0;
    for (let i = 0; i < pa.data.length; i++) {
      const v = (pa.data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / pa.data.length);
  } catch {
    return 0;
  }
}

/** bandingkan snapshot peers tanpa membandingkan objek stream */
function peersSnapshotEqual(a: PeerInfo[], b: PeerInfo[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((p, i) => {
    const q = b[i];
    return (
      p.id === q.id &&
      p.name === q.name &&
      p.avatar === q.avatar &&
      p.speaking === q.speaking &&
      p.connection === q.connection &&
      !!p.stream === !!q.stream
    );
  });
}

export function useVoiceChannel(channelId: string | null) {
  const { user, profile } = useAuth();

  // ── state snapshot untuk UI ──
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localLevel, setLocalLevel] = useState(0);

  // ── refs: semua mutable di sini, TIDAK memicu re-render ──
  const joinedRef = useRef(false);
  const joiningRef = useRef(false);
  const channelIdRef = useRef<string | null>(channelId);
  const myIdRef = useRef("");
  const myNameRef = useRef("Tamu");
  const myAvatarRef = useRef("🐣");
  const chanRef = useRef<RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef(new Map<string, RTCPeerConnection>());
  const connStateRef = useRef(new Map<string, VoiceConnectionState>());
  const retryCountRef = useRef(new Map<string, number>());
  const retryTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingIceRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const remoteStreamsRef = useRef(new Map<string, MediaStream>());
  const audioElsRef = useRef(new Map<string, HTMLAudioElement>());
  const peerAudioRef = useRef(new Map<string, PeerAudio>());
  const helloMetaRef = useRef(new Map<string, PresenceMeta>());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const presenceSyncedRef = useRef(false);
  const mutedRef = useRef(false);
  const deafenedRef = useRef(false);
  const joinTokenRef = useRef(0); // guard: join lama jangan ganggu join baru
  const joinTargetRef = useRef<string | null>(null);

  // ── simpan channelId terbaru untuk join() yang stabil ──
  useEffect(() => {
    channelIdRef.current = channelId;
  }, [channelId]);

  // ── kirim signal broadcast ──
  const sendSignal = useCallback((sig: VcSignal) => {
    const chan = chanRef.current;
    if (!chan) return;
    void chan
      .send({ type: "broadcast", event: "signal", payload: { signal: sig } })
      .catch(() => {});
  }, []);

  // ── AudioContext + analyser ──
  const ensureAudioCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioContext();
      }
      if (audioCtxRef.current.state === "suspended") void audioCtxRef.current.resume();
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  const attachAnalyser = useCallback(
    (key: string, stream: MediaStream) => {
      const ctx = ensureAudioCtx();
      if (!ctx) return;
      try {
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser); // sengaja TIDAK ke destination (feedback)
        peerAudioRef.current.set(key, {
          source,
          analyser,
          data: new Uint8Array(analyser.frequencyBinCount),
          speaking: false,
        });
      } catch {
        // stream tidak bisa dianalisis — abaikan
      }
    },
    [ensureAudioCtx]
  );

  const detachAnalyser = useCallback((key: string) => {
    const pa = peerAudioRef.current.get(key);
    if (!pa) return;
    try {
      pa.source.disconnect();
      pa.analyser.disconnect();
    } catch {
      // sudah terputus
    }
    peerAudioRef.current.delete(key);
  }, []);

  // ── elemen <audio> tersembunyi per peer (dikelola hook, bukan tile) ──
  const attachAudioEl = useCallback((key: string, stream: MediaStream) => {
    if (typeof document === "undefined") return;
    let el = audioElsRef.current.get(key);
    if (!el) {
      el = document.createElement("audio");
      el.autoplay = true;
      el.style.display = "none";
      el.muted = deafenedRef.current;
      document.body.appendChild(el);
      audioElsRef.current.set(key, el);
    }
    try {
      el.srcObject = stream;
      void el.play().catch(() => {});
    } catch {
      // elemen sudah dihapus — abaikan
    }
  }, []);

  const detachAudioEl = useCallback((key: string) => {
    const el = audioElsRef.current.get(key);
    if (!el) return;
    try {
      el.srcObject = null;
      el.remove();
    } catch {
      // sudah terhapus
    }
    audioElsRef.current.delete(key);
  }, []);

  // ── snapshot peers dari presence + status PC (hanya jika berubah) ──
  const syncPeers = useCallback(() => {
    const chan = chanRef.current;
    const myId = myIdRef.current;
    if (!chan || !myId) {
      setPeers((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const state = chan.presenceState<PresenceMeta>();
    const next: PeerInfo[] = [];
    for (const [key, metas] of Object.entries(state)) {
      if (key === myId) continue;
      const presenceMeta = metas[0];
      const meta: PresenceMeta = presenceMeta
        ? { name: presenceMeta.name, avatar: presenceMeta.avatar }
        : (helloMetaRef.current.get(key) ?? { name: "Anonim", avatar: "🐣" });
      next.push({
        id: key,
        name: meta.name,
        avatar: meta.avatar,
        stream: remoteStreamsRef.current.get(key) ?? null,
        speaking: peerAudioRef.current.get(key)?.speaking ?? false,
        connection: connStateRef.current.get(key) ?? "connecting",
      });
    }
    setPeers((prev) => (peersSnapshotEqual(prev, next) ? prev : next));
  }, []);

  const setPeerConn = useCallback(
    (peerId: string, st: VoiceConnectionState) => {
      if (connStateRef.current.get(peerId) === st) return;
      connStateRef.current.set(peerId, st);
      syncPeers();
    },
    [syncPeers]
  );

  // ── buang satu peer sepenuhnya (PC, stream, audio, analyser) ──
  const teardownPeer = useCallback(
    (peerId: string) => {
      const timer = retryTimersRef.current.get(peerId);
      if (timer) {
        clearTimeout(timer);
        retryTimersRef.current.delete(peerId);
      }
      retryCountRef.current.delete(peerId);
      const pc = pcsRef.current.get(peerId);
      if (pc) {
        try {
          pc.onicecandidate = null;
          pc.ontrack = null;
          pc.oniceconnectionstatechange = null;
          pc.close();
        } catch {
          // PC sudah closed
        }
        pcsRef.current.delete(peerId);
      }
      connStateRef.current.delete(peerId);
      pendingIceRef.current.delete(peerId);
      remoteStreamsRef.current.delete(peerId);
      detachAnalyser(peerId);
      detachAudioEl(peerId);
      syncPeers();
    },
    [detachAnalyser, detachAudioEl, syncPeers]
  );

  // ── reconnect: ice failed → status "connecting" + retry offer (initiator) ──
  const handleIceState = useCallback(
    (peerId: string, pc: RTCPeerConnection) => {
      const st = pc.iceConnectionState;
      const existing = retryTimersRef.current.get(peerId);

      if (st === "connected" || st === "completed") {
        if (existing) {
          clearTimeout(existing);
          retryTimersRef.current.delete(peerId);
        }
        retryCountRef.current.delete(peerId);
        setPeerConn(peerId, "connected");
        return;
      }
      if (st === "checking" || st === "disconnected") {
        setPeerConn(peerId, "connecting");
        return;
      }
      if (st !== "failed") return;

      const count = (retryCountRef.current.get(peerId) ?? 0) + 1;
      retryCountRef.current.set(peerId, count);
      setPeerConn(peerId, "connecting"); // UI: "menghubungkan ulang…"
      if (existing) clearTimeout(existing);
      if (!joinedRef.current) return;

      if (myIdRef.current > peerId) {
        // initiator: retry offer (iceRestart) setelah 2 detik, maks 3x
        if (count > MAX_RETRIES) {
          setPeerConn(peerId, "failed");
          return;
        }
        const t = setTimeout(() => {
          retryTimersRef.current.delete(peerId);
          if (!joinedRef.current) return;
          if (pc.signalingState === "closed" || pc.connectionState === "closed") return;
          void (async () => {
            try {
              const offer = await pc.createOffer({ iceRestart: true });
              await pc.setLocalDescription(offer);
              sendSignal({
                from: myIdRef.current,
                to: peerId,
                kind: "offer",
                payload: pc.localDescription,
              });
            } catch {
              // peer mungkin sudah pergi — biarkan timer berikutnya menyerah
            }
          })();
        }, RECONNECT_DELAY_MS);
        retryTimersRef.current.set(peerId, t);
      } else {
        // non-initiator: tunggu offer baru dari initiator, maks 8 detik
        const t = setTimeout(() => {
          retryTimersRef.current.delete(peerId);
          const cur = pcsRef.current.get(peerId);
          if (
            cur &&
            cur.iceConnectionState !== "connected" &&
            cur.iceConnectionState !== "completed"
          ) {
            setPeerConn(peerId, "failed");
          }
        }, 8000);
        retryTimersRef.current.set(peerId, t);
      }
    },
    [sendSignal, setPeerConn]
  );

  // ── buat PC baru untuk peer + pasang handler ──
  const createPC = useCallback(
    (peerId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcsRef.current.set(peerId, pc);
      connStateRef.current.set(peerId, "connecting");
      const local = localStreamRef.current;
      if (local) {
        for (const track of local.getTracks()) pc.addTrack(track, local);
      }

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          sendSignal({
            from: myIdRef.current,
            to: peerId,
            kind: "ice",
            payload: ev.candidate.toJSON(),
          });
        }
      };
      pc.ontrack = (ev) => {
        const stream = ev.streams[0] ?? new MediaStream([ev.track]);
        remoteStreamsRef.current.set(peerId, stream);
        attachAudioEl(peerId, stream);
        if (!peerAudioRef.current.has(peerId)) attachAnalyser(peerId, stream);
        syncPeers();
      };
      pc.oniceconnectionstatechange = () => handleIceState(peerId, pc);
      syncPeers();
      return pc;
    },
    [sendSignal, attachAudioEl, attachAnalyser, handleIceState, syncPeers]
  );

  // ── initiator kirim offer (deterministik: hanya id lebih besar) ──
  const ensureOffer = useCallback(
    async (peerId: string) => {
      if (!joinedRef.current) return;
      if (myIdRef.current <= peerId) return;
      let pc = pcsRef.current.get(peerId);
      if (!pc) pc = createPC(peerId);
      if (pc.signalingState !== "stable") return; // sedang negosiasi
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal({
          from: myIdRef.current,
          to: peerId,
          kind: "offer",
          payload: pc.localDescription,
        });
      } catch {
        // peer sudah pergi / PC bermasalah — abaikan
      }
    },
    [createPC, sendSignal]
  );

  const flushPendingIce = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queue = pendingIceRef.current.get(peerId);
    if (!queue) return;
    pendingIceRef.current.delete(peerId);
    for (const cand of queue) {
      try {
        await pc.addIceCandidate(cand);
      } catch {
        // candidate basi — abaikan
      }
    }
  }, []);

  // ── handler broadcast "signal" (dipasang SEKALI per join) ──
  // Catatan: sengaja TIDAK men-gate joinedRef — offer bisa sah tiba
  // saat kita masih di tengah join flow (peer melihat presence kita).
  // Setelah teardown, channel sudah dilepas sehingga tidak ada pesan.
  const handleSignalMessage = useCallback(
    (msg: SignalMessage) => {
      if (!isVcSignal(msg?.signal)) return;
      const sig: VcSignal = msg.signal;
      const myId = myIdRef.current;
      if (!myId || sig.from === myId) return;

      switch (sig.kind) {
        case "hello": {
          // simpan nama/avatar segera (presence bisa telat sampai)
          helloMetaRef.current.set(sig.from, readHelloMeta(sig.payload));
          if (myId > sig.from) {
            // saya initiator → sambungkan
            void ensureOffer(sig.from);
          } else {
            syncPeers(); // tunggu offer dari peer ber-id lebih besar
          }
          break;
        }
        case "offer": {
          if (sig.to !== myId) break;
          void (async () => {
            try {
              const desc = readSessionDescription(sig.payload);
              if (!desc) return;
              let pc = pcsRef.current.get(sig.from);
              if (!pc) pc = createPC(sig.from);
              await pc.setRemoteDescription(desc); // rollback implisit bila perlu
              await flushPendingIce(sig.from, pc);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              sendSignal({
                from: myId,
                to: sig.from,
                kind: "answer",
                payload: pc.localDescription,
              });
            } catch {
              // offer rusak — abaikan
            }
          })();
          break;
        }
        case "answer": {
          if (sig.to !== myId) break;
          const desc = readSessionDescription(sig.payload);
          const pc = pcsRef.current.get(sig.from);
          if (desc && pc && pc.signalingState === "have-local-offer") {
            void (async () => {
              try {
                await pc.setRemoteDescription(desc);
                await flushPendingIce(sig.from, pc);
              } catch {
                // answer basi — abaikan
              }
            })();
          }
          break;
        }
        case "ice": {
          if (sig.to !== myId) break;
          const cand = readIceCandidate(sig.payload);
          if (!cand) break;
          const pc = pcsRef.current.get(sig.from);
          if (pc && pc.remoteDescription) {
            void pc.addIceCandidate(cand).catch(() => {});
          } else {
            // PC/remote description belum siap → antre dulu
            const queue = pendingIceRef.current.get(sig.from) ?? [];
            queue.push(cand);
            pendingIceRef.current.set(sig.from, queue);
          }
          break;
        }
        case "bye": {
          teardownPeer(sig.from);
          break;
        }
      }
    },
    [ensureOffer, syncPeers, createPC, flushPendingIce, sendSignal, teardownPeer]
  );

  // ── presence sync: refresh daftar + buang PC yatim ──
  const handlePresenceSync = useCallback(() => {
    presenceSyncedRef.current = true;
    const chan = chanRef.current;
    const myId = myIdRef.current;
    if (!chan || !myId) return;
    const state = chan.presenceState<PresenceMeta>();
    const keys = new Set(Object.keys(state));
    for (const id of Array.from(pcsRef.current.keys())) {
      if (!keys.has(id)) teardownPeer(id); // peer pergi tanpa bye
    }
    syncPeers();
  }, [teardownPeer, syncPeers]);

  // ── polling level mic + speaking detection (hysteresis) ──
  const startPolling = useCallback(() => {
    if (pollRef.current !== null) return;
    pollRef.current = setInterval(() => {
      const me = peerAudioRef.current.get(LOCAL_KEY);
      if (me) {
        const level = Math.round(readRms(me) * 50) / 50; // kuantisasi 0.02
        setLocalLevel((prev) => (prev === level ? prev : level));
      } else {
        setLocalLevel((prev) => (prev === 0 ? prev : 0));
      }
      let speakingChanged = false;
      for (const [key, pa] of Array.from(peerAudioRef.current)) {
        if (key === LOCAL_KEY) continue;
        const rms = readRms(pa);
        const next = pa.speaking ? rms < SPEAK_OFF : rms > SPEAK_ON;
        if (next !== pa.speaking) {
          pa.speaking = next;
          speakingChanged = true;
        }
      }
      if (speakingChanged) syncPeers();
    }, POLL_MS);
  }, [syncPeers]);

  // ── teardown total (idempoten — aman dipanggil berulang) ──
  const teardown = useCallback(
    (opts: { broadcast: boolean }) => {
      if (opts.broadcast && joinedRef.current && myIdRef.current) {
        sendSignal({ from: myIdRef.current, to: "*", kind: "bye" });
      }
      if (pollRef.current !== null) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      for (const t of Array.from(retryTimersRef.current.values())) clearTimeout(t);
      retryTimersRef.current.clear();
      retryCountRef.current.clear();

      for (const key of Array.from(peerAudioRef.current.keys())) detachAnalyser(key);
      const ctx = audioCtxRef.current;
      audioCtxRef.current = null;
      if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});

      for (const key of Array.from(audioElsRef.current.keys())) detachAudioEl(key);

      for (const [id, pc] of Array.from(pcsRef.current)) {
        try {
          pc.onicecandidate = null;
          pc.ontrack = null;
          pc.oniceconnectionstatechange = null;
          pc.close();
        } catch {
          // PC sudah closed
        }
        pcsRef.current.delete(id);
      }
      connStateRef.current.clear();
      pendingIceRef.current.clear();
      remoteStreamsRef.current.clear();
      helloMetaRef.current.clear();

      const local = localStreamRef.current;
      localStreamRef.current = null;
      if (local) {
        for (const track of local.getTracks()) {
          try {
            track.stop();
          } catch {
            // track sudah berhenti
          }
        }
      }

      const chan = chanRef.current;
      chanRef.current = null;
      if (chan) {
        try {
          void chan.untrack().catch(() => {});
        } catch {
          // channel sudah ditutup
        }
        try {
          void getSupabase().removeChannel(chan);
        } catch {
          // client bermasalah — biarkan GC
        }
      }

      presenceSyncedRef.current = false;
      joinedRef.current = false;
      joinTargetRef.current = null;
      setJoined(false);
      setPeers([]);
      setLocalLevel(0);
    },
    [sendSignal, detachAnalyser, detachAudioEl]
  );

  // ── JOIN ──
  const join = useCallback(async () => {
    const cid = channelIdRef.current;
    if (!cid || joinedRef.current) return;
    if (typeof window === "undefined") return;
    if (joiningRef.current && joinTargetRef.current === cid) return; // join ini sudah berjalan

    // token baru otomatis membatalkan join lama yang masih in-flight
    const token = ++joinTokenRef.current;
    joiningRef.current = true;
    joinTargetRef.current = cid;
    setJoining(true);
    setError(null);

    // identitas: user.id bila ada, selain itu guest-id yang stabil per hook
    let rid = "";
    try {
      rid = crypto.randomUUID();
    } catch {
      rid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }
    const prevGuest = myIdRef.current.startsWith("guest-") ? myIdRef.current : null;
    myIdRef.current = user?.id ?? prevGuest ?? `guest-${rid}`;
    myNameRef.current = profile?.display_name?.trim() || "Tamu";
    myAvatarRef.current = profile?.avatar || "🐣";

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Browser ini tidak mendukung akses mikrofon 😢");
      }

      // ── 1. mic (gagal → pesan ramah, tidak crash) ──
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
      } catch {
        throw new Error("Mic tidak diizinkan 🎤 — cek izin browser");
      }
      localStreamRef.current = stream;
      attachAnalyser(LOCAL_KEY, stream);

      // ── 2. channel + listener (SEKALI per join) ──
      const sb = getSupabase();
      const chan = sb.channel(`vc:${cid}`, {
        config: { presence: { key: myIdRef.current } },
      });
      chanRef.current = chan;
      chan
        .on("presence", { event: "sync" }, handlePresenceSync)
        .on<{ signal?: unknown }>("broadcast", { event: "signal" }, (payload) =>
          handleSignalMessage(payload.payload)
        );

      const subscribed = await new Promise<boolean>((resolve) => {
        let done = false;
        const timer = setTimeout(() => {
          if (!done) {
            done = true;
            resolve(false);
          }
        }, 8000);
        void chan.subscribe((status) => {
          if (done) return;
          if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
            done = true;
            clearTimeout(timer);
            resolve(true);
          } else if (
            status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
            status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT ||
            status === REALTIME_SUBSCRIBE_STATES.CLOSED
          ) {
            done = true;
            clearTimeout(timer);
            resolve(false);
          }
        });
      });
      if (chanRef.current !== chan) return; // user pindah channel saat menunggu
      if (!subscribed) throw new Error("Gagal terhubung ke channel voice 😢");

      // ── 3. track presence {name, avatar} ──
      await chan.track({ name: myNameRef.current, avatar: myAvatarRef.current });
      if (chanRef.current !== chan) return;

      // ── 4. tunggu presence sync → cek kapasitas ──
      presenceSyncedRef.current = false;
      await new Promise<void>((resolve) => {
        const start = Date.now();
        const check = setInterval(() => {
          if (presenceSyncedRef.current || Date.now() - start > 2500) {
            clearInterval(check);
            resolve();
          }
        }, 100);
      });
      if (chanRef.current !== chan) return;

      const state = chan.presenceState<PresenceMeta>();
      const others = Object.keys(state).filter((k) => k !== myIdRef.current).length;
      if (others >= MAX_PEERS) {
        throw new Error("Channel penuh (maks 8) 🥺 — mesh P2P");
      }

      // ── 5. resmi joined: hello + offer ke peer ber-id lebih kecil ──
      joinedRef.current = true;
      setJoined(true);
      sendSignal({
        from: myIdRef.current,
        to: "*",
        kind: "hello",
        payload: { name: myNameRef.current, avatar: myAvatarRef.current },
      });
      for (const key of Object.keys(state)) {
        if (key !== myIdRef.current && myIdRef.current > key) {
          void ensureOffer(key);
        }
      }

      startPolling();
      playSound("join");
    } catch (e) {
      // join sudah dipreempt oleh join lebih baru → biarkan sepenuhnya
      if (joinTokenRef.current === token) {
        const msg = e instanceof Error ? e.message : "Gagal join voice channel 😢";
        teardown({ broadcast: false }); // belum sempat diumumkan — tanpa bye
        setError(msg);
      }
    } finally {
      // hanya join TERBARU yang boleh mengubah status joining
      if (joinTokenRef.current === token) {
        joiningRef.current = false;
        setJoining(false);
      }
    }
  }, [
    user?.id,
    profile?.display_name,
    profile?.avatar,
    attachAnalyser,
    handlePresenceSync,
    handleSignalMessage,
    sendSignal,
    ensureOffer,
    startPolling,
    teardown,
  ]);

  // ── LEAVE (publik) ──
  const leave = useCallback(() => {
    teardown({ broadcast: true });
  }, [teardown]);

  // ── auto-leave saat channelId berubah / unmount (cleanup ref pattern) ──
  useEffect(() => {
    return () => {
      teardown({ broadcast: true });
    };
  }, [channelId, teardown]);

  // ── mute / deafen ──
  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    const track = localStreamRef.current?.getAudioTracks()[0] ?? null;
    if (track) track.enabled = !next;
  }, []);

  const toggleDeafen = useCallback(() => {
    const next = !deafenedRef.current;
    deafenedRef.current = next;
    setDeafened(next);
    for (const el of Array.from(audioElsRef.current.values())) el.muted = next;
  }, []);

  return {
    joined,
    joining,
    leave,
    join,
    peers,
    muted,
    deafened,
    toggleMute,
    toggleDeafen,
    error,
    localLevel,
  };
}
