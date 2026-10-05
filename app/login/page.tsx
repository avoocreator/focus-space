"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Coffee, Sparkles, BookOpen, Leaf, Star, Music, Moon, Lightbulb,
  Flower2, DoorOpen, Mail, Send, CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { AVATARS_LOGIN } from "@/lib/login-avatars";

const PARTICLES = [Coffee, Sparkles, BookOpen, Leaf, Star, Music, Sparkles, Moon, Lightbulb, Flower2];

export default function LoginPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🐣");
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setAvatar(localStorage.getItem("fs_avatar") || AVATARS_LOGIN[Math.floor(Math.random() * AVATARS_LOGIN.length)]);
    } catch {}
  }, []);

  useEffect(() => {
    if (!loading && session) router.replace("/");
  }, [session, loading, router]);

  const persistGuest = async () => {
    const finalName = name.trim() || "Anak Kopi";
    try {
      localStorage.setItem("fs_display_name", finalName);
      localStorage.setItem("fs_avatar", avatar);
    } catch {}
    const sb = getSupabase();
    if (isSupabaseConfigured) {
      const { error } = await sb.auth.signInAnonymously();
      if (error) {
        toast(
          "error",
          "Login tamu gagal: aktifkan 'Allow anonymous sign-ins' di Supabase → Authentication. (" +
            error.message.slice(0, 60) +
            ")"
        );
        return false;
      }
      await getSupabase().from("profiles").upsert({
        id: (await sb.auth.getSession()).data.session?.user.id,
        display_name: finalName,
        avatar,
      });
    } else {
      toast("info", "Mode offline: data hanya tersimpan di perangkat ini.");
    }
    return true;
  };

  const guestLogin = async () => {
    setBusy(true);
    const ok = await persistGuest();
    setBusy(false);
    if (ok) router.replace("/");
  };

  const sendOtp = async () => {
    if (!email.includes("@")) return toast("error", "Masukkan email yang valid dulu ya");
    setBusy(true);
    try {
      const { error } = await getSupabase().auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setOtpSent(true);
      toast("success", "Kode 6-digit sudah dikirim ke emailmu");
    } catch (e: any) {
      toast("error", "Gagal kirim kode: " + (e.message || "coba lagi"));
    }
    setBusy(false);
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) return toast("error", "Kode harus 6 digit");
    setBusy(true);
    try {
      const { error } = await getSupabase().auth.verifyOtp({ email, token: otp, type: "email" });
      if (error) throw error;
      const finalName = name.trim();
      if (finalName || avatar !== "🐣") {
        const uid = (await getSupabase().auth.getSession()).data.session?.user.id;
        if (uid) {
          await getSupabase()
            .from("profiles")
            .upsert({ id: uid, ...(finalName ? { display_name: finalName } : {}), avatar });
        }
      }
      toast("success", "Selamat datang di FocusSpace!");
      router.replace("/");
    } catch (e: any) {
      toast("error", "Kode salah: " + (e.message || "coba lagi"));
    }
    setBusy(false);
  };

  const googleLogin = async () => {
    setBusy(true);
    try {
      const { error } = await getSupabase().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/login" },
      });
      if (error) throw error;
    } catch (e: any) {
      toast("error", "Google belum diaktifkan: aktifkan provider Google di Supabase Dashboard.");
      setBusy(false);
    }
  };

  return (
    <div className="login-scene min-h-screen relative flex items-center justify-center p-5 overflow-hidden">
      <div className="cafe-bg" />
      <div className="cafe-overlay" />

      {/* partikel ikon melayang */}
      {PARTICLES.map((P, i) => (
        <motion.span
          key={i}
          className="absolute pointer-events-none"
          style={{ left: `${6 + i * 9}%`, bottom: "-10vh", color: "var(--tan)", opacity: 0.5 }}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: "-115vh", rotate: 360, opacity: [0, 0.35, 0.25, 0] }}
          transition={{ duration: 10 + (i % 5) * 2, delay: i * 0.7, repeat: Infinity, ease: "linear" }}
        >
          <P size={i % 3 === 0 ? 22 : 17} strokeWidth={2} />
        </motion.span>
      ))}

      {/* blob dekoratif */}
      <motion.div
        className="absolute w-[240px] h-[240px] rounded-full blur-[50px] opacity-45"
        style={{ background: "var(--peach-dark)", top: "-60px", left: "-60px" }}
        animate={{ y: [0, -20, 0], scale: [1, 1.07, 1] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="absolute w-[180px] h-[180px] rounded-full blur-[50px] opacity-45"
        style={{ background: "var(--blue)", bottom: "-40px", right: "-30px" }}
        animate={{ y: [0, 16, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 9, repeat: Infinity, delay: 2 }}
      />

      <motion.div
        initial={{ scale: 0.9, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="card !p-8 !pt-7 w-full max-w-[430px] relative z-10 !shadow-[var(--shadow-xl)]"
      >
        {/* maskot cangkir (SVG art asli — bukan emoji) */}
        <motion.div
          className="mx-auto mb-1"
          animate={{ rotate: [-3, 3, -3] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        >
          <svg viewBox="0 0 120 90" width="120" xmlns="http://www.w3.org/2000/svg">
            <rect x="25" y="40" width="65" height="40" rx="12" fill="#f4a96a" stroke="#2d1a0e" strokeWidth="3.5" />
            <rect x="21" y="33" width="73" height="13" rx="7" fill="#f9c58d" stroke="#2d1a0e" strokeWidth="3.5" />
            <path d="M90 44 Q113 44 113 60 Q113 76 90 76" fill="none" stroke="#2d1a0e" strokeWidth="4" strokeLinecap="round" />
            <path d="M47 29 Q44 20 47 13" fill="none" stroke="#d4956a" strokeWidth="3" strokeLinecap="round" />
            <path d="M60 25 Q57 16 60 9" fill="none" stroke="#d4956a" strokeWidth="3" strokeLinecap="round" />
            <path d="M73 29 Q70 20 73 13" fill="none" stroke="#d4956a" strokeWidth="3" strokeLinecap="round" />
            <circle cx="50" cy="55" r="4.5" fill="#2d1a0e" />
            <circle cx="70" cy="55" r="4.5" fill="#2d1a0e" />
            <circle cx="52" cy="53" r="1.5" fill="white" />
            <circle cx="72" cy="53" r="1.5" fill="white" />
            <path d="M48 66 Q60 74 72 66" fill="none" stroke="#2d1a0e" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="43" cy="62" rx="6" ry="3.5" fill="#f08080" opacity="0.55" />
            <ellipse cx="77" cy="62" rx="6" ry="3.5" fill="#f08080" opacity="0.55" />
            <rect x="14" y="78" width="92" height="6" rx="3" fill="#c8894a" stroke="#2d1a0e" strokeWidth="2.5" />
          </svg>
        </motion.div>

        <div className="text-center">
          <span className="chip chip-active !text-[11px] mb-2 !gap-1.5">
            <Sparkles size={12} strokeWidth={2.5} /> Virtual Study Café
          </span>
          <h1 className="font-head text-[38px] font-bold leading-none">FocusSpace</h1>
          <p className="text-[13.5px] font-semibold text-[var(--text-muted)] mt-1.5 mb-6">
            Ruang belajar virtualmu yang cozy & menyenangkan
          </p>
        </div>

        {/* TAMU */}
        <div
          className="rounded-[20px] p-4 mb-4 flex flex-col gap-3"
          style={{ background: "rgba(244,169,106,0.08)", border: "2px dashed rgba(44,26,14,0.18)" }}
        >
          <motion.div className="text-[44px] text-center" animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
            {avatar}
          </motion.div>
          <div className="flex flex-wrap justify-center gap-1">
            {AVATARS_LOGIN.map((a) => (
              <button
                key={a}
                className={`text-[16px] py-0.5 px-1 rounded-[8px] transition-all ${a === avatar ? "scale-110" : ""}`}
                style={{
                  background: a === avatar ? "var(--yellow)" : "var(--warm-white)",
                  border: `2px solid ${a === avatar ? "var(--card-border)" : "rgba(44,26,14,0.12)"}`,
                }}
                onClick={() => setAvatar(a)}
              >
                {a}
              </button>
            ))}
          </div>
          <p className="text-[12.5px] font-semibold text-[var(--text-muted)] text-center">
            Masuk sebagai tamu! Pilih avatar & nama panggilanmu.
          </p>
          <input
            className="text-input"
            placeholder="Namamu…"
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn-primary w-full" disabled={busy} onClick={guestLogin}>
            <DoorOpen size={17} strokeWidth={2.5} /> Masuk sebagai Tamu
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4 text-[11px] font-semibold text-[var(--text-muted)]">
          <span className="flex-1 h-[2px] rounded" style={{ background: "rgba(44,26,14,0.15)" }} />
          atau masuk dengan akun
          <span className="flex-1 h-[2px] rounded" style={{ background: "rgba(44,26,14,0.15)" }} />
        </div>

        {/* EMAIL OTP */}
        {!otpSent ? (
          <div className="flex gap-2 mb-3">
            <input
              className="text-input"
              type="email"
              placeholder="email@kamu.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn-secondary whitespace-nowrap" disabled={busy} onClick={sendOtp}>
              <Mail size={16} strokeWidth={2.5} /> Kirim Kode
            </button>
          </div>
        ) : (
          <div className="flex gap-2 mb-3">
            <input
              className="text-input tracking-[0.4em] text-center font-bold"
              placeholder="••••••"
              maxLength={6}
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            />
            <button className="btn-primary whitespace-nowrap" disabled={busy} onClick={verifyOtp}>
              <CheckCircle2 size={16} strokeWidth={2.5} /> Verifikasi
            </button>
          </div>
        )}

        {/* GOOGLE */}
        <button className="btn-secondary w-full !bg-white" disabled={busy} onClick={googleLogin}>
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          Masuk dengan Google
        </button>

        <p className="text-[11px] text-[var(--text-muted)] mt-4 text-center font-medium">
          Dengan masuk, kamu setuju berinteraksi secara positif
        </p>
      </motion.div>
    </div>
  );
}
