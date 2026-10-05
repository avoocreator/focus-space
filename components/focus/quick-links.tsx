"use client";

// ═══════════════════════════════════════════════════════
//  QUICK LINKS — pintasan ke fitur lain.
//  Grid 2x2, stagger entrance, hover: naik + shadow membesar
//  + emoji wiggle.
// ═══════════════════════════════════════════════════════

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Dices, DoorOpen, Gamepad2, Headphones, Map } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { playSound } from "@/components/ui/sfx";

const LINKS: Array<{ href: string; icon: LucideIcon; color: string; title: string; desc: string }> = [
  { href: "/music", icon: Headphones, color: "var(--accent)", title: "Musik", desc: "Hujan + lofi = fokus maksimal" },
  { href: "/rooms", icon: DoorOpen, color: "var(--green-dark)", title: "Ruangan", desc: "Belajar bareng di kafe virtual" },
  { href: "/quiz", icon: Dices, color: "var(--blue-dark)", title: "Kuis", desc: "Uji otak, kalahkan temanmu!" },
  { href: "/games", icon: Gamepad2, color: "var(--red-dark)", title: "Games", desc: "Rehat sebentar, isi bensin otak" },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 14, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 260, damping: 22 },
  },
};

export default function QuickLinks() {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  return (
    <section>
      <p className="micro-title mb-2 flex items-center gap-1.5">
        <Map size={12} strokeWidth={2.5} aria-hidden="true" />
        Jelajah FocusSpace
      </p>
      <motion.div
        className="grid grid-cols-2 gap-2.5"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {LINKS.map((l, i) => (
          <motion.div
            key={l.href}
            variants={item}
            whileHover={{ y: -3 }}
            onHoverStart={() => setHoverIdx(i)}
            onHoverEnd={() => setHoverIdx(null)}
          >
            <Link
              href={l.href}
              onClick={() => playSound("click")}
              className="card card-hover !p-3 flex flex-col gap-0.5 h-full"
            >
              <motion.span
                className="w-[34px] h-[34px] rounded-full border-2 flex items-center justify-center flex-shrink-0"
                style={{
                  background: "var(--warm-white)",
                  borderColor: "var(--card-border)",
                  color: l.color,
                  boxShadow: "var(--shadow-sm)",
                }}
                animate={hoverIdx === i ? { rotate: [0, -12, 12, 0] } : { rotate: 0 }}
                transition={{ duration: 0.45 }}
              >
                <l.icon size={18} strokeWidth={2.5} />
              </motion.span>
              <span className="font-head text-[14px] font-bold mt-1">{l.title}</span>
              <span className="text-[10.5px] font-semibold text-[var(--text-muted)] leading-tight">
                {l.desc}
              </span>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
