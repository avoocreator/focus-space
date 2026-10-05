"use client";

// ═════════════════════════════════════════════════════════════
//  PasswordModal — gerbang ruangan berkunci.
//  Input di-hash SHA-256 di klien lalu dibandingkan dengan
//  password_hash ruangan. Salah → border merah + animasi shake.
// ═════════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, LockOpen } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { sha256Hex, cn } from "@/lib/utils";
import type { StudyRoomDTO } from "@/lib/types";

type Props = {
  room: StudyRoomDTO | null;
  onClose: () => void;
};

export default function PasswordModal({ room, onClose }: Props) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (room) {
      setPw("");
      setShow(false);
      setWrong(false);
      setChecking(false);
    }
  }, [room]);

  const submit = async () => {
    if (!room?.password_hash || checking) return;
    setChecking(true);
    const hash = await sha256Hex(pw);
    setChecking(false);
    if (hash === room.password_hash) {
      onClose();
      router.push(`/rooms/${room.name}`);
    } else {
      setWrong(true);
      setShakeKey((k) => k + 1); // retrigger animasi shake
    }
  };

  return (
    <Modal
      open={!!room}
      onClose={onClose}
      title="Ruangan Berkunci"
      sub={room ? `Masukkan password untuk "${room.name}"` : ""}
    >
      <div key={shakeKey} className={cn(wrong && "animate-shake")}>
        <div className="relative">
          <input
            className={cn("text-input !pr-11", wrong && "!border-red")}
            type={show ? "text" : "password"}
            placeholder="Password ruangan…"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setWrong(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            autoFocus
          />
          <button
            className="btn-icon-sm absolute right-2 top-1/2 -translate-y-1/2 !text-[15px]"
            onClick={() => setShow((v) => !v)}
            title={show ? "Sembunyikan" : "Lihat password"}
            type="button"
          >
            {show ? <EyeOff size={16} strokeWidth={2.5} /> : <Eye size={16} strokeWidth={2.5} />}
          </button>
        </div>
      </div>
      {wrong && (
        <p className="text-[12px] font-bold text-red mt-2 flex items-center gap-1">
          <KeyRound size={13} strokeWidth={2.5} />
          Password salah — coba lagi
        </p>
      )}

      <div className="modal-actions">
        <button className="btn-primary flex-1" onClick={() => void submit()} disabled={checking || !pw.trim()}>
          {checking ? (
            "Memeriksa…"
          ) : (
            <span className="inline-flex items-center justify-center gap-1.5">
              <LockOpen size={14} strokeWidth={2.5} />
              Masuk Ruangan
            </span>
          )}
        </button>
        <button className="btn-secondary" onClick={onClose}>
          Batal
        </button>
      </div>
    </Modal>
  );
}
