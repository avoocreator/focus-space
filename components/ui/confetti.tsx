"use client";

import confetti from "canvas-confetti";
import { useCallback } from "react";

/** Tembakan confetti bergaya cozy (warna tema). Dipakai podium kuis, streak, dll. */
export function useConfetti() {
  return useCallback((opts?: { big?: boolean; colors?: string[] }) => {
    const colors = opts?.colors || ["#f4845f", "#f9d878", "#7ec8a0", "#90c4e4", "#f4a7b9", "#f4b87a"];
    const base = { colors, ticks: 220, gravity: 0.9, scalar: 1.05, zIndex: 7000 };
    confetti({ ...base, particleCount: opts?.big ? 90 : 50, spread: 70, origin: { y: 0.6 } });
    if (opts?.big) {
      setTimeout(() => confetti({ ...base, particleCount: 60, spread: 110, origin: { x: 0.15, y: 0.55 } }), 220);
      setTimeout(() => confetti({ ...base, particleCount: 60, spread: 110, origin: { x: 0.85, y: 0.55 } }), 420);
    }
  }, []);
}
