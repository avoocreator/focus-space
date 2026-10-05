"use client";

// ═════════════════════════════════════════════════════════════
//  QuizCreate — halaman /quiz/create (buat & edit kuis).
//  • Card 1: Generate soal via /api/gemini/quiz
//    (topik ATAU materi tempel, 5–15 soal, 3 tingkat)
//  • Card 2: Editor soal (meta + list soal + validasi inline)
//  • Simpan ke quiz_sets (butuh sesi — tamu anonymous pun boleh);
//    tanpa sesi sama sekali → simpan localStorage + banner.
//  ?edit={id} → mode edit (DB atau lokal "local-…").
// ═════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  FileText,
  Globe,
  Hammer,
  Leaf,
  Loader2,
  Lock,
  Package,
  Pencil,
  Plus,
  Save,
  Shuffle,
  Sparkles,
  Sprout,
  Trash2,
  TreePine,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { playSound } from "@/components/ui/sfx";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { cn, randomCode, shuffle } from "@/lib/utils";
import type { QuizQuestion, QuizSetDTO } from "@/lib/types";
import { deleteLocalSet, getLocalSet, saveLocalSet } from "./quiz-shared";

const EMOJIS = ["🎲", "📚", "🧠", "🔬", "🌍", "🏛️", "🧮", "🎨", "🎵", "🐶", "🍎", "⚡"];
const DIFFICULTIES = ["mudah", "sedang", "sulit"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

const emptyQuestion = (): QuizQuestion => ({ q: "", options: ["", "", "", ""], answer: 0, explain: "" });

export default function QuizCreate({ editId }: { editId?: string | null }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingSet, setLoadingSet] = useState(false);

  // meta
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🎲");
  const [topic, setTopic] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  // soal
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

  // AI generator
  const [sourceMode, setSourceMode] = useState<"topic" | "text">("topic");
  const [aiTopic, setAiTopic] = useState("");
  const [material, setMaterial] = useState("");
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("sedang");
  const [generating, setGenerating] = useState(false);

  const [saving, setSaving] = useState(false);

  // ── mode edit: muat set ──
  useEffect(() => {
    if (!editId) return;
    let alive = true;
    setLoadingSet(true);
    (async () => {
      let set: QuizSetDTO | null = null;
      if (editId.startsWith("local-")) {
        set = getLocalSet(editId);
      } else if (isSupabaseConfigured) {
        try {
          const sb = getSupabase();
          const { data } = await sb.from("quiz_sets").select("*").eq("id", editId).maybeSingle();
          set = (data as QuizSetDTO) ?? null;
        } catch {
          set = null;
        }
      }
      if (!alive) return;
      if (!set) {
        toast("error", "Kuis tidak ditemukan");
        router.replace("/quiz");
        return;
      }
      setEditingId(set.id);
      setTitle(set.title);
      setEmoji(set.emoji || "🎲");
      setTopic(set.topic || "");
      setIsPublic(set.is_public);
      setQuestions(
        (set.questions || []).map((q) => ({
          q: q.q,
          options: [...(q.options || [])].slice(0, 4),
          answer: clampIdx(q.answer),
          explain: q.explain || "",
        }))
      );
      if (set.topic) setAiTopic(set.topic);
      setLoadingSet(false);
    })();
    return () => {
      alive = false;
    };
  }, [editId, router, toast]);

  // ── validasi inline ──
  const questionValid = useCallback(
    (q: QuizQuestion) =>
      q.q.trim().length > 0 &&
      q.options.length === 4 &&
      q.options.every((o) => o.trim().length > 0),
    []
  );
  const errorCount = useMemo(
    () => questions.filter((q) => !questionValid(q)).length,
    [questions, questionValid]
  );

  // ── generator AI ──
  const generate = async () => {
    const hasTopic = sourceMode === "topic" && aiTopic.trim().length > 0;
    const hasText = sourceMode === "text" && material.trim().length > 0;
    if (!hasTopic && !hasText) {
      toast("error", sourceMode === "topic" ? "Isi topik dulu ya" : "Tempel materi dulu ya");
      return;
    }
    setGenerating(true);
    playSound("click");
    try {
      const res = await fetch("/api/gemini/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: sourceMode === "topic" ? aiTopic.trim() : undefined,
          text: sourceMode === "text" ? material.trim() : undefined,
          count,
          difficulty,
          language: "id",
        }),
      });
      const data = (await res.json().catch(() => null)) as { questions?: QuizQuestion[]; error?: string } | null;
      if (!res.ok || !data?.questions?.length) {
        toast("error", data?.error || "Gagal membuat kuis — coba lagi ya.");
        return;
      }
      setQuestions(data.questions);
      if (!title.trim()) setTitle(sourceMode === "topic" && aiTopic.trim() ? aiTopic.trim().slice(0, 60) : "Kuis dari Materi");
      if (!topic.trim() && sourceMode === "topic") setTopic(aiTopic.trim().slice(0, 60));
      playSound("success");
      toast("success", `${data.questions.length} soal siap! Rapikan di editor bawah ya`);
    } catch {
      toast("error", "Tidak bisa menghubungi server — cek koneksi lalu ulangi.");
    } finally {
      setGenerating(false);
    }
  };

  // ── editor helpers ──
  const updateQuestion = (idx: number, patch: Partial<QuizQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };
  const updateOption = (qIdx: number, oIdx: number, val: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIdx ? { ...q, options: q.options.map((o, j) => (j === oIdx ? val : o)) } : q))
    );
  };
  const removeQuestion = (idx: number) => {
    playSound("click");
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };
  const addManual = () => {
    playSound("click");
    setQuestions((prev) => [...prev, emptyQuestion()]);
  };
  const shuffleOrder = () => {
    playSound("click");
    setQuestions((prev) => shuffle(prev));
  };

  const canSaveToDb = !!user && isSupabaseConfigured;

  // ── simpan ──
  const saveToDb = async () => {
    if (!user) return;
    if (!title.trim()) {
      toast("error", "Beri judul kuis dulu ya");
      return;
    }
    if (questions.length === 0) {
      toast("error", "Minimal 1 soal dulu ya");
      return;
    }
    if (errorCount > 0) {
      toast("error", `${errorCount} soal belum lengkap — lengkapi yang bertanda merah`);
      return;
    }
    setSaving(true);
    try {
      const sb = getSupabase();
      const payload = {
        host_id: user.id,
        host_name: profile?.display_name || "Anonim",
        title: title.trim().slice(0, 60),
        topic: topic.trim() || null,
        emoji,
        questions,
        is_public: isPublic,
      };
        if (editingId && !editingId.startsWith("local-")) {
          const { error } = await sb.from("quiz_sets").update(payload).eq("id", editingId);
          if (error) throw error;
        } else {
          const { error } = await sb.from("quiz_sets").insert(payload).select().single();
          if (error) throw error;
          if (editingId?.startsWith("local-")) {
            // versi lokal naik kelas ke DB — hapus lokalnya
            deleteLocalSet(editingId);
          }
        }
      playSound("success");
      toast("success", "Kuis tersimpan!");
      router.push("/quiz");
    } catch {
      setSaving(false);
      toast("error", "Gagal menyimpan ke database (butuh sesi login — tamu pun boleh)");
    }
  };

  const saveLocally = () => {
    if (!title.trim()) {
      toast("error", "Beri judul kuis dulu ya");
      return;
    }
    if (questions.length === 0 || errorCount > 0) {
      toast("error", "Lengkapi soal dulu ya");
      return;
    }
    const id = editingId && editingId.startsWith("local-") ? editingId : `local-${randomCode(8)}`;
    const set: QuizSetDTO = {
      id,
      host_id: null,
      host_name: profile?.display_name || "Tamu",
      title: title.trim().slice(0, 60),
      topic: topic.trim() || null,
      emoji,
      questions,
      is_public: false,
      plays: editingId && editingId.startsWith("local-") ? (getLocalSet(editingId)?.plays ?? 0) : 0,
      created_at: new Date().toISOString(),
    };
    saveLocalSet(set);
    playSound("success");
    toast("success", "Kuis disimpan di perangkat ini");
    router.push("/quiz");
  };

  if (loadingSet) {
    return (
      <div className="flex flex-col gap-3 animate-fadeIn">
        <div className="skeleton h-[120px]" />
        <div className="skeleton h-[300px]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-slideUp">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <h1 className="font-head text-[20px] font-bold inline-flex items-center gap-2">
            {editingId ? (
              <>
                <Pencil size={20} strokeWidth={2.5} />
                Edit Kuis
              </>
            ) : (
              <>
                <Hammer size={20} strokeWidth={2.5} />
                Buat Kuis Baru
              </>
            )}
          </h1>
          <p className="text-[12px] font-semibold text-[var(--text-muted)]">
            Generate dengan AI, lalu rapikan sendiri — atau tulis manual semua.
          </p>
        </div>
        <Link href="/quiz" className="btn-secondary !py-2 !text-[12.5px] inline-flex items-center gap-1.5">
          <ArrowLeft size={14} strokeWidth={2.5} />
          Kembali
        </Link>
      </div>

      {!user && (
        <div className="card !p-3.5 !border-[var(--yellow-dark)]">
          <p className="text-[12.5px] font-semibold">
            Kamu belum punya sesi. Kuis bisa disimpan <b>di perangkat ini saja</b> (mode solo tetap jalan).
            Ingin simpan ke database & host bareng? Masuk dulu —{" "}
            <Link className="underline font-bold" href="/login" style={{ color: "var(--accent-deep)" }}>
              tamu anonymous pun boleh
            </Link>
            .
          </p>
        </div>
      )}

      {/* ══ CARD 1 — GENERATE AI ══ */}
      <div className="card">
        <div className="card-header">
          <span className="card-icon">
            <Bot size={20} strokeWidth={2.5} />
          </span>
          <h2 className="card-title">Generate dengan AI</h2>
          <span className="chip !text-[10px] inline-flex items-center gap-0.5">
            <Sparkles size={11} strokeWidth={2.5} />
            Gemini
          </span>
        </div>

        {sourceMode === "topic" ? (
          <>
            <label className="form-label">Topik kuis</label>
            <input
              className="text-input"
              placeholder="mis. Fotosintesis, Sejarah Kemerdekaan, Kecerdasan Buatan…"
              value={aiTopic}
              maxLength={120}
              onChange={(e) => setAiTopic(e.target.value)}
            />
            <button
              className="btn-icon-sm mt-1.5 !text-[12px] font-bold inline-flex items-center gap-1.5"
              onClick={() => setSourceMode("text")}
            >
              <Package size={13} strokeWidth={2.5} />
              Dari materi tempel
            </button>
          </>
        ) : (
          <>
            <label className="form-label">Materi pelajaranmu</label>
            <textarea
              className="text-input min-h-[110px] resize-y"
              placeholder="Tempel catatan/materi pelajaranmu di sini — AI akan menyusun soal darinya…"
              value={material}
              maxLength={6000}
              onChange={(e) => setMaterial(e.target.value)}
            />
            <div className="flex items-center justify-between mt-1">
              <button
                className="btn-icon-sm !text-[12px] font-bold inline-flex items-center gap-1.5"
                onClick={() => setSourceMode("topic")}
              >
                <Pencil size={13} strokeWidth={2.5} />
                Ganti ke topik
              </button>
              <span className="text-[10.5px] font-bold text-[var(--text-muted)]">
                {material.length}/6000
              </span>
            </div>
          </>
        )}

        <div className="grid sm:grid-cols-[1fr_auto] gap-3 mt-3 items-end">
          <div>
            <label className="form-label">Jumlah soal: <b>{count}</b></label>
            <input
              type="range"
              min={5}
              max={15}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="cozy-slider"
            />
            <div className="flex justify-between text-[10px] font-bold text-[var(--text-muted)] mt-0.5">
              <span>5</span>
              <span>15</span>
            </div>
          </div>
          <div>
            <label className="form-label">Tingkat</label>
            <div className="flex gap-1.5">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  className={cn("chip chip-click", difficulty === d && "chip-active")}
                  onClick={() => setDifficulty(d)}
                >
                  <span className="inline-flex items-center gap-1">
                    {d === "mudah" ? (
                      <Sprout size={12} strokeWidth={2.5} />
                    ) : d === "sedang" ? (
                      <Leaf size={12} strokeWidth={2.5} />
                    ) : (
                      <TreePine size={12} strokeWidth={2.5} />
                    )}
                    {d}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button className="btn-primary w-full mt-4 relative overflow-hidden" onClick={generate} disabled={generating}>
          {generating ? (
            <>
              <motion.span
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)",
                  backgroundSize: "200% 100%",
                }}
                animate={{ backgroundPosition: ["-200% 0", "200% 0"] }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
              />
              <span className="relative inline-flex items-center justify-center gap-2">
                <Loader2 size={15} strokeWidth={2.5} className="animate-spin" />
                Gemini sedang berpikir…
              </span>
            </>
          ) : (
            <span className="relative inline-flex items-center justify-center gap-1.5">
              <Sparkles size={15} strokeWidth={2.5} />
              Buat Kuis
            </span>
          )}
        </button>
      </div>

      {/* ══ CARD 2 — EDITOR ══ */}
      <div className="card">
        <div className="card-header">
          <span className="card-icon">
            <Pencil size={20} strokeWidth={2.5} />
          </span>
          <h2 className="card-title">Editor Soal</h2>
          {errorCount > 0 && (
            <span className="chip !text-[10.5px] !py-1 inline-flex items-center gap-1" style={{ background: "var(--red)", color: "#fff" }}>
              <AlertTriangle size={11} strokeWidth={2.5} />
              {errorCount} soal belum lengkap
            </span>
          )}
        </div>

        {/* meta */}
        <div className="grid sm:grid-cols-[1fr_auto] gap-3 mb-4">
          <div className="flex flex-col gap-2.5">
            <div>
              <label className="form-label">Judul ({title.length}/60)</label>
              <input
                className={cn("text-input", !title.trim() && questions.length > 0 && "!border-[var(--red)]")}
                placeholder="mis. Kuis Seru Fotosintesis"
                value={title}
                maxLength={60}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Topik (opsional)</label>
              <input
                className="text-input"
                placeholder="mis. Biologi SMA"
                value={topic}
                maxLength={60}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="form-label">Emoji</label>
            <div className="grid grid-cols-4 gap-1 w-[164px]">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  className={cn("text-[17px] py-1 rounded-[8px] transition-all", e === emoji && "scale-110")}
                  style={{
                    background: e === emoji ? "var(--yellow)" : "var(--warm-white)",
                    border: `2px solid ${e === emoji ? "var(--card-border)" : "rgba(44,26,14,0.15)"}`,
                  }}
                  onClick={() => setEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
            <button
              className={cn("chip chip-click mt-2", isPublic && "chip-active")}
              onClick={() => setIsPublic((v) => !v)}
              title="Kuis publik tampil di tab Publik semua orang"
            >
              {isPublic ? (
                <span className="inline-flex items-center gap-1">
                  <Globe size={12} strokeWidth={2.5} />
                  Publik
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Lock size={12} strokeWidth={2.5} />
                  Privat
                </span>
              )}
            </button>
          </div>
        </div>

        <hr className="divider-dashed my-3" />

        {/* list soal */}
        {questions.length === 0 ? (
          <div className="text-center py-8">
            <div className="flex justify-center animate-floaty text-[var(--text-muted)]">
              <FileText size={36} strokeWidth={2.5} />
            </div>
            <p className="font-head font-bold mt-1">Belum ada soal</p>
            <p className="text-[12px] font-semibold text-[var(--text-muted)]">
              Generate dengan AI di atas, atau tambah manual.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {questions.map((q, idx) => (
                <motion.div
                  key={idx}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  className="rounded-[14px] p-3.5"
                  style={{
                    background: "var(--warm-white)",
                    border: `2.5px solid ${questionValid(q) ? "rgba(44,26,14,0.12)" : "var(--red)"}`,
                    boxShadow: questionValid(q) ? "var(--shadow-sm)" : "3px 3px 0 var(--red)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="chip !text-[11px] !py-0.5">Soal {idx + 1}</span>
                    <div className="flex-1" />
                    <button
                      className="btn-icon-sm"
                      title="Hapus soal"
                      onClick={() => removeQuestion(idx)}
                    >
                      <Trash2 size={14} strokeWidth={2.5} />
                    </button>
                  </div>

                  <input
                    className={cn("text-input !mb-2", !q.q.trim() && "!border-[var(--red)]")}
                    placeholder={`Pertanyaan ${idx + 1}…`}
                    value={q.q}
                    maxLength={240}
                    onChange={(e) => updateQuestion(idx, { q: e.target.value })}
                  />

                  <div className="grid sm:grid-cols-2 gap-2">
                    {q.options.map((opt, oIdx) => {
                      const isAnswer = q.answer === oIdx;
                      return (
                        <div key={oIdx} className="flex items-center gap-1.5">
                          <button
                            className="btn-ctrl !w-[34px] !h-[34px] !text-[13px] flex-shrink-0"
                            style={
                              isAnswer
                                ? { background: "var(--green)", color: "#fff", borderColor: "var(--card-border)" }
                                : undefined
                            }
                            title="Tandai sebagai jawaban benar"
                            onClick={() => updateQuestion(idx, { answer: oIdx })}
                          >
                            {isAnswer ? "✓" : String.fromCharCode(65 + oIdx)}
                          </button>
                          <input
                            className={cn("text-input !py-2", !opt.trim() && "!border-[var(--red)]", isAnswer && "!border-[var(--green)]")}
                            placeholder={`Opsi ${String.fromCharCode(65 + oIdx)}${isAnswer ? " (benar ✓)" : ""}`}
                            value={opt}
                            maxLength={120}
                            onChange={(e) => updateOption(idx, oIdx, e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <textarea
                    className="text-input min-h-[44px] !py-2 mt-2 resize-y"
                    placeholder="Penjelasan (opsional) — muncul saat pembahasan"
                    value={q.explain || ""}
                    maxLength={300}
                    onChange={(e) => updateQuestion(idx, { explain: e.target.value })}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          <button className="btn-secondary !py-2 !text-[12.5px] inline-flex items-center gap-1" onClick={addManual}>
            <Plus size={14} strokeWidth={2.5} />
            Soal Manual
          </button>
          <button
            className="btn-secondary !py-2 !text-[12.5px] inline-flex items-center gap-1.5"
            onClick={shuffleOrder}
            disabled={questions.length < 2}
          >
            <Shuffle size={14} strokeWidth={2.5} />
            Acak Urutan
          </button>
          <div className="flex-1" />
          <button
            className="btn-primary inline-flex items-center gap-1.5"
            onClick={saveToDb}
            disabled={saving || !canSaveToDb}
            title={canSaveToDb ? "Simpan ke database" : "login dulu (tamu pun boleh)"}
          >
            {saving ? (
              "Menyimpan…"
            ) : (
              <>
                <Save size={15} strokeWidth={2.5} />
                Simpan Kuis
              </>
            )}
          </button>
          {!canSaveToDb && (
            <button
              className="btn-yellow inline-flex items-center gap-1.5"
              onClick={saveLocally}
              title="Simpan di localStorage perangkat ini"
            >
              <Save size={15} strokeWidth={2.5} />
              Simpan di Perangkat Ini
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function clampIdx(n: number): number {
  return Number.isInteger(n) && n >= 0 && n <= 3 ? n : 0;
}
