"use client";

// ═════════════════════════════════════════════════════════════
//  ChatMessage — bubble pesan ruangan + renderBody (aman XSS).
//  KONTEN USER TIDAK PERNAH lewat dangerouslySetInnerHTML /
//  innerHTML: semua teks dipecah jadi array ReactNode sehingga
//  React otomatis meng-escape (fungsi escape manual tidak perlu
//  dan tidak dipakai — ini jalur paling aman).
// ═════════════════════════════════════════════════════════════

import React, { type ReactNode } from "react";
import { Coffee, Reply } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import type { RoomMessageDTO } from "@/lib/types";

// gabungan: group 1 = URL, group 2 = mention @kazu
const INLINE_RE = /(https?:\/\/[^\s<>"]+)|(@kazu)/gi;

/**
 * Parse satu baris teks menjadi ReactNode[]:
 * - URL (https://…) → <a> target blank
 * - @kazu (case-insensitive) → span highlight gradient orange
 * - teks biasa → span (React escape otomatis)
 */
function parseInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = new RegExp(INLINE_RE.source, "gi"); // salinan baru: exec() menggeser lastIndex
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      out.push(<span key={`${keyBase}-t${k++}`}>{text.slice(last, m.index)}</span>);
    }
    if (m[1]) {
      const url = m[1];
      out.push(
        <a
          key={`${keyBase}-a${k++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-2 underline-offset-2 font-bold break-all hover:opacity-75"
          style={{ color: "var(--accent-deep)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
      );
    } else {
      // mention @kazu — highlight gradient orange hangat
      out.push(
        <span
          key={`${keyBase}-k${k++}`}
          className="inline-flex items-center px-1.5 py-px rounded-[6px] font-head text-[10.5px] font-bold text-white align-middle mx-px"
          style={{ background: "linear-gradient(90deg, #f4845f 0%, #f8b98a 100%)", textShadow: "0 1px 0 rgba(0,0,0,0.12)" }}
        >
          @kazu
        </span>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    out.push(<span key={`${keyBase}-t${k++}`}>{text.slice(last)}</span>);
  }
  return out;
}

/**
 * renderBody — ubah body pesan jadi ReactNode:
 * - baris awal '>' → quote block kecil italic
 * - baris kosong tetap dirender (spasi antar paragraf)
 * - inline: linkify URL + highlight @kazu
 */
export function renderBody(body: string): ReactNode {
  const lines = body.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const isQuote = line.startsWith(">");
        const text = isQuote ? line.replace(/^>\s?/, "") : line;
        const content = parseInline(text, `l${i}`);
        if (isQuote) {
          return (
            <div
              key={`q${i}`}
              className="border-l-[3px] pl-2 my-0.5 text-[11.5px] italic font-semibold opacity-70 leading-snug"
              style={{ borderColor: "currentColor" }}
            >
              {content}
            </div>
          );
        }
        return (
          <div key={`p${i}`} className={line ? "" : "min-h-[6px]"}>
            {content}
          </div>
        );
      })}
    </>
  );
}

/** Cuplikan satu baris untuk reply bar / title flash. */
export function snippetOf(body: string, max = 60): string {
  const first = (body || "Gambar").split("\n")[0].replace(/^>\s?/, "").replace(/\s+/g, " ").trim();
  return first.length > max ? `${first.slice(0, max)}…` : first;
}

type Props = {
  msg: RoomMessageDTO;
  myUserId: string;
  onReply: (msg: RoomMessageDTO) => void;
  onOpenImage: (url: string) => void;
};

export default function ChatMessage({ msg, myUserId, onReply, onOpenImage }: Props) {
  const isKazu = msg.is_kazu;
  const mine = !isKazu && msg.user_id === myUserId;

  const bubbleStyle: React.CSSProperties = isKazu
    ? {
        // spesifikasi bubble Kazu: gradient hangat + border karamel
        background: "linear-gradient(135deg, #fff8ee 0%, #fef0d4 100%)",
        borderColor: "#d4956a",
      }
    : {};

  return (
    <div className={`group flex items-end gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}>
      {/* avatar untuk pesan orang lain & Kazu */}
      {(isKazu || !mine) && (
        <span className="badge-emoji !w-[30px] !h-[30px] !text-[15px] flex-shrink-0 mb-0.5">
          {msg.avatar || (isKazu ? "☕" : "🐣")}
        </span>
      )}

      <div className={`flex flex-col max-w-[80%] sm:max-w-[72%] ${mine ? "items-end" : "items-start"}`}>
        {/* nama + waktu */}
        <div className={`flex items-center gap-1.5 px-1 ${mine ? "flex-row-reverse" : ""}`}>
          <span className="font-head text-[11px] font-bold leading-none" style={{ color: "var(--text-muted)" }}>
            {isKazu ? "Kazu" : msg.sender}
          </span>
          <span className="text-[9.5px] font-semibold leading-none opacity-60" style={{ color: "var(--text-muted)" }}>
            {timeAgo(msg.created_at)}
          </span>
          {isKazu && (
            <span
              className="inline-flex items-center gap-1 font-head text-[8.5px] font-bold tracking-wide px-1.5 py-px rounded-full border"
              style={{ borderColor: "#d4956a", background: "#fde8c8", color: "#a05a2c" }}
            >
              KAZU
              <Coffee size={10} strokeWidth={2.5} />
            </span>
          )}
        </div>

        {/* bubble */}
        <div
          className={
            mine
              ? "bg-peach border-[2.5px] border-cardline shadow-hard-sm rounded-[14px_14px_4px_14px] px-3 py-2 text-[13px] font-semibold leading-relaxed"
              : "card !py-2 !px-3 text-[13px] font-semibold leading-relaxed !rounded-[14px_14px_14px_4px]"
          }
          style={bubbleStyle}
        >
          {msg.body ? <div className="break-words whitespace-pre-wrap">{renderBody(msg.body)}</div> : null}
          {msg.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={msg.image_url}
              alt={`Lampiran dari ${msg.sender}`}
              loading="lazy"
              className="mt-1 first:mt-0 max-w-[240px] max-h-[260px] w-auto rounded-[10px] border-2 border-cardline cursor-zoom-in object-cover"
              onClick={() => onOpenImage(msg.image_url as string)}
            />
          )}
        </div>
      </div>

      {/* tombol reply — muncul saat hover (selalu samar di layar sentuh) */}
      {!isKazu && (
        <button
          className="btn-icon-sm max-lg:opacity-60 lg:opacity-0 lg:group-hover:opacity-100 mb-1"
          onClick={() => onReply(msg)}
          title="Balas pesan ini"
          aria-label="Balas pesan ini"
        >
          <Reply size={16} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
