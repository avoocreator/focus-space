// ═══════════════════════════════════════════════════════════
//  MUSIK COZY GENERATIF (Web Audio — tanpa file eksternal)
//  Port penuh dari engine versi lama, diketik ulang ke TypeScript.
//  4 track dengan karakter beda; melodi & pad dibangkitkan
//  langsung oleh kode sehingga tidak ada link audio yang bisa
//  mati dan bebas masalah copyright.
//
//  Singleton module-level → musik tetap bunyi saat pindah halaman.
//  State (playing/volume/ready) ditulis ke stores/music-store.ts.
// ═══════════════════════════════════════════════════════════

import type { LucideIcon } from "lucide-react";
import { BookOpen, CloudRain, Coffee, Moon } from "lucide-react";
import { useMusicStore, type RadioTrackKey } from "@/stores/music-store";

export interface RadioTrackDef {
  key: RadioTrackKey;
  /** Ikon lucide yang dirender di UI (pengganti emoji) */
  icon: LucideIcon;
  name: string;
  desc: string;
  bpm: number;
  hiss?: boolean;
  rain?: boolean;
  musicbox?: boolean;
  dreamy?: boolean;
}

export const MUSIC_TRACKS: Record<RadioTrackKey, RadioTrackDef> = {
  kopi: {
    key: "kopi",
    icon: Coffee,
    name: "Kopi Senja",
    desc: "Jazz hangat + desis vinyl, teman ngopi sore",
    bpm: 60,
    hiss: true,
  },
  hujan: {
    key: "hujan",
    icon: CloudRain,
    name: "Hujan di Jendela",
    desc: "Ambient lembut dengan suara hujan di jendela",
    bpm: 54,
    rain: true,
  },
  buku: {
    key: "buku",
    icon: BookOpen,
    name: "Perpustakaan Senin",
    desc: "Kotak musik pentatonik manja, pas buat baca",
    bpm: 76,
    musicbox: true,
  },
  malam: {
    key: "malam",
    icon: Moon,
    name: "Malam Berbintang",
    desc: "Pad dreamy malam berbintang, buat melamun",
    bpm: 48,
    dreamy: true,
  },
};

export const TRACK_KEYS: RadioTrackKey[] = ["kopi", "hujan", "buku", "malam"];

// Progresi chord (nomor MIDI) — diulang tiap 4 bar
export const MUSIC_PROGS: Record<RadioTrackKey, number[][]> = {
  kopi: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], // Fmaj7 Em7 Dm7 Cmaj7
  hujan: [[45, 52, 55, 60], [53, 57, 60, 64], [48, 52, 55, 59], [50, 55, 59, 62]], // Am7 Fmaj7 Cmaj7 Dm7
  buku: [[48, 55, 60], [45, 52, 60], [43, 50, 59], [41, 48, 57]], // C  Am  G  F
  malam: [[50, 53, 57, 60], [46, 50, 53, 58], [48, 52, 55, 59], [45, 52, 55, 60]], // Dm  Bb  C  Am
};

const MUSIC_PENTA = [72, 74, 76, 79, 81, 84]; // pentatonik C — kotak musik

// ── State engine (module-level, singleton) ──
let ctx: AudioContext | null = null;
let master: GainNode | null = null; // master gain terpisah untuk volume
let chainOut: { out: BiquadFilterNode; delay: DelayNode } | null = null;
let bus: GainNode | null = null;
const noise: AudioBufferSourceNode[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let nextBar = 0;
let barIdx = 0;
let playing: RadioTrackKey | null = null;

function createAudioContext(): AudioContext {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new AC();
}

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = createAudioContext();
    // Master gain terpisah — volume diatur di sini, bus track fade-in sendiri.
    master = ctx.createGain();
    master.gain.value = useMusicStore.getState().volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function musicHz(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/** Rantai FX bersama: lowpass 2800Hz → master, delay 0.34s → master */
function musicChain(): { out: BiquadFilterNode; delay: DelayNode } {
  if (chainOut) return chainOut;
  const c = getCtx();
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2800;
  lp.Q.value = 0.4;
  lp.connect(master as GainNode);

  const delay = c.createDelay(1);
  delay.delayTime.value = 0.34;
  const fb = c.createGain();
  fb.gain.value = 0.3;
  const wet = c.createGain();
  wet.gain.value = 0.22;
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(wet);
  wet.connect(master as GainNode);

  chainOut = { out: lp, delay };
  return chainOut;
}

function musicPad(busNode: GainNode, t: number, midi: number, dur: number, vol: number, type?: OscillatorType): void {
  const c = getCtx();
  const o = c.createOscillator();
  o.type = type || "triangle";
  o.frequency.value = musicHz(midi);
  o.detune.value = Math.random() * 6 - 3; // sedikit lebar biar hidup
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
  g.gain.setValueAtTime(vol, t + dur * 0.75);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(busNode);
  o.start(t);
  o.stop(t + dur + 0.1);
}

function musicPluck(busNode: GainNode, t: number, midi: number, vol: number): void {
  const c = getCtx();
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.value = musicHz(midi);
  const o2 = c.createOscillator();
  o2.type = "triangle";
  o2.frequency.value = musicHz(midi);
  o2.detune.value = 7; // shimmer tipis
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  const g2 = c.createGain();
  g2.gain.setValueAtTime(vol * 0.25, t);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  o.connect(g);
  o2.connect(g2);
  g.connect(busNode);
  g2.connect(busNode);
  o.start(t);
  o.stop(t + 1.5);
  o2.start(t);
  o2.stop(t + 1.0);
}

/** 'rain' = hujan lembut, 'hiss' = desis vinyl tipis */
function musicNoise(busNode: GainNode, kind: "rain" | "hiss"): void {
  const c = getCtx();
  const len = Math.floor(c.sampleRate * 2);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const f = c.createBiquadFilter();
  const g = c.createGain();
  if (kind === "rain") {
    f.type = "bandpass";
    f.frequency.value = 2600;
    f.Q.value = 0.5;
    g.gain.value = 0.035;
  } else {
    f.type = "highpass";
    f.frequency.value = 6000;
    g.gain.value = 0.005;
  }
  src.connect(f);
  f.connect(g);
  g.connect(busNode);
  src.start();
  noise.push(src);
}

function musicBar(t: number, key: RadioTrackKey, idx: number, barDur: number): void {
  const tr = MUSIC_TRACKS[key];
  const chord = MUSIC_PROGS[key][idx % 4];
  const busNode = bus;
  if (!busNode) return;

  // Pad chord
  const padVol = tr.dreamy ? 0.075 : tr.musicbox ? 0.05 : 0.06;
  chord.forEach((m) => musicPad(busNode, t, m, barDur * 0.98, padVol, tr.dreamy ? "sine" : "triangle"));

  // Bass lembut
  musicPad(busNode, t, chord[0] - 12, barDur * 0.92, tr.dreamy ? 0.1 : 0.08, "sine");

  // Melodi
  if (tr.musicbox) {
    const hits = 3 + Math.floor(Math.random() * 3); // 3-5 pluck pentatonik acak
    for (let i = 0; i < hits; i++) {
      if (Math.random() < 0.25) continue;
      const beat = t + Math.random() * barDur * 0.9;
      const note = MUSIC_PENTA[Math.floor(Math.random() * MUSIC_PENTA.length)];
      musicPluck(busNode, beat, note, 0.1 + Math.random() * 0.06);
    }
  } else {
    const hits = 1 + Math.floor(Math.random() * 2); // 1-2 pluck dari chord+12
    for (let i = 0; i < hits; i++) {
      if (Math.random() < 0.3) continue;
      const beat = t + barDur * (0.2 + Math.random() * 0.6);
      const tones = chord.map((m) => m + 12);
      const note = tones[Math.floor(Math.random() * tones.length)];
      musicPluck(busNode, beat, note, 0.07 + Math.random() * 0.05);
    }
  }
}

function musicTick(): void {
  if (!playing || !ctx) return;
  const tr = MUSIC_TRACKS[playing];
  const barDur = (60 / tr.bpm) * 4;
  while (nextBar < ctx.currentTime + 1.5) {
    musicBar(nextBar, playing, barIdx, barDur);
    nextBar += barDur;
    barIdx++;
  }
}

/** Fade-in bus 0→0.9 selama 0.8s lalu mulai scheduler bar */
export function playMusic(key: RadioTrackKey): void {
  if (playing === key) return;
  stopMusic(true);
  const c = getCtx();
  const chain = musicChain();
  const busNode = c.createGain();
  busNode.gain.value = 0.0001;
  busNode.connect(chain.out);
  busNode.connect(chain.delay);
  busNode.gain.linearRampToValueAtTime(0.9, c.currentTime + 0.8);

  bus = busNode;
  playing = key;
  barIdx = 0;
  nextBar = c.currentTime + 0.15;
  const tr = MUSIC_TRACKS[key];
  if (tr.rain) musicNoise(busNode, "rain");
  if (tr.hiss) musicNoise(busNode, "hiss");
  timer = setInterval(musicTick, 300);

  const store = useMusicStore.getState();
  store.setPlaying(key);
  store.setLastTrack(key);
  store.setReady(true);
}

/** Fade-out (default 1s, instant 0.15s) lalu disconnect + bersihkan noise & interval */
export function stopMusic(instant = false): void {
  const wasPlaying = playing;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  const c = ctx;
  const busNode = bus;
  const oldNoise = noise.splice(0, noise.length);
  playing = null;
  bus = null;
  if (wasPlaying) useMusicStore.getState().setPlaying(null);
  if (!busNode || !c) return;

  const fade = instant ? 0.15 : 1;
  try {
    busNode.gain.cancelScheduledValues(c.currentTime);
    busNode.gain.setValueAtTime(busNode.gain.value, c.currentTime);
    busNode.gain.linearRampToValueAtTime(0.0001, c.currentTime + fade);
  } catch {
    /* abaikan */
  }
  window.setTimeout(() => {
    try {
      busNode.disconnect();
    } catch {
      /* abaikan */
    }
  }, fade * 1000 + 300);
  oldNoise.forEach((n) => {
    try {
      n.stop(c.currentTime + fade);
    } catch {
      /* abaikan */
    }
  });
}

function applyMasterVolume(v: number): void {
  if (!master || !ctx) return;
  try {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(Math.min(1, Math.max(0, v)), ctx.currentTime, 0.05);
  } catch {
    /* abaikan */
  }
}

/** Atur volume master (0..1). Lewat store supaya satu sumber kebenaran + persist localStorage;
 *  langganan di bawah yang menerapkannya ke master gain node. */
export function setVolume(v: number): void {
  useMusicStore.getState().setVolume(Math.min(1, Math.max(0, v)));
}

// Sinkronkan volume master dengan store (satu sumber kebenaran).
// UI cukup memanggil setVolume() / useMusicStore.getState().setVolume().
useMusicStore.subscribe((s, prev) => {
  if (s.volume !== prev.volume) applyMasterVolume(s.volume);
});
