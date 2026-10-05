// ═════════════════════════════════════════════════════════════
//  API /api/gemini/quiz — generator kuis AI untuk Arena Kuis 🎲
//  Server-side (Node runtime): GEMINI_API_KEY TIDAK PERNAH
//  dikirim ke browser. Klien kirim {topic?|text?, count,
//  difficulty, language} dan menerima {questions: QuizQuestion[]}.
//  Output diparse ketat & dinormalisasi — item rusak dibuang.
// ═════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import type { QuizQuestion } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_COUNT = 5;
const MAX_COUNT = 15;
const MIN_VALID = 3;
const MAX_TEXT_CHARS = 6000;

const DIFFICULTIES = ["mudah", "sedang", "sulit"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

type ParsedBody = {
  topic: string;
  text: string;
  count: number;
  difficulty: Difficulty;
  language: string;
};

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

/** Validasi & normalisasi body request tanpa `any`. */
function parseBody(raw: unknown): ParsedBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const topic = typeof r.topic === "string" ? r.topic.trim().slice(0, 200) : "";
  const text = typeof r.text === "string" ? r.text.trim().slice(0, MAX_TEXT_CHARS) : "";
  if (!topic && !text) return null; // harus ada topic ATAU text

  let count = 5;
  if (typeof r.count === "number" && Number.isFinite(r.count)) {
    count = Math.round(r.count);
  }
  count = Math.min(MAX_COUNT, Math.max(MIN_COUNT, count));

  const difficulty: Difficulty = DIFFICULTIES.includes(r.difficulty as Difficulty)
    ? (r.difficulty as Difficulty)
    : "sedang";

  const language =
    typeof r.language === "string" && r.language.trim() ? r.language.trim().slice(0, 30) : "id";

  return { topic, text, count, difficulty, language };
}

function buildPrompt(body: ParsedBody): string {
  const lines: string[] = [];
  lines.push(
    `Kamu pembuat kuis edukatif yang kreatif. Buatkan ${body.count} soal pilihan ganda yang menarik dalam bahasa "${body.language}".`
  );
  if (body.topic) {
    lines.push(`Topik kuis: "${body.topic}".`);
  } else {
    lines.push(`Buat soal BERDASARKAN materi pelajaran berikut (fokus pada poin pentingnya):\n"""\n${body.text}\n"""`);
  }
  lines.push(`Tingkat kesulitan: ${body.difficulty}.`);
  lines.push(
    "ATURAN WAJIB untuk SETIAP soal:",
    '1. "q": pertanyaan yang jelas dan spesifik (jangan ambigu).',
    '2. "options": TEPAT 4 string pilihan jawaban, panjangnya seimbang. Jangan pakai pilihan "semua benar" / "tidak ada yang benar".',
    '3. "answer": index 0-3 yang menunjuk jawaban benar di "options".',
    '4. "explain": 1 kalimat singkat menjelaskan kenapa jawaban itu benar.',
    "5. VARIASIKAN posisi index jawaban benar — jangan menumpuk di satu index yang sama.",
    `6. Output HANYA JSON murni berupa array of object {q, options, answer, explain} — TANPA markdown, TANPA penjelasan lain.`
  );
  return lines.join("\n");
}

/**
 * Ekstrak JSON dari balasan model: buang fence ```json … ``` bila ada,
 * lalu coba parse; gagal → potong dari "[" pertama ke "]" terakhir.
 */
function extractJson(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) t = fence[1].trim();
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf("[");
    const end = t.lastIndexOf("]");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1));
      } catch {
        /* lanjut → null */
      }
    }
    return null;
  }
}

/** Normalisasi tiap item: buang yang rusak, kembalikan yang valid saja. */
function normalizeQuestions(raw: unknown, max: number): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  if (!Array.isArray(raw)) return out;
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const it = item as Record<string, unknown>;

    const q = typeof it.q === "string" ? it.q.trim() : "";
    if (!q) continue;

    if (!Array.isArray(it.options) || it.options.length !== 4) continue;
    const options: string[] = [];
    let optsOk = true;
    for (const o of it.options) {
      if (typeof o !== "string" || !o.trim()) {
        optsOk = false;
        break;
      }
      options.push(o.trim());
    }
    if (!optsOk) continue;

    const answer =
      typeof it.answer === "number" && Number.isInteger(it.answer) && it.answer >= 0 && it.answer <= 3
        ? it.answer
        : -1;
    if (answer < 0) continue;

    const explain = typeof it.explain === "string" && it.explain.trim() ? it.explain.trim() : undefined;
    out.push({ q, options, answer, explain });
    if (out.length >= max) break;
  }
  return out;
}

function friendlyUpstreamError(status: number): string {
  if (status === 429)
    return "Gemini kecapekan sebentar ☕ (rate limit) — coba lagi dalam semenit ya.";
  if (status === 403 || status === 401) return "GEMINI_API_KEY tidak valid — cek /setup ya ⚙️.";
  if (status === 400) return "Prompt kuis ditolak Gemini 😅 — coba topik/materi yang lain.";
  return "Gemini sedang istirahat ☕ — coba lagi nanti ya.";
}

export async function POST(req: Request): Promise<NextResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY belum diset — lihat /setup" },
      { status: 500 }
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Request tidak valid 😅" }, { status: 400 });
  }

  const body = parseBody(raw);
  if (!body) {
    return NextResponse.json(
      { error: "Isi topik dulu atau tempel materi pelajaranmu 📝" },
      { status: 400 }
    );
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ parts: [{ text: buildPrompt(body) }] }],
    generationConfig: { temperature: 0.9, responseMimeType: "application/json" },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => null)) as GeminiResponse | null;

    if (!res.ok) {
      console.error("[gemini/quiz] upstream error", res.status, data?.error?.message ?? "");
      return NextResponse.json({ error: friendlyUpstreamError(res.status) }, { status: 500 });
    }

    const parts = data?.candidates?.[0]?.content?.parts;
    const text = (parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();

    if (!text) {
      const blocked = data?.promptFeedback?.blockReason ?? data?.candidates?.[0]?.finishReason;
      console.error("[gemini/quiz] empty reply", blocked ?? "");
      return NextResponse.json(
        { error: "Gemini bingung sebentar 😅 — coba ubah topik/materi lalu ulangi." },
        { status: 502 }
      );
    }

    const questions = normalizeQuestions(extractJson(text), body.count);
    if (questions.length < MIN_VALID) {
      return NextResponse.json(
        {
          error:
            "Gemini hanya menghasilkan soal yang tidak valid 😵 — coba lagi, atau ganti topik/materi ya.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ questions });
  } catch (err) {
    console.error("[gemini/quiz] fetch failed", err);
    return NextResponse.json(
      { error: "Gemini tidak bisa dihubungi ☕ — koneksi bermasalah, coba lagi ya." },
      { status: 500 }
    );
  }
}
