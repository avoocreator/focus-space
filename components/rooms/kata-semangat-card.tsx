"use client";

// ═════════════════════════════════════════════════════════════
//  KataSemangatCard — quote harian cozy + tombol acak (RotateCcw).
// ═════════════════════════════════════════════════════════════

import React, { useState } from "react";
import { RotateCcw, Sparkle } from "lucide-react";
import { QUOTES, quoteOfTheDay } from "@/lib/quotes";

export default function KataSemangatCard() {
  const [quote, setQuote] = useState<string>(() => quoteOfTheDay());

  const shuffle = () => {
    if (QUOTES.length < 2) return;
    let next = quote;
    while (next === quote) {
      next = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    }
    setQuote(next);
  };

  return (
    <div className="card !bg-peach !py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="micro-title inline-flex items-center gap-1">
          <Sparkle size={13} strokeWidth={2.5} />
          Kata Semangat
        </span>
        <button className="btn-icon-sm !text-[15px]" onClick={shuffle} title="Quote acak lain">
          <RotateCcw size={15} strokeWidth={2.5} />
        </button>
      </div>
      <p className="text-[12.5px] font-semibold italic leading-snug">{quote}</p>
    </div>
  );
}
