"use client";

// ═════════════════════════════════════════════════════════════
//  RoomMembersCard — daftar anggota online di ruangan (presence).
//  Owner ruangan (dari study_rooms.owner_id) dapat chip Crown.
// ═════════════════════════════════════════════════════════════

import React from "react";
import { Crown, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type RoomMember = {
  user_id: string;
  name: string;
  avatar: string;
  status: string;
};

type Props = {
  members: RoomMember[];
  myUserId: string;
  ownerId: string | null;
  ownerName: string | null;
};

export default function RoomMembersCard({ members, myUserId, ownerId, ownerName }: Props) {
  return (
    <div className="card !py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="micro-title inline-flex items-center gap-1">
          <Users size={13} strokeWidth={2.5} />
          Anggota
        </span>
        <span className="chip !text-[10px] !py-0.5">
          <span
            className="inline-block h-2 w-2 rounded-full flex-shrink-0"
            style={{ background: "var(--green)" }}
            aria-hidden
          />
          {members.length} online
        </span>
      </div>

      <div className="flex flex-col gap-1.5 max-h-[190px] overflow-y-auto pr-0.5">
        {members.length === 0 ? (
          <p className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
            Sepi banget… kamu orang pertama di sini
          </p>
        ) : (
          members.map((m) => (
            <div
              key={m.user_id}
              className={cn(
                "flex items-center gap-2 bg-warmwhite border-2 border-cardline rounded-[12px] px-2 py-1.5",
                m.user_id === myUserId && "bg-peach"
              )}
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              <span className="badge-emoji !w-[26px] !h-[26px] !text-[13px]">{m.avatar}</span>
              <span className="font-head text-[12.5px] font-semibold truncate flex-1">
                {m.name}
                {m.user_id === myUserId && <span className="opacity-60"> (kamu)</span>}
              </span>
              {m.user_id === ownerId && (
                <span className="chip !text-[9px] !py-0 !px-2">
                  <Crown size={10} strokeWidth={2.5} />
                  Owner
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {ownerName && (
        <p className="text-[10px] font-semibold mt-2 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
          <Crown size={11} strokeWidth={2.5} />
          Dibuat oleh {ownerName}
        </p>
      )}
    </div>
  );
}
