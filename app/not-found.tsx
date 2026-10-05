import Link from "next/link";
import { Ghost, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="cafe-bg" />
      <div className="cafe-overlay" />
      <div className="card text-center max-w-[360px]">
        <div className="flex justify-center text-[var(--text-muted)]">
          <Ghost size={56} strokeWidth={2} className="animate-bouncy" />
        </div>
        <h1 className="font-head text-[24px] font-bold mt-2">404 — Halaman Hilang</h1>
        <p className="text-[13px] font-semibold text-[var(--text-muted)] mt-1 mb-4">
          Sepertinya halaman ini ada di dimensi lain. Yuk balik ke kafe!
        </p>
        <Link href="/" className="btn-primary">
          <Home size={16} strokeWidth={2.5} /> Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
