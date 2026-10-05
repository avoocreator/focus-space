"use client";

import React from "react";

type Props = {
  /** 0..1 — proporsi progress */
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
};

/** Cincin progress bergaya pomodoro (SVG). */
export function ProgressRing({
  progress,
  size = 130,
  stroke = 10,
  color = "var(--accent)",
  trackColor = "rgba(44,26,14,0.08)",
  children,
}: Props) {
  const r = 82;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full -rotate-90">
        <circle cx="100" cy="100" r={r} stroke={trackColor} fill="none" strokeWidth={stroke} />
        <circle
          cx="100"
          cy="100"
          r={r}
          stroke={color}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          style={{ transition: "stroke-dashoffset 0.3s ease, stroke 0.4s ease" }}
        />
      </svg>
      <div className="relative z-10 flex flex-col items-center">{children}</div>
    </div>
  );
}
