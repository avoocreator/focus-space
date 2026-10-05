"use client";

// ═════════════════════════════════════════════════════════════
//  RoomChat — area chat ruangan: pesan realtime, optimistic UI,
//  reply, gambar (kompres canvas → storage), quick reaction,
//  notif suara + title flash, dan @kazu AI via /api/gemini/chat.
//  Semua channel realtime di-cleanup saat unmount (removeChannel).
// ═════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  BellOff,
  Coffee,
  Image as ImageIcon,
  MessageCircle,
  Reply,
  Send,
  X,
  Zap,
  Target,
  PartyPopper,
  Star,
  type LucideIcon,
} from "lucide-react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { playSound } from "@/components/ui/sfx";
import { cn } from "@/lib/utils";
import type { RoomMessageDTO } from "@/lib/types";
import ChatMessage, { snippetOf } from "./chat-message";
import ImageLightbox from "./image-lightbox";

export type ChatIdentity = { id: string; name: string; avatar: string };

type Props = {
  roomName: string;
  me: ChatIdentity;
  /** false → pengunjung tanpa sesi: composer dikunci */
  canPost: boolean;
};

type PendingImage = { dataUrl: string; name: string };

const QUICK_REACTIONS: { label: string; Icon: LucideIcon }[] = [
  { label: "Semangat!", Icon: Zap },
  { label: "Fokus bareng!", Icon: Target },
  { label: "Istirahat dulu", Icon: Coffee },
  { label: "Aku selesai!", Icon: PartyPopper },
  { label: "Jangan nyerah!", Icon: Star },
];
const KAZU_TEST = /@kazu/i;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB

function tmpId(): string {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Kompres gambar di canvas: sisi terpanjang 1024px, JPEG kualitas 0.8. */
async function compressImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("load-gagal"));
      el.src = url;
    });
    const scale = Math.min(1, 1024 / Math.max(img.width || 1, img.height || 1));
    const w = Math.max(1, Math.round((img.width || 1024) * scale));
    const h = Math.max(1, Math.round((img.height || 1024) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas-tidak-ada");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** dataURL JPEG → Blob untuk diupload ke Storage. */
function dataUrlToBlob(dataUrl: string): Blob {
  const commaIdx = dataUrl.indexOf(",");
  const head = dataUrl.slice(0, commaIdx);
  const b64 = dataUrl.slice(commaIdx + 1);
  const mime = /data:(.*?);/.exec(head)?.[1] || "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export default function RoomChat({ roomName, me, canPost }: Props) {
  const { toast } = useToast();

  const [messages, setMessages] = useState<RoomMessageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<RoomMessageDTO | null>(null);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [kazuThinking, setKazuThinking] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [notifOn, setNotifOn] = useState(true);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const notifRef = useRef(notifOn);
  const meRef = useRef(me);
  meRef.current = me;
  notifRef.current = notifOn;

  // ── notif: preferensi tersimpan di localStorage ──
  useEffect(() => {
    try {
      const v = localStorage.getItem("fs_room_notif");
      if (v !== null) setNotifOn(v === "1");
    } catch {}
  }, []);
  const toggleNotif = () => {
    setNotifOn((v) => {
      const next = !v;
      try {
        localStorage.setItem("fs_room_notif", next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  // ── title flash saat tab tidak aktif (dikembalikan setelah 4 detik) ──
  const baseTitleRef = useRef<string>("");
  const titleTimerRef = useRef<number | null>(null);
  const flashTitle = useCallback((msg: RoomMessageDTO) => {
    if (typeof document === "undefined" || !document.hidden) return;
    if (!baseTitleRef.current) baseTitleRef.current = document.title;
    document.title = `${msg.sender}: ${snippetOf(msg.body, 32)}`;
    if (titleTimerRef.current !== null) window.clearTimeout(titleTimerRef.current);
    titleTimerRef.current = window.setTimeout(() => {
      if (baseTitleRef.current) document.title = baseTitleRef.current;
      baseTitleRef.current = "";
      titleTimerRef.current = null;
    }, 4000);
  }, []);
  useEffect(() => {
    return () => {
      if (titleTimerRef.current !== null) window.clearTimeout(titleTimerRef.current);
      if (baseTitleRef.current) document.title = baseTitleRef.current;
    };
  }, []);

  // ── gabungkan pesan masuk (realtime / hasil insert) dengan dedupe ──
  const mergeIncoming = useCallback((msg: RoomMessageDTO) => {
    setMessages((prev) => {
      // buang pesan optimistic (tmp-) yang cocok lalu dedupe by id (echo realtime)
      const cleaned = prev.filter(
        (m) => !(m.id.startsWith("tmp-") && m.sender === msg.sender && m.body === msg.body)
      );
      if (cleaned.some((m) => m.id === msg.id)) return cleaned;
      return [...cleaned, msg];
    });
  }, []);

  // ── load 50 pesan terakhir (query desc → dibalik jadi asc) ──
  useEffect(() => {
    let cancelled = false;
    setReplyTo(null);
    setPendingImage(null);
    setLightbox(null);
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const sb = getSupabase();
    sb.from("room_messages")
      .select("*")
      .eq("room_name", roomName)
      .order("created_at", { ascending: false }) // ambil 50 TERAKHIR…
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) toast("error", "Gagal memuat pesan");
        setMessages((data ?? [] as unknown as RoomMessageDTO[]).slice().reverse()); // …lalu balik jadi asc
        setLoading(false);
      });
    return () => {
      cancelled = true;
      setMessages([]);
    };
  }, [roomName, toast]);

  // ── realtime INSERT pesan ruangan ini (channel terpisah dari presence) ──
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = getSupabase();
    const ch = sb
      .channel(`room-msgs:${roomName}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_messages", filter: `room_name=eq.${roomName}` },
        (payload) => {
          const msg = payload.new as unknown as RoomMessageDTO | null;
          if (!msg || !msg.id) return;
          mergeIncoming(msg);
          // suara + flash title hanya untuk pesan BUKAN dari diri sendiri
          if (notifRef.current && msg.user_id !== meRef.current.id) {
            playSound("chat");
            flashTitle(msg);
          }
        }
      )
      .subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, [roomName, mergeIncoming, flashTitle]);

  // ── auto-scroll ke bawah saat ada pesan / typing baru ──
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, kazuThinking]);

  // ── Kazu AI: panggil /api/gemini/chat lalu insert balasannya ke DB ──
  const askKazu = useCallback(
    async (question: string) => {
      setKazuThinking(true);
      try {
        const history = messages
          .filter((m) => !m.id.startsWith("tmp-") && m.body.trim().length > 0)
          .slice(-6)
          .map((m) => ({
            role: m.is_kazu ? ("assistant" as const) : ("user" as const),
            content: (m.is_kazu ? m.body : `${m.sender}: ${m.body}`).slice(0, 400),
          }));
        const res = await fetch("/api/gemini/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: question.slice(0, 2000), history, player_name: meRef.current.name }),
        });
        const json = (await res.json().catch(() => null)) as { reply?: string; error?: string } | null;
        if (!res.ok || !json?.reply) throw new Error(json?.error || "Kazu tidak merespons");
        const sb = getSupabase();
        const { data, error } = await sb
          .from("room_messages")
          .insert({
            room_name: roomName,
            user_id: meRef.current.id,
            sender: "Kazu",
            avatar: "☕",
            body: json.reply,
            image_url: null,
            is_kazu: true,
          })
          .select()
          .single();
        if (error || !data) throw new Error("insert-gagal");
        mergeIncoming(data as RoomMessageDTO);
      } catch {
        toast("error", "Kazu sedang istirahat (cek GEMINI_API_KEY)");
      } finally {
        setKazuThinking(false);
      }
    },
    [roomName, messages, mergeIncoming, toast]
  );

  // ── kirim pesan teks (dengan optimistic UI) ──
  const sendTextMessage = useCallback(
    async (fullBody: string, typedText: string) => {
      const sb = getSupabase();
      const tmp: RoomMessageDTO = {
        id: tmpId(),
        room_name: roomName,
        user_id: me.id,
        sender: me.name,
        avatar: me.avatar,
        body: fullBody,
        image_url: null,
        is_kazu: false,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tmp]);
      if (KAZU_TEST.test(typedText)) {
        const question = typedText.replace(/@kazu/gi, " ").replace(/\s+/g, " ").trim() || "halo";
        void askKazu(question);
      }
      const { data, error } = await sb
        .from("room_messages")
        .insert({
          room_name: roomName,
          user_id: me.id,
          sender: me.name,
          avatar: me.avatar,
          body: fullBody,
          image_url: null,
          is_kazu: false,
        })
        .select()
        .single();
      if (error || !data) {
        setMessages((prev) => prev.filter((m) => m.id !== tmp.id));
        toast("error", "Pesan gagal terkirim — coba lagi");
        return;
      }
      mergeIncoming(data as RoomMessageDTO);
    },
    [roomName, me, askKazu, mergeIncoming, toast]
  );

  // ── kirim pesan gambar: upload storage → insert message ──
  const sendImageMessage = useCallback(
    async (img: PendingImage, caption: string, reply: RoomMessageDTO | null) => {
      const sb = getSupabase();
      const fullBody = reply ? `> ${reply.sender}: ${snippetOf(reply.body)}\n${caption}` : caption;
      const tmp: RoomMessageDTO = {
        id: tmpId(),
        room_name: roomName,
        user_id: me.id,
        sender: me.name,
        avatar: me.avatar,
        body: fullBody,
        image_url: img.dataUrl, // preview instan pakai dataURL
        is_kazu: false,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tmp]);
      const path = `${roomName}/${Date.now()}.jpg`;
      const { error: upErr } = await sb.storage
        .from("chat-images")
        .upload(path, dataUrlToBlob(img.dataUrl), { contentType: "image/jpeg" });
      if (upErr) {
        setMessages((prev) => prev.filter((m) => m.id !== tmp.id));
        toast("error", "Upload gambar gagal (cek bucket chat-images)");
        return;
      }
      const { data: pub } = sb.storage.from("chat-images").getPublicUrl(path);
      const { data, error } = await sb
        .from("room_messages")
        .insert({
          room_name: roomName,
          user_id: me.id,
          sender: me.name,
          avatar: me.avatar,
          body: fullBody,
          image_url: pub.publicUrl,
          is_kazu: false,
        })
        .select()
        .single();
      if (error || !data) {
        setMessages((prev) => prev.filter((m) => m.id !== tmp.id));
        toast("error", "Pesan gambar gagal terkirim");
        return;
      }
      mergeIncoming(data as RoomMessageDTO);
    },
    [roomName, me, mergeIncoming, toast]
  );

  // ── submit composer: gambar diprioritaskan, teks mengikuti ──
  const handleSend = async () => {
    if (busy) return;
    const text = input.trim();
    if (!text && !pendingImage) return;
    if (!canPost) {
      toast("info", "Login dulu untuk ikut ngobrol ya");
      return;
    }
    setBusy(true);
    try {
      const reply = replyTo;
      setReplyTo(null);
      if (pendingImage) {
        const img = pendingImage;
        setPendingImage(null);
        setInput("");
        await sendImageMessage(img, text, reply);
      } else {
        const full = reply ? `> ${reply.sender}: ${snippetOf(reply.body)}\n${text}` : text;
        setInput("");
        await sendTextMessage(full, text);
      }
    } finally {
      setBusy(false);
    }
  };

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset agar file yang sama bisa dipilih ulang
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("error", "Harus file gambar ya");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast("error", "Gambar maksimal 3MB");
      return;
    }
    try {
      const dataUrl = await compressImage(file);
      setPendingImage({ dataUrl, name: file.name });
    } catch {
      toast("error", "Gagal membaca gambar");
    }
  };

  return (
    <div className="card flex flex-col h-full min-h-0 !p-0 overflow-hidden">
      {/* ── bar atas ── */}
      <div
        className="flex items-center gap-2 px-3.5 py-2 border-b-2 border-dashed flex-shrink-0"
        style={{ borderColor: "var(--peach-dark)" }}
      >
        <span className="micro-title inline-flex items-center gap-1">
          <MessageCircle size={13} strokeWidth={2.5} />
          Obrolan
        </span>
        <div className="flex-1" />
        <button
          className={cn("chip chip-click !text-[11px]", notifOn && "chip-active")}
          onClick={toggleNotif}
          title={notifOn ? "Notifikasi suara nyala" : "Notifikasi suara mati"}
        >
          {notifOn ? <Bell size={12} strokeWidth={2.5} /> : <BellOff size={12} strokeWidth={2.5} />}
          <span className="hidden sm:inline">Notif</span>
        </button>
      </div>

      {/* ── daftar pesan ── */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3.5 py-3 flex flex-col gap-2.5">
        {loading ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cn("flex gap-2", i % 2 === 1 && "flex-row-reverse")}>
                <div className="skeleton !w-[30px] !h-[30px] !rounded-full flex-shrink-0" />
                <div className="skeleton h-[46px] w-[55%] max-w-[280px] !rounded-[14px]" />
              </div>
            ))}
          </>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-1 py-8">
            <span className="animate-floaty" style={{ color: "var(--accent)" }}>
              <Coffee size={28} strokeWidth={2.5} />
            </span>
            <p className="font-head text-[14px] font-bold">Belum ada pesan</p>
            <p className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
              Sapa yang lain dengan hangat — ketik sesuatu atau coba chip reaksi di bawah!
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <ChatMessage
              key={m.id}
              msg={m}
              myUserId={me.id}
              onReply={(target) => setReplyTo(target)}
              onOpenImage={(url) => setLightbox(url)}
            />
          ))
        )}

        {/* typing indicator Kazu */}
        {kazuThinking && (
          <motion.div
            className="flex items-end gap-2 animate-fadeIn"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="badge-emoji !w-[30px] !h-[30px] !text-[15px] flex-shrink-0">☕</span>
            <div className="card !py-1.5 !px-3 !rounded-[14px_14px_14px_4px] flex items-center gap-2">
              <span className="flex items-end gap-1 h-[12px]">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="inline-block w-[5px] h-[5px] rounded-full"
                    style={{ background: "var(--accent)" }}
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.16, ease: "easeInOut" }}
                  />
                ))}
              </span>
              <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                Kazu sedang mengetik…
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── reply bar + preview gambar ── */}
      {(replyTo || pendingImage) && (
        <div className="px-3.5 pb-1.5 flex flex-col gap-1.5 flex-shrink-0">
          {replyTo && (
            <div
              className="flex items-center gap-2 bg-peach border-2 border-cardline rounded-[10px] px-2.5 py-1.5 animate-slideDown"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              <Reply size={14} strokeWidth={2.5} />
              <span className="text-[11.5px] font-semibold truncate flex-1">
                Membalas <b className="font-head">{replyTo.sender}</b>: {snippetOf(replyTo.body, 48)}
              </span>
              <button className="btn-icon-sm" onClick={() => setReplyTo(null)} title="Batal balas">
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          )}
          {pendingImage && (
            <div
              className="flex items-center gap-2 bg-warmwhite border-2 border-cardline rounded-[10px] px-2.5 py-1.5 animate-slideDown"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingImage.dataUrl}
                alt={pendingImage.name}
                className="w-[34px] h-[34px] rounded-[8px] border-2 border-cardline object-cover flex-shrink-0"
              />
              <span className="text-[11.5px] font-semibold truncate flex-1">{pendingImage.name}</span>
              <button className="btn-icon-sm" onClick={() => setPendingImage(null)} title="Buang gambar">
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── quick reaction + composer ── */}
      <div className="px-3.5 pb-3 pt-1 flex-shrink-0 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {QUICK_REACTIONS.map(({ label, Icon }) => (
            <button
              key={label}
              className="chip chip-click !text-[11px] !px-2.5 !gap-1"
              onClick={() => {
                if (!canPost) {
                  toast("info", "Login dulu untuk ikut ngobrol ya");
                  return;
                }
                void sendTextMessage(label, label);
              }}
              disabled={busy}
              title={`Kirim "${label}"`}
            >
              <Icon size={13} strokeWidth={2.5} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="btn-ctrl cursor-pointer" title="Kirim gambar (maks 3MB)">
            <ImageIcon size={16} strokeWidth={2.5} />
            <input type="file" accept="image/*" className="hidden" onChange={onFilePicked} disabled={!canPost} />
          </label>
          <input
            className="text-input flex-1 min-w-0"
            placeholder={canPost ? "Tulis pesan… (coba panggil @kazu)" : "Login dulu untuk chat"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            disabled={!canPost}
            maxLength={2000}
          />
          <button
            className="btn-primary !px-4 !bg-blue hover:!bg-[var(--blue-dark)]"
            onClick={() => void handleSend()}
            disabled={busy || !canPost}
            title="Kirim pesan"
          >
            <Send size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <ImageLightbox url={lightbox} alt="Lampiran gambar" onClose={() => setLightbox(null)} />
    </div>
  );
}
