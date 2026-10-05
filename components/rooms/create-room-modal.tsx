"use client";

// ═════════════════════════════════════════════════════════════
//  CreateRoomModal — bikin ruangan baru.
//  Nama dinormalisasi jadi lowercase-hyphen (maks 30), dicek
//  unik via query dulu (ramah UX); error 23505 dari DB juga
//  ditangkap dengan pesan yang sama. Password opsional →
//  disimpan sebagai sha256 hex (kosong = ruangan publik).
// ═════════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import { Coffee, Eye, EyeOff, Globe, Lock } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { cn, sha256Hex } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  /** dipanggil dengan nama ruangan yang berhasil dibuat */
  onCreated: (name: string) => void;
};

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

export default function CreateRoomModal({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [nameError, setNameError] = useState("");
  const [busy, setBusy] = useState(false);

  const slug = slugify(name);

  // reset tiap kali modal dibuka
  useEffect(() => {
    if (open) {
      setName("");
      setPassword("");
      setShowPw(false);
      setNameError("");
      setBusy(false);
    }
  }, [open]);

  const submit = async () => {
    if (busy) return;
    if (!slug) {
      setNameError("Nama ruangan belum valid — pakai huruf/angka ya");
      return;
    }
    if (!isSupabaseConfigured) {
      toast("info", "Supabase belum disetel — buka /setup dulu ya");
      return;
    }
    if (!user) {
      toast("info", "Login dulu untuk bikin ruangan ya");
      return;
    }
    setBusy(true);
    try {
      const sb = getSupabase();
      // cek unik via query dulu supaya pesannya ramah…
      const { data: existing } = await sb.from("study_rooms").select("id").eq("name", slug).maybeSingle();
      if (existing) {
        setNameError("Nama itu sudah dipakai — coba yang lain");
        return;
      }
      const password_hash = password.trim() ? await sha256Hex(password) : null;
      // …dan tetap tangkap 23505 (duplicate) kalau keburu balapan
      const { error } = await sb.from("study_rooms").insert({ name: slug, password_hash, owner_id: user.id });
      if (error) {
        if (error.code === "23505") setNameError("Nama itu sudah dipakai — coba yang lain");
        else toast("error", "Gagal bikin ruangan — coba lagi");
        return;
      }
      toast("success", `Ruangan ${slug} jadi! Selamat menempa ilmu`);
      onCreated(slug);
    } catch {
      toast("error", "Gagal bikin ruangan — coba lagi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bikin Ruangan Baru"
      sub="Ruang belajar cozy untuk kamu dan teman-teman"
    >
      <label className="form-label" htmlFor="room-name-input">
        Nama ruangan
      </label>
      <input
        id="room-name-input"
        className={cn("text-input", nameError && "!border-red")}
        placeholder="mis. rahim-santai"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setNameError("");
        }}
        onKeyDown={(e) => e.key === "Enter" && void submit()}
        maxLength={40}
        autoFocus
      />
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        <span className="chip !text-[10px] !py-0.5">
          <Coffee size={12} strokeWidth={2.5} />
          /rooms/{slug || "nama-ruangan"}
        </span>
        <span className="chip !text-[10px] !py-0.5">{slug.length}/30</span>
      </div>
      {nameError && <p className="text-[12px] font-bold text-red mt-1.5">{nameError}</p>}

      <label className="form-label mt-4" htmlFor="room-pw-input">
        Password (opsional)
      </label>
      <div className="relative">
        <input
          id="room-pw-input"
          className="text-input !pr-11"
          type={showPw ? "text" : "password"}
          placeholder="Kosongkan = publik (tanpa password)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          maxLength={64}
        />
        <button
          className="btn-icon-sm absolute right-2 top-1/2 -translate-y-1/2 !text-[15px]"
          onClick={() => setShowPw((v) => !v)}
          title={showPw ? "Sembunyikan password" : "Lihat password"}
          type="button"
        >
          {showPw ? <EyeOff size={16} strokeWidth={2.5} /> : <Eye size={16} strokeWidth={2.5} />}
        </button>
      </div>
      <p className="text-[10.5px] font-semibold mt-1 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
        {password.trim() ? (
          <>
            <Lock size={12} strokeWidth={2.5} />
            Ruangan akan berkunci (password di-hash SHA-256)
          </>
        ) : (
          <>
            <Globe size={12} strokeWidth={2.5} />
            Semua orang bisa masuk langsung
          </>
        )}
      </p>

      <div className="modal-actions">
        <button className="btn-primary flex-1" onClick={() => void submit()} disabled={busy || !slug}>
          {busy ? (
            "Menyeduh ruangan…"
          ) : (
            <span className="inline-flex items-center justify-center gap-1.5">
              <Coffee size={14} strokeWidth={2.5} />
              Bikin Ruangan
            </span>
          )}
        </button>
        <button className="btn-secondary" onClick={onClose} disabled={busy}>
          Batal
        </button>
      </div>
    </Modal>
  );
}
