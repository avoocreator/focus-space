import React from "react";
import Link from "next/link";
import { ArrowLeft, Database, Bot, Music, Rocket, CheckCircle2 } from "lucide-react";

const STEPS = [
  {
    Icon: Database,
    title: "1 · Supabase (database, login, realtime)",
    items: [
      "Buka supabase.com → daftar gratis → New Project (region Singapore).",
      "Buka SQL Editor → paste seluruh isi file supabase/schema.sql dari repo ini → Run.",
      "Project Settings → API → salin Project URL & anon public key ke .env.local / Vercel.",
      "Authentication → Sign In/Up → centang “Allow anonymous sign-ins” (untuk mode Tamu).",
      "Opsional: Authentication → Providers → Google untuk login Google.",
    ],
  },
  {
    Icon: Bot,
    title: "2 · Gemini API (kuis AI & Kazu)",
    items: [
      "Buka aistudio.google.com/apikey → Create API key (gratis).",
      "Simpan sebagai GEMINI_API_KEY di .env.local / Vercel.",
    ],
  },
  {
    Icon: Music,
    title: "3 · Spotify (opsional, kontrol musik)",
    items: [
      "Buka developer.spotify.com/dashboard → Create app.",
      "Redirect URI: https://DOMAIN-VERCEL-MU/music/callback (dan http://localhost:3000/music/callback untuk dev).",
      "Salin Client ID sebagai NEXT_PUBLIC_SPOTIFY_CLIENT_ID.",
      "Catatan: memutar lagu penuh di browser butuh Spotify Premium. Akun gratis tetap bisa browsing playlist & mengontrol Spotify di device lain.",
    ],
  },
  {
    Icon: Rocket,
    title: "4 · Deploy ke Vercel (gratis)",
    items: [
      "Push repo ini ke GitHub.",
      "vercel.com → Add New Project → pilih repo → framework terdeteksi otomatis.",
      "Tambahkan semua variabel dari .env.example di Settings → Environment Variables.",
      "Deploy! Jangan lupa update Redirect URI Spotify ke domain final.",
    ],
  },
];

export default function SetupPage() {
  return (
    <div className="min-h-screen p-4 flex justify-center">
      <div className="cafe-bg" />
      <div className="cafe-overlay" />
      <div className="w-full max-w-[720px] flex flex-col gap-4 py-2 relative">
        <Link href="/" className="btn-secondary self-start">
          <ArrowLeft size={16} strokeWidth={2.5} /> Kembali ke Kafe
        </Link>
        <div className="card">
          <h1 className="font-head text-[26px] font-bold mb-1">Panduan Setup FocusSpace</h1>
          <p className="text-[13px] font-semibold text-[var(--text-muted)] mb-2">
            Semua layanan di bawah punya paket gratis. Ikuti berurutan — total ± 10 menit.
            Detail lengkap ada di <b>README.md</b> repo.
          </p>
        </div>
        {STEPS.map((s) => (
          <section key={s.title} className="card">
            <div className="card-header">
              <s.Icon size={20} strokeWidth={2.5} className="text-[var(--accent-deep)]" />
              <h2 className="card-title">{s.title}</h2>
            </div>
            <ol className="flex flex-col gap-2 pl-1">
              {s.items.map((it) => (
                <li key={it} className="text-[13px] font-semibold flex gap-2">
                  <span className="mt-[7px] w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ background: "var(--accent-deep)" }} />
                  <span>{it}</span>
                </li>
              ))}
            </ol>
          </section>
        ))}
        <div className="card !border-[var(--green-dark)]">
          <p className="text-[13px] font-semibold flex items-center gap-2">
            <CheckCircle2 size={17} strokeWidth={2.5} className="text-[var(--green-dark)] flex-shrink-0" />
            Selesai? Restart server / re-deploy, lalu pesan ini di beranda akan hilang otomatis.
          </p>
        </div>
      </div>
    </div>
  );
}
