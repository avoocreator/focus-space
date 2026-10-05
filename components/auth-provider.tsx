"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { ProfileDTO } from "@/lib/types";

const AVATARS = ["🐣", "🐱", "🦊", "🐼", "🐸", "☕", "🎯", "📚", "🍿", "🚀", "🍀", "🌈"];
const NAMES = ["Anak Kopi", "Si Fokus", "Burung Hantu", "Kucing Belajar", "Pejuang Skripsi", "Racun Tugas"];

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: ProfileDTO | null;
  loading: boolean;
  isGuest: boolean;
  /** refresh profil dari DB (dipanggil setelah XP/streak berubah) */
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: { display_name?: string; avatar?: string; status?: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  isGuest: false,
  refreshProfile: async () => {},
  updateProfile: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(Ctx);

const LS_NAME = "fs_display_name";
const LS_AVATAR = "fs_avatar";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);

  // Simpan nama/avatar tamu di localStorage untuk fallback tanpa DB
  const [localName, setLocalName] = useState<string>("");
  const [localAvatar, setLocalAvatar] = useState<string>("🐣");

  useEffect(() => {
    try {
      setLocalName(localStorage.getItem(LS_NAME) || "");
      setLocalAvatar(localStorage.getItem(LS_AVATAR) || AVATARS[Math.floor(Math.random() * AVATARS.length)]);
    } catch {}
  }, []);

  const loadProfile = useCallback(async (uid: string) => {
    try {
      const sb = getSupabase();
      const { data } = await sb.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (data) {
        setProfile(data as ProfileDTO);
        return;
      }
      // Fallback: buat profile sendiri (kalau trigger DB belum jalan)
      const insert = {
        id: uid,
        display_name:
          (localStorage.getItem(LS_NAME) || NAMES[Math.floor(Math.random() * NAMES.length)]) + "",
        avatar: localStorage.getItem(LS_AVATAR) || "🐣",
      };
      const { data: created } = await sb.from("profiles").insert(insert).select().single();
      setProfile((created as ProfileDTO) ?? null);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const sb = getSupabase();
    sb.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        if (data.session?.user) loadProfile(data.session.user.id);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const { data: sub } = sb.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      if (s?.user) loadProfile(s.user.id);
      else setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  // Realtime: kalau XP/streak berubah dari device lain, ikutkan
  useEffect(() => {
    if (!session?.user || !isSupabaseConfigured) return;
    const sb = getSupabase();
    const ch = sb
      .channel("profile-live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${session.user.id}` },
        (payload) => setProfile(payload.new as ProfileDTO)
      )
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session?.user?.id, loadProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateProfile = useCallback(
    async (patch: { display_name?: string; avatar?: string; status?: string }) => {
      // simpan lokal selalu (tamu tanpa DB pun tetap tampil)
      if (patch.display_name) {
        setLocalName(patch.display_name);
        try {
          localStorage.setItem(LS_NAME, patch.display_name);
        } catch {}
      }
      if (patch.avatar) {
        setLocalAvatar(patch.avatar);
        try {
          localStorage.setItem(LS_AVATAR, patch.avatar);
        } catch {}
      }
      setProfile((p) => (p ? { ...p, ...patch } : p));
      if (!session?.user || !isSupabaseConfigured) return;
      try {
        const sb = getSupabase();
        await sb.from("profiles").update(patch).eq("id", session.user.id);
      } catch {}
    },
    [session?.user?.id] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const signOut = useCallback(async () => {
    try {
      await getSupabase().auth.signOut();
    } catch {}
    setProfile(null);
    setSession(null);
  }, []);

  const displayName =
    profile?.display_name || localName || (session?.user ? "Anak Kopi" : "Tamu");
  const displayAvatar = profile?.avatar || localAvatar || "🐣";

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      user: session?.user ?? null,
      profile: profile
        ? { ...profile, display_name: displayName, avatar: displayAvatar }
        : null,
      loading,
      isGuest: session ? !!session.user.is_anonymous : true,
      refreshProfile,
      updateProfile,
      signOut,
    }),
    [session, profile, loading, displayName, displayAvatar, refreshProfile, updateProfile, signOut]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
