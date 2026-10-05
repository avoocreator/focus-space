"use client";

// ═════════════════════════════════════════════════════════════
//  ImageLightbox — layar penuh + background blur, klik / Esc
//  untuk menutup. Animasi pop via framer-motion.
// ═════════════════════════════════════════════════════════════

import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

type Props = {
  url: string | null;
  alt?: string;
  onClose: () => void;
};

export default function ImageLightbox({ url, alt, onClose }: Props) {
  useEffect(() => {
    if (!url) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [url, onClose]);

  return (
    <AnimatePresence>
      {url && (
        <motion.div
          className="fixed inset-0 z-[5000] flex items-center justify-center p-5 cursor-zoom-out"
          style={{ background: "rgba(44,26,14,0.72)", backdropFilter: "blur(7px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.img
            src={url}
            alt={alt || "Gambar chat"}
            className="max-w-[92vw] max-h-[88vh] w-auto h-auto object-contain rounded-[18px] border-[3px] border-cardline shadow-hard-xl cursor-default"
            initial={{ scale: 0.85, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="btn-header-icon absolute top-4 right-4 !w-10 !h-10 !text-[17px]"
            onClick={onClose}
            title="Tutup (Esc)"
            aria-label="Tutup gambar"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
