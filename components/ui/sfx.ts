"use client";

import React, { useRef } from "react";

type Props = {
  audioSrc: string; // path audio, kosongkan untuk suara WebAudio default
};

/**
 * Notifikasi suara cozy via WebAudio (port dari versi lama).
 * play('chat' | 'timer' | 'join' | 'check' | 'wrong' | 'tick')
 */
let audioCtx: AudioContext | null = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

export type SoundName = "chat" | "timer" | "join" | "check" | "wrong" | "click" | "success";

export function playSound(type: SoundName) {
  try {
    const ctx = getCtx();
    if (type === "chat") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.setValueAtTime(780, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
    } else if (type === "timer") {
      [0, 0.18, 0.36].forEach((delay, i) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = "sine"; o.frequency.value = [660, 880, 1100][i];
        g.gain.setValueAtTime(0.22, ctx.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.35);
        o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + 0.35);
      });
    } else if (type === "join") {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
    } else if (type === "check") {
      const t = ctx.currentTime;
      [[660, 0], [990, 0.09]].forEach(([freq, delay]) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = "triangle";
        o.frequency.setValueAtTime(freq, t + delay);
        g.gain.setValueAtTime(0.0001, t + delay);
        g.gain.exponentialRampToValueAtTime(0.28, t + delay + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.22);
        o.start(t + delay); o.stop(t + delay + 0.25);
      });
    } else if (type === "wrong") {
      const t = ctx.currentTime;
      [[330, 0], [247, 0.1]].forEach(([freq, delay]) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = "sawtooth";
        o.frequency.setValueAtTime(freq, t + delay);
        g.gain.setValueAtTime(0.0001, t + delay);
        g.gain.exponentialRampToValueAtTime(0.12, t + delay + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.3);
        o.start(t + delay); o.stop(t + delay + 0.32);
      });
    } else if (type === "click") {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine"; o.frequency.setValueAtTime(880, ctx.currentTime);
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.08);
    } else if (type === "success") {
      const t = ctx.currentTime;
      [[523, 0], [659, 0.09], [784, 0.18], [1047, 0.27]].forEach(([freq, delay]) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = "triangle"; o.frequency.setValueAtTime(freq, t + delay);
        g.gain.setValueAtTime(0.0001, t + delay);
        g.gain.exponentialRampToValueAtTime(0.22, t + delay + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.35);
        o.start(t + delay); o.stop(t + delay + 0.4);
      });
    }
  } catch {
    /* diam */
  }
}

/** Hook praktis: const play = useSfx(); play('check') */
export function useSfx() {
  const ref = useRef(playSound);
  return ref.current;
}
