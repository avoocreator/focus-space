"use client";

// ═══════════════════════════════════════════════════════
//  QUOTE CARD — "Kata Semangat"
//  Kutipan harian (quoteOfTheDay) + ganti acak dengan
//  animasi fade (AnimatePresence mode="wait").
// ═══════════════════════════════════════════════════════

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lightbulb, RefreshCw } from "lucide-react";
import { playSound } from "@/components/ui/sfx";
import { QUOTES, quoteOfTheDay } from "@/lib/quotes";

export default function QuoteCard() {
  const [quote, setQuote] = useState<string>(quoteOfTheDay);

  const shuffleQuote = () => {
    playSound("click");
    setQuote((prev) => {
      let next = prev;
      for (let guard = 0; next === prev && guard < QUOTES.length; guard++) {
        next = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      }
      return next;
    });
  };

  return (
    <section
      className="card"
      style={{
        background: "var(--warm-white)",
        borderStyle: "dashed",
        borderColor: "var(--peach-dark)",
      }}
    >
      <div className="card-header !mb-2">
        <p className="micro-title flex-1 flex items-center gap-1.5">
          <Lightbulb size={12} strokeWidth={2.5} aria-hidden="true" />
          Kata Semangat
        </p>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={shuffleQuote}
          className="btn-icon-sm !text-[13px] !opacity-100 flex items-center gap-1 font-head font-bold !text-[10.5px]"
          title="Kutipan lain"
          aria-label="Ganti kutipan"
        >
          Kutipan lain <RefreshCw size={11} strokeWidth={3} />
        </motion.button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={quote}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="text-[13px] font-semibold leading-relaxed"
          style={{ color: "var(--text-main)" }}
        >
          {quote}
        </motion.p>
      </AnimatePresence>
    </section>
  );
}
