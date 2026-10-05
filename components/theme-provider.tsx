"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const THEMES = [
  { key: "default", label: "Cozy Cafe", swatch: "linear-gradient(135deg,#fef6e4,#f4a96a)" },
  { key: "midnight", label: "Midnight", swatch: "linear-gradient(135deg,#1a1a2e,#16213e)" },
  { key: "forest", label: "Forest", swatch: "linear-gradient(135deg,#e8f5e9,#a5d6a7)" },
  { key: "ocean", label: "Ocean", swatch: "linear-gradient(135deg,#e3f2fd,#90caf9)" },
  { key: "sakura", label: "Sakura", swatch: "linear-gradient(135deg,#fce4ec,#f48fb1)" },
  { key: "sunset", label: "Sunset", swatch: "linear-gradient(135deg,#fff3e0,#ff8a65)" },
  { key: "lavender", label: "Lavender", swatch: "linear-gradient(135deg,#ede7f6,#b39ddb)" },
  { key: "matcha", label: "Matcha", swatch: "linear-gradient(135deg,#f1f8e9,#8bc34a)" },
] as const;

export type ThemeKey = (typeof THEMES)[number]["key"];

type ThemeCtx = {
  theme: ThemeKey;
  setTheme: (t: ThemeKey) => void;
  screenTemp: number; // 0..100 (0 biru normal, 100 lilin hangat)
  setScreenTemp: (v: number) => void;
};

const Ctx = createContext<ThemeCtx>({
  theme: "default",
  setTheme: () => {},
  screenTemp: 0,
  setScreenTemp: () => {},
});

export const useTheme = () => useContext(Ctx);

function tempToBg(v: number): string {
  // overlay warna hangat; blend multiply seperti filter night-light
  if (v <= 0) return "transparent";
  const warmth = v / 100;
  const r = Math.round(255);
  const g = Math.round(235 - 60 * warmth);
  const b = Math.round(210 - 120 * warmth);
  const alpha = 0.06 + 0.22 * warmth;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeKey>("default");
  const [screenTemp, setScreenTempState] = useState(0);

  useEffect(() => {
    try {
      const t = localStorage.getItem("fs_theme") as ThemeKey | null;
      const v = localStorage.getItem("fs_screen_temp");
      if (t) setThemeState(t);
      if (v) setScreenTempState(Number(v));
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("fs_theme", theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--fs-temp", tempToBg(screenTemp));
    try {
      localStorage.setItem("fs_screen_temp", String(screenTemp));
    } catch {}
  }, [screenTemp]);

  const setTheme = useCallback((t: ThemeKey) => setThemeState(t), []);
  const setScreenTemp = useCallback((v: number) => setScreenTempState(v), []);

  const value = useMemo(() => ({ theme, setTheme, screenTemp, setScreenTemp }), [theme, setTheme, screenTemp, setScreenTemp]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Warm filter overlay */}
      <div className="warm-filter" style={{ background: tempToBg(screenTemp) }} />
    </Ctx.Provider>
  );
}
