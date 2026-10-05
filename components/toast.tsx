"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, AlertTriangle, Lightbulb } from "lucide-react";

export type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; text: string };

const ToastCtx = createContext<{ toast: (kind: ToastKind, text: string) => void }>({
  toast: () => {},
});

export const useToast = () => useContext(ToastCtx);

const KIND_STYLE = {
  success: { bg: "var(--green)", Icon: Check },
  error: { bg: "var(--red)", Icon: AlertTriangle },
  info: { bg: "var(--yellow)", Icon: Lightbulb },
} as const;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((kind: ToastKind, text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-5 right-5 z-[6000] flex flex-col gap-2 max-w-[280px]">
        <AnimatePresence>
          {toasts.map((t) => {
            const { Icon } = KIND_STYLE[t.kind];
            return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 26 }}
              className="card !py-2.5 !px-3.5 flex items-center gap-2.5"
              style={{ boxShadow: "var(--shadow-md)" }}
            >
              <span
                className="flex items-center justify-center w-7 h-7 rounded-full border-2 flex-shrink-0"
                style={{
                  background: KIND_STYLE[t.kind].bg,
                  borderColor: "var(--card-border)",
                  color: t.kind === "info" ? "var(--text-main)" : "#fff",
                }}
              >
                <Icon size={14} strokeWidth={2.5} />
              </span>
              <span className="text-[13px] font-semibold leading-snug">{t.text}</span>
            </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
