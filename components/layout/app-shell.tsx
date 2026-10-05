"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Brain, Coffee, BookOpen, Moon, Footprints, Coffee as CoffeeIcon,
  Home, Headphones, DoorOpen, Dices, Gamepad2, UserRound,
  Flame, Palette, Headphones as HeadphonesIcon, Settings, LogOut, X, Check,
  Sparkles, Leaf, Star, Thermometer, Snowflake,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useTheme, THEMES } from "@/components/theme-provider";
import { Modal } from "@/components/ui/modal";
import { InstallButton, useInstallPrompt } from "@/components/layout/install-pwa";
import MusicDock from "@/components/music/music-dock";
import { levelFromXp } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/supabase/client";

const NAV = [
  { href: "/", label: "Beranda", Icon: Home },
  { href: "/music", label: "Musik", Icon: Headphones },
  { href: "/rooms", label: "Ruangan", Icon: DoorOpen },
  { href: "/quiz", label: "Kuis", Icon: Dices },
  { href: "/games", label: "Games", Icon: Gamepad2 },
  { href: "/profile", label: "Profil", Icon: UserRound },
];

const STATUSES = [
  { key: "focus", Icon: Brain, label: "Fokus" },
  { key: "break", Icon: Coffee, label: "Istirahat" },
  { key: "studying", Icon: BookOpen, label: "Belajar" },
  { key: "idle", Icon: Moon, label: "Santai" },
  { key: "away", Icon: Footprints, label: "Away" },
];

const AVATARS = ["🐣", "🐱", "🦊", "🐼", "🐸", "☕", "🎯", "📚", "🍿", "🚀", "🍀", "🌈"];

const IC = { size: 18, strokeWidth: 2.5 } as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  const isQuizPlay = pathname.startsWith("/quiz/play/");
  const isSetup = pathname === "/setup";

  if (isLogin || isQuizPlay || isSetup) {
    return <div className="min-h-screen relative">{children}</div>;
  }

  return <Shell>{children}</Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, isGuest, user, updateProfile } = useAuth();
  const { theme, setTheme, screenTemp, setScreenTemp } = useTheme();

  const [musicOpen, setMusicOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  const currentStatus = STATUSES.find((s) => s.key === (profile?.status || "focus")) || STATUSES[0];
  const lvl = levelFromXp(profile?.xp || 0);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="min-h-screen relative flex">
      <div className="cafe-bg" />
      <div className="cafe-overlay" />
      {/* dekorasi melayang — ikon murni */}
      <Sparkles className="deco s1" size={22} strokeWidth={2} />
      <CoffeeIcon className="deco s2" size={22} strokeWidth={2} />
      <Sparkles className="deco s3" size={18} strokeWidth={2} />
      <Leaf className="deco leaf" size={26} strokeWidth={2} />
      <CoffeeIcon className="deco bean" size={19} strokeWidth={2} />
      <Star className="deco star4" size={15} strokeWidth={2} />

      {/* ══ SIDEBAR DESKTOP ══ */}
      <aside className="hidden lg:flex flex-col gap-2.5 w-[218px] flex-shrink-0 p-4 pr-0 sticky top-0 h-screen">
        <Link href="/" className="card !py-3 flex items-center gap-2.5 justify-center card-hover">
          <motion.span
            animate={{ rotate: [0, -10, 10, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          >
            <Coffee size={24} strokeWidth={2.5} className="text-[var(--accent-deep)]" />
          </motion.span>
          <span className="font-head text-[19px] font-bold">FocusSpace</span>
        </Link>

        <nav className="flex flex-col gap-2">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className="card !p-0 overflow-hidden">
                <motion.span
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-3 px-4 py-3 font-head text-[14px] font-semibold"
                  style={{
                    background: active ? "var(--peach-dark)" : "transparent",
                    boxShadow: active ? "var(--shadow-sm)" : "none",
                    color: "var(--text-main)",
                    display: "flex",
                  }}
                >
                  <motion.span
                    animate={active ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 1.8 }}
                    className="flex"
                  >
                    <item.Icon {...IC} />
                  </motion.span>
                  {item.label}
                  {active && <span className="ml-auto text-[10px]">●</span>}
                </motion.span>
              </Link>
            );
          })}
        </nav>

        {/* Streak & level card */}
        <div className="card !py-3 !px-3.5 mt-auto">
          <div className="flex items-center justify-between mb-1.5">
            <span className="chip !text-[11px] !gap-1.5">
              <Flame size={13} strokeWidth={2.5} className="text-[var(--orange-deep)]" />
              {profile?.streak_current ?? 0} hari
            </span>
            <span className="chip chip-active !text-[11px]">Lv {lvl.level}</span>
          </div>
          <div className="h-3 rounded-full border-2 overflow-hidden" style={{ borderColor: "var(--card-border)", background: "var(--warm-white)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "var(--accent)" }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(lvl.progress * 100)}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
          <p className="text-[10px] font-bold text-[var(--text-muted)] mt-1">{lvl.cur}/{lvl.next} XP</p>
        </div>
      </aside>

      {/* ══ KONTEN UTAMA ══ */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* HEADER */}
        <header className="sticky top-0 z-[2000] px-3 pt-3 lg:px-4 lg:pt-4">
          <div
            className="card !rounded-[16px] flex items-center gap-2 px-3.5 h-[60px]"
            style={{ background: "var(--card-bg)" }}
          >
            <Link href="/" className="lg:hidden flex items-center gap-1.5 flex-shrink-0">
              <Coffee size={20} strokeWidth={2.5} className="text-[var(--accent-deep)]" />
              <span className="font-head text-[14.5px] font-bold">FocusSpace</span>
            </Link>

            <div className="hidden lg:flex items-center gap-2">
              <span className="chip !gap-1.5">
                <Flame size={14} strokeWidth={2.5} className="text-[var(--orange-deep)]" />
                <b>{profile?.streak_current ?? 0}</b>&nbsp;hari streak
              </span>
              {!isGuest && user && <span className="chip">Lv {lvl.level} · {profile?.xp ?? 0} XP</span>}
            </div>

            <div className="flex-1" />

            {/* status selector */}
            <div className="relative hidden sm:block" ref={statusRef}>
              <button className="chip chip-click min-w-[104px] justify-between" onClick={() => setStatusOpen((v) => !v)}>
                <span className="flex items-center gap-1.5">
                  <currentStatus.Icon size={14} strokeWidth={2.5} />
                  {currentStatus.label}
                </span>
                <span className="text-[9px] opacity-60">▾</span>
              </button>
              <AnimatePresence>
                {statusOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-[calc(100%+6px)] right-0 card !p-1.5 flex flex-col gap-0.5 min-w-[150px] z-[2500]"
                    style={{ boxShadow: "5px 5px 0 var(--card-border)" }}
                  >
                    {STATUSES.map((s) => (
                      <button
                        key={s.key}
                        className="flex items-center gap-2 text-left px-3 py-2 rounded-[10px] font-head text-[13px] font-semibold hover:bg-[var(--peach)] transition-all"
                        style={s.key === currentStatus.key ? { background: "var(--peach-dark)" } : {}}
                        onClick={() => {
                          setStatusOpen(false);
                          updateProfile({ status: s.key });
                        }}
                      >
                        <s.Icon size={15} strokeWidth={2.5} /> {s.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <InstallButton />

            {/* musik */}
            <button
              className={`chip chip-click ${musicOpen ? "chip-active" : ""}`}
              onClick={() => setMusicOpen((v) => !v)}
              title="Musik Cozy"
            >
              <HeadphonesIcon size={15} strokeWidth={2.5} />
              <span className="hidden md:inline">Musik</span>
            </button>

            {/* tema */}
            <button className="btn-header-icon" onClick={() => setThemeOpen(true)} title="Ganti Tema">
              <Palette size={17} strokeWidth={2.5} />
            </button>

            {/* profil widget (avatar = emoji identitas user, sengaja dipertahankan) */}
            <button className="chip chip-click !pl-1.5" onClick={() => setProfileOpen(true)}>
              <span className="badge-emoji !w-[26px] !h-[26px] !text-[13px]">{profile?.avatar || "🐣"}</span>
              <span className="hidden md:inline max-w-[90px] truncate">{profile?.display_name || "Tamu"}</span>
            </button>
          </div>
        </header>

        {/* PANEL MUSIK (global) */}
        <MusicDock open={musicOpen} onClose={() => setMusicOpen(false)} />

        {/* HALAMAN */}
        <main className="flex-1 min-h-0 px-3 pb-24 lg:pb-6 lg:px-4 pt-3 w-full max-w-[1240px] mx-auto">
          {!isSupabaseConfigured && <SetupNotice />}
          {children}
        </main>
      </div>

      {/* ══ BOTTOM NAV MOBILE ══ */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-[2500] flex bg-[var(--card-bg)]"
        style={{ borderTop: "2.5px solid var(--card-border)" }}
      >
        {NAV.filter((n) => n.href !== "/profile").map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className="flex-1 flex flex-col items-center gap-0.5 py-2">
              <motion.span
                animate={active ? { y: [0, -4, 0] } : { y: 0 }}
                transition={active ? { repeat: Infinity, duration: 1.4 } : { duration: 0.2 }}
                className="flex"
                style={{ color: active ? "var(--accent-deep)" : "var(--text-main)" }}
              >
                <item.Icon size={20} strokeWidth={2.5} />
              </motion.span>
              <span
                className="font-head text-[9.5px] font-bold"
                style={{ color: active ? "var(--accent-deep)" : "var(--text-muted)" }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
        <button className="flex-1 flex flex-col items-center gap-0.5 py-2" onClick={() => setProfileOpen(true)}>
          <span className="text-[19px]">{profile?.avatar || "🐣"}</span>
          <span className="font-head text-[9.5px] font-bold text-[var(--text-muted)]">Profil</span>
        </button>
      </nav>

      {/* ══ PANEL TEMA ══ */}
      <ThemePanel open={themeOpen} onClose={() => setThemeOpen(false)} theme={theme} setTheme={setTheme} />

      {/* ══ MODAL PROFIL ══ */}
      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        screenTemp={screenTemp}
        setScreenTemp={setScreenTemp}
      />
    </div>
  );
}

function ThemePanel({
  open,
  onClose,
  theme,
  setTheme,
}: {
  open: boolean;
  onClose: () => void;
  theme: string;
  setTheme: (t: any) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[2400]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="fixed top-[80px] right-4 z-[2500] card !p-4 w-[300px]"
            style={{ boxShadow: "var(--shadow-lg)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-head text-[16px] font-bold">Pilih Tema</span>
              <button className="btn-icon-sm" onClick={onClose} aria-label="Tutup">
                <X size={17} strokeWidth={2.5} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.key}
                  className="flex flex-col items-center gap-1.5 rounded-[14px] p-2.5 transition-all"
                  style={{
                    background: theme === t.key ? "var(--yellow)" : "var(--warm-white)",
                    border: "2.5px solid var(--card-border)",
                    boxShadow: theme === t.key ? "3px 3px 0 var(--card-border)" : "var(--shadow-sm)",
                  }}
                  onClick={() => setTheme(t.key)}
                >
                  <span
                    className="w-9 h-9 rounded-full border-2"
                    style={{ background: t.swatch, borderColor: "var(--card-border)" }}
                  />
                  <span className="font-head text-[11px] font-bold">{t.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function ProfileModal({
  open,
  onClose,
  screenTemp,
  setScreenTemp,
}: {
  open: boolean;
  onClose: () => void;
  screenTemp: number;
  setScreenTemp: (v: number) => void;
}) {
  const { profile, updateProfile, signOut, isGuest } = useAuth();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🐣");

  useEffect(() => {
    if (open) {
      setName(profile?.display_name || "");
      setAvatar(profile?.avatar || "🐣");
    }
  }, [open, profile?.display_name, profile?.avatar]);

  const presets = [
    { val: 0, label: "Biru", sub: "Normal" },
    { val: 25, label: "Siang", sub: "Segar" },
    { val: 50, label: "Sore", sub: "Nyaman" },
    { val: 75, label: "Malam", sub: "Hangat" },
    { val: 100, label: "Lilin", sub: "Panas" },
  ];
  const tempLabel = presets.reduce((best, p) => (Math.abs(p.val - screenTemp) < Math.abs(best.val - screenTemp) ? p : best), presets[0]);

  return (
    <Modal open={open} onClose={onClose} title="Pengaturan Profil">
      <div className="flex flex-col items-center mb-3">
        <div className="badge-emoji !w-[70px] !h-[70px] !text-[38px] !rounded-full mb-2 animate-wiggle">{avatar}</div>
        <p className="text-[12px] font-semibold text-[var(--text-muted)] mb-1.5">Pilih Emoji untuk Foto Profilmu:</p>
        <div className="grid grid-cols-6 gap-1">
          {AVATARS.map((a) => (
            <button
              key={a}
              className={`text-[18px] py-1 rounded-[8px] transition-all ${a === avatar ? "scale-110" : ""}`}
              style={{
                background: a === avatar ? "var(--yellow)" : "var(--warm-white)",
                border: `2px solid ${a === avatar ? "var(--card-border)" : "rgba(44,26,14,0.15)"}`,
              }}
              onClick={() => setAvatar(a)}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <label className="form-label">Ubah Nama Tampilan:</label>
      <input className="text-input" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />

      {/* Temperatur layar */}
      <div className="mt-4 pt-3" style={{ borderTop: "2px solid rgba(44,26,14,0.1)" }}>
        <div className="flex items-center gap-1.5 font-head text-[13px] font-bold mb-2.5">
          <Thermometer size={16} strokeWidth={2.5} /> Temperatur Layar
          <span className="chip !text-[10px] !py-0.5 ml-auto">{tempLabel.label}</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Snowflake size={15} strokeWidth={2.5} className="text-[var(--blue-dark)]" />
          <input
            type="range"
            min={0}
            max={100}
            value={screenTemp}
            onChange={(e) => setScreenTemp(Number(e.target.value))}
            className="cozy-slider flex-1"
            style={{
              background:
                "linear-gradient(to right, #c8e8ff 0%, #e0f0ff 15%, #fef6e4 35%, #fde8c0 50%, #f4b87a 65%, #e8834a 80%, #c05020 100%)",
            }}
          />
          <Flame size={15} strokeWidth={2.5} className="text-[var(--orange-deep)]" />
        </div>
        <div className="flex gap-1">
          {presets.map((p) => (
            <button
              key={p.val}
              className={`flex-1 rounded-[10px] py-1 font-head text-[10px] font-bold leading-tight transition-all ${screenTemp === p.val ? "" : "hover:-translate-y-px"}`}
              style={{
                background: screenTemp === p.val ? "var(--peach-dark)" : "var(--warm-white)",
                border: "2px solid var(--card-border)",
                boxShadow: "var(--shadow-sm)",
              }}
              onClick={() => setScreenTemp(p.val)}
            >
              {p.label}<br /><small className="font-medium text-[9px] opacity-70">{p.sub}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="modal-actions !mt-5">
        <button
          className="btn-primary"
          onClick={async () => {
            await updateProfile({ display_name: name.trim() || "Anak Kopi", avatar });
            onClose();
          }}
        >
          <Check size={16} strokeWidth={2.5} /> Simpan
        </button>
        <button className="btn-secondary" onClick={onClose}>Batal</button>
        {!isGuest && (
          <button
            className="btn-danger ml-auto"
            onClick={async () => {
              await signOut();
              onClose();
              window.location.href = "/login";
            }}
          >
            <LogOut size={16} strokeWidth={2.5} /> Keluar
          </button>
        )}
      </div>
    </Modal>
  );
}

function SetupNotice() {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="card !p-3.5 mb-3 !border-[var(--yellow-dark)]">
      <p className="text-[12.5px] font-semibold flex items-start gap-2">
        <Settings size={16} strokeWidth={2.5} className="flex-shrink-0 mt-0.5 text-[var(--accent-deep)]" />
        <span>
          <b>Supabase belum dikonfigurasi.</b> Fitur online (login, ruangan, kuis bareng, streak) butuh koneksi.
          Isi <code className="px-1 rounded bg-[var(--peach)]">.env.local</code> (lihat{" "}
          <a className="underline font-bold" href="/setup" style={{ color: "var(--accent-deep)" }}>Panduan Setup</a>) lalu restart server.
        </span>
      </p>
    </motion.div>
  );
}
