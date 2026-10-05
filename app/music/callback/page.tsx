"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Frown, Headphones, Hourglass } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  SpotifyError,
  fetchSpotifyMe,
  saveSpotifyToken,
  spotifyClientId,
  takeCodeVerifier,
  type SpotifyTokenResponse,
} from "@/lib/music/spotify";
import { useMusicStore } from "@/stores/music-store";
import { playSound } from "@/components/ui/sfx";
import { useToast } from "@/components/toast";

/**
 * Callback OAuth Spotify (PKCE): ?code=... → tukar token via /api/spotify/token
 * → simpan → refresh profil → kembali ke /music.
 * Dibungkus Suspense karena memakai useSearchParams (wajib di Next 14).
 */
export default function SpotifyCallbackPage() {
  return (
    <Suspense fallback={<CallbackCard icon={Hourglass} title="Menyiapkan…" sub="Sedang menghubungi Spotify" />}>
      <CallbackInner />
    </Suspense>
  );
}

function CallbackCard({
  icon: Icon,
  title,
  sub,
  children,
}: {
  icon: LucideIcon;
  title: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="cafe-bg" />
      <div className="cafe-overlay" />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="card text-center max-w-[400px] w-full"
      >
        <motion.div
          className="flex justify-center text-[var(--text-main)]"
          animate={{ y: [0, -7, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        >
          <Icon size={44} strokeWidth={2.5} aria-hidden="true" />
        </motion.div>
        <h1 className="font-head text-[19px] font-bold mt-1.5">{title}</h1>
        {sub && <p className="text-[12.5px] font-semibold text-[var(--text-muted)] mt-1 leading-relaxed">{sub}</p>}
        {children && <div className="mt-4">{children}</div>}
      </motion.div>
    </div>
  );
}

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const patchSpotify = useMusicStore((s) => s.patchSpotify);
  const [fatal, setFatal] = useState<{ title: string; sub: string } | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return; // StrictMode dev memasang effect 2x
    startedRef.current = true;

    const error = params.get("error");
    const code = params.get("code");

    if (error) {
      setFatal({
        title: "Login Spotify dibatalkan",
        sub:
          error === "access_denied"
            ? "Kamu menekan “Batal” di halaman Spotify. Tidak apa-apa, bisa coba lagi kapan saja"
            : `Spotify menolak permintaan (${error}). Coba login ulang ya`,
      });
      return;
    }
    if (!code) {
      setFatal({
        title: "Kode login tidak ditemukan",
        sub: "Link-nya terasa aneh. Coba connect Spotify lagi dari halaman Musik ya.",
      });
      return;
    }

    const verifier = takeCodeVerifier();
    if (!verifier) {
      setFatal({
        title: "Sesi login kedaluwarsa",
        sub: "Data verifikasinya hilang (mungkin tab sudah ditutup lama). Coba connect ulang — cepat kok",
      });
      return;
    }

    const clientId = spotifyClientId();
    if (!clientId) {
      setFatal({
        title: "Spotify belum dikonfigurasi",
        sub: "NEXT_PUBLIC_SPOTIFY_CLIENT_ID belum diset — lihat /setup",
      });
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/spotify/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            verifier,
            redirect_uri: `${window.location.origin}/music/callback`,
          }),
        });
        const data = (await res.json()) as SpotifyTokenResponse & { error?: string };
        if (!res.ok || !data.access_token) {
          setFatal({
            title: "Gagal masuk ke Spotify",
            sub:
              typeof data.error === "string" && data.error
                ? data.error
                : "Tukar token gagal. Coba connect ulang dari halaman Musik",
          });
          return;
        }

        saveSpotifyToken(data);
        playSound("success");
        toast("success", "Spotify terhubung! Selamat menikmati musiknya~");

        // Lengkapi profil (nama, avatar, premium/gratis) — gagal tidak fatal
        try {
          const me = await fetchSpotifyMe();
          patchSpotify({
            connected: true,
            displayName: me.display_name || me.id,
            avatarUrl: me.images[0]?.url ?? null,
            premium: me.product === "premium",
          });
        } catch {
          /* biarkan panel yang coba lagi */
        }

        router.replace("/music");
      } catch (e) {
        setFatal({
          title: "Koneksi bermasalah",
          sub:
            e instanceof SpotifyError || e instanceof Error
              ? `${e.message} — coba lagi ya`
              : "Coba lagi ya",
        });
      }
    })();
  }, [params, router, toast, patchSpotify]);

  if (fatal) {
    return (
      <CallbackCard icon={Frown} title={fatal.title} sub={fatal.sub}>
        <Link href="/music" className="btn-primary w-full">
          <ArrowLeft size={14} strokeWidth={2.5} aria-hidden="true" />
          Kembali ke Musik
        </Link>
      </CallbackCard>
    );
  }

  return (
    <CallbackCard
      icon={Headphones}
      title="Menghubungkan Spotify…"
      sub="Menukar tiket login-mu jadi akses musik, sebentar ya"
    />
  );
}
